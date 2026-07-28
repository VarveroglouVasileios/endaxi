<script setup lang="ts">
import { authClient } from '~/lib/auth-client'
import { isValidEmail } from '../../shared/auth-validation'

useSeoMeta({ title: 'Επαναφορά κωδικού — Εντάξει', robots: 'noindex' })

const email = ref('')
const emailTouched = ref(false)
const submitted = ref(false)
const loading = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

const emailHasError = computed(
  () => (emailTouched.value || submitted.value) && !isValidEmail(email.value),
)

const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

async function submit() {
  submitted.value = true
  error.value = null

  if (!isValidEmail(email.value)) {
    error.value = 'Συμπλήρωσε μια έγκυρη διεύθυνση email.'
    return
  }

  loading.value = true
  try {
    const redirectTo = new URL('/reset-password', window.location.origin).toString()
    const { error: requestError } = await authClient.requestPasswordReset({
      email: email.value.trim(),
      redirectTo,
    })

    if (requestError) {
      error.value = 'Δεν ήταν δυνατή η αποστολή. Δοκίμασε ξανά σε λίγο.'
      return
    }

    sent.value = true
  } catch {
    error.value = 'Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-5 py-16">
    <h1 class="text-2xl font-bold">Επαναφορά κωδικού</h1>
    <p class="mt-2 text-sm" style="color: var(--color-ink-soft)">
      Θα σου στείλουμε έναν ασφαλή σύνδεσμο για να ορίσεις νέο κωδικό.
    </p>

    <div v-if="sent" class="card mt-8 space-y-5">
      <div class="notice-ok">
        Αν υπάρχει λογαριασμός με αυτό το email, ο σύνδεσμος επαναφοράς έχει
        σταλεί. Έλεγξε και τον φάκελο ανεπιθύμητης αλληλογραφίας.
      </div>
      <NuxtLink to="/login" class="btn-secondary w-full">Επιστροφή στη σύνδεση</NuxtLink>
    </div>

    <form v-else class="card mt-8 space-y-5" @submit.prevent="submit">
      <div>
        <label for="reset-email" class="label">Email λογαριασμού</label>
        <input
          id="reset-email"
          v-model="email"
          type="email"
          class="input"
          :class="{ 'input-error': emailHasError }"
          required
          autocomplete="email"
          inputmode="email"
          aria-describedby="reset-email-error"
          :aria-invalid="emailHasError"
          @blur="emailTouched = true"
        />
        <p v-if="emailHasError" id="reset-email-error" class="error-text">
          Συμπλήρωσε ένα έγκυρο email, π.χ. onoma@example.gr.
        </p>
      </div>

      <p v-if="error" class="notice-danger">{{ error }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="!mounted || loading">
        {{ loading ? 'Αποστολή…' : 'Στείλε σύνδεσμο επαναφοράς' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm" style="color: var(--color-ink-soft)">
      Θυμήθηκες τον κωδικό;
      <NuxtLink to="/login" class="font-medium underline">Σύνδεση</NuxtLink>
    </p>
  </div>
</template>
