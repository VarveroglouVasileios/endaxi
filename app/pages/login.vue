<script setup lang="ts">
import { authClient } from '~/lib/auth-client'
import { safePrivateRedirect } from '#shared/safe-redirect'

useSeoMeta({
  title: 'Σύνδεση — Endaxi',
  description: 'Σύνδεση στον λογαριασμό Endaxi.',
  robots: 'noindex, nofollow',
})

const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const needsVerification = ref(false)
const resendLoading = ref(false)
const resendStatus = ref<string | null>(null)

// Δες το αντίστοιχο σχόλιο στο register.vue — ίδιο hydration-race bug.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

async function submit() {
  error.value = null
  needsVerification.value = false
  resendStatus.value = null
  loading.value = true

  const { error: e } = await authClient.signIn.email({
    email: email.value.trim(),
    password: password.value,
  })
  loading.value = false

  if (e) {
    needsVerification.value = true
    error.value = 'Λάθος email ή κωδικός, ή ο λογαριασμός δεν έχει ενεργοποιηθεί.'
    return
  }

  // Ίδιος λόγος με το register.vue — δες το σχόλιο εκεί.
  const next = safePrivateRedirect(route.query.next)
  await navigateTo(next, { external: true })
}

async function resendVerification() {
  resendLoading.value = true
  resendStatus.value = null
  try {
    await authClient.sendVerificationEmail({
      email: email.value.trim(),
      callbackURL: '/onboarding',
    })
  } finally {
    resendLoading.value = false
    resendStatus.value =
      'Το αίτημα ολοκληρώθηκε. Αν υπάρχει μη ενεργοποιημένος λογαριασμός και επιτρέπεται νέα αποστολή, θα λάβεις email.'
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-5 py-16">
    <h1 class="text-2xl font-bold">Σύνδεση</h1>

    <form class="card mt-8 space-y-5" @submit.prevent="submit">
      <div>
        <label for="email" class="label">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="input"
          required
          autocomplete="email"
        />
      </div>

      <div>
        <label for="password" class="label">Κωδικός</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="input"
          required
          autocomplete="current-password"
        />
        <div class="mt-2 text-right">
          <NuxtLink
            to="/forgot-password"
            class="text-xs font-medium underline"
            style="color: var(--color-brand-dark)"
          >
            Ξέχασες τον κωδικό;
          </NuxtLink>
        </div>
      </div>

      <p v-if="error" class="notice-danger">{{ error }}</p>
      <div v-if="needsVerification" class="text-center">
        <button
          type="button"
          class="btn-ghost"
          :disabled="resendLoading"
          @click="resendVerification"
        >
          {{ resendLoading ? 'Αποστολή…' : 'Αποστολή νέου συνδέσμου' }}
        </button>
        <p v-if="resendStatus" class="mt-2 text-xs" role="status">
          {{ resendStatus }}
        </p>
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="!mounted || loading">
        {{ loading ? 'Σύνδεση…' : 'Σύνδεση' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm" style="color: var(--color-ink-soft)">
      Δεν έχεις λογαριασμό;
      <NuxtLink to="/register" class="font-medium underline">Εγγραφή</NuxtLink>
    </p>
  </div>
</template>
