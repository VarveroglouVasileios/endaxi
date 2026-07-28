import { eq, desc } from 'drizzle-orm'
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
        .select()
        .from(icalSources)
        .where(eq(icalSources.isActive, true))
    : []

  return rows.map((p) => ({
    ...p,
    icalSources: sources.filter((s) => s.propertyId === p.id),
  }))
})
