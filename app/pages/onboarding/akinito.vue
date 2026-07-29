<script setup lang="ts">
/**
 * ΒΗΜΑ 2 — Στοιχεία ακινήτου
 *
 * Η κατηγορία καθορίζει το ποσό ΤΑΚΚ (8€ vs 15€ θερινή), οπότε την
 * εξηγούμε αντί να τη ρωτάμε ξερά.
 */

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Το ακίνητό σου — Εντάξει', robots: 'noindex' })

const form = reactive({
  ama: '',
  name: '',
  category: 'str_standard' as 'str_standard' | 'str_villa',
  addressLine: '',
  city: '',
  postalCode: '',
  areaSqm: undefined as number | undefined,
})

const loading = ref(false)
const error = ref<string | null>(null)

/** Μονοκατοικία >80τμ → υψηλότερος συντελεστής */
const suggestsVilla = computed(() => (form.areaSqm ?? 0) > 80)

async function submit() {
  error.value = null
  loading.value = true

  try {
    const property = await $fetch<{ id: string }>('/api/properties', {
      method: 'POST',
      body: {
        ama: form.ama.trim(),
        name: form.name.trim(),
        category: form.category,
        addressLine: form.addressLine,
        city: form.city,
        postalCode: form.postalCode,
        areaSqm: form.areaSqm,
      },
    })

    await navigateTo(`/onboarding/imerologio?property=${property.id}`)
  } catch (e) {
    const err = e as { data?: { data?: { notice?: string }; message?: string } }
    error.value =
      err.data?.data?.notice ?? err.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg px-5 py-16">
    <OnboardingSteps :current="2" />

    <h1 class="mt-8 text-2xl font-bold">Το ακίνητό σου</h1>
    <p class="mt-2 text-sm" style="color: var(--color-ink-soft)">
      Αυτά τα στοιχεία εμφανίζονται στα παραστατικά.
    </p>

    <form class="card mt-8 space-y-5" @submit.prevent="submit">
      <div>
        <label for="ama" class="label">Α.Μ.Α.</label>
        <input
          id="ama"
          v-model="form.ama"
          class="input tnum"
          required
          inputmode="numeric"
          placeholder="00001234567"
        />
        <p class="hint">
          Ο Αριθμός Μητρώου Ακινήτου από το Μητρώο Βραχυχρόνιας Διαμονής της ΑΑΔΕ.
        </p>
      </div>

      <div>
        <label for="name" class="label">Πώς το λες;</label>
        <input
          id="name"
          v-model="form.name"
          class="input"
          required
          placeholder="Διαμέρισμα Κουκάκι"
        />
        <p class="hint">Μόνο για να το ξεχωρίζεις εσύ.</p>
      </div>

      <div>
        <label for="area" class="label">Τετραγωνικά <span style="color: var(--color-ink-muted)">(προαιρετικό)</span></label>
        <input
          id="area"
          v-model.number="form.areaSqm"
          type="number"
          class="input tnum"
          min="1"
          max="10000"
          placeholder="65"
        />
      </div>

      <fieldset>
        <legend class="label">Τύπος καταλύματος</legend>
        <div class="mt-2 space-y-2">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5"
            :style="
              form.category === 'str_standard'
                ? 'border-color: var(--color-brand); background: var(--color-brand-light)'
                : 'border-color: var(--color-line-strong)'
            "
          >
            <input
              v-model="form.category"
              type="radio"
              value="str_standard"
              class="mt-1"
            />
            <span class="text-sm">
              <strong>Διαμέρισμα ή μικρό κατάλυμα</strong>
              <span class="block text-xs" style="color: var(--color-ink-muted)">
                8€ ανά διανυκτέρευση θερινή περίοδο, 2€ χειμερινή
              </span>
            </span>
          </label>

          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5"
            :style="
              form.category === 'str_villa'
                ? 'border-color: var(--color-brand); background: var(--color-brand-light)'
                : 'border-color: var(--color-line-strong)'
            "
          >
            <input v-model="form.category" type="radio" value="str_villa" class="mt-1" />
            <span class="text-sm">
              <strong>Μονοκατοικία &gt;80τμ, βίλα ή αυτοεξυπηρετούμενο</strong>
              <span class="block text-xs" style="color: var(--color-ink-muted)">
                15€ ανά διανυκτέρευση θερινή περίοδο, 4€ χειμερινή
              </span>
            </span>
          </label>
        </div>

        <p v-if="suggestsVilla && form.category === 'str_standard'" class="notice-warn mt-3">
          Δήλωσες πάνω από 80τμ. Αν πρόκειται για <strong>μονοκατοικία</strong>,
          ανήκει στη δεύτερη κατηγορία. Για διαμέρισμα σε πολυκατοικία, η πρώτη
          είναι σωστή.
        </p>
      </fieldset>

      <div class="border-t pt-5" style="border-color: var(--color-line)">
        <label for="address" class="label">Διεύθυνση</label>
        <input
          id="address"
          v-model="form.addressLine"
          class="input"
          required
          placeholder="Δράκου 12"
        />
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label for="city" class="label">Πόλη</label>
            <input id="city" v-model="form.city" class="input" required autocomplete="address-level2" />
          </div>
          <div>
            <label for="postal-code" class="label">Τ.Κ.</label>
          <input
            id="postal-code"
            v-model="form.postalCode"
            class="input tnum"
            required
            inputmode="numeric"
            autocomplete="postal-code"
          />
          </div>
        </div>
        <p class="hint">
          Ο νόμος απαιτεί τη διεύθυνση στο παραστατικό
          <span style="color: var(--color-ink-muted)">(Α.1202/2024)</span>.
        </p>
      </div>

      <p v-if="error" class="notice-danger">{{ error }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? 'Αποθήκευση…' : 'Συνέχεια' }}
      </button>
    </form>
  </div>
</template>
