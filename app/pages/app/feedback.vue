<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Feedback — Εντάξει', robots: 'noindex' })

import { grDateTime } from '~/utils/format'

type FeedbackType = 'positive' | 'negative' | 'idea'

interface Comment {
  id: string
  body: string
  createdAt: string
  authorName: string
  isMine: boolean
}

interface Post {
  id: string
  type: FeedbackType
  title: string
  body: string
  createdAt: string
  authorName: string
  isMine: boolean
  comments: Comment[]
}

const { data: posts, refresh } = await useFetch<Post[]>('/api/feedback')

const TYPE_LABEL: Record<FeedbackType, string> = {
  positive: '👍 Μου αρέσει',
  negative: '👎 Δεν μου αρέσει',
  idea: '💡 Πρόταση',
}

const TYPE_COLOR: Record<FeedbackType, string> = {
  positive: 'var(--color-ok)',
  negative: 'var(--color-danger)',
  idea: 'var(--color-accent, var(--color-ink))',
}

// ── Νέα δημοσίευση ──
const form = reactive({
  type: 'idea' as FeedbackType,
  title: '',
  body: '',
})
const posting = ref(false)
const postError = ref<string | null>(null)

async function submitPost() {
  postError.value = null
  posting.value = true
  try {
    await $fetch('/api/feedback', { method: 'POST', body: { ...form } })
    form.title = ''
    form.body = ''
    form.type = 'idea'
    await refresh()
  } catch (e) {
    const err = e as { data?: { data?: { message?: string }; message?: string } }
    postError.value = err.data?.data?.message ?? err.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    posting.value = false
  }
}

// ── Σχόλια ──
const commentDrafts = reactive<Record<string, string>>({})
const commentingId = ref<string | null>(null)
const commentErrorPostId = ref<string | null>(null)
const commentError = ref<string | null>(null)

async function submitComment(postId: string) {
  const body = (commentDrafts[postId] ?? '').trim()
  if (!body) return

  commentError.value = null
  commentErrorPostId.value = null
  commentingId.value = postId
  try {
    await $fetch(`/api/feedback/${postId}/comments`, { method: 'POST', body: { body } })
    commentDrafts[postId] = ''
    await refresh()
  } catch (e) {
    const err = e as { data?: { data?: { message?: string }; message?: string } }
    commentError.value = err.data?.data?.message ?? err.data?.message ?? 'Κάτι πήγε στραβά.'
    commentErrorPostId.value = postId
  } finally {
    commentingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-12">
    <h1 class="text-2xl font-bold">Feedback</h1>
    <p class="mt-1 text-sm" style="color: var(--color-ink-soft)">
      Πες μας τι σου αρέσει, τι όχι, ή πρότεινε κάτι νέο — το διαβάζουμε όλο.
    </p>

    <!-- ── Νέα δημοσίευση ── -->
    <form class="card mt-6 space-y-4" @submit.prevent="submitPost">
      <div>
        <label for="feedback-type" class="label">Τύπος</label>
        <select id="feedback-type" v-model="form.type" class="input">
          <option value="positive">👍 Μου αρέσει</option>
          <option value="negative">👎 Δεν μου αρέσει</option>
          <option value="idea">💡 Πρόταση</option>
        </select>
      </div>

      <div>
        <label for="feedback-title" class="label">Τίτλος</label>
        <input
          id="feedback-title"
          v-model="form.title"
          class="input"
          required
          maxlength="150"
          placeholder="Σε μία γραμμή"
        />
      </div>

      <div>
        <label for="feedback-body" class="label">Μήνυμα</label>
        <textarea
          id="feedback-body"
          v-model="form.body"
          class="input"
          rows="4"
          required
          maxlength="4000"
          placeholder="Πες μας περισσότερα…"
        />
      </div>

      <p v-if="postError" class="notice-danger">{{ postError }}</p>

      <button type="submit" class="btn-primary" :disabled="posting">
        {{ posting ? 'Δημοσίευση…' : 'Δημοσίευση' }}
      </button>
    </form>

    <!-- ── Λίστα δημοσιεύσεων ── -->
    <div v-if="!posts?.length" class="card mt-8 text-center">
      <p class="font-medium">Δεν υπάρχει ακόμα κανένα σχόλιο</p>
      <p class="mt-1 text-sm" style="color: var(--color-ink-soft)">
        Γίνε ο πρώτος που θα αφήσει feedback.
      </p>
    </div>

    <ul v-else class="mt-8 space-y-4">
      <li v-for="p in posts" :key="p.id" class="card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <span
              class="badge"
              :style="`background: var(--color-paper); color: ${TYPE_COLOR[p.type]}`"
            >
              {{ TYPE_LABEL[p.type] }}
            </span>
            <h2 class="mt-2 font-semibold">{{ p.title }}</h2>
          </div>
        </div>

        <p class="mt-2 text-sm whitespace-pre-wrap" style="color: var(--color-ink-soft)">
          {{ p.body }}
        </p>

        <p class="mt-3 text-xs" style="color: var(--color-ink-muted)">
          {{ p.authorName }}<span v-if="p.isMine"> (εσύ)</span> · {{ grDateTime(p.createdAt) }}
        </p>

        <!-- ── Σχόλια ── -->
        <div class="mt-4 border-t pt-4" style="border-color: var(--color-line)">
          <p
            v-if="p.comments.length"
            class="text-xs font-medium"
            style="color: var(--color-ink-muted)"
          >
            {{ p.comments.length }} σχόλι{{ p.comments.length === 1 ? 'ο' : 'α' }}
          </p>

          <ul v-if="p.comments.length" class="mt-2 space-y-3">
            <li v-for="c in p.comments" :key="c.id" class="text-sm">
              <p class="whitespace-pre-wrap">{{ c.body }}</p>
              <p class="mt-0.5 text-xs" style="color: var(--color-ink-muted)">
                {{ c.authorName }}<span v-if="c.isMine"> (εσύ)</span> · {{ grDateTime(c.createdAt) }}
              </p>
            </li>
          </ul>

          <form
            class="mt-3 flex flex-col gap-2 sm:flex-row"
            @submit.prevent="submitComment(p.id)"
          >
            <input
              v-model="commentDrafts[p.id]"
              class="input flex-1"
              maxlength="2000"
              placeholder="Γράψε ένα σχόλιο…"
            />
            <button
              type="submit"
              class="btn-secondary shrink-0"
              :disabled="commentingId === p.id || !commentDrafts[p.id]?.trim()"
            >
              {{ commentingId === p.id ? 'Αποστολή…' : 'Σχόλιο' }}
            </button>
          </form>
          <p v-if="commentError && commentErrorPostId === p.id" class="notice-danger mt-2">
            {{ commentError }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
