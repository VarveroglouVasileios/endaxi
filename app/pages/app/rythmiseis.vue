<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Ρυθμίσεις — Εντάξει', robots: 'noindex' })

interface Me {
  email: string
  name: string | null
  afm: string | null
  phone: string | null
  legalAddressLine: string | null
  legalAddressCity: string | null
  legalAddressPostalCode: string | null
  taxRegime: string
  declaredPropertyCount: number
  canIssue: boolean
  inboundEmailToken: string | null
}

const { data: me, refresh } = await useFetch<Me>('/api/me')

// ── Αυτόματη λήψη ποσών εισοδήματος (forwarding address) ──
const INBOUND_DOMAIN = 'in.endaxi.app'
const inboundAddress = computed(() =>
  me.value?.inboundEmailToken ? `${me.value.inboundEmailToken}@${INBOUND_DOMAIN}` : null,
)
const generatingToken = ref(false)
const tokenError = ref<string | null>(null)
const copied = ref(false)

async function generateInboundAddress() {
  tokenError.value = null
  generatingToken.value = true
  try {
    await $fetch('/api/me/inbound-token', { method: 'POST' })
    await refresh()
  } catch (e) {
    const err = e as { data?: { data?: { message?: string } } }
    tokenError.value = err.data?.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    generatingToken.value = false
  }
}

async function copyAddress() {
  if (!inboundAddress.value) return
  await navigator.clipboard.writeText(inboundAddress.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const form = reactive({
  name: me.value?.name ?? '',
  afm: me.value?.afm ?? '',
  phone: me.value?.phone ?? '',
  legalAddressLine: me.value?.legalAddressLine ?? '',
  legalAddressCity: me.value?.legalAddressCity ?? '',
  legalAddressPostalCode: me.value?.legalAddressPostalCode ?? '',
})

const saving = ref(false)
const saved = ref(false)
const fieldError = ref<string | null>(null)

async function save() {
  fieldError.value = null
  saved.value = false
  saving.value = true

  try {
    await $fetch('/api/me', { method: 'PATCH', body: { ...form } })
    await refresh()
    saved.value = true
    setTimeout(() => (saved.value = false), 3000)
  } catch (e) {
    const err = e as { data?: { data?: { message?: string } } }
    fieldError.value = err.data?.data?.message ?? 'Κάτι πήγε στραβά.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg px-5 py-12">
    <h1 class="text-2xl font-bold">Ρυθμίσεις</h1>

    <!-- Προειδοποίηση: χωρίς αυτά δεν εκδίδεται τίποτα -->
    <div v-if="me && !me.canIssue" class="notice-warn mt-6">
      <p class="font-semibold">Λείπουν στοιχεία εκδότη</p>
      <p class="mt-1.5">
        Χωρίς ονοματεπώνυμο, έγκυρο ΑΦΜ και νόμιμη διεύθυνση <strong>δεν εκδίδονται
        παραστατικά</strong> — το παραστατικό θα ήταν νομικά ελαττωματικό.
        Συμπλήρωσέ τα τώρα ώστε να μη χαθούν οι κρατήσεις σου.
      </p>
    </div>

    <form class="card mt-8 space-y-5" @submit.prevent="save">
      <div>
        <label for="account-email" class="label">Email</label>
        <input id="account-email" :value="me?.email" class="input" disabled />
        <p class="hint">Δεν αλλάζει.</p>
      </div>

      <div>
        <label for="name" class="label">Ονοματεπώνυμο</label>
        <input id="name" v-model="form.name" class="input" required />
        <p class="hint">Εμφανίζεται ως εκδότης στα παραστατικά.</p>
      </div>

      <div>
        <label for="afm" class="label">ΑΦΜ</label>
        <input
          id="afm"
          v-model="form.afm"
          class="input tnum"
          :class="fieldError ? 'input-error' : ''"
          inputmode="numeric"
          maxlength="11"
          placeholder="123456789"
        />
        <p v-if="fieldError" class="error-text">{{ fieldError }}</p>
        <p v-else class="hint">
          <strong>Γιατί το ζητάμε:</strong> ο νόμος (Α.1202/2024) απαιτεί
          επωνυμία, διεύθυνση και ΑΦΜ ως ελάχιστο περιεχόμενο του ειδικού
          στοιχείου. Τυπώνεται στην απόδειξη που δίνεις στον επισκέπτη —
          όπως το ΑΦΜ σε κάθε τιμολόγιο. Δεν το στέλνουμε πουθενά αλλού.
        </p>
      </div>

      <div>
        <label for="phone" class="label">
          Τηλέφωνο
          <span style="color: var(--color-ink-muted)">(προαιρετικό)</span>
        </label>
        <input id="phone" v-model="form.phone" class="input tnum" type="tel" />
      </div>

      <fieldset class="space-y-3 border-t pt-5" style="border-color: var(--color-line)">
        <legend class="font-semibold">Νόμιμη διεύθυνση εκδότη</legend>
        <p class="hint">
          Είναι ξεχωριστή από τη διεύθυνση του καταλύματος και αποθηκεύεται
          στο παραστατικό όπως ισχύει τη στιγμή της έκδοσης.
        </p>
        <div>
          <label for="legal-address-line" class="label">Διεύθυνση</label>
          <input
            id="legal-address-line"
            v-model="form.legalAddressLine"
            class="input"
            required
            autocomplete="street-address"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="legal-address-city" class="label">Πόλη</label>
            <input
              id="legal-address-city"
              v-model="form.legalAddressCity"
              class="input"
              required
              autocomplete="address-level2"
            />
          </div>
          <div>
            <label for="legal-address-postal-code" class="label">Τ.Κ.</label>
            <input
              id="legal-address-postal-code"
              v-model="form.legalAddressPostalCode"
              class="input tnum"
              required
              inputmode="numeric"
              autocomplete="postal-code"
            />
          </div>
        </div>
      </fieldset>

      <div class="flex items-center gap-3">
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Αποθήκευση…' : 'Αποθήκευση' }}
        </button>
        <span v-if="saved" class="text-sm" style="color: var(--color-ok)">
          ✓ Αποθηκεύτηκε
        </span>
      </div>
    </form>

    <!-- Καθεστώς -->
    <div class="card mt-6">
      <h2 class="text-sm font-bold">Φορολογικό καθεστώς</h2>
      <p class="mt-2 text-sm" style="color: var(--color-ink-soft)">
        Δήλωσες <strong>{{ me?.declaredPropertyCount }}</strong>
        {{ me?.declaredPropertyCount === 1 ? 'ακίνητο' : 'ακίνητα' }} —
        {{
          me?.taxRegime === 'individual_upto_2'
            ? 'φυσικό πρόσωπο χωρίς βιβλία.'
            : 'επιτηδευματίας.'
        }}
      </p>
      <p class="hint mt-3">
        Αν αποκτήσεις τρίτο ακίνητο αλλάζει το καθεστώς σου και χρειάζεσαι
        βιβλία, ΦΠΑ και διαβίβαση myDATA. Μίλα με τον λογιστή σου πρώτα.
      </p>
    </div>

    <!-- Αυτόματη λήψη ποσών εισοδήματος -->
    <div class="card mt-6">
      <h2 class="text-sm font-bold">Αυτόματη λήψη ποσών (Εισόδημα)</h2>
      <p class="mt-2 text-sm" style="color: var(--color-ink-soft)">
        Το iCal δεν περιέχει τιμές, οπότε δεν μπορούμε να δούμε πόσο εισέπραξες
        από κάθε κράτηση. Αν προωθείς εδώ τα emails κράτησης/payout της
        Airbnb ή Booking.com, προσπαθούμε να διαβάσουμε αυτόματα το ποσό και
        να συμπληρώσουμε τη σελίδα
        <NuxtLink to="/app/eisodima" class="font-medium underline">Εισόδημα</NuxtLink>.
      </p>

      <div v-if="inboundAddress" class="mt-4">
        <label class="label">Η διεύθυνσή σου</label>
        <div class="flex items-center gap-2">
          <input :value="inboundAddress" class="input tnum" readonly />
          <button type="button" class="btn-secondary shrink-0 !px-3 text-xs" @click="copyAddress">
            {{ copied ? '✓ Αντιγράφηκε' : 'Αντιγραφή' }}
          </button>
        </div>
        <p class="hint mt-2">
          Στήσε έναν κανόνα προώθησης στο Gmail/Outlook σου για τα emails από
          την Airbnb/Booking προς αυτή τη διεύθυνση. Κάθε ασυνήθιστο ή
          μη-αναγνωρίσιμο email απλά αγνοείται με ασφάλεια — δεν παίρνει ποτέ
          λάθος ποσό. Ό,τι δεν αναγνωριστεί αυτόματα, το καταχωρείς χειροκίνητα
          όπως και σήμερα.
        </p>
        <button
          type="button"
          class="btn-ghost mt-2 !px-3 text-xs"
          :disabled="generatingToken"
          @click="generateInboundAddress"
        >
          {{ generatingToken ? '…' : 'Νέα διεύθυνση (η παλιά σταματά να λειτουργεί)' }}
        </button>
      </div>

      <div v-else class="mt-4">
        <button
          type="button"
          class="btn-secondary"
          :disabled="generatingToken"
          @click="generateInboundAddress"
        >
          {{ generatingToken ? 'Δημιουργία…' : 'Δημιουργία διεύθυνσης' }}
        </button>
      </div>

      <p v-if="tokenError" class="notice-danger mt-3">{{ tokenError }}</p>
    </div>
  </div>
</template>
