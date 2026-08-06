/**
 * Διαμονές έτους — για καταχώρηση ποσού εισοδήματος.
 *
 * Χρησιμοποιεί το check-in για να κατατάξει τη διαμονή σε έτος (το
 * δηλωτέο εισόδημα δηλώνεται με βάση το φορολογικό έτος στο οποίο
 * εισπράχθηκε το ποσό — στην πράξη αυτό συμπίπτει σχεδόν πάντα με το
 * έτος της άφιξης).
 */

import { z } from 'zod'
import { eq, and, gte, lte, ne, desc, inArray, sql } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { stays, properties, takkDocuments } from '../../database/schema'

const querySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2024)
    .max(2100)
    .default(() => new Date().getFullYear()),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const { year } = await getValidatedQuery(event, querySchema.parse)

  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const rows = await db
    .select({
      id: stays.id,
      propertyId: stays.propertyId,
      propertyName: properties.name,
      checkIn: stays.checkIn,
      checkOut: stays.checkOut,
      nights: stays.nights,
      guestName: stays.guestName,
      status: stays.status,
      isComplimentary: stays.isComplimentary,
      grossAmountCents: stays.grossAmountCents,
      platformFeeCents: stays.platformFeeCents,
      payoutAmountCents: stays.payoutAmountCents,
      amountSource: stays.amountSource,
    })
    .from(stays)
    .innerJoin(properties, eq(stays.propertyId, properties.id))
    .where(
      and(
        eq(properties.userId, userId),
        ne(stays.status, 'cancelled'),
        ne(stays.status, 'blocked'),
        gte(stays.checkIn, from),
        lte(stays.checkIn, to),
      ),
    )
    .orderBy(desc(stays.checkIn))
    .limit(500)

  /**
   * ΣΥΝΔΕΣΗ ΜΕ ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ΤΑΚΚ: για κάθε διαμονή δείχνουμε αν έχει
   * ήδη εκδοθεί το ειδικό στοιχείο ΤΑΚΚ — έτσι ο host βλέπει στο ίδιο
   * σημείο και τα δύο πράγματα που πρέπει να κάνει για μια κράτηση
   * (ΤΑΚΚ αυτόματο, εισόδημα χειροκίνητο) αντί να ψάχνει σε άλλη σελίδα.
   * Μία διαμονή μπορεί να έχει >1 παραστατικά αν διασχίζει μήνα.
   */
  const stayIds = rows.map(r => r.id)
  const docsByStay = new Map<
    string,
    { id: string; series: string; number: number; year: number; hasPdf: boolean }[]
  >()

  if (stayIds.length > 0) {
    const docs = await db
      .select({
        id: takkDocuments.id,
        stayId: takkDocuments.stayId,
        series: takkDocuments.series,
        number: takkDocuments.number,
        year: takkDocuments.year,
        hasPdf: sql<boolean>`${takkDocuments.pdfStorageKey} is not null`,
      })
      .from(takkDocuments)
      .where(
        and(
          inArray(takkDocuments.stayId, stayIds),
          eq(takkDocuments.documentType, 'takk_receipt'),
        ),
      )

    for (const d of docs) {
      if (!d.stayId) continue
      const list = docsByStay.get(d.stayId) ?? []
      list.push({ id: d.id, series: d.series, number: d.number, year: d.year, hasPdf: d.hasPdf })
      docsByStay.set(d.stayId, list)
    }
  }

  return rows.map(r => ({ ...r, documents: docsByStay.get(r.id) ?? [] }))
})
