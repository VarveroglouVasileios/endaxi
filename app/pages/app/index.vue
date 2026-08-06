<script setup lang="ts">
/**
 * DASHBOARD
 *
 * Ο χρήστης ανοίγει αυτή τη σελίδα για έναν λόγο: «πόσα χρωστάω και
 * μέχρι πότε». Άρα αυτό είναι το πρώτο πράγμα που βλέπει.
 */

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Τα παραστατικά σου — Εντάξει', robots: 'noindex' })

import { formatCents, grDate, grPeriod, fullNumber, daysUntil } from '~/utils/format'

const route = useRoute()
const justOnboarded = computed(() => route.query.welcome === '1')

interface Doc {
  id: string
  documentType: 'takk_receipt' | 'takk_cancellation'
  series: string
  number: number
  year: number
  propertyName: string
  checkIn: string
  checkOut: string
  nights: number
  guestName: string | null
  totalAmountCents: number
  hasPdf: string | null
  stayId: string | null
  stayGrossAmountCents: number | null
}

interface Period {
  period: string
  deadline: string
  totalCents: number
  documents: Doc[]
}

interface Readiness {
  ready: boolean
  missing: Array<{ field: string; label: string; where: string }>
  propertiesWithoutCalendar: Array<{ id: string; name: string }>
  nextCheckOut: string | null
}

const [
  { data, pending, refresh },
  { data: readiness },
] = await Promise.all([
  useFetch<{ periods: Period[]; total: number }>('/api/documents'),
  useFetch<Readiness>('/api/me/readiness'),
])

/** Η τρέχουσα εκκρεμότητα — αυτό που ψάχνει ο χρήστης */
const current = computed(() => data.value?.periods[0] ?? null)

const downloading = ref<string | null>(null)
const { error: toastError } = useToast()

async function download(id: string) {
  downloading.value = id
  try {
    const { url } = await $fetch<{ url: string }>(`/api/documents/${id}/download`)
    window.open(url, '_blank')
  } catch (e) {
    const err = e as { data?: { data?: { message?: string } } }
    toastError(err.data?.data?.message ?? 'Δεν ήταν δυνατή η λήψη.')
  } finally {
    downloading.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-12">
    <div v-if="justOnboarded" class="notice-ok mb-8">
      <p class="font-semibold">Είσαι εντάξει.</p>
      <p class="mt-1.5">
        Το ημερολόγιό σου συνδέθηκε. Ελέγχουμε για νέες κρατήσεις κάθε 2 ώρες
        και τα παραστατικά θα εμφανίζονται εδώ αυτόματα.
      </p>
    </div>

    <ReadinessBanner :data="readiness" class="mb-8" />

    <h1 class="text-2xl font-bold">Παραστατικά ΤΑΚΚ</h1>

    <!-- Φόρτωση -->
    <p v-if="pending" class="mt-8 text-sm" style="color: var(--color-ink-muted)">
      Φόρτωση…
    </p>

    <!-- Κενή κατάσταση -->
    <div v-else-if="!data?.total" class="card mt-8 text-center">
      <p class="font-medium">Δεν υπάρχουν παραστατικά ακόμα</p>
      <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style="color: var(--color-ink-soft)">
        Μόλις κάποιος επισκέπτης αναχωρήσει, το παραστατικό εκδίδεται αυτόματα
        και εμφανίζεται εδώ. Δεν χρειάζεται να κάνεις τίποτα.
      </p>
      <NuxtLink to="/app/akinita" class="btn-secondary mt-5">
        Δες τα ακίνητά σου
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Τρέχουσα εκκρεμότητα -->
      <div v-if="current" class="card mt-8">
        <p class="text-xs font-medium" style="color: var(--color-ink-muted)">
          {{ grPeriod(current.period) }}
        </p>
        <p class="mt-1 text-4xl font-bold tnum" style="color: var(--color-brand)">
          {{ formatCents(current.totalCents) }}
        </p>
        <p class="mt-2 text-sm" style="color: var(--color-ink-soft)">
          {{ current.documents.length }}
          {{ current.documents.length === 1 ? 'παραστατικό' : 'παραστατικά' }}
          · προθεσμία δήλωσης <strong>{{ grDate(current.deadline) }}</strong>
          <span v-if="daysUntil(current.deadline) <= 10" style="color: var(--color-warn)">
            ({{ daysUntil(current.deadline) }} μέρες)
          </span>
        </p>

        <p class="hint mt-4">
          Την υποβολή στην ΑΑΔΕ την κάνεις εσύ. Εμείς κρατάμε τους αριθμούς σωστούς.
        </p>
      </div>

      <!-- Ανά περίοδο -->
      <section v-for="p in data.periods" :key="p.period" class="mt-10">
        <div class="flex items-baseline justify-between">
          <h2 class="text-sm font-bold">{{ grPeriod(p.period) }}</h2>
          <span class="text-sm font-semibold tnum">{{ formatCents(p.totalCents) }}</span>
        </div>

        <ul class="mt-3 space-y-2">
          <li
            v-for="d in p.documents"
            :key="d.id"
            class="card flex flex-col gap-3 !p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate text-xs font-semibold tnum">
                  {{ fullNumber(d.series, d.number, d.year) }}
                </span>
                <span
                  v-if="d.documentType === 'takk_cancellation'"
                  class="badge shrink-0"
                  style="background: var(--color-danger-bg); color: var(--color-danger)"
                >
                  Ακυρωτικό
                </span>
              </div>
              <p class="mt-1 truncate text-sm" style="color: var(--color-ink-soft)">
                {{ grDate(d.checkIn) }} → {{ grDate(d.checkOut) }}
                <span class="tnum">({{ d.nights }} νύχτες)</span>
                <template v-if="d.guestName"> · {{ d.guestName }}</template>
              </p>
              <p class="text-xs" style="color: var(--color-ink-muted)">
                {{ d.propertyName }}
              </p>

              <!-- Σύνδεση με το Εισόδημα: το ΤΑΚΚ είναι ξεχωριστό από το -->
              <!-- πραγματικό ενοίκιο — υπενθυμίζουμε αν λείπει το δεύτερο. -->
              <NuxtLink
                v-if="d.documentType === 'takk_receipt' && d.stayGrossAmountCents == null"
                :to="`/app/eisodima?year=${new Date(d.checkIn).getFullYear()}`"
                class="mt-1 inline-block text-xs font-medium underline"
                style="color: var(--color-warn)"
              >
                Λείπει το δηλωτέο ποσό ενοικίου →
              </NuxtLink>
            </div>

            <div class="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
              <span
                class="text-sm font-semibold tnum"
                :style="d.totalAmountCents < 0 ? 'color: var(--color-danger)' : ''"
              >
                {{ formatCents(d.totalAmountCents) }}
              </span>

              <button
                class="btn-secondary !px-3 text-xs"
                :disabled="!d.hasPdf || downloading === d.id"
                :title="d.hasPdf ? 'Λήψη PDF' : 'Το PDF ετοιμάζεται'"
                @click="download(d.id)"
              >
                {{ downloading === d.id ? '…' : d.hasPdf ? 'PDF' : '⏳' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
