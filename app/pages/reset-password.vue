<script setup lang="ts">
import { authClient } from '~/lib/auth-client'
import { isStrongPassword } from '../../shared/auth-validation'

useSeoMeta({ title: 'Νέος κωδικός — Εντάξει', robots: 'noindex' })

const route = useRoute()
const password = ref('')
const passwordConfirmation = ref('')
const submitted = ref(false)
const loading = ref(false)
const completed = ref(false)
const error = ref<string | null>(null)

const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})
const hasInvalidToken = computed(
  () => route.query.error === 'INVALID_TOKEN' || !token.value,
)

const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

async function submit() {
  submitted.value = true
  error.value = null

  if (!isStrongPassword(password.value)) {
    error.value = 'Ο κωδικός δεν πληροί όλους τους κανόνες ασφαλείας.'
    return
  }

  if (password.value !== passwordConfirmation.value) {
    error.value = 'Οι δύο κωδικοί δεν ταιριάζουν.'
    return
  }

  if (!token.value) {
    error.value = 'Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος.'
    return
  }

  loading.value = true
  try {
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password.value,
      token: token.value,
    })

    if (resetError) {
      error.value =
        resetError.status === 400
          ? 'Ο σύνδεσμος έληξε ή έχει ήδη χρησιμοποιηθεί.'
          : 'Δεν ήταν δυνατή η αλλαγή του κωδικού. Δοκίμασε ξανά.'
      return
    }

    completed.value = true
  } catch {
    error.value = 'Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-5 py-16">
    <h1 class="text-2xl font-bold">Όρισε νέο κωδικό</h1>

    <div v-if="completed" class="card mt-8 space-y-5">
      <div class="notice-ok">Ο κωδικός άλλαξε επιτυχώς.</div>
      <NuxtLink to="/login" class="btn-primary w-full">Σύνδεση με τον νέο κωδικό</NuxtLink>
    </div>

    <div v-else-if="hasInvalidToken" class="card mt-8 space-y-5">
      <div class="notice-danger">
        Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος ή έχει λήξει.
      </div>
      <NuxtLink to="/forgot-password" class="btn-primary w-full">
        Ζήτησε νέο σύνδεσμο
      </NuxtLink>
    </div>

    <form v-else class="card mt-8 space-y-5" @submit.prevent="submit">
      <p class="text-sm" style="color: var(--color-ink-soft)">
        Ο νέος κωδικός θα αντικαταστήσει τον προηγούμενο σε όλες τις συσκευές.
      </p>

      <PasswordSetupFields
        v-model:password="password"
        v-model:confirmation="passwordConfirmation"
        id-prefix="reset"
        :submitted="submitted"
      />

      <p v-if="error" class="notice-danger">{{ error }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="!mounted || loading">
        {{ loading ? 'Αποθήκευση…' : 'Αποθήκευση νέου κωδικού' }}
      </button>
    </form>
  </div>
</template>
