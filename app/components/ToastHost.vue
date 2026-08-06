<script setup lang="ts">
const { toasts, dismiss } = useToast()

const STYLES = {
  error: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)', icon: '⚠' },
  success: { bg: 'var(--color-ok-bg)', color: 'var(--color-ok)', icon: '✓' },
  info: { bg: 'var(--color-brand-light)', color: 'var(--color-brand-dark)', icon: 'ℹ' },
} as const
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      <TransitionGroup name="toast-fade">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg"
          :style="`background: ${STYLES[t.type].bg}; color: ${STYLES[t.type].color}; border: 1px solid color-mix(in srgb, ${STYLES[t.type].color} 25%, transparent)`"
          role="status"
        >
          <span aria-hidden="true">{{ STYLES[t.type].icon }}</span>
          <p class="flex-1 leading-relaxed">{{ t.message }}</p>
          <button
            type="button"
            class="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Κλείσιμο"
            @click="dismiss(t.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 200ms ease;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
