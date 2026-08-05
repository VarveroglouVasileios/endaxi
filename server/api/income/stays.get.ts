/**
 * Διαμονές έτους — για καταχώρηση ποσού εισοδήματος.
 *
 * Χρησιμοποιεί το check-in για να κατατάξει τη διαμονή σε έτος (το
 * δηλωτέο εισόδημα δηλώνεται με βάση το φορολογικό έτος στο οποίο
 * εισπράχθηκε το ποσό — στην πράξη αυτό συμπίπτει σχεδόν πάντα με το
 * έτος της άφιξης).
 */

import { z } from 'zod'
import { eq, and, gte, lte, ne, desc } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { stays, properties } from '../../database/schema'

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

  return rows
})
