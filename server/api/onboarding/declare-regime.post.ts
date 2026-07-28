/**
 * ΔΗΛΩΣΗ ΚΑΘΕΣΤΩΤΟΣ — το gate στην εγγραφή.
 *
 * Καταγράφουμε ΤΙ δήλωσε ο χρήστης, ΠΟΤΕ και ΑΠΟ ΠΟΥ.
 * Αν κάποιος δηλώσει ψευδώς «2 ακίνητα», η ευθύνη είναι δική του —
 * αρκεί να έχουμε απόδειξη.
 */

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { users, auditLog } from '../../database/schema'
import { checkGate } from '../../utils/gate'

const bodySchema = z.object({
  propertyCount: z.number().int().min(0).max(999),
  isLegalEntity: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const { propertyCount, isLegalEntity } = await readValidatedBody(
    event,
    bodySchema.parse,
  )

  const gate = checkGate({ propertyCount, isLegalEntity })
  const ip = getRequestIP(event, { xForwardedFor: true })

  await db
    .update(users)
    .set({
      declaredPropertyCount: propertyCount,
      taxRegime: gate.regime,
      regimeDeclaredAt: new Date(),
      regimeDeclaredIp: ip,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))

  await db.insert(auditLog).values({
    userId,
    action: 'regime.declared',
    entityType: 'user',
    entityId: userId,
    metadata: { propertyCount, isLegalEntity, regime: gate.regime, allowed: gate.allowed },
    ipAddress: ip,
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  return {
    allowed: gate.allowed,
    regime: gate.regime,
    reason: gate.reason ?? null,
    notice: gate.notice ?? null,
  }
})
