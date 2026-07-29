/**
 * Επεξεργασία ακινήτου.
 *
 * ⚠️ ΠΡΟΣΟΧΗ ΣΤΟ SNAPSHOT: τα εκδοθέντα παραστατικά κρατούν αντίγραφο
 * των στοιχείων τη στιγμή της έκδοσης. Αλλαγή εδώ ΔΕΝ αλλοιώνει παλιά
 * παραστατικά — και αυτό είναι σωστό. Επηρεάζει μόνο τα επόμενα.
 *
 * Ο ΑΜΑ και η σειρά ΔΕΝ αλλάζουν μετά την πρώτη έκδοση: ο ΑΜΑ γιατί
 * ταυτοποιεί το ακίνητο στο μητρώο, η σειρά γιατί θα έσπαγε τη
 * συνέχεια της αρίθμησης.
 */

import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { properties, takkDocuments, auditLog } from '../../database/schema'
import { getTrustedClientIp } from '../../utils/request-ip'

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(['str_standard', 'str_villa']).optional(),
  addressLine: z.string().min(3, 'Η διεύθυνση είναι υποχρεωτική').max(300).optional(),
  city: z.string().min(2, 'Η πόλη είναι υποχρεωτική').max(120).optional(),
  postalCode: z.string().min(4, 'Ο Τ.Κ. είναι υποχρεωτικός').max(20).optional(),
  areaSqm: z.number().int().positive().max(10_000).nullable().optional(),
  /** Μόνο πριν την πρώτη έκδοση */
  ama: z.string().min(1).max(64).optional(),
  documentSeries: z.string().min(1).max(5).optional(),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Λείπει το id' })

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), eq(properties.userId, userId)))
    .limit(1)

  if (!property) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε' })

  const body = await readValidatedBody(event, bodySchema.parse)

  // Έχει εκδοθεί παραστατικό; Τότε κλειδώνουν ΑΜΑ και σειρά.
  const [issued] = await db
    .select({ n: count() })
    .from(takkDocuments)
    .where(eq(takkDocuments.propertyId, id))

  const hasIssued = (issued?.n ?? 0) > 0

  if (hasIssued) {
    if (body.ama && body.ama !== property.ama) {
      throw createError({
        statusCode: 409,
        statusMessage: 'AMA_LOCKED',
        data: {
          message:
            'Ο ΑΜΑ δεν αλλάζει αφού έχουν εκδοθεί παραστατικά. Αν άλλαξε ' +
            'ο ΑΜΑ του ακινήτου, πρόσθεσέ το ως νέο ακίνητο.',
        },
      })
    }
    if (body.documentSeries && body.documentSeries !== property.documentSeries) {
      throw createError({
        statusCode: 409,
        statusMessage: 'SERIES_LOCKED',
        data: {
          message:
            'Η σειρά παραστατικών δεν αλλάζει αφού έχει ξεκινήσει η αρίθμηση — ' +
            'θα έσπαγε τη συνέχειά της.',
        },
      })
    }
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  for (const k of [
    'name',
    'category',
    'addressLine',
    'city',
    'postalCode',
    'areaSqm',
  ] as const) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  if (!hasIssued) {
    if (body.ama !== undefined) patch.ama = body.ama.trim()
    if (body.documentSeries !== undefined) patch.documentSeries = body.documentSeries
  }

  const [updated] = await db
    .update(properties)
    .set(patch)
    .where(eq(properties.id, id))
    .returning()

  await db.insert(auditLog).values({
    userId,
    action: 'property.updated',
    entityType: 'property',
    entityId: id,
    metadata: { fields: Object.keys(body), hadIssuedDocuments: hasIssued },
    ipAddress: getTrustedClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  return { ...updated, canEditAma: !hasIssued }
})
