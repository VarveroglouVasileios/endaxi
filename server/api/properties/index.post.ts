import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { properties, users, auditLog } from '../../database/schema'
import { checkAddProperty } from '../../utils/gate'
import { isUniqueAmaViolation } from '../../utils/db/unique-ama'
import { getTrustedClientIp } from '../../utils/request-ip'

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
  // Χρησιμοποιείται ως τμήμα του R2 storage key (server/utils/storage.ts) —
  // μόνο γράμματα/αριθμοί, ώστε να μην είναι δυνατό path traversal.
  documentSeries: z.string().regex(/^[\p{L}\p{N}]{1,5}$/u, 'Η σειρά επιτρέπει μόνο γράμματα και αριθμούς').default('Α'),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  // Γεμίζεται από το server/middleware/02.auth.ts
  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const body = await readValidatedBody(event, bodySchema.parse)
  const ipAddress = getTrustedClientIp(event)
  const userAgent = getRequestHeader(event, 'user-agent')

  const created = await db.transaction(async (tx) => {
    // Serialize property creation per user. Without this lock, two concurrent
    // requests can both observe one property and create properties #2 and #3.
    const [user] = await tx
      .select({ id: users.id, taxRegime: users.taxRegime })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')

    if (!user) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })
    if (user.taxRegime === 'business_3_plus') {
      throw createError({
        statusCode: 409,
        statusMessage: 'PROPERTY_LIMIT',
        data: {
          reason: 'business_regime',
          notice: 'Η υπηρεσία δεν υποστηρίζει ακόμη καθεστώς 3+ ακινήτων.',
          regime: user.taxRegime,
        },
      })
    }

    const [existing] = await tx
      .select({ n: count() })
      .from(properties)
      .where(eq(properties.userId, userId))

    const propertyCount = existing?.n ?? 0
    const gate = checkAddProperty(propertyCount)
    if (!gate.allowed) {
      throw createError({
        statusCode: 409,
        statusMessage: 'PROPERTY_LIMIT',
        data: { reason: gate.reason, notice: gate.notice, regime: gate.regime },
      })
    }

    let property: typeof properties.$inferSelect | undefined
    try {
      ;[property] = await tx
        .insert(properties)
        .values({ userId, ...body })
        .returning()
    } catch (error) {
      if (isUniqueAmaViolation(error)) {
        throw createError({
          statusCode: 409,
          statusMessage: 'AMA_TAKEN',
          data: {
            message:
              'Αυτός ο ΑΜΑ είναι ήδη καταχωρημένος σε άλλο λογαριασμό. ' +
              'Επικοινώνησε μαζί μας αν πιστεύεις ότι πρόκειται για λάθος.',
          },
        })
      }
      throw error
    }

    if (!property) {
      throw createError({ statusCode: 500, message: 'Αποτυχία δημιουργίας ακινήτου' })
    }

    await tx.insert(auditLog).values({
      userId,
      action: 'property.created',
      entityType: 'property',
      entityId: property.id,
      metadata: { ama: body.ama, propertyCount: propertyCount + 1 },
      ipAddress,
      userAgent,
    })

    return property
  })

  setResponseStatus(event, 201)
  return created
})
