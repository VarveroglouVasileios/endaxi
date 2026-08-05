/**
 * Καταχώρηση ποσού διαμονής — για το ΔΗΛΩΤΕΟ ΕΙΣΟΔΗΜΑ, όχι για το ΤΑΚΚ.
 *
 * ΚΡΙΣΙΜΗ ΔΙΑΚΡΙΣΗ: το ΤΑΚΚ είναι σταθερό ποσό ανά διανυκτέρευση και δεν
 * χρειάζεται καμία τιμή κράτησης (server/utils/takk/rates.ts). Αυτό εδώ
 * είναι ΕΝΤΕΛΩΣ ξεχωριστό: το πραγματικό ποσό που εισέπραξε ο host από
 * την πλατφόρμα (Airbnb/Booking), ώστε να υπολογιστεί το ετήσιο
 * εισόδημα προς δήλωση στο Ε2 (βλ. server/api/income/summary.get.ts).
 *
 * Ο host το καταχωρεί χειροκίνητα (π.χ. από το «Payout summary» της
 * Airbnb) — δεν υπάρχει σήμερα αυτόματη λήψη (θα μπορούσε να έρθει
 * αργότερα μέσω του inbound-email module, βλ. σχόλια στο schema.ts).
 */

import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { useDatabase } from '../../../database/client'
import { stays, properties, auditLog } from '../../../database/schema'
import { getTrustedClientIp } from '../../../utils/request-ip'
import { readValidatedBodyFriendly } from '../../../utils/validated-body'

const bodySchema = z.object({
  /** Μικτό ποσό που εισέπραξε ο host (σε λεπτά). null = καθάρισμα καταχώρησης. */
  grossAmountCents: z
    .number()
    .int()
    .min(0, 'Το ποσό δεν μπορεί να είναι αρνητικό')
    .max(100_000_00, 'Μη ρεαλιστικό ποσό')
    .nullable(),
  /** Προμήθεια πλατφόρμας (προαιρετικό, ενημερωτικό) */
  platformFeeCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  /** Καθαρό ποσό που κατατέθηκε (προαιρετικό, ενημερωτικό) */
  payoutAmountCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Λείπει το id' })

  const [row] = await db
    .select({ stay: stays })
    .from(stays)
    .innerJoin(properties, eq(stays.propertyId, properties.id))
    .where(and(eq(stays.id, id), eq(properties.userId, userId)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε η διαμονή' })

  const body = await readValidatedBodyFriendly(event, bodySchema)

  await db
    .update(stays)
    .set({
      grossAmountCents: body.grossAmountCents,
      platformFeeCents: body.platformFeeCents ?? null,
      payoutAmountCents: body.payoutAmountCents ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(stays.id, id),
        inArray(
          stays.propertyId,
          db.select({ id: properties.id }).from(properties).where(eq(properties.userId, userId)),
        ),
      ),
    )

  await db.insert(auditLog).values({
    userId,
    action: 'stay.amount_updated',
    entityType: 'stay',
    entityId: id,
    metadata: {
      checkIn: row.stay.checkIn,
      checkOut: row.stay.checkOut,
      grossAmountCents: body.grossAmountCents,
    },
    ipAddress: getTrustedClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  return { ok: true }
})
