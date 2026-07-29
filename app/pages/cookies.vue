<script setup lang="ts">
useCanonicalSeo({
  title: 'Πολιτική Cookies — Endaxi',
  description: 'Ποια cookies χρησιμοποιεί το Endaxi και πώς ελέγχεις τις επιλογές σου.',
  robots: 'noindex, follow',
})

const updated = '29 Ιουλίου 2026'
const { openPreferences } = useCookieConsent()
</script>

<template>
  <article class="mx-auto max-w-2xl px-5 py-16">
    <h1 class="text-3xl font-bold">Πολιτική Cookies</h1>
    <p class="mt-2 text-sm" style="color: var(--color-ink-muted)">
      Τελευταία ενημέρωση: {{ updated }}
    </p>

    <div class="notice-warn mt-8">
      <strong>Πρόχειρο προς νομικό έλεγχο.</strong> Η πολιτική πρέπει να ελεγχθεί
      μαζί με την τελική ρύθμιση των υπηρεσιών πριν από τη δημόσια κυκλοφορία.
    </div>

    <div class="mt-10 space-y-9 text-sm leading-relaxed">
      <section>
        <h2 class="text-lg font-bold">1. Τι είναι τα cookies</h2>
        <p class="mt-3">
          Τα cookies είναι μικρά αρχεία που αποθηκεύονται στη συσκευή σου όταν
          χρησιμοποιείς έναν ιστότοπο. Μας επιτρέπουν να διατηρούμε τη σύνδεσή σου,
          να προστατεύουμε τον λογαριασμό και να θυμόμαστε τις επιλογές απορρήτου σου.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">2. Απαραίτητα cookies</h2>
        <p class="mt-3">
          Χρησιμοποιούνται χωρίς προαιρετική συγκατάθεση, επειδή είναι αναγκαία
          για τη λειτουργία και την ασφάλεια της υπηρεσίας.
        </p>
        <div class="mt-4 space-y-3">
          <div class="card !p-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-semibold">Cookies συνεδρίας Endaxi</p>
              <span class="text-xs" style="color: var(--color-ink-muted)">έως 30 ημέρες</span>
            </div>
            <p class="mt-1.5" style="color: var(--color-ink-soft)">
              Διατηρούν την ασφαλή σύνδεση και αναγνωρίζουν την ενεργή συνεδρία.
              Στην παραγωγή μπορεί να εμφανίζονται με ασφαλές πρόθεμα
              <code>__Secure-endaxi</code>.
            </p>
          </div>

          <div class="card !p-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-semibold"><code>endaxi_cookie_consent</code></p>
              <span class="text-xs" style="color: var(--color-ink-muted)">180 ημέρες</span>
            </div>
            <p class="mt-1.5" style="color: var(--color-ink-soft)">
              Αποθηκεύει μόνο τις επιλογές σου για τις κατηγορίες cookies.
            </p>
          </div>

          <div class="card !p-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-semibold"><code>endaxi_theme</code></p>
              <span class="text-xs" style="color: var(--color-ink-muted)">365 ημέρες</span>
            </div>
            <p class="mt-1.5" style="color: var(--color-ink-soft)">
              Θυμάται αν προτιμάς φωτεινό ή σκοτεινό θέμα.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-bold">3. Στατιστικά cookies</h2>
        <p class="mt-3">
          Η κατηγορία αυτή είναι προαιρετική και παραμένει απενεργοποιημένη μέχρι
          να δώσεις συγκατάθεση. <strong>Δεν χρησιμοποιούνται στατιστικά cookies
          αυτή τη στιγμή.</strong> Αν ενεργοποιηθεί υπηρεσία analytics, η πολιτική
          θα ενημερωθεί με τον πάροχο, τα συγκεκριμένα cookies και τη διάρκειά τους.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">4. Τι δεν χρησιμοποιούμε</h2>
        <p class="mt-3">
          Δεν χρησιμοποιούμε cookies διαφήμισης, δημιουργίας διαφημιστικού προφίλ
          ή παρακολούθησης μεταξύ διαφορετικών ιστοτόπων.
        </p>
        <p class="mt-3">
          Η συνομιλία με τον AI βοηθό διατηρείται μόνο προσωρινά στη μνήμη της
          ανοιχτής σελίδας. Δεν αποθηκεύεται σε cookie ή localStorage και χάνεται
          με την ανανέωση της σελίδας. Η αποστολή μηνύματος στον πάροχο AI είναι
          επεξεργασία δεδομένων που περιγράφεται στην
          <NuxtLink to="/aporrito" class="underline">Πολιτική Απορρήτου</NuxtLink>
          και δεν αποτελεί κατηγορία cookie.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">5. Πώς αλλάζεις επιλογές</h2>
        <p class="mt-3">
          Μπορείς ανά πάσα στιγμή να αλλάξεις ή να ανακαλέσεις τη συγκατάθεσή σου.
          Η ανάκληση δεν επηρεάζει την προηγούμενη νόμιμη επεξεργασία.
        </p>
        <button type="button" class="btn-secondary mt-4" @click="openPreferences">
          Άνοιγμα ρυθμίσεων cookies
        </button>
        <p class="mt-4" style="color: var(--color-ink-soft)">
          Μπορείς επίσης να διαγράψεις cookies από τις ρυθμίσεις του browser.
          Η διαγραφή των απαραίτητων cookies μπορεί να σε αποσυνδέσει.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">6. Νομική βάση και επικοινωνία</h2>
        <p class="mt-3">
          Για τα απαραίτητα cookies βασιζόμαστε στην παροχή και ασφάλεια της
          υπηρεσίας. Για οποιαδήποτε προαιρετική στατιστική μέτρηση βασιζόμαστε
          στη συγκατάθεσή σου, την οποία μπορείς να ανακαλέσεις ελεύθερα.
        </p>
        <p class="mt-3">
          Για ερωτήσεις:
          <a href="mailto:privacy@endaxi.app" class="underline">privacy@endaxi.app</a>.
          Δες επίσης την
          <NuxtLink to="/aporrito" class="underline">Πολιτική Απορρήτου</NuxtLink>.
        </p>
      </section>
    </div>
  </article>
</template>
