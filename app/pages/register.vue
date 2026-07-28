<script setup lang="ts">
import { authClient } from '~/lib/auth-client'
import {
  isStrongPassword,
  isValidEmail,
} from '../../shared/auth-validation'

useSeoMeta({ title: 'Εγγραφή — Εντάξει', robots: 'noindex' })

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const emailTouched = ref(false)
const formSubmitted = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const emailHasError = computed(
  () => (emailTouched.value || formSubmitted.value) && !isValidEmail(email.value),
)

/**
 * ΒΡΕΘΗΚΕ ΜΕ ΠΡΑΓΜΑΤΙΚΟ BROWSER TEST (όχι curl): αν ο χρήστης πατήσει
 * «Δημιουργία λογαριασμού» πριν προλάβει να «κουμπώσει» το Vue hydration
 * (πολύ ρεαλιστικό σε κινητό/αργό δίκτυο — ο host είναι βιαστικός, έχει
 * προθεσμία ΑΑΔΕ), το `@submit.prevent` δεν έχει ακόμα δεθεί και ο
 * browser κάνει ΚΑΝΟΝΙΚΟ HTML submit: GET στο /register με άδειο query,
 * η σελίδα ξαναφορτώνει, η φόρμα αδειάζει — χωρίς ΚΑΝΕΝΑ μήνυμα λάθους.
 * Ο χρήστης νομίζει ότι έκανε κάτι λάθος και ξαναπροσπαθεί σε βρόχο.
 *
 * Λύση: το κουμπί μένει disabled μέχρι να ολοκληρωθεί το mount — μετά
 * από αυτό το σημείο ο event listener είναι σίγουρα δεμένος.
 */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

async function submit() {
  error.value = null
  formSubmitted.value = true

  if (!isValidEmail(email.value)) {
    error.value = 'Συμπλήρωσε μια έγκυρη διεύθυνση email.'
    return
  }

  if (!isStrongPassword(password.value)) {
    error.value = 'Ο κωδικός δεν πληροί όλους τους κανόνες ασφαλείας.'
    return
  }

  if (password.value !== passwordConfirmation.value) {
    error.value = 'Οι δύο κωδικοί δεν ταιριάζουν.'
    return
  }

  loading.value = true
  try {
    const { error: e } = await authClient.signUp.email({
      email: email.value.trim(),
      password: password.value,
      name: name.value.trim(),
    })

    if (e) {
      const message = e.message ?? ''
      if (message.includes('exist') || e.status === 422) {
        error.value = 'Υπάρχει ήδη λογαριασμός με αυτό το email.'
      } else if (message.includes('κανόνες ασφαλείας')) {
        error.value = message
      } else {
        error.value = 'Κάτι πήγε στραβά. Δοκίμασε ξανά.'
      }
      return
    }

    /**
     * ΚΡΙΣΙΜΟ: `external: true` αναγκάζει πλήρες page reload αντί για
     * client-side SPA navigation. Χωρίς αυτό, το `authClient.useSession()`
     * στο middleware διαβάζει το ΠΑΛΙΟ (χωρίς session) cached state —
     * βρέθηκε με πραγματικό browser test: ο χρήστης εγγραφόταν κανονικά
     * αλλά αναπηδούσε σε /login αντί να πάει στο /onboarding.
     * Με πλήρες reload, το session cookie διαβάζεται φρέσκο από τον server.
     */
    await navigateTo('/onboarding', { external: true })
  } catch {
    error.value = 'Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-5 py-16">
    <h1 class="text-2xl font-bold">Δημιούργησε λογαριασμό</h1>
    <p class="mt-2 text-sm" style="color: var(--color-ink-soft)">
      Δύο λεπτά και το ΤΑΚΚ σου τρέχει μόνο του.
    </p>

    <form class="card mt-8 space-y-5" @submit.prevent="submit">
      <div>
        <label for="name" class="label">Ονοματεπώνυμο</label>
        <input
          id="name"
          v-model="name"
          type="text"
          class="input"
          required
          autocomplete="name"
          placeholder="Βασίλης Παπαδόπουλος"
        />
        <p class="hint">Θα εμφανίζεται ως εκδότης στα παραστατικά.</p>
      </div>

      <div>
        <label for="email" class="label">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="input"
          :class="{ 'input-error': emailHasError }"
          required
          autocomplete="email"
          inputmode="email"
          aria-describedby="email-error"
          :aria-invalid="emailHasError"
          @blur="emailTouched = true"
        />
        <p v-if="emailHasError" id="email-error" class="error-text">
          Συμπλήρωσε ένα έγκυρο email, π.χ. onoma@example.gr.
        </p>
      </div>

      <PasswordSetupFields
        v-model:password="password"
        v-model:confirmation="passwordConfirmation"
        id-prefix="register"
        :submitted="formSubmitted"
      />

      <p v-if="error" class="notice-danger">{{ error }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="!mounted || loading">
        {{ loading ? 'Δημιουργία…' : 'Δημιουργία λογαριασμού' }}
      </button>

      <p class="text-center text-xs" style="color: var(--color-ink-muted)">
        Συνεχίζοντας αποδέχεσαι τους
        <NuxtLink to="/oroi" class="underline">Όρους Χρήσης</NuxtLink> και την
        <NuxtLink to="/aporrito" class="underline">Πολιτική Απορρήτου</NuxtLink>.
      </p>
    </form>

    <p class="mt-6 text-center text-sm" style="color: var(--color-ink-soft)">
      Έχεις ήδη λογαριασμό;
      <NuxtLink to="/login" class="font-medium underline">Σύνδεση</NuxtLink>
    </p>
  </div>
</template>
