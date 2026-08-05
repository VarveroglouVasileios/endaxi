<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

async function handleSignOut() {
  await authClient.signOut()
  await navigateTo('/')
}

/**
 * ΒΡΕΘΗΚΕ ΣΕ VISUAL TEST (mobile, 390px): σε στενή οθόνη το nav δεν χωράει
 * και γίνεται οριζόντια scrollable strip (`overflow-x-auto`) — σωστό, αλλά
 * χωρίς καμία οπτική ένδειξη ο χρήστης δεν καταλάβαινε ότι υπάρχουν κι άλλα
 * κουμπιά δεξιά (π.χ. «Ρυθμίσεις», «Feedback», «Έξοδος» ήταν αόρατα, εκτός
 * scroll). Fix: δύο fade overlays στα άκρα, ορατά ΜΟΝΟ όταν υπάρχει
 * πραγματικά κρυμμένο περιεχόμενο προς τα εκεί (όχι στατικά — αλλιώς θα
 * έδειχνε ψευδώς «σβησμένο» το πρώτο/τελευταίο κουμπί ακόμα κι όταν όλα
 * χωράνε).
 */
const navEl = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollShadows() {
  const el = navEl.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 2
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
}

onMounted(() => {
  updateScrollShadows()
  navEl.value?.addEventListener('scroll', updateScrollShadows, { passive: true })
  window.addEventListener('resize', updateScrollShadows)
})
onBeforeUnmount(() => {
  navEl.value?.removeEventListener('scroll', updateScrollShadows)
  window.removeEventListener('resize', updateScrollShadows)
})
</script>

<template>
  <div class="relative min-w-0">
    <nav
      ref="navEl"
      class="flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap sm:gap-1"
      aria-label="Πλοήγηση εφαρμογής"
    >
      <NuxtLink to="/app" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
        Παραστατικά
      </NuxtLink>
      <NuxtLink to="/app/diamones" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
        Διαμονές
      </NuxtLink>
      <NuxtLink to="/app/eisodima" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
        Εισόδημα
      </NuxtLink>
      <NuxtLink to="/app/akinita" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
        Ακίνητα
      </NuxtLink>
      <NuxtLink to="/app/rythmiseis" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
        Ρυθμίσεις
      </NuxtLink>
      <NuxtLink to="/app/feedback" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
        Feedback
      </NuxtLink>
      <button class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5" @click="handleSignOut">
        Έξοδος
      </button>
    </nav>

    <div
      v-show="canScrollLeft"
      class="pointer-events-none absolute inset-y-0 left-0 w-6"
      style="background: linear-gradient(to right, var(--color-paper), transparent)"
      aria-hidden="true"
    />
    <div
      v-show="canScrollRight"
      class="pointer-events-none absolute inset-y-0 right-0 w-6"
      style="background: linear-gradient(to left, var(--color-paper), transparent)"
      aria-hidden="true"
    />
  </div>
</template>
