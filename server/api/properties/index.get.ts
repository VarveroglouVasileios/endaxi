import { and, desc, eq, inArray } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { properties, icalSources } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.userId, userId))
    .orderBy(desc(properties.createdAt))

  // Οι πηγές ημερολογίου ανά ακίνητο — ο χρήστης θέλει να δει αν συγχρονίζεται
  const sources = rows.length
    ? await db
        .select({
          id: icalSources.id,
          propertyId: icalSources.propertyId,
          source: icalSources.source,
          label: icalSources.label,
          isActive: icalSources.isActive,
          lastSyncedAt: icalSources.lastSyncedAt,
          lastSyncStatus: icalSources.lastSyncStatus,
          consecutiveFailures: icalSources.consecutiveFailures,
          createdAt: icalSources.createdAt,
        })
        .from(icalSources)
        .where(
          and(
            eq(icalSources.isActive, true),
            inArray(icalSources.propertyId, rows.map(property => property.id)),
          ),
        )
    : []

  return rows.map((p) => ({
    ...p,
    icalSources: sources.filter((s) => s.propertyId === p.id),
  }))
})
