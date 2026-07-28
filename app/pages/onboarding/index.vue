<script setup lang="ts">
/**
 * ΒΗΜΑ 1 — ΤΟ GATE
 *
 * Το πιο σημαντικό ερώτημα όλου του προϊόντος. Με 3+ ακίνητα ο χρήστης
 * είναι επιτηδευματίας και έχει υποχρέωση myDATA — δεν τον εξυπηρετούμε.
 *
 * Καταγράφουμε τι δήλωσε, πότε και από ποια IP (server-side).
 */

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Ας ξεκινήσουμε — Εντάξει', robots: 'noindex' })

/**
 * ΣΧΕΔΙΑΣΤΙΚΗ ΑΠΟΦΑΣΗ: το ΑΦΜ ΔΕΝ ζητείται εδώ.
 *
 * Είναι νομικά υποχρεωτικό στο παραστατικό (Α.1202/2024: «επωνυμία,
 * διεύθυνση και ΑΦΜ της εκδούσας επιχείρησης»), αλλά το ζητάμε **όταν
 * χρειάζεται** — πριν την πρώτη έκδοση, όχι στην εγγραφή.
 *
 * Λόγος: ο host πρέπει πρώτα να δει το σύστημα να δουλεύει (να συνδέσει
 * iCal, να δει τις κρατήσεις του) και μετά να δώσει φορολογικά στοιχεία.
 * Η εμπιστοσύνη κερδίζεται, δεν προαπαιτείται.
 */

const count = ref<number | null>(null)
const isLegalEntity = ref(false)
const loading = ref(false)
const blocked = ref<{ notice: string } | null>(null)

const options = [1, 2, 3]

async function submit() {
  if (count.value === null) return
  loading.value = true
  blocked.value = null

  try {
    const res = await $fetch<{
      allowed: boolean
      notice: string | null
    }>('/api/onboarding/declare-regime', {
      method: 'POST',
      body: { propertyCount: count.value, isLegalEntity: isLegalEntity.value },
    })

    if (!res.allowed) {
      blocked.value = { notice: res.notice ?? '' }
      return
    }

    await navigateTo('/onboarding/akinito')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg px-5 py-16">
    <OnboardingSteps :current="1" />

    <h1 class="mt-8 text-2xl font-bold">Πόσα ακίνητα έχεις;</h1>
    <p class="mt-2 text-sm leading-relaxed" style="color: var(--color-ink-soft)">
      Ρωτάμε γιατί στα 3 ακίνητα αλλάζει το φορολογικό σου καθεστώς — και
      αλλάζει και τι μπορούμε να κάνουμε για σένα.
    </p>

    <div class="card mt-8">
      <fieldset>
        <legend class="label">Ακίνητα σε βραχυχρόνια μίσθωση</legend>
        <div class="mt-2 grid grid-cols-3 gap-2">
          <button
            v-for="o in options"
            :key="o"
            type="button"
            class="rounded-lg border px-4 py-4 text-center transition-colors"
            :style="
              count === o
                ? 'border-color: var(--color-brand); background: var(--color-brand-light)'
                : 'border-color: var(--color-line-strong)'
            "
            @click="count = o"
          >
            <span class="block text-xl font-bold tnum">{{ o === 3 ? '3+' : o }}</span>
            <span class="mt-0.5 block text-xs" style="color: var(--color-ink-muted)">
              {{ o === 1 ? 'ακίνητο' : 'ακίνητα' }}
            </span>
          </button>
        </div>
      </fieldset>

      <label class="mt-5 flex items-start gap-2.5 text-sm">
        <input v-model="isLegalEntity" type="checkbox" class="mt-0.5" />
        <span>
          Τα εκμεταλλεύομαι μέσω εταιρείας
          <span class="block text-xs" style="color: var(--color-ink-muted)">
            ΙΚΕ, ΟΕ, ΑΕ ή άλλο νομικό πρόσωπο
          </span>
        </span>
      </label>

      <button
        class="btn-primary mt-6 w-full"
        :disabled="count === null || loading"
        @click="submit"
      >
        {{ loading ? 'Έλεγχος…' : 'Συνέχεια' }}
      </button>
    </div>

    <!-- Το gate έκλεισε -->
    <div v-if="blocked" class="notice-warn mt-6">
      <p class="font-semibold">Δεν μπορούμε να σε εξυπηρετήσουμε ακόμα</p>
      <p class="mt-2">{{ blocked.notice }}</p>
      <p class="mt-3 text-xs">
        Άφησε το email σου και θα σε ειδοποιήσουμε μόλις ολοκληρωθεί η σύνδεση
        με πιστοποιημένο πάροχο ηλεκτρονικής τιμολόγησης.
      </p>
    </div>
  </div>
</template>
