<script setup lang="ts">
/**
 * ΔΙΑΜΟΝΕΣ
 *
 * Υπάρχει για έναν λόγο: να σημαδέψει ο host τις **δωρεάν διαμονές**
 * πριν εκδοθεί ΤΑΚΚ. Ο νόμος λέει ότι δεν επιβαρύνονται, αλλά το iCal
 * δεν μας λέει την τιμή — άρα δεν μπορούμε να το μαντέψουμε.
 */

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Διαμονές — Εντάξει', robots: 'noindex' })

import { formatCents, grDate } from '~/utils/format'

interface Stay {
  id: string
  propertyName: string
  checkIn: string
  checkOut: string
  nights: number
  guestName: string | null
  status: string
  isComplimentary: boolean
  complimentaryNote: string | null
  documentCount: number
  canMarkComplimentary: boolean
  pendingIssuance: boolean
  estimatedAmountCents: number
  estimatedDocuments: number
}

const { data: staysList, refresh } = await useFetch<Stay[]>('/api/stays')

const busy = ref<string | null>(null)
const error = ref<string | null>(null)
const { confirm } = useConfirmDialog()

async function toggleComplimentary(s: Stay) {
  error.value = null

  if (!s.isComplimentary) {
    const ok = await confirm({
      title: 'Σήμανση ως δωρεάν διαμονή;',
      message:
        `${grDate(s.checkIn)} → ${grDate(s.checkOut)}\n\n`
        + `Δεν θα εκδοθεί ΤΑΚΚ (${formatCents(s.estimatedAmountCents)}).\n`
        + `Ο νόμος εξαιρεί τις δωρεάν διαμονές.`,
      confirmLabel: 'Σήμανση ως δωρεάν',
    })
    if (!ok) return
  }

  busy.value = s.id
  try {
    await $fetch(`/api/stays/${s.id}/complimentary`, {
      method: 'PATCH',
      body: { isComplimentary: !s.isComplimentary },
    })
    await refresh()
  } catch (e) {
    const err = e as { data?: { data?: { message?: string } } }
    error.value = err.data?.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    busy.value = null
  }
}

const pending = computed(() => staysList.value?.filter((s) => s.pendingIssuance) ?? [])
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-12">
    <h1 class="text-2xl font-bold">Διαμονές</h1>
    <p class="mt-2 text-sm leading-relaxed" style="color: var(--color-ink-soft)">
      Οι <strong>δωρεάν διαμονές δεν επιβαρύνονται με ΤΑΚΚ</strong>. Επειδή το
      ημερολόγιο δεν μας λέει την τιμή, σήμανέ τες εδώ —
      <strong>πριν</strong> εκδοθεί το παραστατικό.
    </p>

    <p v-if="error" class="notice-danger mt-6">{{ error }}</p>

    <div v-if="pending.length" class="notice-warn mt-6">
      <strong>{{ pending.length }}</strong>
      {{ pending.length === 1 ? 'διαμονή αναμένει' : 'διαμονές αναμένουν' }} έκδοση.
      Αν κάποια ήταν δωρεάν, σήμανέ τη τώρα.
    </div>

    <div v-if="!staysList?.length" class="card mt-8 text-center">
      <p class="font-medium">Καμία διαμονή</p>
      <p class="mt-2 text-sm" style="color: var(--color-ink-soft)">
        Μόλις συγχρονιστεί το ημερολόγιό σου, οι κρατήσεις θα εμφανιστούν εδώ.
      </p>
    </div>

    <ul v-else class="mt-8 space-y-2">
      <li
        v-for="s in staysList"
        :key="s.id"
        class="card flex flex-col gap-3 !p-4 sm:flex-row sm:items-center sm:gap-4"
        :style="s.isComplimentary ? 'opacity: .7' : ''"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium tnum">
              {{ grDate(s.checkIn) }} → {{ grDate(s.checkOut) }}
            </span>
            <span class="text-xs tnum" style="color: var(--color-ink-muted)">
              {{ s.nights }} {{ s.nights === 1 ? 'νύχτα' : 'νύχτες' }}
            </span>

            <span
              v-if="s.isComplimentary"
              class="badge"
              style="background: var(--color-brand-light); color: var(--color-brand-dark)"
            >
              Δωρεάν — χωρίς ΤΑΚΚ
            </span>
            <span
              v-else-if="s.documentCount"
              class="badge"
              style="background: var(--color-ok-bg); color: var(--color-ok)"
            >
              {{ s.documentCount }}
              {{ s.documentCount === 1 ? 'παραστατικό' : 'παραστατικά' }}
            </span>
            <span
              v-else-if="s.pendingIssuance"
              class="badge"
              style="background: var(--color-warn-bg); color: var(--color-warn)"
            >
              Εκκρεμεί έκδοση
            </span>
            <span
              v-if="s.status === 'cancelled'"
              class="badge"
              style="background: var(--color-danger-bg); color: var(--color-danger)"
            >
              Ακυρωμένη
            </span>
          </div>

          <p class="mt-1 truncate text-xs" style="color: var(--color-ink-muted)">
            {{ s.propertyName }}
            <template v-if="s.guestName"> · {{ s.guestName }}</template>
          </p>
        </div>

        <div class="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <span
            v-if="!s.isComplimentary"
            class="text-sm font-semibold tnum"
          >
            {{ formatCents(s.estimatedAmountCents) }}
            <span
              v-if="s.estimatedDocuments > 1"
              class="block text-xs font-normal"
              style="color: var(--color-ink-muted)"
            >
              σε {{ s.estimatedDocuments }} παραστατικά
            </span>
          </span>

          <button
            v-if="s.canMarkComplimentary"
            class="btn-secondary !px-3 text-xs"
            :disabled="busy === s.id"
            @click="toggleComplimentary(s)"
          >
            {{
              busy === s.id
                ? '…'
                : s.isComplimentary
                  ? 'Αναίρεση'
                  : 'Δωρεάν'
            }}
          </button>
          <span
            v-else
            class="text-xs"
            style="color: var(--color-ink-muted)"
            title="Έχει ήδη εκδοθεί παραστατικό"
          >
            κλειδωμένη
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>
