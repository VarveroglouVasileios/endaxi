<script setup lang="ts">
const {
  preferences,
  preferencesOpen,
  hasDecision,
  savePreferences,
  closePreferences,
} = useCookieConsent()

const mounted = ref(false)
const detailsOpen = ref(false)
const analyticsEnabled = ref(false)
const dialog = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const visible = computed(
  () => mounted.value && (!hasDecision.value || preferencesOpen.value),
)

onMounted(() => {
  mounted.value = true
  analyticsEnabled.value = preferences.value?.analytics ?? false
})

watch(preferencesOpen, (open) => {
  if (!open) return
  analyticsEnabled.value = preferences.value?.analytics ?? false
  detailsOpen.value = true
})

watch(visible, async (isVisible) => {
  if (isVisible && hasDecision.value && preferencesOpen.value) {
    previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    await nextTick()
    focusableElements()[0]?.focus()
    return
  }

  previouslyFocused?.focus()
  previouslyFocused = null
})

function focusableElements(): HTMLElement[] {
  if (!dialog.value) return []
  return Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && hasDecision.value) {
    event.preventDefault()
    closePreferences()
  }
}

function acceptAll() {
  savePreferences(true)
}

function acceptNecessary() {
  savePreferences(false)
}

function saveSelection() {
  savePreferences(analyticsEnabled.value)
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="translate-y-4 opacity-0"
  >
    <section
      v-if="visible"
      ref="dialog"
      class="fixed inset-x-3 z-50 mx-auto max-h-[calc(100dvh-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl border bg-white shadow-2xl"
      style="bottom: max(0.75rem, env(safe-area-inset-bottom)); border-color: var(--color-line)"
      :role="hasDecision ? 'dialog' : 'region'"
      :aria-modal="hasDecision ? 'false' : undefined"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      @keydown="handleDialogKeydown"
    >
      <div class="p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <span
            class="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex"
            style="background: var(--color-brand-light); color: var(--color-brand-dark)"
            aria-hidden="true"
          >
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="M12 3a2.75 2.75 0 0 0 3.55 2.63A3.5 3.5 0 0 0 20.5 10a3 3 0 0 0 .5 5.96A9 9 0 1 1 12 3Z"
              />
              <circle cx="8.25" cy="10.25" r=".8" fill="currentColor" stroke="none" />
              <circle cx="12.5" cy="14.5" r=".8" fill="currentColor" stroke="none" />
              <circle cx="7.5" cy="16" r=".8" fill="currentColor" stroke="none" />
            </svg>
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <h2 id="cookie-consent-title" class="text-base font-bold">
                Εσύ επιλέγεις τα cookies
              </h2>
              <button
                v-if="hasDecision"
                type="button"
                class="-mr-1 -mt-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2"
                aria-label="Κλείσιμο ρυθμίσεων cookies"
                style="color: var(--color-ink-muted)"
                @click="closePreferences"
              >
                <svg aria-hidden="true" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-width="2" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p
              id="cookie-consent-description"
              class="mt-1.5 text-sm leading-relaxed"
              style="color: var(--color-ink-soft)"
            >
              Τα απαραίτητα cookies κρατούν ασφαλή τη σύνδεσή σου. Τα προαιρετικά
              στατιστικά μάς βοηθούν να βελτιώνουμε την εμπειρία μόνο με τη συγκατάθεσή σου.
              <NuxtLink to="/cookies" class="font-medium underline">Μάθε περισσότερα</NuxtLink>.
            </p>
          </div>
        </div>

        <div v-if="detailsOpen" class="mt-5 space-y-3">
          <label
            class="flex items-start justify-between gap-4 rounded-xl border p-3.5"
            style="border-color: var(--color-line); background: var(--color-paper)"
          >
            <span>
              <span class="block text-sm font-semibold">Απαραίτητα</span>
              <span class="mt-0.5 block text-xs" style="color: var(--color-ink-muted)">
                Σύνδεση, ασφάλεια και αποθήκευση της επιλογής σου.
              </span>
            </span>
            <input
              type="checkbox"
              checked
              disabled
              class="mt-1 size-4 accent-[var(--color-brand)]"
              aria-label="Απαραίτητα cookies, πάντα ενεργά"
            />
          </label>

          <label
            class="flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-3.5"
            style="border-color: var(--color-line)"
          >
            <span>
              <span class="block text-sm font-semibold">Στατιστικά</span>
              <span class="mt-0.5 block text-xs" style="color: var(--color-ink-muted)">
                Ανώνυμη κατανόηση της χρήσης. Δεν είναι ενεργά αυτή τη στιγμή.
              </span>
            </span>
            <input
              v-model="analyticsEnabled"
              type="checkbox"
              class="mt-1 size-4 accent-[var(--color-brand)]"
            />
          </label>
        </div>

        <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            v-if="!detailsOpen"
            type="button"
            class="btn-ghost"
            @click="detailsOpen = true"
          >
            Ρυθμίσεις
          </button>
          <button
            v-if="detailsOpen"
            type="button"
            class="btn-secondary"
            @click="saveSelection"
          >
            Αποθήκευση επιλογών
          </button>
          <button type="button" class="btn-secondary" @click="acceptNecessary">
            Μόνο απαραίτητα
          </button>
          <button type="button" class="btn-primary" @click="acceptAll">
            Αποδοχή όλων
          </button>
        </div>
      </div>
    </section>
  </Transition>
</template>
