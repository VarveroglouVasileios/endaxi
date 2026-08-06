<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

const route = useRoute()
const { openPreferences: openCookiePreferences } = useCookieConsent()
const isAppArea = computed(
  () => route.path === '/app'
    || route.path.startsWith('/app/')
    || route.path.startsWith('/onboarding'),
)

/**
 * ΒΡΕΘΗΚΕ: το header έδειχνε πάντα «Σύνδεση / Ξεκίνα δωρεάν» εκτός
 * /app-/onboarding — ΑΚΟΜΑ ΚΙ ΑΝ ο χρήστης ήταν ήδη συνδεδεμένος (π.χ.
 * επέστρεφε στην αρχική σελίδα). Ο έλεγχος βασιζόταν ΜΟΝΟ στο path, ποτέ
 * στην πραγματική κατάσταση σύνδεσης — έδειχνε σαν να «αποσυνδεόταν».
 * Η session ζει σε http-only cookie (Better Auth) — ΟΧΙ localStorage —
 * οπότε το `useSession` εδώ απλά τη διαβάζει, δεν αποθηκεύει τίποτα.
 */
const { data: session } = await authClient.useSession(useFetch)
const isAuthenticated = computed(() => Boolean(session.value?.user?.emailVerified))
const showAppNav = computed(() => isAppArea.value || isAuthenticated.value)
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
        <NuxtLink to="/" class="eyebrow shrink-0">Endaxi</NuxtLink>

        <div class="flex min-w-0 items-center gap-1">
          <ClientOnly v-if="showAppNav">
            <LazyAppNavigation />
            <template #fallback>
              <nav class="flex h-11 min-w-0 items-center gap-1" aria-hidden="true" />
            </template>
          </ClientOnly>
          <nav
            v-else
            class="flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap sm:gap-1"
            aria-label="Κύρια πλοήγηση"
          >
            <NuxtLink to="/login" class="btn-ghost shrink-0">Σύνδεση</NuxtLink>
            <NuxtLink to="/register" class="btn-primary shrink-0">Ξεκίνα δωρεάν</NuxtLink>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="mt-16 text-white" style="background: #12312f">
      <div class="mx-auto max-w-5xl px-5 py-12 sm:py-14">
        <div class="grid gap-10 sm:grid-cols-[minmax(0,1.8fr)_1fr_1fr] sm:gap-8">
          <div class="max-w-sm">
            <NuxtLink
              to="/"
              class="inline-flex items-center gap-3"
              aria-label="Endaxi — Αρχική"
            >
              <span
                class="flex size-10 items-center justify-center rounded-xl"
                style="background: var(--color-brand); box-shadow: 0 8px 24px rgb(15 118 110 / 28%)"
              >
                <svg
                  aria-hidden="true"
                  class="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    d="m5 12.5 4.25 4.25L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.25"
                  />
                </svg>
              </span>
              <span class="text-xl font-bold tracking-tight">Endaxi</span>
            </NuxtLink>

            <p class="mt-5 text-base font-medium leading-relaxed" style="color: #e7f5f3">
              Το ΤΑΚΚ σου, στην ώρα του.
            </p>
            <p class="mt-2 text-sm leading-relaxed" style="color: #a9c3c0">
              Οργάνωση διαμονών και παραστατικών για ιδιοκτήτες βραχυχρόνιας
              μίσθωσης στην Ελλάδα.
            </p>

            <div class="mt-6">
              <p class="text-xs font-medium" style="color: #7fa29e">
                Σύντομα στα social
              </p>
              <div class="mt-2 flex items-center gap-2" aria-label="Social media">
                <button
                  type="button"
                  disabled
                  class="flex size-11 items-center justify-center rounded-xl border opacity-55"
                  style="border-color: rgb(169 195 192 / 24%); color: #d4e6e4"
                  aria-label="Instagram — σύντομα"
                  title="Instagram — σύντομα"
                >
                  <svg
                    aria-hidden="true"
                    class="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke-width="1.8" />
                    <circle cx="12" cy="12" r="3.75" stroke-width="1.8" />
                    <circle cx="17.6" cy="6.7" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </button>

                <button
                  type="button"
                  disabled
                  class="flex size-11 items-center justify-center rounded-xl border opacity-55"
                  style="border-color: rgb(169 195 192 / 24%); color: #d4e6e4"
                  aria-label="Facebook — σύντομα"
                  title="Facebook — σύντομα"
                >
                  <svg
                    aria-hidden="true"
                    class="size-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.8-.1-1.6-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H7.8V13h2.7v8h3.2Z" />
                  </svg>
                </button>

                <button
                  type="button"
                  disabled
                  class="flex size-11 items-center justify-center rounded-xl border opacity-55"
                  style="border-color: rgb(169 195 192 / 24%); color: #d4e6e4"
                  aria-label="X — σύντομα"
                  title="X — σύντομα"
                >
                  <svg
                    aria-hidden="true"
                    class="size-4.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.9 3H22l-6.8 7.8L23.2 21H17l-4.9-6.4L6.6 21H3.5l7.1-8.1L2.8 3h6.4l4.4 5.8L18.9 3Zm-1.1 16h1.7L8.3 4.9H6.5L17.8 19Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <nav aria-label="Πλοήγηση προϊόντος">
            <p class="text-xs font-semibold uppercase tracking-[0.14em]" style="color: #7fa29e">
              Προϊόν
            </p>
            <ul class="mt-4 space-y-3 text-sm" style="color: #d4e6e4">
              <li>
                <NuxtLink to="/" class="transition-colors hover:text-white">Αρχική</NuxtLink>
              </li>
              <li>
                <NuxtLink to="/register" class="transition-colors hover:text-white">
                  Ξεκίνα δωρεάν
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="/login" class="transition-colors hover:text-white">
                  Σύνδεση
                </NuxtLink>
              </li>
            </ul>
          </nav>

          <nav aria-label="Νομικές πληροφορίες">
            <p class="text-xs font-semibold uppercase tracking-[0.14em]" style="color: #7fa29e">
              Νομικά
            </p>
            <ul class="mt-4 space-y-3 text-sm" style="color: #d4e6e4">
              <li>
                <NuxtLink to="/oroi" class="transition-colors hover:text-white">
                  Όροι Χρήσης
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="/aporrito" class="transition-colors hover:text-white">
                  Πολιτική Απορρήτου
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="/cookies" class="transition-colors hover:text-white">
                  Πολιτική Cookies
                </NuxtLink>
              </li>
              <li>
                <button
                  type="button"
                  class="text-left transition-colors hover:text-white"
                  @click="openCookiePreferences"
                >
                  Ρυθμίσεις cookies
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div
          class="mt-10 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-end sm:justify-between"
          style="border-color: rgb(169 195 192 / 20%); color: #88a9a5"
        >
          <p class="shrink-0">© {{ new Date().getFullYear() }} Endaxi</p>
          <p class="max-w-2xl leading-relaxed sm:text-right">
            Το Endaxi είναι εργαλείο υπολογισμού και οργάνωσης. Δεν αποτελεί
            φοροτεχνική συμβουλή και δεν υποβάλλει στοιχεία στην ΑΑΔΕ για λογαριασμό σου.
          </p>
        </div>

        <!--
          Στοιχεία φορέα παροχής υπηρεσίας, μόνιμα προσβάσιμα σε κάθε σελίδα
          (άρ. 4 Π.Δ. 131/2003, ενσωμάτωση Οδηγίας 2000/31/ΕΚ για το
          ηλεκτρονικό εμπόριο): επωνυμία, γεωγραφική διεύθυνση, στοιχεία
          επικοινωνίας. Δεν είναι εγγεγραμμένος σε εμπορικό/ΓΕΜΗ μητρώο
          (ατομική δραστηριότητα) — δεν εφαρμόζεται η υποχρέωση του άρ. 4δ.
        -->
        <div
          class="mt-4 border-t pt-4 text-[11px] leading-relaxed"
          style="border-color: rgb(169 195 192 / 20%); color: #7fa29e"
        >
          Πάροχος υπηρεσίας: Βασίλης Βαρβέρογλου, ΑΦΜ 171158067, Ελευθερές,
          Καβάλα — <a href="mailto:privacy@endaxi.app" class="underline">privacy@endaxi.app</a>
        </div>
      </div>
    </footer>

    <ClientOnly>
      <CookieConsent />
      <ChatWidgetLoader />
      <ConfirmDialogHost />
      <ToastHost />
    </ClientOnly>
  </div>
</template>
