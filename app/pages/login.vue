<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

useSeoMeta({ title: 'Σύνδεση — Εντάξει', robots: 'noindex' })

const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

// Δες το αντίστοιχο σχόλιο στο register.vue — ίδιο hydration-race bug.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

async function submit() {
  error.value = null
  loading.value = true

  const { error: e } = await authClient.signIn.email({
    email: email.value.trim(),
    password: password.value,
  })
  loading.value = false

  if (e) {
    error.value = 'Λάθος email ή κωδικός.'
    return
  }

  // Ίδιος λόγος με το register.vue — δες το σχόλιο εκεί.
  const next = (route.query.next as string) || '/app'
  await navigateTo(next, { external: true })
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
        <div class="mb-1.5 flex items-center justify-between gap-3">
          <label for="password" class="text-sm font-medium">Κωδικός</label>
          <NuxtLink
            to="/forgot-password"
            class="text-xs font-medium underline"
            style="color: var(--color-brand-dark)"
          >
            Ξέχασες τον κωδικό;
          </NuxtLink>
        </div>
        <input
          id="password"
          v-model="password"
          type="password"
          class="input"
          required
          autocomplete="current-password"
        />
      </div>

      <p v-if="error" class="notice-danger">{{ error }}</p>

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
