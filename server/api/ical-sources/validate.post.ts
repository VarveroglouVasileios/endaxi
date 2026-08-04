/**
 * Έλεγχος iCal συνδέσμου ΠΡΙΝ την αποθήκευση.
 * Το UI το καλεί καθώς ο χρήστης κάνει paste, ώστε να δει αμέσως
 * «βρήκαμε 12 κρατήσεις» αντί να ελπίζει.
 */

import { z } from 'zod'
import { validateIcalUrl } from '../../utils/ical/validate'
import { readValidatedBodyFriendly } from '../../utils/validated-body'

const bodySchema = z.object({ url: z.string().min(1).max(2048) })

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const { url } = await readValidatedBodyFriendly(event, bodySchema)
  return await validateIcalUrl(url)
})
