/**
 * Ενημέρωση στοιχείων εκδότη.
 *
 * Αυτά τυπώνονται σε φορολογικό παραστατικό — άρα ελέγχονται σοβαρά
 * και κάθε αλλαγή καταγράφεται στο audit log.
 */

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { users, auditLog } from '../../database/schema'
import { isValidAfm, normalizeAfm, afmError } from '../../utils/afm'
import { getTrustedClientIp } from '../../utils/request-ip'

const bodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  afm: z.string().max(20).optional(),
  // Κενό string επιτρέπεται — σημαίνει «καθάρισε το τηλέφωνο» (βλ. παρακάτω).
  phone: z
    .string()
    .max(30)
    .refine(
      value => value.trim() === '' || /^[+0-9 ()-]{6,30}$/.test(value.trim()),
      'Μη έγκυρη μορφή τηλεφώνου',
    )
    .optional(),
  legalAddressLine: z.string().min(3).max(300).optional(),
  legalAddressCity: z.string().min(2).max(120).optional(),
  legalAddressPostalCode: z.string().min(4).max(20).optional(),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const body = await readValidatedBody(event, bodySchema.parse)

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) {
    patch.name = body.name.trim()
    patch.fullName = body.name.trim() // κρατάμε συγχρονισμένο το legacy πεδίο
  }

  if (body.afm !== undefined) {
    const err = afmError(body.afm)
    if (err) {
      throw createError({
        statusCode: 422,
        statusMessage: 'INVALID_AFM',
        data: { field: 'afm', message: err },
      })
    }
    patch.afm = normalizeAfm(body.afm)
  }

  if (body.phone !== undefined) patch.phone = body.phone.trim() || null
  if (body.legalAddressLine !== undefined) {
    patch.legalAddressLine = body.legalAddressLine.trim()
  }
  if (body.legalAddressCity !== undefined) {
    patch.legalAddressCity = body.legalAddressCity.trim()
  }
  if (body.legalAddressPostalCode !== undefined) {
    patch.legalAddressPostalCode = body.legalAddressPostalCode.trim()
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning()

  await db.insert(auditLog).values({
    userId,
    action: 'user.profile_updated',
    entityType: 'user',
    entityId: userId,
    // ΔΕΝ καταγράφουμε το ίδιο το ΑΦΜ — μόνο ότι άλλαξε
    metadata: { fields: Object.keys(body) },
    ipAddress: getTrustedClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  const name = updated!.name ?? updated!.fullName

  return {
    name,
    afm: updated!.afm,
    phone: updated!.phone,
    legalAddressLine: updated!.legalAddressLine,
    legalAddressCity: updated!.legalAddressCity,
    legalAddressPostalCode: updated!.legalAddressPostalCode,
    canIssue: Boolean(name?.trim())
      && Boolean(updated!.afm && isValidAfm(updated!.afm))
      && Boolean(updated!.legalAddressLine?.trim())
      && Boolean(updated!.legalAddressCity?.trim())
      && Boolean(updated!.legalAddressPostalCode?.trim()),
  }
})
