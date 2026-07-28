import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { properties, users, auditLog } from '../../database/schema'
import { checkAddProperty } from '../../utils/gate'

const bodySchema = z.object({
  ama: z.string().min(1, 'Ο ΑΜΑ είναι υποχρεωτικός').max(64),
  name: z.string().min(1).max(200),
  category: z.enum(['str_standard', 'str_villa']).default('str_standard'),
  // Υποχρεωτικά: η Α.1202/2024 απαιτεί «επωνυμία, διεύθυνση και ΑΦΜ»
  // ως ελάχιστο περιεχόμενο του ειδικού στοιχείου.
  addressLine: z.string().min(3, 'Η διεύθυνση είναι υποχρεωτική').max(300),
  city: z.string().min(2, 'Η πόλη είναι υποχρεωτική').max(120),
  postalCode: z.string().min(4, 'Ο Τ.Κ. είναι υποχρεωτικός').max(20),
  areaSqm: z.number().int().positive().max(10_000).optional(),
  documentSeries: z.string().min(1).max(5).default('Α'),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  // Γεμίζεται από το server/middleware/02.auth.ts
  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const body = await readValidatedBody(event, bodySchema.parse)

  // ── ΤΟ GATE ──
  const [existing] = await db
    .select({ n: count() })
    .from(properties)
    .where(eq(properties.userId, userId))

  const gate = checkAddProperty(existing?.n ?? 0)

  if (!gate.allowed) {
    throw createError({
      statusCode: 409,
      statusMessage: 'PROPERTY_LIMIT',
      data: { reason: gate.reason, notice: gate.notice, regime: gate.regime },
    })
  }

  const [created] = await db
    .insert(properties)
    .values({ userId, ...body })
    .returning()

  // Ενημέρωση δηλωμένου αριθμού + audit trail
  const newCount = (existing?.n ?? 0) + 1
  await db
    .update(users)
    .set({ declaredPropertyCount: newCount, updatedAt: new Date() })
    .where(eq(users.id, userId))

  await db.insert(auditLog).values({
    userId,
    action: 'property.created',
    entityType: 'property',
    entityId: created!.id,
    metadata: { ama: body.ama, propertyCount: newCount },
    ipAddress: getRequestIP(event, { xForwardedFor: true }),
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  setResponseStatus(event, 201)
  return created
})
