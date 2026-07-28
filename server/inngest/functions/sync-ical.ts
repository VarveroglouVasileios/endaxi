/**
 * iCal SYNC — ο μηχανισμός που κάνει το προϊόν «zero effort».
 *
 * Τρέχει κάθε 2 ώρες. Ο χρήστης δεν κάνει τίποτα ποτέ μετά το setup.
 *
 * Inngest v4: τα triggers ζουν μέσα στο πρώτο όρισμα του createFunction.
 */

import { eq, and } from 'drizzle-orm'
import { NonRetriableError, cron } from 'inngest'
import { inngest } from '../client'
import { icalSyncRequested, stayCreated, stayCancelled } from '../events'
import { useDatabase } from '../../database/client'
import { icalSources, stays } from '../../database/schema'
import { parseIcalFeed, diffStays } from '../../utils/ical/parser'
import { countNights } from '../../utils/takk/calculator'

/** Cron: κάθε 2 ώρες, στέλνει sync event για κάθε ενεργή πηγή */
export const scheduleIcalSync = inngest.createFunction(
  {
    id: 'schedule-ical-sync',
    triggers: [cron('0 */2 * * *')],
  },
  async ({ step }) => {
    const db = useDatabase()

    const sources = await step.run('fetch-active-sources', async () =>
      db
        .select({ id: icalSources.id })
        .from(icalSources)
        .where(eq(icalSources.isActive, true)),
    )

    if (sources.length === 0) return { dispatched: 0 }

    await step.sendEvent(
      'dispatch-syncs',
      sources.map((s) => icalSyncRequested.create({ icalSourceId: s.id })),
    )

    return { dispatched: sources.length }
  },
)

/** Συγχρονισμός μίας πηγής */
export const syncIcalSource = inngest.createFunction(
  {
    id: 'sync-ical-source',
    triggers: [icalSyncRequested],
    retries: 3,
    // Ένα sync ανά πηγή τη φορά — αποφεύγει διπλές εγγραφές
    concurrency: { key: 'event.data.icalSourceId', limit: 1 },
  },
  async ({ event, step }) => {
    const db = useDatabase()
    const { icalSourceId } = event.data

    // ── 1. Φόρτωση πηγής ──
    const source = await step.run('load-source', async () => {
      const [row] = await db
        .select()
        .from(icalSources)
        .where(eq(icalSources.id, icalSourceId))
        .limit(1)

      if (!row) throw new NonRetriableError(`Δεν βρέθηκε πηγή ${icalSourceId}`)
      if (!row.isActive) throw new NonRetriableError('Η πηγή είναι ανενεργή')
      return row
    })

    // ── 2. Κατέβασμα feed ──
    const icsText = await step.run('fetch-feed', async () => {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Endaxi/1.0 (+https://endaxi.app)' },
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        // 404/410 = ο host άλλαξε/διέγραψε το link — μην ξαναπροσπαθείς
        if (res.status === 404 || res.status === 410) {
          throw new NonRetriableError(`Το iCal link δεν υπάρχει (${res.status})`)
        }
        throw new Error(`Αποτυχία λήψης feed: ${res.status}`)
      }

      return await res.text()
    })

    // ── 3. Parsing ──
    const events = await step.run('parse-feed', async () => parseIcalFeed(icsText))

    // ── 4. Diff με υπάρχοντα ──
    const diff = await step.run('compute-diff', async () => {
      const existing = await db
        .select({
          id: stays.id,
          externalUid: stays.externalUid,
          checkIn: stays.checkIn,
          checkOut: stays.checkOut,
          status: stays.status,
        })
        .from(stays)
        .where(
          and(
            eq(stays.propertyId, source.propertyId),
            eq(stays.icalSourceId, source.id),
          ),
        )

      return diffStays(existing, events)
    })

    // ── 5. Εφαρμογή ──
    const applied = await step.run('apply-diff', async () => {
      const created: string[] = []

      for (const ev of diff.toCreate) {
        const nights = countNights(ev.checkIn, ev.checkOut)
        if (nights === 0) continue // same-day, δεν παράγει ΤΑΚΚ

        const [row] = await db
          .insert(stays)
          .values({
            propertyId: source.propertyId,
            icalSourceId: source.id,
            externalUid: ev.uid,
            source: source.source,
            checkIn: ev.checkIn,
            checkOut: ev.checkOut,
            nights,
            guestName: ev.guestName,
            status: 'confirmed',
            rawPayload: ev.raw,
          })
          .onConflictDoNothing({
            target: [stays.propertyId, stays.externalUid],
          })
          .returning({ id: stays.id })

        if (row) created.push(row.id)
      }

      for (const u of diff.toUpdate) {
        const nights = countNights(u.event.checkIn, u.event.checkOut)
        await db
          .update(stays)
          .set({
            checkIn: u.event.checkIn,
            checkOut: u.event.checkOut,
            nights,
            guestName: u.event.guestName,
            rawPayload: u.event.raw,
            updatedAt: new Date(),
          })
          .where(eq(stays.id, u.existingId))
      }

      for (const stayId of diff.toCancel) {
        await db
          .update(stays)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(stays.id, stayId))
      }

      await db
        .update(icalSources)
        .set({
          lastSyncedAt: new Date(),
          lastSyncStatus: 'ok',
          lastSyncError: null,
          consecutiveFailures: 0,
        })
        .where(eq(icalSources.id, source.id))

      return { created, updated: diff.toUpdate.length, cancelled: diff.toCancel }
    })

    // ── 6. Events για επόμενα βήματα ──
    if (applied.created.length > 0) {
      await step.sendEvent(
        'emit-created',
        applied.created.map((id) => stayCreated.create({ stayId: id })),
      )
    }

    if (applied.cancelled.length > 0) {
      await step.sendEvent(
        'emit-cancelled',
        applied.cancelled.map((id) => stayCancelled.create({ stayId: id })),
      )
    }

    return {
      created: applied.created.length,
      updated: applied.updated,
      cancelled: applied.cancelled.length,
      unchanged: diff.unchanged,
    }
  },
)
