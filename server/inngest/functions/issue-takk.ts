/**
 * ΕΚΔΟΣΗ ΤΑΚΚ — αυτόματα, μετά την αναχώρηση.
 *
 * Το ειδικό στοιχείο εκδίδεται μετά τη διαμονή και πριν την αναχώρηση.
 * Πρακτικά: το εκδίδουμε την ημέρα της αναχώρησης.
 *
 * Inngest v4: triggers στο πρώτο όρισμα, event types από ../events.
 */

import { eq, and, lte, isNull, sql } from 'drizzle-orm'
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

/**
 * Cron ημερήσιο: εκδίδει ΤΑΚΚ για όσες διαμονές αναχωρούν σήμερα
 * και δεν έχουν ακόμα παραστατικό.
 */
export const issueDueTakkDocuments = inngest.createFunction(
  {
    id: 'issue-due-takk-documents',
    triggers: [cron('TZ=Europe/Athens 0 20 * * *')], // 20:00 ώρα Ελλάδας
  },
  async ({ step }) => {
    const db = useDatabase()
    const today = new Date().toISOString().slice(0, 10)

    const due = await step.run('find-due-stays', async () =>
      db
        .select({ id: stays.id })
        .from(stays)
        .innerJoin(properties, eq(stays.propertyId, properties.id))
        .innerJoin(users, eq(properties.userId, users.id))
        .leftJoin(
          takkDocuments,
          and(
            eq(takkDocuments.stayId, stays.id),
            eq(takkDocuments.documentType, 'takk_receipt'),
          ),
        )
        .where(
          and(
            eq(stays.status, 'confirmed'),
            lte(stays.checkOut, today),
            sql`${stays.nights} > 0`,
            isNull(takkDocuments.id),
            // Μόνο ιδιώτες ≤2 ακίνητα — οι επιτηδευματίες θέλουν myDATA
            eq(users.taxRegime, 'individual_upto_2'),
          ),
        )
        .limit(500),
    )

    if (due.length === 0) return { dispatched: 0 }

    await step.sendEvent(
      'dispatch-issuance',
      due.map((s) => takkIssueRequested.create({ stayId: s.id })),
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
        return await issueTakkDocuments(db, { stayId: event.data.stayId })
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
  },
  async ({ event, step }) => {
    const db = useDatabase()

    const existing = await step.run('find-issued-document', async () => {
      const [row] = await db
        .select()
        .from(takkDocuments)
        .where(
          and(
            eq(takkDocuments.stayId, event.data.stayId),
            eq(takkDocuments.documentType, 'takk_receipt'),
          ),
        )
        .limit(1)
      return row ?? null
    })

    if (!existing) return { action: 'none', reason: 'Δεν είχε εκδοθεί παραστατικό' }

    const cancellation = await step.run('issue-cancellation', async () => {
      try {
        return await cancelTakkDocument(
          db,
          existing.id,
          'Ακύρωση κράτησης — η διαμονή αφαιρέθηκε από το ημερολόγιο της πλατφόρμας',
        )
      } catch (e) {
        if (e instanceof NumberingError) throw new NonRetriableError(e.message)
        throw e
      }
    })

    return { action: 'cancelled', document: cancellation }
  },
)
