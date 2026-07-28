<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Ρυθμίσεις — Εντάξει', robots: 'noindex' })

interface Me {
  email: string
  name: string | null
  afm: string | null
  phone: string | null
  taxRegime: string
  declaredPropertyCount: number
  canIssue: boolean
}

const { data: me, refresh } = await useFetch<Me>('/api/me')

const form = reactive({
  name: me.value?.name ?? '',
  afm: me.value?.afm ?? '',
  phone: me.value?.phone ?? '',
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
        Χωρίς ονοματεπώνυμο και έγκυρο ΑΦΜ <strong>δεν εκδίδονται
        παραστατικά</strong> — το παραστατικό θα ήταν νομικά ελαττωματικό.
        Συμπλήρωσέ τα τώρα ώστε να μη χαθούν οι κρατήσεις σου.
      </p>
    </div>

    <form class="card mt-8 space-y-5" @submit.prevent="save">
      <div>
        <label class="label">Email</label>
        <input :value="me?.email" class="input" disabled />
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
  </div>
</template>
