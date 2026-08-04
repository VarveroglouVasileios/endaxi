/**
 * ΒΡΕΘΗΚΕ ΣΕ VISUAL TEST (Αύγ 2026): `readValidatedBody(event, schema.parse)`
 * αφήνει το zod `.parse()` να πετάξει `ZodError` απευθείας. Το default
 * error handler του h3 χρησιμοποιεί το `error.message` του πεταμένου
 * σφάλματος ως το μήνυμα προς τον client — και το `ZodError.message` ΕΙΝΑΙ
 * ορισμένο ως `JSON.stringify(issues)`, όχι φιλικό κείμενο. Αποτέλεσμα:
 * ο χρήστης έβλεπε ωμό JSON validation error αντί για ελληνικό μήνυμα.
 * Επιβεβαιώθηκε οπτικά σε πραγματικό browser test.
 *
 * Αυτό δεν είναι μόνο δικό μας πρόβλημα — ΚΑΘΕ endpoint στο repo που καλεί
 * `readValidatedBody(event, bodySchema.parse)` απευθείας έχει το ίδιο κενό.
 * Fix εδώ μόνο για τα νέα feedback endpoints (μικρό, στοχευμένο, ίδιο
 * σχήμα σφάλματος `data.message` με τα υπόλοιπα endpoints της εφαρμογής).
 * Μια συνολική διόρθωση σε όλο το repo χρειάζεται δικό της, προσεκτικό
 * πέρασμα — δεν έγινε εδώ για να μην ανοίξει ρίσκο σε λειτουργικό κώδικα
 * που δεν σχετίζεται με το feedback.
 */

import { readBody, createError, type H3Event } from 'h3'
import type { ZodType } from 'zod'

export async function readValidatedBodyFriendly<T>(
  event: H3Event,
  schema: ZodType<T>,
): Promise<T> {
  const raw = await readBody(event)
  const result = schema.safeParse(raw)

  if (!result.success) {
    const first = result.error.issues[0]
    throw createError({
      statusCode: 400,
      statusMessage: 'VALIDATION_ERROR',
      data: { message: first?.message ?? 'Μη έγκυρα δεδομένα.' },
    })
  }

  return result.data
}
