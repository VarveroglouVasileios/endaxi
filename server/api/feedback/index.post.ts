/**
 * Νέα δημοσίευση feedback — τι αρέσει, τι όχι, ή πρόταση.
 */

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { feedbackPosts, users } from '../../database/schema'
import { readValidatedBodyFriendly } from '../../utils/validated-body'

const bodySchema = z.object({
  type: z.enum(['positive', 'negative', 'idea']),
  title: z.string().trim().min(1, 'Ο τίτλος είναι υποχρεωτικός').max(150),
  body: z.string().trim().min(1, 'Το μήνυμα είναι υποχρεωτικό').max(4000),
})

function displayName(name: string | null, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split('@')[0] ?? 'Χρήστης'
}

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const body = await readValidatedBodyFriendly(event, bodySchema)

  const [author] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!author) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const [created] = await db
    .insert(feedbackPosts)
    .values({
      userId,
      type: body.type,
      title: body.title,
      body: body.body,
    })
    .returning()

  if (!created) throw createError({ statusCode: 500, message: 'Αποτυχία δημοσίευσης' })

  setResponseStatus(event, 201)
  return {
    id: created.id,
    type: created.type,
    title: created.title,
    body: created.body,
    createdAt: created.createdAt,
    authorName: displayName(author.name, author.email),
    isMine: true,
    comments: [],
  }
})
