/**
 * Επερχόμενες & πρόσφατες διαμονές.
 *
 * Ο host το χρειάζεται για έναν λόγο: να σημαδέψει τις **δωρεάν
 * διαμονές** πριν εκδοθεί ΤΑΚΚ. Μετά την έκδοση θέλει αντιλογιστικό.
 */

import { z } from 'zod'
import { eq, and, gte, desc, sql } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { stays, properties, takkDocuments } from '../../database/schema'
import { calculateTakk } from '../../utils/takk/calculator'

const querySchema = z.object({
  /** Πόσες μέρες πίσω να δείξουμε (default 30) */
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const { days } = await getValidatedQuery(event, querySchema.parse)

  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  const rows = await db
    .select({
      id: stays.id,
      propertyId: stays.propertyId,
      propertyName: properties.name,
      category: properties.category,
      checkIn: stays.checkIn,
      checkOut: stays.checkOut,
      nights: stays.nights,
      guestName: stays.guestName,
      status: stays.status,
      source: stays.source,
      isComplimentary: stays.isComplimentary,
      complimentaryNote: stays.complimentaryNote,
      documentId: takkDocuments.id,
    })
    .from(stays)
    .innerJoin(properties, eq(stays.propertyId, properties.id))
    .leftJoin(
      takkDocuments,
      and(
        eq(takkDocuments.stayId, stays.id),
        eq(takkDocuments.documentType, 'takk_receipt'),
      ),
    )
    .where(
      and(
        eq(properties.userId, userId),
        gte(stays.checkOut, from),
        sql`${stays.nights} > 0`,
      ),
    )
    .orderBy(desc(stays.checkOut))
    .limit(200)

  // Ομαδοποίηση: πολλά παραστατικά ανά διαμονή (ένα ανά μήνα)
  const byStay = new Map<string, (typeof rows)[number] & { documentCount: number }>()
  for (const r of rows) {
    const existing = byStay.get(r.id)
    if (existing) {
      if (r.documentId) existing.documentCount++
    } else {
      byStay.set(r.id, { ...r, documentCount: r.documentId ? 1 : 0 })
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return [...byStay.values()].map((s) => {
    const calc = s.isComplimentary
      ? null
      : calculateTakk({
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          category: s.category,
        })

    return {
      id: s.id,
      propertyName: s.propertyName,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      nights: s.nights,
      guestName: s.guestName,
      status: s.status,
      isComplimentary: s.isComplimentary,
      complimentaryNote: s.complimentaryNote,
      documentCount: s.documentCount,
      /** Μπορεί ακόμα να σημανθεί ως δωρεάν; Μόνο πριν την έκδοση. */
      canMarkComplimentary: s.documentCount === 0,
      /** Εκκρεμεί έκδοση; */
      pendingIssuance:
        s.documentCount === 0 &&
        !s.isComplimentary &&
        s.status === 'confirmed' &&
        s.checkOut <= today,
      estimatedAmountCents: calc?.totalAmountCents ?? 0,
      estimatedDocuments: calc?.segments.length ?? 0,
    }
  })
})
