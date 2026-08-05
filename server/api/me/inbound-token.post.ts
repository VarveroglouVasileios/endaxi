/**
 * (Επανα)δημιουργία προσωπικής διεύθυνσης inbound email.
 *
 * Ο host προωθεί εκεί τα emails κράτησης/payout της Airbnb/Booking —
 * βλ. server/api/webhooks/resend-inbound.post.ts για την επεξεργασία.
 * Regenerate είναι χρήσιμο αν η διεύθυνση διέρρευσε/έφτασε spam.
 */

import { eq } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { users, auditLog } from '../../database/schema'
import { generateInboundToken, buildInboundAddress } from '../../utils/email/inbound-token'
import { getTrustedClientIp } from '../../utils/request-ip'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε' })

  let token = generateInboundToken(u.name ?? u.fullName)

  // Πρακτικά αδύνατο (4 bytes τυχαία), αλλά τηρούμε το unique index σοβαρά.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.inboundEmailToken, token))
      .limit(1)
    if (!clash) break
    token = generateInboundToken(u.name ?? u.fullName)
  }

  await db
    .update(users)
    .set({ inboundEmailToken: token, updatedAt: new Date() })
    .where(eq(users.id, userId))

  await db.insert(auditLog).values({
    userId,
    action: 'user.inbound_token_regenerated',
    entityType: 'user',
    entityId: userId,
    metadata: null,
    ipAddress: getTrustedClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  return { token, address: buildInboundAddress(token) }
})
