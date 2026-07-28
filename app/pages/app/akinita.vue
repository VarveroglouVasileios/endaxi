<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Τα ακίνητά σου — Εντάξει', robots: 'noindex' })

import { grDate } from '~/utils/format'

interface IcalSource {
  id: string
  url: string
  source: string
  label: string | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  consecutiveFailures: number
}

interface Property {
  id: string
  ama: string
  name: string
  category: 'str_standard' | 'str_villa'
  addressLine: string | null
  city: string | null
  postalCode: string | null
  areaSqm: number | null
  documentSeries: string
  icalSources: IcalSource[]
}

const { data: properties, refresh } = await useFetch<Property[]>('/api/properties')

const CATEGORY_LABEL = {
  str_standard: 'Διαμέρισμα / μικρό κατάλυμα',
  str_villa: 'Μονοκατοικία >80τμ / βίλα',
} as const

function syncStatus(s: IcalSource) {
  if (s.consecutiveFailures > 0) return { label: 'Πρόβλημα συγχρονισμού', ok: false }
  if (!s.lastSyncedAt) return { label: 'Αναμονή πρώτου συγχρονισμού', ok: true }
  return { label: `Συγχρονίστηκε ${grDate(s.lastSyncedAt.slice(0, 10))}`, ok: true }
}

// ── Επεξεργασία ──
const editingId = ref<string | null>(null)
const saving = ref(false)
const editError = ref<string | null>(null)

const form = reactive({
  name: '',
  category: 'str_standard' as 'str_standard' | 'str_villa',
  addressLine: '',
  city: '',
  postalCode: '',
  areaSqm: undefined as number | undefined,
})

function startEdit(p: Property) {
  editingId.value = p.id
  editError.value = null
  form.name = p.name
  form.category = p.category
  form.addressLine = p.addressLine ?? ''
  form.city = p.city ?? ''
  form.postalCode = p.postalCode ?? ''
  form.areaSqm = p.areaSqm ?? undefined
}

async function save(id: string) {
  editError.value = null
  saving.value = true
  try {
    await $fetch(`/api/properties/${id}`, { method: 'PATCH', body: { ...form } })
    await refresh()
    editingId.value = null
  } catch (e) {
    const err = e as { data?: { data?: { message?: string }; message?: string } }
    editError.value = err.data?.data?.message ?? err.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    saving.value = false
  }
}

async function disconnect(id: string) {
  if (!confirm('Να σταματήσει ο συγχρονισμός; Τα παραστατικά σου παραμένουν.')) return
  await $fetch(`/api/ical-sources/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-12">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Ακίνητα</h1>
      <NuxtLink to="/onboarding/akinito" class="btn-secondary">Προσθήκη</NuxtLink>
    </div>

    <div v-if="!properties?.length" class="card mt-8 text-center">
      <p class="font-medium">Δεν έχεις ακίνητα ακόμα</p>
      <NuxtLink to="/onboarding/akinito" class="btn-primary mt-4">
        Πρόσθεσε το πρώτο
      </NuxtLink>
    </div>

    <ul v-else class="mt-8 space-y-4">
      <li v-for="p in properties" :key="p.id" class="card">
        <!-- ── Προβολή ── -->
        <template v-if="editingId !== p.id">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="font-semibold">{{ p.name }}</h2>
              <p class="mt-0.5 text-xs tnum" style="color: var(--color-ink-muted)">
                Α.Μ.Α. {{ p.ama }} · σειρά {{ p.documentSeries }}
              </p>
              <p class="mt-1 text-sm" style="color: var(--color-ink-soft)">
                <template v-if="p.addressLine">
                  {{ p.addressLine }}, {{ p.city }} {{ p.postalCode }}
                </template>
                <span v-else style="color: var(--color-warn)">
                  ⚠ Λείπει η διεύθυνση — υποχρεωτική στο παραστατικό
                </span>
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-2">
              <span
                class="badge"
                style="background: var(--color-paper); color: var(--color-ink-soft)"
              >
                {{ CATEGORY_LABEL[p.category] }}
              </span>
              <button class="btn-ghost !px-2 !py-1 text-xs" @click="startEdit(p)">
                Επεξεργασία
              </button>
            </div>
          </div>
        </template>

        <!-- ── Επεξεργασία ── -->
        <form v-else class="space-y-4" @submit.prevent="save(p.id)">
          <div>
            <label class="label">Ονομασία</label>
            <input v-model="form.name" class="input" required />
          </div>

          <div>
            <label class="label">Διεύθυνση</label>
            <input
              v-model="form.addressLine"
              class="input"
              required
              placeholder="Δράκου 12"
            />
            <div class="mt-2 grid grid-cols-2 gap-3">
              <input v-model="form.city" class="input" required placeholder="Πόλη" />
              <input
                v-model="form.postalCode"
                class="input tnum"
                required
                placeholder="Τ.Κ."
              />
            </div>
            <p class="hint">Υποχρεωτική στο ειδικό στοιχείο (Α.1202/2024).</p>
          </div>

          <div>
            <label class="label">Τετραγωνικά</label>
            <input v-model.number="form.areaSqm" type="number" class="input tnum" />
          </div>

          <div>
            <label class="label">Τύπος</label>
            <select v-model="form.category" class="input">
              <option value="str_standard">Διαμέρισμα / μικρό κατάλυμα — 8€/2€</option>
              <option value="str_villa">Μονοκατοικία &gt;80τμ / βίλα — 15€/4€</option>
            </select>
            <p class="hint">Αλλάζει το ποσό ΤΑΚΚ στα επόμενα παραστατικά.</p>
          </div>

          <p v-if="editError" class="notice-danger">{{ editError }}</p>

          <div class="flex gap-2">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? 'Αποθήκευση…' : 'Αποθήκευση' }}
            </button>
            <button type="button" class="btn-secondary" @click="editingId = null">
              Άκυρο
            </button>
          </div>

          <p class="hint">
            Τα ήδη εκδοθέντα παραστατικά <strong>δεν αλλάζουν</strong> — κρατούν
            τα στοιχεία της στιγμής έκδοσης.
          </p>
        </form>

        <!-- ── Ημερολόγια ── -->
        <div class="mt-5 border-t pt-4" style="border-color: var(--color-line)">
          <p class="text-xs font-medium" style="color: var(--color-ink-muted)">
            Συνδεδεμένα ημερολόγια
          </p>

          <p v-if="!p.icalSources.length" class="notice-warn mt-2">
            Κανένα ημερολόγιο. <strong>Δεν θα εκδοθεί κανένα παραστατικό</strong>
            μέχρι να συνδέσεις ένα.
            <NuxtLink
              :to="`/onboarding/imerologio?property=${p.id}`"
              class="font-medium underline"
            >
              Σύνδεσε τώρα
            </NuxtLink>
          </p>

          <ul v-else class="mt-2 space-y-2">
            <li
              v-for="s in p.icalSources"
              :key="s.id"
              class="flex items-center gap-3 text-sm"
            >
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :style="`background: ${syncStatus(s).ok ? 'var(--color-ok)' : 'var(--color-danger)'}`"
              />
              <span class="capitalize">{{ s.label ?? s.source }}</span>
              <span class="flex-1 text-xs" style="color: var(--color-ink-muted)">
                {{ syncStatus(s).label }}
              </span>
              <button class="btn-ghost !px-2 !py-1 text-xs" @click="disconnect(s.id)">
                Αποσύνδεση
              </button>
            </li>
          </ul>

          <NuxtLink
            v-if="p.icalSources.length"
            :to="`/onboarding/imerologio?property=${p.id}`"
            class="btn-ghost mt-2 !px-2 !py-1 text-xs"
          >
            + Προσθήκη ημερολογίου
          </NuxtLink>
        </div>
      </li>
    </ul>
  </div>
</template>
