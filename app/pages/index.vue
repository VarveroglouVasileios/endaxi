<script setup lang="ts">
const seoTitle = 'Παραστατικά ΤΑΚΚ για βραχυχρόνια μίσθωση — Endaxi'
const seoDescription
  = 'Οργάνωσε διαμονές και παραστατικά ΤΑΚΚ με σύνδεση iCal, υπολογισμούς και υπενθυμίσεις. Εσύ ελέγχεις και υποβάλλεις ό,τι απαιτείται.'

useCanonicalSeo({
  title: seoTitle,
  description: seoDescription,
})

const config = useRuntimeConfig()
const siteUrl = config.public.appUrl.replace(/\/+$/u, '')

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
    title: 'Έλεγξε και οργάνωσε',
    body: 'Βλέπεις συγκεντρωμένα τα παραστατικά και τις υπενθυμίσεις κάθε μήνα.',
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

useHead({
  script: [
    {
      key: 'endaxi-structured-data',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: 'Endaxi',
            url: siteUrl,
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            url: siteUrl,
            name: 'Endaxi',
            inLanguage: 'el-GR',
            publisher: { '@id': `${siteUrl}/#organization` },
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${siteUrl}/#software`,
            name: 'Endaxi',
            url: siteUrl,
            description: seoDescription,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            inLanguage: 'el-GR',
            publisher: { '@id': `${siteUrl}/#organization` },
          },
          {
            '@type': 'FAQPage',
            '@id': `${siteUrl}/#faq`,
            mainEntity: problems.map(problem => ({
              '@type': 'Question',
              name: problem.q.replaceAll('«', '').replaceAll('»', ''),
              acceptedAnswer: {
                '@type': 'Answer',
                text: problem.a,
              },
            })),
          },
        ],
      }),
    },
  ],
})
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
          το Endaxi οργανώνει τους υπολογισμούς και τα παραστατικά κάθε μήνα —
          εσύ τα ελέγχεις πριν τα χρησιμοποιήσεις.
        </p>

        <p class="mt-5">
          <span
            class="badge"
            style="background: var(--color-ok-bg, var(--color-paper)); color: var(--color-ok)"
          >
            100% δωρεάν προς το παρόν
          </span>
        </p>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <NuxtLink to="/register" class="btn-primary btn-lg">
            Ξεκίνα δωρεάν
          </NuxtLink>
          <span class="text-sm" style="color: var(--color-ink-muted)">
            Χωρίς κάρτα, καμία χρέωση
          </span>
        </div>
      </div>
    </section>

    <!-- ── Το πρόβλημα ── -->
    <section class="border-y bg-white" style="border-color: var(--color-line)">
      <div class="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 v-reveal class="text-2xl font-bold sm:text-3xl">
          Αυτά ρωτάει ο κόσμος κάθε μέρα
        </h2>
        <p v-reveal="70" class="mt-3 max-w-xl" style="color: var(--color-ink-soft)">
          Το ΤΑΚΚ απαιτεί ξεχωριστό παραστατικό ανά διαμονή, με σειρά και
          αύξοντα αριθμό, και μηνιαία δήλωση. Οι πλατφόρμες κρατήσεων δεν
          οργανώνουν συνήθως αυτή τη διαδικασία για τον ιδιοκτήτη.
        </p>

        <dl class="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <div
            v-for="(p, problemIndex) in problems"
            :key="p.q"
            v-reveal="problemIndex * 70"
          >
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
      <h2 v-reveal class="text-2xl font-bold sm:text-3xl">Δύο λεπτά, μία φορά</h2>

      <ol class="mt-10 grid gap-6 sm:grid-cols-3">
        <li
          v-for="(s, stepIndex) in steps"
          :key="s.n"
          v-reveal="stepIndex * 90"
          class="card"
        >
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

      <div v-reveal="120" class="notice-info mt-8">
        <strong>Δεν χρειάζεται να κατεβάσεις τίποτα.</strong> Χρησιμοποιούμε το
        iCal link που δίνουν ήδη οι πλατφόρμες — δεν χρειαζόμαστε τους κωδικούς σου
        ούτε τα ποσά των κρατήσεων. Το ΤΑΚΚ είναι σταθερό ποσό ανά διανυκτέρευση,
        οπότε μας αρκούν οι ημερομηνίες.
      </div>
    </section>

    <!-- ── Το όριο ── -->
    <section class="border-t bg-white" style="border-color: var(--color-line)">
      <div class="mx-auto max-w-5xl px-5 py-16">
        <div v-reveal class="max-w-2xl">
          <h2 class="text-xl font-bold">Για ποιους είναι — και για ποιους όχι</h2>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <div class="notice-ok">
              <strong>1–2 ακίνητα, φυσικό πρόσωπο</strong>
              <p class="mt-1.5">
                Το Endaxi σε βοηθά να οργανώνεις διαμονές και παραστατικά ΤΑΚΚ.
                Εσύ ελέγχεις και υποβάλλεις ό,τι απαιτείται.
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
    <section v-reveal class="mx-auto max-w-5xl px-5 py-20 text-center">
      <h2 class="text-3xl font-bold">Είσαι εντάξει.</h2>
      <p class="mx-auto mt-3 max-w-md" style="color: var(--color-ink-soft)">
        Ξεκινάς σε δύο λεπτά και έχεις οργανωμένη εικόνα κάθε μήνα —
        100% δωρεάν προς το παρόν, χωρίς κάρτα.
      </p>
      <NuxtLink to="/register" class="btn-primary btn-lg mt-8">
        Ξεκίνα δωρεάν
      </NuxtLink>
    </section>
  </div>
</template>
