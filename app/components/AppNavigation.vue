<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

async function handleSignOut() {
  await authClient.signOut()
  await navigateTo('/')
}
</script>

<template>
  <nav
    class="flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap sm:gap-1"
    aria-label="Πλοήγηση εφαρμογής"
  >
    <NuxtLink to="/app" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
      Παραστατικά
    </NuxtLink>
    <NuxtLink to="/app/diamones" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
      Διαμονές
    </NuxtLink>
    <NuxtLink to="/app/akinita" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
      Ακίνητα
    </NuxtLink>
    <NuxtLink to="/app/rythmiseis" class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5">
      Ρυθμίσεις
    </NuxtLink>
    <button class="btn-ghost shrink-0 !px-2.5 sm:!px-3.5" @click="handleSignOut">
      Έξοδος
    </button>
  </nav>
</template>
