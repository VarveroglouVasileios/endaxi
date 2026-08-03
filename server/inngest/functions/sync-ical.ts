/**
 * iCal SYNC — ο μηχανισμός που κάνει το προϊόν «zero effort».
 *
 * Τρέχει κάθε 2 ώρες. Ο χρήστης δεν κάνει τίποτα ποτέ μετά το setup.
 *
 * Inngest v4: τα triggers ζουν μέσα στο πρώτο όρισμα του createFunction.
 */

import { eq, and, sql } from 'drizzle-orm'
import { NonRetriableError, cron } from 'inngest'
import { inngest } from '../client'
import { icalSyncRequested, stayCreated } from '../events'
import { useDatabase } from '../../database/client'
import { icalSources, stays, takkDocuments } from '../../database/schema'
import { fetchPublicText, PublicFetchError } from '../../utils/http/safe-public-fetch'
import { parseIcalFeed, diffStays } from '../../utils/ical/parser'
import { countNights } from '../../utils/takk/calculator'

const MAX_ICAL_BYTES = 5 * 1024 * 1024

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
    onFailure: async ({ event }) => {
      const originalEvent = event.data.event
      const icalSourceId = originalEvent.data.icalSourceId
      if (typeof icalSourceId !== 'string') return

      const db = useDatabase()
      await db
        .update(icalSources)
        .set({
          lastSyncStatus: 'failed',
          lastSyncError: 'Η λήψη ή επεξεργασία του ημερολογίου απέτυχε.',
          consecutiveFailures: sql`${icalSources.consecutiveFailures} + 1`,
        })
        .where(
          and(
            eq(icalSources.id, icalSourceId),
            eq(icalSources.isActive, true),
          ),
        )
    },
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
      let res
      try {
        res = await fetchPublicText(source.url, {
          maxBytes: MAX_ICAL_BYTES,
          timeoutMs: 30_000,
          maxRedirects: 3,
        })
      } catch (error) {
        if (
          error instanceof PublicFetchError
          && ['bad_url', 'blocked_target', 'too_large', 'too_many_redirects'].includes(error.code)
        ) {
          throw new NonRetriableError(`Μη ασφαλές ή μη έγκυρο iCal feed (${error.code})`)
        }
        throw error
      }

      if (res.status < 200 || res.status >= 300) {
        // 404/410 = ο host άλλαξε/διέγραψε το link — μην ξαναπροσπαθείς
        if (res.status === 404 || res.status === 410) {
          throw new NonRetriableError(`Το iCal link δεν υπάρχει (${res.status})`)
        }
        throw new Error(`Αποτυχία λήψης feed: ${res.status}`)
      }

      if (!res.text.includes('BEGIN:VCALENDAR')) {
        throw new NonRetriableError('Η απόκριση δεν είναι έγκυρο iCal feed')
      }

      return res.text
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
      const updated: string[] = []
      const reviewRequired = new Set(diff.toCancel)
      for (const candidate of diff.toReview) reviewRequired.add(candidate.existingId)

      for (const ev of diff.toCreate) {
        // ΒΡΕΘΗΚΕ ΣΕ ΔΙΚΟ ΜΟΥ SECURITY AUDIT: countNights() πλέον απορρίπτει
        // ακραίες διάρκειες (βλ. MAX_STAY_NIGHTS, calculator.ts) — ένα ΕΝΑ
        // αλλοιωμένο event στο feed δεν πρέπει να ρίχνει ΟΛΟ αυτό το step
        // (και άρα να μπλοκάρει τις υπόλοιπες, έγκυρες κρατήσεις). Παράλειψε
        // μόνο το προβληματικό event.
        let nights: number
        try {
          nights = countNights(ev.checkIn, ev.checkOut)
        } catch (err) {
          console.error('[sync-ical]', {
            status: 'invalid_event_skipped',
            icalSourceId: source.id,
            uid: ev.uid,
            errorType: err instanceof Error ? err.message : 'UnknownError',
          })
          continue
        }
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
        const [issuedDocument] = await db
          .select({ id: takkDocuments.id })
          .from(takkDocuments)
          .where(
            and(
              eq(takkDocuments.stayId, u.existingId),
              eq(takkDocuments.documentType, 'takk_receipt'),
            ),
          )
          .limit(1)

        // Once a legal document exists, changing the stay requires an explicit
        // cancellation/replacement workflow. Never silently mutate its source.
        if (issuedDocument) {
          reviewRequired.add(u.existingId)
          continue
        }

        let nights: number
        try {
          nights = countNights(u.event.checkIn, u.event.checkOut)
        } catch (err) {
          console.error('[sync-ical]', {
            status: 'invalid_event_update_skipped',
            icalSourceId: source.id,
            existingId: u.existingId,
            errorType: err instanceof Error ? err.message : 'UnknownError',
          })
          reviewRequired.add(u.existingId)
          continue
        }
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
        updated.push(u.existingId)
      }

      await db
        .update(icalSources)
        .set({
          lastSyncedAt: new Date(),
          lastSyncStatus: reviewRequired.size > 0 ? 'review_required' : 'ok',
          lastSyncError: reviewRequired.size > 0
            ? 'Εντοπίστηκαν αλλαγές που χρειάζονται έλεγχο πριν ενημερωθούν παραστατικά.'
            : null,
          consecutiveFailures: 0,
        })
        .where(eq(icalSources.id, source.id))

      return { created, updated, reviewRequired: [...reviewRequired] }
    })

    // ── 6. Events για επόμενα βήματα ──
    if (applied.created.length > 0) {
      await step.sendEvent(
        'emit-created',
        applied.created.map((id) => stayCreated.create({ stayId: id })),
      )
    }

    return {
      created: applied.created.length,
      updated: applied.updated.length,
      reviewRequired: applied.reviewRequired.length,
      unchanged: diff.unchanged,
    }
  },
)
