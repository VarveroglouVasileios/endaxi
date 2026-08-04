/**
 * Νέο σχόλιο σε δημοσίευση feedback.
 */

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDatabase } from '../../../database/client'
import { feedbackPosts, feedbackComments, users } from '../../../database/schema'
import { readValidatedBodyFriendly } from '../../../utils/validated-body'

const idSchema = z.string().uuid()

const bodySchema = z.object({
  body: z.string().trim().min(1, 'Το σχόλιο είναι υποχρεωτικό').max(2000),
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

  const rawId = getRouterParam(event, 'id')
  const parsedId = idSchema.safeParse(rawId)
  if (!parsedId.success) throw createError({ statusCode: 400, message: 'Μη έγκυρο id' })
  const postId = parsedId.data

  const body = await readValidatedBodyFriendly(event, bodySchema)

  const [post] = await db
    .select({ id: feedbackPosts.id })
    .from(feedbackPosts)
    .where(eq(feedbackPosts.id, postId))
    .limit(1)

  if (!post) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε η δημοσίευση' })

  const [author] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!author) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const [created] = await db
    .insert(feedbackComments)
    .values({ postId, userId, body: body.body })
    .returning()

  if (!created) throw createError({ statusCode: 500, message: 'Αποτυχία σχολίου' })

  setResponseStatus(event, 201)
  return {
    id: created.id,
    postId: created.postId,
    body: created.body,
    createdAt: created.createdAt,
    authorName: displayName(author.name, author.email),
    isMine: true,
  }
})
