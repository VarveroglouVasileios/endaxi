<script setup lang="ts">
const { isDark, toggleTheme } = useColorTheme()
</script>

<template>
  <button
    type="button"
    class="btn-ghost min-w-11 shrink-0 !px-2.5"
    :aria-label="isDark ? 'Ενεργοποίηση φωτεινού θέματος' : 'Ενεργοποίηση σκοτεινού θέματος'"
    :title="isDark ? 'Φωτεινό θέμα' : 'Σκοτεινό θέμα'"
    @click="toggleTheme"
  >
    <svg
      v-if="isDark"
      aria-hidden="true"
      class="size-4.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="3.5" stroke-width="1.8" />
      <path
        stroke-linecap="round"
        stroke-width="1.8"
        d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.28 5.28l1.42 1.42M17.3 17.3l1.42 1.42M18.72 5.28 17.3 6.7M6.7 17.3l-1.42 1.42"
      />
    </svg>
    <svg
      v-else
      aria-hidden="true"
      class="size-4.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
        d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5a8.5 8.5 0 1 0 11.7 11.7Z"
      />
    </svg>
  </button>
</template>
