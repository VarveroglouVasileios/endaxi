<script setup lang="ts">
/**
 * ΔΗΛΩΤΕΟ ΕΙΣΟΔΗΜΑ
 *
 * Η πιο συχνή ερώτηση host: «τι δηλώνω από τις εισπράξεις Airbnb;».
 * Είναι ΞΕΧΩΡΙΣΤΟ ερώτημα από το ΤΑΚΚ (σταθερό τέλος/διανυκτέρευση,
 * βλ. σελίδα Διαμονές) — αυτό εδώ αφορά το πραγματικό εισόδημα από
 * ενοίκιο, που ο host γνωρίζει μόνο ο ίδιος (δεν υπάρχει στο iCal).
 *
 * Ροή: ο host καταχωρεί το μικτό ποσό ανά διαμονή (από το «Payout
 * summary» της πλατφόρμας), η εφαρμογή αθροίζει ανά ακίνητο/έτος και
 * δείχνει μια ΕΝΔΕΙΚΤΙΚΗ εκτίμηση φόρου με την κλίμακα 15/35/45% —
 * με σαφή προειδοποίηση ότι δεν αποτελεί φορολογική συμβουλή.
 */

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Δηλωτέο εισόδημα — Εντάξει', robots: 'noindex' })

import { formatCents, grDate } from '~/utils/format'

interface StayRow {
  id: string
  propertyId: string
  propertyName: string
  checkIn: string
  checkOut: string
  nights: number
  guestName: string | null
  status: string
  isComplimentary: boolean
  grossAmountCents: number | null
  platformFeeCents: number | null
  payoutAmountCents: number | null
  amountSource: 'manual' | 'email_auto'
}

interface Summary {
  year: number
  taxRegime: 'individual_upto_2' | 'business_3_plus'
  declaredPropertyCount: number
  totalGrossCents: number
  totalMissingCount: number
  properties: {
    propertyId: string
    propertyName: string
    totalGrossCents: number
    stayCount: number
    missingCount: number
  }[]
}

const currentYear = new Date().getFullYear()
const year = ref(currentYear)
const years = computed(() => [currentYear, currentYear - 1, currentYear - 2])

const { data: summary, refresh: refreshSummary } = await useFetch<Summary>('/api/income/summary', {
  query: { year },
})
const { data: staysList, refresh: refreshStays } = await useFetch<StayRow[]>('/api/income/stays', {
  query: { year },
})

async function refreshAll() {
  await Promise.all([refreshSummary(), refreshStays()])
}
watch(year, refreshAll)

// ── Καταχώρηση ποσού ──
const editingId = ref<string | null>(null)
const amountInput = ref<string>('')
const saving = ref(false)
const error = ref<string | null>(null)

function startEdit(s: StayRow) {
  editingId.value = s.id
  amountInput.value = s.grossAmountCents != null ? (s.grossAmountCents / 100).toFixed(2) : ''
  error.value = null
}

async function saveAmount(s: StayRow) {
  error.value = null
  const trimmed = amountInput.value.trim()
  const cents = trimmed === '' ? null : Math.round(Number.parseFloat(trimmed.replace(',', '.')) * 100)

  if (cents !== null && (Number.isNaN(cents) || cents < 0)) {
    error.value = 'Μη έγκυρο ποσό.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/stays/${s.id}/amount`, {
      method: 'PATCH',
      body: { grossAmountCents: cents },
    })
    editingId.value = null
    await refreshAll()
  } catch (e) {
    const err = e as { data?: { data?: { message?: string } } }
    error.value = err.data?.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    saving.value = false
  }
}

/**
 * ΕΝΔΕΙΚΤΙΚΗ κλίμακα φόρου εισοδήματος από ακίνητη περιουσία (άθροισμα
 * ενοικίων όλων των ακινήτων, ετησίως): 15% έως 12.000€, 35% από
 * 12.001–35.000€, 45% πάνω από 35.000€ (κλιμακωτά, όχι flat).
 * Αμιγώς ενδεικτικό — δεν λαμβάνει υπόψη άλλα εισοδήματα ή εκπτώσεις.
 */
function estimateTaxCents(totalCents: number): number {
  const total = totalCents / 100
  const b1 = Math.min(total, 12_000) * 0.15
  const b2 = Math.max(0, Math.min(total, 35_000) - 12_000) * 0.35
  const b3 = Math.max(0, total - 35_000) * 0.45
  return Math.round((b1 + b2 + b3) * 100)
}

const estimatedTaxCents = computed(() => estimateTaxCents(summary.value?.totalGrossCents ?? 0))
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-12">
    <h1 class="text-2xl font-bold">Δηλωτέο εισόδημα</h1>
    <p class="mt-2 text-sm leading-relaxed" style="color: var(--color-ink-soft)">
      Το ποσό που πρέπει να δηλώσεις στο <strong>Ε2</strong> (και αθροιστικά στο Ε1)
      είναι το <strong>πραγματικό εισόδημα από ενοίκιο</strong> — εντελώς
      διαφορετικό από το ΤΑΚΚ. Το iCal δεν περιέχει τιμές (μόνο ημερομηνίες),
      οπότε δεν μπορούμε να το μαντέψουμε από εκεί. Δύο τρόποι να το
      συμπληρώσεις: καταχώρησέ το εδώ χειροκίνητα, ή
      <NuxtLink to="/app/rythmiseis" class="font-medium underline">
        ενεργοποίησε αυτόματη λήψη
      </NuxtLink>
      προωθώντας τα emails κράτησης/payout στη δική σου διεύθυνση.
    </p>

    <div class="card mt-4 !p-4" style="background: var(--color-paper)">
      <p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--color-ink-muted)">
        Ποιο ποσό ακριβώς;
      </p>
      <p class="mt-1.5 text-sm leading-relaxed" style="color: var(--color-ink-soft)">
        Στα «Έσοδα» της Airbnb βλέπεις <strong>δύο</strong> διαφορετικά ποσά για
        την ίδια κράτηση — π.χ. «Κερδίζετε 385,12 €» και
        «Ο επισκέπτης πλήρωσε 470,02 €». <strong>Κανένα από τα δύο δεν είναι
        το σωστό</strong>: το πρώτο έχει ήδη αφαιρεθεί η προμήθεια της Airbnb
        προς εσένα, το δεύτερο περιλαμβάνει την προμήθεια που πληρώνει ο
        επισκέπτης στην Airbnb (ποτέ δικά σου χρήματα). Το ποσό που δηλώνεις
        είναι η <strong>καθαρή τιμή διαμονής</strong> — στο παράδειγμα, η
        γραμμή «Τιμή δωματίου» (500,00 €) μείον τυχόν δική σου «Ρύθμιση
        τιμής» (-100,00 €) = <strong>400,00 €</strong>. Στην αμφιβολία,
        ρώτα τον λογιστή σου.
      </p>
    </div>

    <div class="mt-6 flex items-center gap-2">
      <label for="year-select" class="label !mb-0">Έτος</label>
      <select id="year-select" v-model.number="year" class="input w-auto">
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
    </div>

    <p v-if="error" class="notice-danger mt-4">{{ error }}</p>

    <!-- ── Σύνοψη ── -->
    <div v-if="summary" class="card mt-6">
      <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-ink-muted)">
        Σύνολο {{ summary.year }}
      </p>
      <p class="mt-1 text-3xl font-bold tnum">{{ formatCents(summary.totalGrossCents) }}</p>

      <div v-if="summary.totalMissingCount" class="notice-warn mt-3">
        <strong>{{ summary.totalMissingCount }}</strong>
        {{ summary.totalMissingCount === 1 ? 'διαμονή χρειάζεται' : 'διαμονές χρειάζονται' }}
        καταχώρηση ποσού — το σύνολο παραπάνω είναι ημιτελές.
      </div>

      <ul v-if="summary.properties.length" class="mt-4 space-y-2 border-t pt-4" style="border-color: var(--color-line)">
        <li
          v-for="p in summary.properties"
          :key="p.propertyId"
          class="flex items-center justify-between text-sm"
        >
          <span>{{ p.propertyName }}</span>
          <span class="tnum font-medium">
            {{ formatCents(p.totalGrossCents) }}
            <span v-if="p.missingCount" class="text-xs font-normal" style="color: var(--color-warn)">
              (+{{ p.missingCount }} εκκρεμ.)
            </span>
          </span>
        </li>
      </ul>

      <div class="mt-4 border-t pt-4" style="border-color: var(--color-line)">
        <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-ink-muted)">
          Ενδεικτικός φόρος (κλίμακα 15% / 35% / 45%)
        </p>
        <p class="mt-1 text-xl font-semibold tnum">{{ formatCents(estimatedTaxCents) }}</p>
        <p class="hint mt-1">
          Υπολογισμένο μόνο πάνω στα ενοίκια αυτής της εφαρμογής, κλιμακωτά.
          <strong>Δεν είναι φορολογική συμβουλή</strong> — δεν λαμβάνει υπόψη
          άλλα εισοδήματά σου, εκπτώσεις, ή τυχόν ΦΠΑ αν παρέχεις
          ξενοδοχειακού τύπου υπηρεσίες.
          <template v-if="summary.taxRegime === 'individual_upto_2'">
            Με έως 2 ακίνητα δηλωμένα ({{ summary.declaredPropertyCount }}) συνήθως
            δεν οφείλεται ΦΠΑ.
          </template>
          Επικοινώνησε με τον λογιστή σου πριν τη δήλωση.
        </p>
      </div>
    </div>

    <!-- ── Λίστα διαμονών προς καταχώρηση ── -->
    <h2 class="mt-10 text-lg font-semibold">Διαμονές {{ year }}</h2>

    <div v-if="!staysList?.length" class="card mt-4 text-center">
      <p class="font-medium">Καμία διαμονή για αυτό το έτος</p>
    </div>

    <ul v-else class="mt-4 space-y-2">
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
              Δωρεάν
            </span>
          </div>
          <p class="mt-1 truncate text-xs" style="color: var(--color-ink-muted)">
            {{ s.propertyName }}
            <template v-if="s.guestName"> · {{ s.guestName }}</template>
          </p>
        </div>

        <div v-if="!s.isComplimentary" class="flex shrink-0 items-center justify-end gap-2">
          <template v-if="editingId === s.id">
            <input
              v-model="amountInput"
              type="text"
              inputmode="decimal"
              class="input w-28 tnum"
              placeholder="0,00"
              @keyup.enter="saveAmount(s)"
            />
            <button class="btn-primary !px-3 text-xs" :disabled="saving" @click="saveAmount(s)">
              {{ saving ? '…' : 'Αποθήκευση' }}
            </button>
            <button class="btn-ghost !px-3 text-xs" @click="editingId = null">Άκυρο</button>
          </template>
          <template v-else>
            <span
              v-if="s.grossAmountCents != null && s.amountSource === 'email_auto'"
              class="badge"
              style="background: var(--color-warn-bg); color: var(--color-warn)"
              title="Συμπληρώθηκε αυτόματα από προωθημένο email — έλεγξέ το πριν το δηλώσεις, ειδικά αν η Airbnb δείχνει πάνω από ένα «σύνολο» για την ίδια κράτηση."
            >
              αυτόματα — έλεγξε
            </span>
            <span class="text-sm font-semibold tnum">
              {{ s.grossAmountCents != null ? formatCents(s.grossAmountCents) : '—' }}
            </span>
            <button class="btn-secondary !px-3 text-xs" @click="startEdit(s)">
              {{ s.grossAmountCents != null ? 'Επεξεργασία' : 'Καταχώρηση' }}
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>
