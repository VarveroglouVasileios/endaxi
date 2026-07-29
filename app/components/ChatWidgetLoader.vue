<script setup lang="ts">
const { hasDecision, preferencesOpen } = useCookieConsent()
const loaded = ref(false)

const triggerVisible = computed(
  () => hasDecision.value && !preferencesOpen.value && !loaded.value,
)
</script>

<template>
  <div>
    <button
      v-if="triggerVisible"
      type="button"
      class="fixed right-4 z-40 flex min-h-13 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-xl sm:right-5"
      style="bottom: max(1rem, env(safe-area-inset-bottom)); background: var(--color-brand)"
      aria-label="Άνοιγμα AI βοήθειας"
      @click="loaded = true"
    >
      <svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M8 10h.01M12 10h.01M16 10h.01M6.8 18.1 4 20l.8-3.5A8 8 0 1 1 20 13a8 8 0 0 1-13.2 5.1Z"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
        />
      </svg>
      AI Βοήθεια
    </button>

    <LazyHelpChat v-if="loaded" start-open />
  </div>
</template>
