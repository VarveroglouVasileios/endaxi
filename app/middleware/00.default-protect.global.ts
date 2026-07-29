import { authClient } from '~/lib/auth-client'

/**
 * ΔΙΧΤΥ ΑΣΦΑΛΕΙΑΣ — όχι το κύριο μηχανισμό προστασίας.
 *
 * Η πραγματική ασφάλεια είναι server-side: κάθε /api/** route ελέγχει
 * `event.context.userId` μέσω server/middleware/02.auth.ts, ανεξάρτητα
 * από το τι κάνει το client-side routing. Αυτό εδώ υπάρχει μόνο ως
 * δεύτερη γραμμή άμυνας στο UX: αν κάποτε προστεθεί σελίδα κάτω από
 * /app ή /onboarding χωρίς `definePageMeta({ middleware: 'auth' })`,
 * να μη μείνει προσβάσιμη χωρίς session αντί να «σκάσει» αργότερα σε
 * ένα 401 από κάποιο API call.
 *
 * Global middleware — τρέχει σε ΚΑΘΕ navigation, γι' αυτό ελέγχει πρώτα
 * το path πριν κάνει οτιδήποτε άλλο.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const needsAuth = to.path.startsWith('/app') || to.path.startsWith('/onboarding')
  if (!needsAuth) return

  const { data: session } = await authClient.useSession(useFetch)
  if (!session.value?.user.emailVerified) {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }
})
