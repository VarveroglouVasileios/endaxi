<script setup lang="ts">
defineProps<{ current: 1 | 2 | 3 }>()

const steps = [
  { n: 1, label: 'Καθεστώς' },
  { n: 2, label: 'Ακίνητο' },
  { n: 3, label: 'Ημερολόγιο' },
]
</script>

<template>
  <ol class="flex items-center gap-2">
    <li v-for="(s, i) in steps" :key="s.n" class="flex flex-1 items-center gap-2">
      <div class="flex items-center gap-2">
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          :style="
            s.n <= current
              ? 'background: var(--color-brand); color: #fff'
              : 'background: var(--color-line); color: var(--color-ink-muted)'
          "
        >
          {{ s.n < current ? '✓' : s.n }}
        </span>
        <span
          class="hidden text-xs font-medium sm:inline"
          :style="
            s.n <= current
              ? 'color: var(--color-ink)'
              : 'color: var(--color-ink-muted)'
          "
        >
          {{ s.label }}
        </span>
      </div>
      <span
        v-if="i < steps.length - 1"
        class="h-px flex-1"
        :style="
          s.n < current
            ? 'background: var(--color-brand)'
            : 'background: var(--color-line)'
        "
      />
    </li>
  </ol>
</template>
