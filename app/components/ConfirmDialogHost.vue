<script setup lang="ts">
const { state, respond } = useConfirmDialog()

function onKeydown(e: KeyboardEvent) {
  if (!state.value.open) return
  if (e.key === 'Escape') respond(false)
  if (e.key === 'Enter') respond(true)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="state.open"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style="background: rgb(0 0 0 / 45%)"
        role="presentation"
        @click.self="respond(false)"
      >
        <div
          class="w-full max-w-sm rounded-2xl p-6"
          style="background: var(--color-surface); border: 1px solid var(--color-line); box-shadow: 0 20px 60px rgb(0 0 0 / 25%)"
          role="alertdialog"
          aria-modal="true"
          :aria-label="state.title"
        >
          <h2 class="text-base font-bold" style="color: var(--color-ink)">
            {{ state.title }}
          </h2>
          <p
            v-if="state.message"
            class="mt-2 text-sm leading-relaxed whitespace-pre-line"
            style="color: var(--color-ink-soft)"
          >
            {{ state.message }}
          </p>

          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="btn-secondary" @click="respond(false)">
              {{ state.cancelLabel }}
            </button>
            <button
              type="button"
              class="btn"
              :style="state.danger
                ? 'background: var(--color-danger); color: #fff'
                : 'background: var(--color-brand); color: #fff'"
              autofocus
              @click="respond(true)"
            >
              {{ state.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 150ms ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
</style>
