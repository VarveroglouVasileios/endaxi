import { eq } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { users } from '../../database/schema'
import { isValidAfm } from '../../utils/afm'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε' })

  const name = u.name ?? u.fullName

  return {
    id: u.id,
    email: u.email,
    name,
    afm: u.afm,
    phone: u.phone,
    legalAddressLine: u.legalAddressLine,
    legalAddressCity: u.legalAddressCity,
    legalAddressPostalCode: u.legalAddressPostalCode,
    taxRegime: u.taxRegime,
    declaredPropertyCount: u.declaredPropertyCount,
    /**
     * Είναι έτοιμος να εκδίδει παραστατικά;
     * Το UI το χρησιμοποιεί για να δείξει προειδοποίηση πριν χαθούν κρατήσεις.
     */
    canIssue: Boolean(name?.trim())
      && Boolean(u.afm && isValidAfm(u.afm))
      && Boolean(u.legalAddressLine?.trim())
      && Boolean(u.legalAddressCity?.trim())
      && Boolean(u.legalAddressPostalCode?.trim()),
  }
})
