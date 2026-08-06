/**
 * Λίστα παραστατικών του χρήστη, ομαδοποιημένα ανά περίοδο απόδοσης.
 * Αυτό τροφοδοτεί το dashboard.
 */

import { z } from 'zod'
import { eq, desc, and, sql } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { takkDocuments, properties, stays } from '../../database/schema'
import { getRemittanceDeadline } from '../../utils/takk/calculator'

const querySchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  propertyId: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const q = await getValidatedQuery(event, querySchema.parse)

  const filters = [eq(properties.userId, userId)]
  if (q.period) filters.push(eq(takkDocuments.remittancePeriod, q.period))
  if (q.propertyId) filters.push(eq(takkDocuments.propertyId, q.propertyId))

  const rows = await db
    .select({
      id: takkDocuments.id,
      documentType: takkDocuments.documentType,
      series: takkDocuments.series,
      number: takkDocuments.number,
      year: takkDocuments.year,
      issuedAt: takkDocuments.issuedAt,
      propertyId: takkDocuments.propertyId,
      propertyName: takkDocuments.propertyName,
      propertyAma: takkDocuments.propertyAma,
      checkIn: takkDocuments.checkIn,
      checkOut: takkDocuments.checkOut,
      nights: takkDocuments.nights,
      guestName: takkDocuments.guestName,
      totalAmountCents: takkDocuments.totalAmountCents,
      remittancePeriod: takkDocuments.remittancePeriod,
      hasPdf: sql<boolean>`${takkDocuments.pdfStorageKey} is not null`,
      cancelsDocumentId: takkDocuments.cancelsDocumentId,
      /**
       * ΣΥΝΔΕΣΗ ΜΕ ΤΟ ΕΙΣΟΔΗΜΑ: δείχνουμε δίπλα σε κάθε παραστατικό ΤΑΚΚ
       * αν έχει καταχωρηθεί το δηλωτέο ποσό ενοικίου για την ίδια διαμονή
       * — έτσι ο host βλέπει με μια ματιά ποιες διαμονές έχουν εκκρεμότητα
       * και στα δύο (ΤΑΚΚ εκδόθηκε, αλλά εισόδημα λείπει).
       */
      stayId: takkDocuments.stayId,
      stayGrossAmountCents: stays.grossAmountCents,
    })
    .from(takkDocuments)
    .innerJoin(properties, eq(takkDocuments.propertyId, properties.id))
    .leftJoin(stays, eq(takkDocuments.stayId, stays.id))
    .where(and(...filters))
    .orderBy(desc(takkDocuments.remittancePeriod), desc(takkDocuments.number))
    .limit(500)

  // Ομαδοποίηση ανά περίοδο — έτσι το σκέφτεται ο χρήστης
  const byPeriod = new Map<
    string,
    { period: string; deadline: string; totalCents: number; documents: typeof rows }
  >()

  for (const r of rows) {
    let g = byPeriod.get(r.remittancePeriod)
    if (!g) {
      g = {
        period: r.remittancePeriod,
        deadline: getRemittanceDeadline(r.remittancePeriod),
        totalCents: 0,
        documents: [],
      }
      byPeriod.set(r.remittancePeriod, g)
    }
    g.totalCents += r.totalAmountCents
    g.documents.push(r)
  }

  return {
    periods: [...byPeriod.values()],
    total: rows.length,
  }
})
