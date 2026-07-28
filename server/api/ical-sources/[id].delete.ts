/**
 * Αποσύνδεση iCal πηγής.
 *
 * ΔΕΝ διαγράφουμε τις διαμονές ούτε τα παραστατικά — είναι φορολογικά
 * δεδομένα. Απλώς σταματάμε τον συγχρονισμό.
 */

import { eq, and } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { icalSources, properties, auditLog } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Λείπει το id' })

  const [row] = await db
    .select({ source: icalSources })
    .from(icalSources)
    .innerJoin(properties, eq(icalSources.propertyId, properties.id))
    .where(and(eq(icalSources.id, id), eq(properties.userId, userId)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε' })

  // Απενεργοποίηση, όχι διαγραφή — κρατάμε το ιστορικό
  await db
    .update(icalSources)
    .set({ isActive: false })
    .where(eq(icalSources.id, id))

  await db.insert(auditLog).values({
    userId,
    action: 'ical_source.deactivated',
    entityType: 'ical_source',
    entityId: id,
    ipAddress: getRequestIP(event, { xForwardedFor: true }),
  })

  return { ok: true }
})
