<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
  }
}>()

const statusCode = computed(() => props.error.statusCode ?? 500)
const isNotFound = computed(() => statusCode.value === 404)

useSeoMeta({
  title: () => isNotFound.value ? 'Η σελίδα δεν βρέθηκε — Endaxi' : 'Προσωρινό πρόβλημα — Endaxi',
  description: 'Η σελίδα δεν είναι διαθέσιμη.',
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
      <h1 class="mt-3 text-3xl font-bold">
        {{ isNotFound ? 'Η σελίδα δεν βρέθηκε' : 'Κάτι πήγε στραβά' }}
      </h1>
      <p class="mt-4 leading-relaxed" style="color: var(--color-ink-soft)">
        {{
          isNotFound
            ? 'Ο σύνδεσμος ίσως έχει αλλάξει ή η σελίδα δεν υπάρχει.'
            : 'Η υπηρεσία αντιμετώπισε προσωρινό πρόβλημα. Δοκίμασε ξανά σε λίγο.'
        }}
      </p>
      <button type="button" class="btn-primary mt-6" @click="returnHome">
        Επιστροφή στην αρχική
      </button>
    </div>
  </main>
</template>
