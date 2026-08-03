/**
 * Σήμανση διαμονής ως δωρεάν.
 *
 * ΑΑΔΕ FAQ ΤΑΚΚ: «Οι δωρεάν διαμονές δεν επιβαρύνονται με το τέλος».
 *
 * ⚠️ Επιτρέπεται ΜΟΝΟ πριν την έκδοση παραστατικού. Μετά, το
 * παραστατικό υπάρχει και είναι append-only — η διόρθωση γίνεται με
 * αντιλογιστικό, όχι με αλλαγή σήμανσης.
 */

import { z } from 'zod'
import { eq, and, count, inArray } from 'drizzle-orm'
import { useDatabase } from '../../../database/client'
import { stays, properties, takkDocuments, auditLog } from '../../../database/schema'
import { getTrustedClientIp } from '../../../utils/request-ip'

const bodySchema = z.object({
  isComplimentary: z.boolean(),
  note: z.string().max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Λείπει το id' })

  const [row] = await db
    .select({ stay: stays })
    .from(stays)
    .innerJoin(properties, eq(stays.propertyId, properties.id))
    .where(and(eq(stays.id, id), eq(properties.userId, userId)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε η διαμονή' })

  const body = await readValidatedBody(event, bodySchema.parse)

  /**
   * ΒΡΕΘΗΚΕ ΣΕ ΔΙΚΟ ΜΟΥ SECURITY AUDIT (race condition / TOCTOU): ο παλιός
   * κώδικας έκανε "SELECT έχει εκδοθεί;" και μετά το UPDATE ΕΚΤΟΣ transaction.
   * Αν ένα Inngest job εξέδιδε παραστατικό ΑΝΑΜΕΣΑ στα δύο βήματα, το stay
   * μπορούσε να σημανθεί "δωρεάν" ενώ υπήρχε ήδη έγκυρο παραστατικό —
   * ασυνεπής φορολογική κατάσταση.
   *
   * Fix: κλειδώνουμε τη ΓΡΑΜΜΗ του stay (SELECT ... FOR UPDATE) πριν τον
   * έλεγχο. Το issueTakkDocuments() (server/utils/takk/numbering.ts)
   * κλειδώνει την ΙΔΙΑ γραμμή πριν αποφασίσει τι θα εκδώσει — τα δύο
   * transactions σειριοποιούνται σωστά από την ίδια την Postgres.
   */
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: stays.id })
      .from(stays)
      .where(eq(stays.id, id))
      .for('update')

    if (!locked) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε η διαμονή' })

    // Έχει ήδη εκδοθεί παραστατικό; (ΜΕΣΑ στο κλείδωμα, όχι πριν)
    const [issued] = await tx
      .select({ n: count() })
      .from(takkDocuments)
      .where(
        and(
          eq(takkDocuments.stayId, id),
          eq(takkDocuments.documentType, 'takk_receipt'),
        ),
      )

    if ((issued?.n ?? 0) > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'ALREADY_ISSUED',
        data: {
          message:
            'Έχει ήδη εκδοθεί παραστατικό για αυτή τη διαμονή. Η σήμανση ως ' +
            'δωρεάν δεν το ακυρώνει — χρειάζεται έκδοση αντιλογιστικού.',
        },
      })
    }

    // Defense-in-depth (προηγούμενο security audit): ownership ξανά μέσα
    // στο WHERE (subquery στα properties του χρήστη), όχι μόνο στο SELECT
    // από πάνω.
    await tx
      .update(stays)
      .set({
        isComplimentary: body.isComplimentary,
        complimentaryNote: body.isComplimentary ? (body.note ?? null) : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stays.id, id),
          inArray(
            stays.propertyId,
            tx.select({ id: properties.id }).from(properties).where(eq(properties.userId, userId)),
          ),
        ),
      )
  })

  await db.insert(auditLog).values({
    userId,
    action: body.isComplimentary ? 'stay.marked_complimentary' : 'stay.unmarked_complimentary',
    entityType: 'stay',
    entityId: id,
    metadata: {
      checkIn: row.stay.checkIn,
      checkOut: row.stay.checkOut,
      note: body.note ?? null,
    },
    ipAddress: getTrustedClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  return { ok: true, isComplimentary: body.isComplimentary }
})
