/**
 * Λήψη PDF παραστατικού.
 *
 * Επιστρέφει signed URL 15 λεπτών αντί για το ίδιο το αρχείο —
 * το κατέβασμα γίνεται απευθείας από το R2, χωρίς να περνά από εμάς.
 */

import { eq, and } from 'drizzle-orm'
import { useDatabase } from '../../../database/client'
import { takkDocuments, properties } from '../../../database/schema'
import { signedDownloadUrl, isStorageConfigured } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Λείπει το id' })

  const [row] = await db
    .select({ doc: takkDocuments })
    .from(takkDocuments)
    .innerJoin(properties, eq(takkDocuments.propertyId, properties.id))
    .where(and(eq(takkDocuments.id, id), eq(properties.userId, userId)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε' })

  if (!row.doc.pdfStorageKey) {
    throw createError({
      statusCode: 409,
      statusMessage: 'PDF_PENDING',
      data: { message: 'Το PDF ετοιμάζεται. Δοκίμασε σε λίγο.' },
    })
  }

  if (!isStorageConfigured()) {
    throw createError({ statusCode: 503, message: 'Η αποθήκευση δεν είναι διαθέσιμη' })
  }

  return { url: await signedDownloadUrl(row.doc.pdfStorageKey) }
})
