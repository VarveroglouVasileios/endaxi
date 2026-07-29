<script setup lang="ts">
/**
 * Ειδοποίηση εκκρεμοτήτων.
 *
 * Ο τόνος είναι σημαντικός: δεν κατηγορούμε τον χρήστη που δεν έδωσε
 * ΑΦΜ — του εξηγούμε γιατί το χρειάζεται ο νόμος και πόσο χρόνο έχει.
 */

import { grDate, daysUntil } from '~/utils/format'

interface Readiness {
  ready: boolean
  missing: Array<{ field: string; label: string; where: string }>
  propertiesWithoutCalendar: Array<{ id: string; name: string }>
  nextCheckOut: string | null
}

const { data } = defineProps<{ data: Readiness | null }>()

const urgent = computed(() => {
  const d = data?.nextCheckOut
  return d ? daysUntil(d) <= 7 : false
})
</script>

<template>
  <div v-if="data && (!data.ready || data.propertiesWithoutCalendar.length)">
    <!-- Λείπουν στοιχεία εκδότη -->
    <div v-if="!data.ready" :class="urgent ? 'notice-danger' : 'notice-warn'">
      <p class="font-semibold">
        {{
          urgent
            ? 'Επείγον: θα χαθεί παραστατικό'
            : 'Λείπουν στοιχεία για την έκδοση'
        }}
      </p>

      <p class="mt-2">
        Ο νόμος απαιτεί <strong>ονοματεπώνυμο, ΑΦΜ και διεύθυνση</strong> στο
        ειδικό στοιχείο ΤΑΚΚ. Χωρίς αυτά δεν μπορούμε να εκδώσουμε — και το
        παραστατικό θα ήταν άκυρο.
      </p>

      <ul class="mt-3 space-y-1">
        <li v-for="m in data.missing" :key="m.field" class="text-sm">
          ·
          <NuxtLink :to="m.where" class="font-medium underline">
            {{ m.label }}
          </NuxtLink>
        </li>
      </ul>

      <p v-if="data.nextCheckOut" class="mt-3 text-sm font-medium">
        Επόμενη αναχώρηση: {{ grDate(data.nextCheckOut) }}
        <span v-if="daysUntil(data.nextCheckOut) === 0">— σήμερα</span>
        <span v-else>— σε {{ daysUntil(data.nextCheckOut) }} μέρες</span>
      </p>
      <p v-else class="mt-3 text-sm">
        Δεν έχεις προσεχείς αναχωρήσεις, οπότε έχεις χρόνο.
      </p>
    </div>

    <!-- Ακίνητα χωρίς ημερολόγιο -->
    <div
      v-if="data.propertiesWithoutCalendar.length"
      class="notice-warn"
      :class="!data.ready ? 'mt-3' : ''"
    >
      <p class="font-semibold">Ακίνητα χωρίς συνδεδεμένο ημερολόγιο</p>
      <p class="mt-2">
        Δεν θα εκδοθεί κανένα παραστατικό γι' αυτά — δεν βλέπουμε τις κρατήσεις.
      </p>
      <ul class="mt-3 space-y-1">
        <li v-for="p in data.propertiesWithoutCalendar" :key="p.id" class="text-sm">
          ·
          <NuxtLink
            :to="`/onboarding/imerologio?property=${p.id}`"
            class="font-medium underline"
          >
            {{ p.name }} — σύνδεσε ημερολόγιο
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
