<script setup lang="ts">
useSeoMeta({
  title: 'Πολιτική Απορρήτου — Εντάξει',
  description: 'Πώς επεξεργαζόμαστε τα δεδομένα σου.',
})

const updated = '26 Ιουλίου 2026'

const subprocessors = [
  { name: 'Neon', purpose: 'Βάση δεδομένων', region: 'ΕΕ (Φρανκφούρτη)' },
  { name: 'Vercel', purpose: 'Φιλοξενία εφαρμογής', region: 'ΕΕ' },
  { name: 'Inngest', purpose: 'Προγραμματισμένες εργασίες', region: 'ΕΕ/ΗΠΑ (SCCs)' },
  { name: 'Cloudflare R2', purpose: 'Αποθήκευση PDF', region: 'ΕΕ' },
  { name: 'Resend', purpose: 'Αποστολή email', region: 'ΕΕ/ΗΠΑ (SCCs)' },
  { name: 'Anthropic', purpose: 'Αναγνώριση εγγράφων (OCR)', region: 'ΗΠΑ (SCCs, μηδενική διατήρηση)' },
]
</script>

<template>
  <article class="mx-auto max-w-2xl px-5 py-16">
    <h1 class="text-3xl font-bold">Πολιτική Απορρήτου</h1>
    <p class="mt-2 text-sm" style="color: var(--color-ink-muted)">
      Τελευταία ενημέρωση: {{ updated }}
    </p>

    <div class="notice-warn mt-8">
      <strong>⚠️ Πρόχειρο προς νομικό έλεγχο.</strong> Συμπλήρωσε τα στοιχεία
      του υπευθύνου επεξεργασίας (επωνυμία, ΑΦΜ, έδρα) και έλεγξε το κείμενο
      με δικηγόρο πριν τη δημοσίευση.
    </div>

    <div class="mt-10 space-y-8 text-sm leading-relaxed">
      <section>
        <h2 class="text-lg font-bold">1. Οι δύο ρόλοι μας</h2>
        <p class="mt-3">Αυτό είναι σημαντικό και συχνά παρεξηγείται:</p>
        <div class="mt-4 space-y-3">
          <div class="card !p-4">
            <p class="font-semibold">Για τα δικά σου δεδομένα</p>
            <p class="mt-1" style="color: var(--color-ink-soft)">
              Email, ονοματεπώνυμο, ΑΦΜ, στοιχεία ακινήτων: είμαστε
              <strong>υπεύθυνος επεξεργασίας</strong>.
            </p>
          </div>
          <div class="card !p-4">
            <p class="font-semibold">Για τα δεδομένα των επισκεπτών σου</p>
            <p class="mt-1" style="color: var(--color-ink-soft)">
              Ονόματα και ημερομηνίες διαμονής: <strong>εσύ</strong> είσαι ο
              υπεύθυνος επεξεργασίας και <strong>εμείς εκτελών</strong> για
              λογαριασμό σου. Οι όροι της ανάθεσης περιγράφονται στην ενότητα 6.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-bold">2. Τι συλλέγουμε</h2>
        <ul class="mt-3 list-disc space-y-2 pl-5">
          <li><strong>Λογαριασμός:</strong> email, ονοματεπώνυμο, ΑΦΜ, τηλέφωνο</li>
          <li><strong>Ακίνητα:</strong> ΑΜΑ, ονομασία, κατηγορία, διεύθυνση</li>
          <li>
            <strong>Ημερολόγια:</strong> ημερομηνίες κρατήσεων και όνομα
            επισκέπτη, από τους iCal συνδέσμους που συνδέεις
          </li>
          <li><strong>Τεχνικά:</strong> IP και user-agent, για το αρχείο ελέγχου</li>
        </ul>
        <p class="mt-4 notice-info">
          <strong>Τι ΔΕΝ συλλέγουμε:</strong> κωδικούς πρόσβασης σε πλατφόρμες,
          στοιχεία πληρωμών επισκεπτών, ποσά κρατήσεων. Το ΤΑΚΚ είναι σταθερό
          ποσό ανά διανυκτέρευση — μας αρκούν οι ημερομηνίες.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">3. Γιατί — νομική βάση</h2>
        <ul class="mt-3 list-disc space-y-2 pl-5">
          <li><strong>Εκτέλεση σύμβασης</strong> (άρ. 6§1β): παροχή της υπηρεσίας</li>
          <li><strong>Νομική υποχρέωση</strong> (άρ. 6§1γ): τήρηση παραστατικών</li>
          <li><strong>Έννομο συμφέρον</strong> (άρ. 6§1στ): ασφάλεια, αποτροπή κατάχρησης</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold">4. Πόσο καιρό</h2>
        <div class="notice-warn mt-3">
          <strong>Προσοχή στη διατήρηση:</strong> τα φορολογικά παραστατικά
          διατηρούνται για όσο επιβάλλει η φορολογική νομοθεσία,
          <strong>ακόμη κι αν ζητήσεις διαγραφή</strong>. Το δικαίωμα διαγραφής
          δεν υπερισχύει νομικής υποχρέωσης τήρησης (άρ. 17§3β ΓΚΠΔ).
        </div>
        <ul class="mt-4 list-disc space-y-2 pl-5">
          <li><strong>Παραστατικά ΤΑΚΚ:</strong> κατά τη φορολογική νομοθεσία</li>
          <li><strong>Λογαριασμός:</strong> έως τη διαγραφή του</li>
          <li><strong>Αρχείο ελέγχου:</strong> 24 μήνες</li>
          <li><strong>Δεδομένα επισκεπτών:</strong> όσο απαιτείται για τα παραστατικά</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold">5. Ποιοι άλλοι εμπλέκονται</h2>
        <p class="mt-3">Υπο-εκτελούντες επεξεργασία:</p>
        <div class="mt-4 overflow-hidden rounded-lg border" style="border-color: var(--color-line)">
          <table class="w-full text-xs">
            <thead style="background: var(--color-paper)">
              <tr>
                <th class="p-2.5 text-left font-semibold">Πάροχος</th>
                <th class="p-2.5 text-left font-semibold">Σκοπός</th>
                <th class="p-2.5 text-left font-semibold">Τοποθεσία</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in subprocessors"
                :key="s.name"
                class="border-t"
                style="border-color: var(--color-line)"
              >
                <td class="p-2.5 font-medium">{{ s.name }}</td>
                <td class="p-2.5" style="color: var(--color-ink-soft)">{{ s.purpose }}</td>
                <td class="p-2.5" style="color: var(--color-ink-soft)">{{ s.region }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="hint mt-3">
          Για διαβιβάσεις εκτός ΕΟΧ εφαρμόζονται Τυποποιημένες Συμβατικές Ρήτρες.
          Στον πάροχο AI εφαρμόζεται ρύθμιση μηδενικής διατήρησης και απαγόρευση
          χρήσης για εκπαίδευση μοντέλων.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">6. Όροι επεξεργασίας (DPA)</h2>
        <p class="mt-3">
          Για τα δεδομένα των επισκεπτών σου, όπου ενεργούμε ως εκτελών
          επεξεργασία, δεσμευόμαστε ότι:
        </p>
        <ul class="mt-3 list-disc space-y-2 pl-5">
          <li>Επεξεργαζόμαστε μόνο κατ' εντολή σου και για τους σκοπούς της υπηρεσίας</li>
          <li>Δεσμεύουμε το προσωπικό μας με εχεμύθεια</li>
          <li>Εφαρμόζουμε κρυπτογράφηση κατά τη μεταφορά και την αποθήκευση</li>
          <li>Σε ενημερώνουμε <strong>χωρίς αδικαιολόγητη καθυστέρηση</strong> σε περίπτωση παραβίασης</li>
          <li>Σε συνδράμουμε σε αιτήματα υποκειμένων και σε εκτιμήσεις αντικτύπου</li>
          <li>Δεν προσλαμβάνουμε νέο υπο-εκτελούντα χωρίς προηγούμενη ενημέρωση</li>
          <li>Διαγράφουμε ή επιστρέφουμε τα δεδομένα στη λήξη, εκτός αν ο νόμος επιβάλλει τήρηση</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold">7. Τα δικαιώματά σου</h2>
        <p class="mt-3">
          Πρόσβαση, διόρθωση, διαγραφή, περιορισμός, φορητότητα, εναντίωση.
          Αίτημα στο
          <a href="mailto:privacy@endaxi.app" class="underline">privacy@endaxi.app</a>
          — απαντάμε εντός 30 ημερών.
        </p>
        <p class="mt-3">
          Δικαίωμα καταγγελίας στην
          <a href="https://www.dpa.gr" target="_blank" rel="noopener" class="underline">
            Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα</a>.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">8. Cookies</h2>
        <p class="mt-3">
          Μόνο <strong>απολύτως απαραίτητα</strong> cookies, για τη διατήρηση
          της σύνδεσής σου. Δεν χρησιμοποιούμε cookies διαφήμισης ή
          παρακολούθησης τρίτων.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold">9. Επικοινωνία</h2>
        <p class="mt-3">
          <span class="notice-warn inline-block">
            Συμπλήρωσε: επωνυμία, ΑΦΜ, έδρα, email υπευθύνου επεξεργασίας.
          </span>
        </p>
      </section>
    </div>
  </article>
</template>
