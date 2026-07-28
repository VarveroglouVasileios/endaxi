<script setup lang="ts">
useSeoMeta({
  title: 'Εντάξει — Το ΤΑΚΚ σου εκδίδεται μόνο του',
  description:
    'Συνδέεις το ημερολόγιό σου μία φορά. Το Τέλος Ανθεκτικότητας εκδίδεται αυτόματα κάθε μήνα, με σωστή σειρά και αύξοντα αριθμό. Χωρίς μπλοκάκι, χωρίς Excel.',
  ogTitle: 'Εντάξει — Είσαι εντάξει με την ΑΑΔΕ',
  ogDescription:
    'Compliance autopilot για βραχυχρόνια μίσθωση. Το ΤΑΚΚ σου, αυτόματα.',
  ogLocale: 'el_GR',
})

const steps = [
  {
    n: '1',
    title: 'Πρόσθεσε το ακίνητό σου',
    body: 'ΑΜΑ, όνομα, κατηγορία. Μισό λεπτό.',
  },
  {
    n: '2',
    title: 'Κάνε paste το iCal link',
    body: 'Από Airbnb, Booking ή Vrbo. Σου δείχνουμε αμέσως πόσες κρατήσεις βρήκαμε.',
  },
  {
    n: '3',
    title: 'Τέλος',
    body: 'Από εδώ και πέρα δεν κάνεις τίποτα. Τα παραστατικά βγαίνουν μόνα τους.',
  },
]

const problems = [
  {
    q: '«Εκεί που γράφει σειρά, τι βάζουμε;»',
    a: 'Αυτόματη σειρά και αύξων αριθμός, χωρίς κενά. Τέλος το μπλοκάκι.',
  },
  {
    q: '«Ο πελάτης έφυγε 1η Μαΐου — σε ποιον μήνα ανήκει;»',
    a: 'Στον Μάιο. Το υπολογίζουμε από την αναχώρηση, όπως ορίζει ο νόμος.',
  },
  {
    q: '«Η διαμονή πιάνει Οκτώβριο και Νοέμβριο μαζί.»',
    a: 'Κάθε νύχτα χρεώνεται με τη δική της περίοδο. 8 + 8 + 2 = 18€, όχι 24€.',
  },
  {
    q: '«Ξέχασα τη δήλωση και ήρθε πρόστιμο.»',
    a: 'Υπενθύμιση την 1η και ξανά στις 25, με το ακριβές ποσό.',
  },
]
</script>

<template>
  <div>
    <!-- ── Hero ── -->
    <section class="mx-auto max-w-5xl px-5 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div class="max-w-2xl">
        <p class="eyebrow mb-5">Για ιδιοκτήτες με 1–2 ακίνητα</p>
        <h1 class="text-5xl leading-[1.05] font-bold sm:text-6xl">
          Είσαι εντάξει.
        </h1>
        <p
          class="mt-6 text-lg leading-relaxed"
          style="color: var(--color-ink-soft)"
        >
          Συνδέεις το ημερολόγιό σου <strong>μία φορά</strong>. Από εκεί και πέρα
          το Τέλος Ανθεκτικότητας εκδίδεται μόνο του κάθε μήνα — με σωστή σειρά,
          σωστό μήνα, σωστό ποσό.
        </p>

        <div class="mt-9 flex flex-wrap items-center gap-3">
          <NuxtLink to="/register" class="btn-primary btn-lg">
            Ξεκίνα δωρεάν
          </NuxtLink>
          <span class="text-sm" style="color: var(--color-ink-muted)">
            Χωρίς κάρτα · 5 παραστατικά τον μήνα δωρεάν
          </span>
        </div>
      </div>
    </section>

    <!-- ── Το πρόβλημα ── -->
    <section class="border-y bg-white" style="border-color: var(--color-line)">
      <div class="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 class="text-2xl font-bold sm:text-3xl">
          Αυτά ρωτάει ο κόσμος κάθε μέρα
        </h2>
        <p class="mt-3 max-w-xl" style="color: var(--color-ink-soft)">
          Το ΤΑΚΚ απαιτεί ξεχωριστό παραστατικό ανά διαμονή, με σειρά και
          αύξοντα αριθμό, και μηνιαία δήλωση. Καμία πλατφόρμα δεν το υποστηρίζει.
        </p>

        <dl class="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <div v-for="p in problems" :key="p.q">
            <dt class="font-medium" style="color: var(--color-ink)">
              {{ p.q }}
            </dt>
            <dd class="mt-2 text-sm leading-relaxed" style="color: var(--color-ink-soft)">
              {{ p.a }}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ── Πώς δουλεύει ── -->
    <section class="mx-auto max-w-5xl px-5 py-16 sm:py-20">
      <h2 class="text-2xl font-bold sm:text-3xl">Δύο λεπτά, μία φορά</h2>

      <ol class="mt-10 grid gap-6 sm:grid-cols-3">
        <li v-for="s in steps" :key="s.n" class="card">
          <div
            class="mb-4 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
            style="background: var(--color-brand)"
          >
            {{ s.n }}
          </div>
          <h3 class="font-semibold">{{ s.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed" style="color: var(--color-ink-soft)">
            {{ s.body }}
          </p>
        </li>
      </ol>

      <div class="notice-info mt-8">
        <strong>Δεν χρειάζεται να κατεβάσεις τίποτα.</strong> Χρησιμοποιούμε το
        iCal link που δίνουν ήδη οι πλατφόρμες — δεν χρειαζόμαστε τους κωδικούς σου
        ούτε τα ποσά των κρατήσεων. Το ΤΑΚΚ είναι σταθερό ποσό ανά διανυκτέρευση,
        οπότε μας αρκούν οι ημερομηνίες.
      </div>
    </section>

    <!-- ── Το όριο ── -->
    <section class="border-t bg-white" style="border-color: var(--color-line)">
      <div class="mx-auto max-w-5xl px-5 py-16">
        <div class="max-w-2xl">
          <h2 class="text-xl font-bold">Για ποιους είναι — και για ποιους όχι</h2>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <div class="notice-ok">
              <strong>1–2 ακίνητα, φυσικό πρόσωπο</strong>
              <p class="mt-1.5">
                Δεν τηρείς βιβλία. Το Εντάξει καλύπτει πλήρως τις υποχρεώσεις ΤΑΚΚ.
              </p>
            </div>
            <div class="notice-warn">
              <strong>3+ ακίνητα ή εταιρεία</strong>
              <p class="mt-1.5">
                Είσαι επιτηδευματίας — χρειάζεσαι βιβλία και διαβίβαση myDATA.
                Ετοιμάζουμε σύνδεση με πιστοποιημένο πάροχο.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA ── -->
    <section class="mx-auto max-w-5xl px-5 py-20 text-center">
      <h2 class="text-3xl font-bold">Είσαι εντάξει.</h2>
      <p class="mx-auto mt-3 max-w-md" style="color: var(--color-ink-soft)">
        Δύο λεπτά τώρα, και δεν ξανασχολείσαι.
      </p>
      <NuxtLink to="/register" class="btn-primary btn-lg mt-8">
        Ξεκίνα δωρεάν
      </NuxtLink>
    </section>
  </div>
</template>
