<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

const { data: session } = await authClient.useSession(useFetch)

async function handleSignOut() {
  await authClient.signOut()
  await navigateTo('/')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="border-b" style="border-color: var(--color-line)">
      <!--
        ΒΡΕΘΗΚΕ ΜΕ ΠΡΑΓΜΑΤΙΚΟ mobile-viewport test (390px, όπως iPhone): το
        authenticated nav («Παραστατικά · Διαμονές · Ακίνητα · Ρυθμίσεις ·
        Έξοδος») δεν χωράει ΠΟΤΕ σε τηλέφωνο — και επειδή δεν υπήρχε κανένα
        `overflow`/`wrap` όριο, δεν μάζευε απλώς το ίδιο το nav· έσπρωχνε
        ΟΛΗ τη σελίδα σε πλάτος >590px, προκαλώντας οριζόντιο scroll σε
        ΚΑΘΕ authenticated σελίδα (dashboard, ρυθμίσεις, ακίνητα, διαμονές,
        onboarding). Ορατό ΜΟΝΟ σε πραγματικό mobile viewport, όχι σε
        desktop browser test.
        Λύση: `min-w-0` στον header container (επιτρέπει στο flex child να
        μικρύνει κάτω από το content-based πλάτος του) + `overflow-x-auto`
        στο ίδιο το nav, ώστε αν ακόμα δεν χωράει, να scrollάρει ΜΟΝΟ η
        μπάρα πλοήγησης — ποτέ ξανά ολόκληρη η σελίδα.
      -->
      <div class="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-5">
        <NuxtLink to="/" class="eyebrow shrink-0">Εντάξει</NuxtLink>

        <!--
          ΒΡΕΘΗΚΕ ΜΕ ΠΡΑΓΜΑΤΙΚΟ BROWSER TEST: για ήδη συνδεδεμένο χρήστη, το
          SSR render έβλεπε session (άρα «Παραστατικά» κλπ) αλλά η πρώτη
          στιγμή του client hydration έβλεπε ΑΚΟΜΑ null session («Σύνδεση»,
          «Ξεκίνα δωρεάν») — το `authClient.useSession(useFetch)` λύνεται
          ασύγχρονα διαφορετικά stateful στο server vs client payload replay.
          Vue το ανίχνευε ως hydration text/attribute/children mismatch σε
          ΚΑΘΕ NuxtLink του nav και πετούσε όλο το SSR HTML για να κάνει
          πλήρες client re-render — ορατό flicker + άχρηστο κόστος.

          Λύση: το session-εξαρτώμενο nav renderάρεται ΜΟΝΟ στον client
          (`<ClientOnly>`), με ένα ουδέτερο fallback ίδιου μεγέθους/ύψους
          όσο διαρκεί το πρώτο mount — έτσι δεν υπάρχει καθόλου σύγκριση
          SSR/CSR σε αυτό το κομμάτι, άρα μηδέν πιθανότητα mismatch.
        -->
        <ClientOnly>
          <nav
            class="flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap sm:gap-1"
          >
            <template v-if="session">
              <NuxtLink to="/app" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">Παραστατικά</NuxtLink>
              <NuxtLink to="/app/diamones" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">Διαμονές</NuxtLink>
              <NuxtLink to="/app/akinita" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">Ακίνητα</NuxtLink>
              <NuxtLink to="/app/rythmiseis" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">Ρυθμίσεις</NuxtLink>
              <button class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5" @click="handleSignOut">Έξοδος</button>
            </template>
            <template v-else>
              <NuxtLink to="/login" class="btn-ghost shrink-0">Σύνδεση</NuxtLink>
              <NuxtLink to="/register" class="btn-primary shrink-0">Ξεκίνα δωρεάν</NuxtLink>
            </template>
          </nav>
          <template #fallback>
            <nav class="flex h-9 min-w-0 items-center gap-1" aria-hidden="true" />
          </template>
        </ClientOnly>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t py-8" style="border-color: var(--color-line)">
      <div
        class="mx-auto flex max-w-5xl flex-col gap-3 px-5 text-xs sm:flex-row sm:items-center sm:justify-between"
        style="color: var(--color-ink-muted)"
      >
        <p>© {{ new Date().getFullYear() }} Εντάξει</p>
        <nav class="flex gap-4">
          <NuxtLink to="/oroi">Όροι Χρήσης</NuxtLink>
          <NuxtLink to="/aporrito">Απόρρητο</NuxtLink>
        </nav>
      </div>
      <p
        class="mx-auto mt-4 max-w-5xl px-5 text-[11px] leading-relaxed"
        style="color: var(--color-ink-muted)"
      >
        Το Εντάξει είναι εργαλείο υπολογισμού και οργάνωσης. Δεν αποτελεί
        φοροτεχνική συμβουλή και δεν υποβάλλει τίποτα στην ΑΑΔΕ για λογαριασμό σου.
      </p>
    </footer>
  </div>
</template>
