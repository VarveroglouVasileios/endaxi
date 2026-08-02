<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
  }
}>()

const statusCode = computed(() => props.error.statusCode ?? 500)
const isNotFound = computed(() => statusCode.value === 404)
const isForbidden = computed(() => statusCode.value === 403)

const title = computed(() => {
  if (isNotFound.value) return 'Η σελίδα δεν βρέθηκε'
  if (isForbidden.value) return 'Δεν έχεις πρόσβαση'
  return 'Κάτι πήγε στραβά'
})

const description = computed(() => {
  if (isNotFound.value) return 'Ο σύνδεσμος ίσως έχει αλλάξει ή η σελίδα δεν υπάρχει.'
  if (isForbidden.value) return 'Δεν έχεις δικαίωμα πρόσβασης σε αυτή τη σελίδα με τον τρέχοντα λογαριασμό σου.'
  return 'Η υπηρεσία αντιμετώπισε προσωρινό πρόβλημα. Δοκίμασε ξανά σε λίγο.'
})

useSeoMeta({
  title: () => `${title.value} — Endaxi`,
  description: () => description.value,
  robots: 'noindex, nofollow',
})

async function returnHome() {
  await clearError({ redirect: '/' })
}
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-5 py-16">
    <div class="card max-w-lg text-center">
      <p class="eyebrow">{{ statusCode }}</p>
      <h1 class="mt-3 text-3xl font-bold">{{ title }}</h1>
      <p class="mt-4 leading-relaxed" style="color: var(--color-ink-soft)">
        {{ description }}
      </p>
      <button type="button" class="btn-primary mt-6" @click="returnHome">
        Επιστροφή στην αρχική
      </button>
    </div>
  </main>
</template>
