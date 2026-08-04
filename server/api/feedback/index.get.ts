/**
 * Λίστα δημοσιεύσεων feedback — δημόσιο board μέσα στην εφαρμογή, μόνο
 * για συνδεδεμένους πελάτες. Πιο πρόσφατα πρώτα, μαζί με τα σχόλιά τους.
 */

import { eq, desc, inArray } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { feedbackPosts, feedbackComments, users } from '../../database/schema'

const MAX_POSTS = 100

function displayName(name: string | null, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split('@')[0] ?? 'Χρήστης'
}

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const posts = await db
    .select({
      id: feedbackPosts.id,
      type: feedbackPosts.type,
      title: feedbackPosts.title,
      body: feedbackPosts.body,
      createdAt: feedbackPosts.createdAt,
      authorId: feedbackPosts.userId,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(feedbackPosts)
    .innerJoin(users, eq(feedbackPosts.userId, users.id))
    .orderBy(desc(feedbackPosts.createdAt))
    .limit(MAX_POSTS)

  if (posts.length === 0) return []

  const postIds = posts.map((p) => p.id)

  const comments = await db
    .select({
      id: feedbackComments.id,
      postId: feedbackComments.postId,
      body: feedbackComments.body,
      createdAt: feedbackComments.createdAt,
      authorId: feedbackComments.userId,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(feedbackComments)
    .innerJoin(users, eq(feedbackComments.userId, users.id))
    .where(inArray(feedbackComments.postId, postIds))
    .orderBy(feedbackComments.createdAt)

  const commentsByPost = new Map<string, typeof comments>()
  for (const c of comments) {
    const list = commentsByPost.get(c.postId)
    if (list) list.push(c)
    else commentsByPost.set(c.postId, [c])
  }

  return posts.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    body: p.body,
    createdAt: p.createdAt,
    authorName: displayName(p.authorName, p.authorEmail),
    isMine: p.authorId === userId,
    comments: (commentsByPost.get(p.id) ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      authorName: displayName(c.authorName, c.authorEmail),
      isMine: c.authorId === userId,
    })),
  }))
})
