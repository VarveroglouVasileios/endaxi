/**
 * Ετήσια σύνοψη δηλωτέου εισοδήματος ανά ακίνητο.
 *
 * ΠΡΟΣΟΧΗ, ΓΙΑ ΝΑ ΜΗΝ ΜΠΕΡΔΕΥΤΕΙ ΜΕ ΤΟ ΤΑΚΚ:
 * Το ΤΑΚΚ (server/utils/takk/*) είναι σταθερό τέλος ανά διανυκτέρευση,
 * άσχετο με την τιμή — το πληρώνει ο επισκέπτης, το αποδίδει ο host.
 *
 * Αυτό εδώ είναι το εισόδημα από ενοίκια βραχυχρόνιας μίσθωσης, που ο
 * host πρέπει να δηλώσει στο Ε2 (και αθροιστικά στο Ε1) με την
 * κλιμακωτή φορολογική κλίμακα (15% / 35% / 45%). Είναι εντελώς
 * ξεχωριστό ποσό, βασισμένο στις πραγματικές εισπράξεις — που η
 * εφαρμογή ΔΕΝ μπορεί να μαντέψει από το iCal (δεν περιέχει τιμές).
 *
 * ⚠️ Δεν αποτελεί φορολογική συμβουλή. Το ποσό είναι για ενημέρωση —
 * η τελική δήλωση γίνεται από τον host ή τον λογιστή του.
 */

import { z } from 'zod'
import { eq, and, gte, lte, ne } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { stays, properties, users } from '../../database/schema'

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

  const [me] = await db
    .select({ taxRegime: users.taxRegime, declaredPropertyCount: users.declaredPropertyCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const rows = await db
    .select({
      propertyId: stays.propertyId,
      propertyName: properties.name,
      checkIn: stays.checkIn,
      isComplimentary: stays.isComplimentary,
      grossAmountCents: stays.grossAmountCents,
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

  const byProperty = new Map<
    string,
    { propertyId: string; propertyName: string; totalGrossCents: number; stayCount: number; missingCount: number }
  >()

  for (const r of rows) {
    let entry = byProperty.get(r.propertyId)
    if (!entry) {
      entry = { propertyId: r.propertyId, propertyName: r.propertyName, totalGrossCents: 0, stayCount: 0, missingCount: 0 }
      byProperty.set(r.propertyId, entry)
    }
    entry.stayCount++
    if (r.isComplimentary) continue // δωρεάν διαμονή, δεν έφερε εισόδημα
    if (r.grossAmountCents == null) {
      entry.missingCount++
    } else {
      entry.totalGrossCents += r.grossAmountCents
    }
  }

  const properties_ = [...byProperty.values()].sort((a, b) => a.propertyName.localeCompare(b.propertyName, 'el'))
  const totalGrossCents = properties_.reduce((s, p) => s + p.totalGrossCents, 0)
  const totalMissingCount = properties_.reduce((s, p) => s + p.missingCount, 0)

  return {
    year,
    taxRegime: me?.taxRegime ?? 'individual_upto_2',
    declaredPropertyCount: me?.declaredPropertyCount ?? 1,
    totalGrossCents,
    totalMissingCount,
    properties: properties_,
  }
})
