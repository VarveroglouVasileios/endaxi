/**
 * ΕΚΔΟΣΗ ΤΑΚΚ — αυτόματα, μετά την αναχώρηση.
 *
 * Το ειδικό στοιχείο εκδίδεται μετά τη διαμονή και πριν την αναχώρηση.
 * Πρακτικά: το εκδίδουμε την ημέρα της αναχώρησης.
 *
 * Inngest v4: triggers στο πρώτο όρισμα, event types από ../events.
 */

import { eq, and, sql } from 'drizzle-orm'
import { NonRetriableError, cron } from 'inngest'
import { inngest } from '../client'
import { takkIssueRequested, takkIssued, stayCancelled } from '../events'
import { useDatabase } from '../../database/client'
import { stays, takkDocuments, properties, users } from '../../database/schema'
import {
  issueTakkDocuments,
  cancelTakkDocument,
  NumberingError,
} from '../../utils/takk/numbering'

function athensDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Cron ημερήσιο: εκδίδει κάθε ολοκληρωμένο μηνιαίο τμήμα που λείπει.
 */
export const issueDueTakkDocuments = inngest.createFunction(
  {
    id: 'issue-due-takk-documents',
    triggers: [cron('TZ=Europe/Athens 0 20 * * *')], // 20:00 ώρα Ελλάδας
  },
  async ({ step }) => {
    const db = useDatabase()
    const today = athensDate()

    const due = await step.run('find-due-stays', async () =>
      db
        .select({ id: stays.id })
        .from(stays)
        .innerJoin(properties, eq(stays.propertyId, properties.id))
        .innerJoin(users, eq(properties.userId, users.id))
        .where(
          and(
            eq(stays.status, 'confirmed'),
            sql`${stays.nights} > 0`,
            // Μόνο ιδιώτες ≤2 ακίνητα — οι επιτηδευματίες θέλουν myDATA
            eq(users.taxRegime, 'individual_upto_2'),
            sql`EXISTS (
              SELECT 1
              FROM generate_series(
                date_trunc('month', ${stays.checkIn}::date),
                date_trunc(
                  'month',
                  LEAST(${stays.checkOut}::date - 1, ${today}::date - 1)
                ),
                interval '1 month'
              ) AS eligible(month_start)
              WHERE NOT EXISTS (
                SELECT 1
                FROM takk_documents AS issued
                WHERE issued.stay_id = ${stays.id}
                  AND issued.document_type = 'takk_receipt'
                  AND issued.remittance_period = to_char(eligible.month_start, 'YYYY-MM')
              )
            )`,
          ),
        )
        .limit(500),
    )

    if (due.length === 0) return { dispatched: 0 }

    await step.sendEvent(
      'dispatch-issuance',
      due.map((s) => takkIssueRequested.create({ stayId: s.id, asOfDate: today })),
    )

    return { dispatched: due.length }
  },
)

/** Έκδοση για μία διαμονή */
export const issueTakkForStay = inngest.createFunction(
  {
    id: 'issue-takk-for-stay',
    triggers: [takkIssueRequested],
    retries: 3,
    // Ένα ανά διαμονή — αποτρέπει διπλή αρίθμηση
    concurrency: { key: 'event.data.stayId', limit: 1 },
  },
  async ({ event, step }) => {
    const db = useDatabase()

    // Διαμονή που διασχίζει μήνες παράγει ΠΟΛΛΑ παραστατικά
    const docs = await step.run('issue-documents', async () => {
      try {
        return await issueTakkDocuments(db, {
          stayId: event.data.stayId,
          asOfDate: event.data.asOfDate,
        })
      } catch (e) {
        // Λάθη λογικής δεν επαναλαμβάνονται
        if (e instanceof NumberingError) throw new NonRetriableError(e.message)
        throw e
      }
    })

    if (docs.length > 0) {
      await step.sendEvent(
        'emit-issued',
        docs.map((d) => takkIssued.create({ documentId: d.id })),
      )
    }

    return { count: docs.length, documents: docs }
  },
)

/**
 * Ακύρωση διαμονής μετά την έκδοση ΤΑΚΚ
 * → έκδοση ΑΝΤΙΛΟΓΙΣΤΙΚΟΥ, ποτέ διαγραφή.
 */
export const handleStayCancellation = inngest.createFunction(
  {
    id: 'handle-stay-cancellation',
    triggers: [stayCancelled],
    retries: 3,
    concurrency: { key: 'event.data.stayId', limit: 1 },
  },
  async ({ event, step }) => {
    const db = useDatabase()

    const existing = await step.run('find-issued-documents', async () =>
      db
        .select()
        .from(takkDocuments)
        .where(
          and(
            eq(takkDocuments.stayId, event.data.stayId),
            eq(takkDocuments.documentType, 'takk_receipt'),
          ),
        )
    )

    if (existing.length === 0) {
      return { action: 'none', reason: 'Δεν είχε εκδοθεί παραστατικό' }
    }

    const cancellations = await step.run('issue-cancellations', async () => {
      const created = []
      for (const document of existing) {
        const [alreadyCancelled] = await db
          .select({ id: takkDocuments.id })
          .from(takkDocuments)
          .where(eq(takkDocuments.cancelsDocumentId, document.id))
          .limit(1)
        if (alreadyCancelled) continue

        try {
          created.push(
            await cancelTakkDocument(
              db,
              document.id,
              'Ακύρωση κράτησης μετά από επιβεβαιωμένο έλεγχο',
            ),
          )
        } catch (e) {
          if (e instanceof NumberingError) throw new NonRetriableError(e.message)
          throw e
        }
      }
      return created
    })

    if (cancellations.length > 0) {
      await step.sendEvent(
        'emit-cancellations',
        cancellations.map(document => takkIssued.create({ documentId: document.id })),
      )
    }

    return { action: 'cancelled', documents: cancellations }
  },
)
