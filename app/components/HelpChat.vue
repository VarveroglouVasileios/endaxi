<script setup lang="ts">
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  reply: string
  requestId: string
}

const { startOpen = false } = defineProps<{ startOpen?: boolean }>()

const MAX_TURNS = 5
const MAX_MESSAGE_LENGTH = 1_500
const quickQuestions = [
  'Τι κάνει το Endaxi;',
  'Πώς συνδέω το ημερολόγιό μου;',
  'Στέλνει στοιχεία στην ΑΑΔΕ;',
]

const { hasDecision, preferencesOpen } = useCookieConsent()
const route = useRoute()
const isOpen = ref(startOpen)
const isSending = ref(false)
const input = ref('')
const errorMessage = ref('')
const messages = ref<ChatMessage[]>([])
const inputElement = ref<HTMLTextAreaElement | null>(null)
const triggerElement = ref<HTMLButtonElement | null>(null)
const messagesElement = ref<HTMLElement | null>(null)

const userTurnCount = computed(
  () => messages.value.filter(message => message.role === 'user').length,
)
const canSend = computed(
  () =>
    input.value.trim().length > 0
    && input.value.trim().length <= MAX_MESSAGE_LENGTH
    && !isSending.value
    && userTurnCount.value < MAX_TURNS,
)
const widgetVisible = computed(
  () => hasDecision.value && !preferencesOpen.value,
)

onMounted(() => {
  if (startOpen) {
    nextTick(() => inputElement.value?.focus())
  }
})

watch(
  () => route.fullPath,
  () => closeChat(false),
)

watch(preferencesOpen, (open) => {
  if (open) closeChat(false)
})

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
  }
}

async function scrollToLatest() {
  await nextTick()
  messagesElement.value?.scrollTo({
    top: messagesElement.value.scrollHeight,
    behavior: 'smooth',
  })
}

async function openChat() {
  isOpen.value = true
  errorMessage.value = ''
  await nextTick()
  inputElement.value?.focus()
}

function closeChat(returnFocus = true) {
  isOpen.value = false
  if (returnFocus) {
    nextTick(() => triggerElement.value?.focus())
  }
}

function resetChat() {
  messages.value = []
  input.value = ''
  errorMessage.value = ''
  nextTick(() => inputElement.value?.focus())
}

function getErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('data' in error)) {
    return 'Η AI βοήθεια δεν είναι διαθέσιμη αυτή τη στιγμή.'
  }

  const data = error.data as {
    data?: { message?: string }
    message?: string
  } | undefined

  return (
    data?.data?.message
    ?? data?.message
    ?? 'Η AI βοήθεια δεν είναι διαθέσιμη αυτή τη στιγμή.'
  )
}

async function sendMessage() {
  const content = input.value.trim()
  if (!canSend.value || !content) return

  const userMessage = createMessage('user', content)
  messages.value.push(userMessage)
  input.value = ''
  errorMessage.value = ''
  isSending.value = true
  await scrollToLatest()

  try {
    const response = await $fetch<ChatResponse>('/api/help/chat', {
      method: 'POST',
      body: {
        messages: messages.value.map(message => ({
          role: message.role,
          content: message.content,
        })),
      },
    })
    messages.value.push(createMessage('assistant', response.reply))
  } catch (error) {
    messages.value = messages.value.filter(message => message.id !== userMessage.id)
    input.value = content
    errorMessage.value = getErrorMessage(error)
  } finally {
    isSending.value = false
    await scrollToLatest()
    inputElement.value?.focus()
  }
}

async function askQuickQuestion(question: string) {
  input.value = question
  await sendMessage()
}
</script>

<template>
  <div>
    <section
      v-if="widgetVisible && isOpen"
      id="endaxi-help-chat"
      class="fixed inset-x-3 z-40 flex max-h-[min(40rem,calc(100dvh-6.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl sm:left-auto sm:right-5 sm:w-[24rem]"
      style="bottom: max(5rem, calc(env(safe-area-inset-bottom) + 4.5rem)); border-color: var(--color-line); background: var(--color-surface)"
      role="dialog"
      aria-modal="false"
      aria-labelledby="help-chat-title"
      @keydown.esc="closeChat"
    >
      <header
        class="flex items-center justify-between gap-3 border-b px-4 py-3.5"
        style="border-color: var(--color-line)"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
            style="background: var(--color-brand)"
            aria-hidden="true"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M8 10h.01M12 10h.01M16 10h.01M6.8 18.1 4 20l.8-3.5A8 8 0 1 1 20 13a8 8 0 0 1-13.2 5.1Z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </span>
          <div class="min-w-0">
            <h2 id="help-chat-title" class="truncate text-sm font-bold">
              AI Βοηθός Endaxi
            </h2>
            <p class="text-xs" style="color: var(--color-ink-muted)">
              Βοήθεια για το προϊόν
            </p>
          </div>
        </div>
        <button
          type="button"
          class="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
          style="color: var(--color-ink-muted)"
          aria-label="Κλείσιμο AI βοηθού"
          @click="closeChat"
        >
          <svg aria-hidden="true" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" stroke-width="2" />
          </svg>
        </button>
      </header>

      <div
        ref="messagesElement"
        class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        <div
          class="max-w-[90%] rounded-2xl rounded-tl-sm px-3.5 py-3 text-sm leading-relaxed"
          style="background: var(--color-paper); color: var(--color-ink-soft)"
        >
          Γεια! Μπορώ να εξηγήσω πώς λειτουργεί το Endaxi. Δεν έχω πρόσβαση
          στον λογαριασμό σου και δεν παρέχω φορολογική ή νομική συμβουλή.
        </div>

        <div v-if="messages.length === 0" class="flex flex-wrap gap-2">
          <button
            v-for="question in quickQuestions"
            :key="question"
            type="button"
            class="min-h-11 rounded-full border px-3 py-2 text-left text-xs font-medium"
            style="border-color: var(--color-line-strong); color: var(--color-ink-soft)"
            @click="askQuickQuestion(question)"
          >
            {{ question }}
          </button>
        </div>

        <div
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <p
            class="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
            :class="message.role === 'user' ? 'rounded-tr-sm text-white' : 'rounded-tl-sm'"
            :style="
              message.role === 'user'
                ? 'background: var(--color-brand)'
                : 'background: var(--color-paper); color: var(--color-ink)'
            "
          >
            {{ message.content }}
          </p>
        </div>

        <div
          v-if="isSending"
          class="w-fit rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm"
          style="background: var(--color-paper); color: var(--color-ink-muted)"
        >
          Απαντά…
        </div>

        <p v-if="errorMessage" class="notice-danger">
          {{ errorMessage }}
        </p>
      </div>

      <div
        class="border-t p-3"
        style="border-color: var(--color-line); background: var(--color-surface)"
      >
        <p class="mb-2 text-[11px] leading-relaxed" style="color: var(--color-ink-muted)">
          Μην γράφεις ΑΦΜ, email, τηλέφωνα, διευθύνσεις, ονόματα επισκεπτών,
          iCal links ή άλλα προσωπικά δεδομένα.
        </p>

        <div v-if="userTurnCount >= MAX_TURNS" class="flex items-center justify-between gap-3">
          <p class="text-xs" style="color: var(--color-ink-soft)">
            Έφτασες το όριο αυτής της συνομιλίας.
          </p>
          <button type="button" class="btn-secondary shrink-0" @click="resetChat">
            Νέα συνομιλία
          </button>
        </div>

        <form v-else class="flex items-end gap-2" @submit.prevent="sendMessage">
          <label for="help-chat-input" class="sr-only">Η ερώτησή σου</label>
          <textarea
            id="help-chat-input"
            ref="inputElement"
            v-model="input"
            rows="1"
            :maxlength="MAX_MESSAGE_LENGTH"
            class="input max-h-28 min-h-11 resize-none"
            placeholder="Ρώτησε για το Endaxi…"
            :disabled="isSending"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <button
            type="submit"
            class="btn-primary min-w-11 shrink-0 !px-3"
            :disabled="!canSend"
            aria-label="Αποστολή ερώτησης"
          >
            <svg aria-hidden="true" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="m5 12 14-7-4 14-3-6-7-1Z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </button>
        </form>

        <p class="mt-2 text-center text-[10px]" style="color: var(--color-ink-muted)">
          Οι απαντήσεις AI μπορεί να είναι ανακριβείς.
          <NuxtLink to="/aporrito" class="underline">Απόρρητο</NuxtLink>
        </p>
      </div>
    </section>

    <button
      v-if="widgetVisible && !isOpen"
      ref="triggerElement"
      type="button"
      class="fixed right-4 z-40 flex min-h-13 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-xl sm:right-5"
      style="bottom: max(1rem, env(safe-area-inset-bottom)); background: var(--color-brand)"
      aria-controls="endaxi-help-chat"
      aria-expanded="false"
      @click="openChat"
    >
      <svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M8 10h.01M12 10h.01M16 10h.01M6.8 18.1 4 20l.8-3.5A8 8 0 1 1 20 13a8 8 0 0 1-13.2 5.1Z"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        />
      </svg>
      AI Βοήθεια
    </button>
  </div>
</template>
