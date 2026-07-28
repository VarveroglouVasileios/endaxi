<script setup lang="ts">
/**
 * ΒΗΜΑ 3 — Το iCal link. ΤΟ βήμα.
 *
 * Επαληθεύουμε ζωντανά καθώς κάνει paste, ώστε να δει «βρήκαμε 12
 * κρατήσεις» αντί να ελπίζει. Αν αποτύχει σιωπηλά, το μαθαίνει τον Ιούλιο.
 */

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Σύνδεσε το ημερολόγιο — Εντάξει', robots: 'noindex' })

const route = useRoute()
const propertyId = route.query.property as string

interface Validation {
  ok: boolean
  platform: string
  message: string
  bookings: number
  blocks: number
  sample: Array<{ checkIn: string; checkOut: string; nights: number }>
  error?: string
}

const url = ref('')
const checking = ref(false)
const saving = ref(false)
const result = ref<Validation | null>(null)
const saveError = ref<string | null>(null)

let debounce: ReturnType<typeof setTimeout> | undefined

watch(url, (v) => {
  result.value = null
  clearTimeout(debounce)
  if (!v.trim().startsWith('http')) return
  debounce = setTimeout(check, 600)
})

async function check() {
  checking.value = true
  try {
    result.value = await $fetch<Validation>('/api/ical-sources/validate', {
      method: 'POST',
      body: { url: url.value.trim() },
    })
  } catch {
    result.value = {
      ok: false,
      platform: 'other',
      message: 'Δεν μπορέσαμε να ελέγξουμε τον σύνδεσμο.',
      bookings: 0,
      blocks: 0,
      sample: [],
    }
  } finally {
    checking.value = false
  }
}

async function save() {
  saveError.value = null
  saving.value = true
  try {
    await $fetch('/api/ical-sources', {
      method: 'POST',
      body: { propertyId, url: url.value.trim() },
    })
    await navigateTo('/app?welcome=1')
  } catch (e) {
    const err = e as { data?: { data?: { message?: string } } }
    saveError.value = err.data?.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    saving.value = false
  }
}

function grDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const guides = [
  {
    platform: 'Airbnb',
    steps: 'Ημερολόγιο → Διαθεσιμότητα → Συγχρονισμός ημερολογίων → Εξαγωγή ημερολογίου',
  },
  {
    platform: 'Booking.com',
    steps: 'Ημερολόγιο & τιμές → Συγχρονισμός ημερολογίων → Εξαγωγή',
  },
  { platform: 'Vrbo', platformSteps: '', steps: 'Ημερολόγιο → Εισαγωγή/Εξαγωγή → Εξαγωγή ημερολογίου' },
]
</script>

<template>
  <div class="mx-auto max-w-lg px-5 py-16">
    <OnboardingSteps :current="3" />

    <h1 class="mt-8 text-2xl font-bold">Σύνδεσε το ημερολόγιό σου</h1>
    <p class="mt-2 text-sm leading-relaxed" style="color: var(--color-ink-soft)">
      Αντέγραψε το iCal link από την πλατφόρμα σου. Είναι το μόνο που
      χρειαζόμαστε — <strong>όχι κωδικούς, όχι ποσά κρατήσεων</strong>.
    </p>

    <div class="card mt-8">
      <label for="url" class="label">iCal σύνδεσμος</label>
      <input
        id="url"
        v-model="url"
        class="input"
        type="url"
        placeholder="https://www.airbnb.com/calendar/ical/..."
        autocomplete="off"
        spellcheck="false"
      />

      <p v-if="checking" class="hint">Ελέγχουμε τον σύνδεσμο…</p>

      <!-- Επιτυχία -->
      <div v-else-if="result?.ok" class="notice-ok mt-4">
        <p class="font-semibold">{{ result.message }}</p>

        <div v-if="result.sample.length" class="mt-3">
          <p class="text-xs font-medium">Οι πρώτες κρατήσεις που βρήκαμε:</p>
          <ul class="mt-1.5 space-y-1 text-xs tnum">
            <li v-for="s in result.sample" :key="s.checkIn">
              {{ grDate(s.checkIn) }} → {{ grDate(s.checkOut) }}
              <span style="opacity: 0.7">({{ s.nights }} νύχτες)</span>
            </li>
          </ul>
        </div>

        <p v-if="result.blocks" class="mt-2.5 text-xs" style="opacity: 0.8">
          Αγνοήσαμε {{ result.blocks }}
          {{ result.blocks === 1 ? 'ημερολογιακό μπλοκάρισμα' : 'ημερολογιακά μπλοκαρίσματα' }}
          — δεν είναι κρατήσεις και δεν παράγουν ΤΑΚΚ.
        </p>
      </div>

      <!-- Αποτυχία -->
      <p v-else-if="result && !result.ok" class="notice-danger mt-4">
        {{ result.message }}
      </p>

      <p v-if="saveError" class="notice-danger mt-4">{{ saveError }}</p>

      <button
        class="btn-primary mt-5 w-full"
        :disabled="!result?.ok || saving"
        @click="save"
      >
        {{ saving ? 'Σύνδεση…' : 'Σύνδεσε και τελείωσε' }}
      </button>
    </div>

    <!-- Οδηγίες -->
    <details class="mt-6 text-sm">
      <summary class="cursor-pointer font-medium" style="color: var(--color-ink-soft)">
        Πού βρίσκω το iCal link;
      </summary>
      <dl class="mt-4 space-y-3">
        <div v-for="g in guides" :key="g.platform" class="card !p-4">
          <dt class="text-sm font-semibold">{{ g.platform }}</dt>
          <dd class="mt-1 text-xs leading-relaxed" style="color: var(--color-ink-soft)">
            {{ g.steps }}
          </dd>
        </div>
      </dl>
      <p class="hint mt-3">
        Πρόσεχε: θέλουμε τον σύνδεσμο <strong>εξαγωγής</strong> (export), όχι τη
        διεύθυνση της αγγελίας σου.
      </p>
    </details>

    <NuxtLink to="/app" class="btn-ghost mt-4 w-full">
      Θα το κάνω αργότερα
    </NuxtLink>
  </div>
</template>
