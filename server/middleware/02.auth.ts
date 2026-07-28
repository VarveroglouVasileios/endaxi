/**
 * Γεμίζει το `event.context` με τον συνδεδεμένο χρήστη.
 *
 * Πριν από αυτό, όλα τα API routes είχαν `event.context.userId` = undefined
 * και επέστρεφαν 401. Ήταν το μπλοκάρισμα όλου του backend.
 */

import { useAuth } from '../utils/auth'

/** Διαδρομές που δεν χρειάζονται session */
const PUBLIC_PREFIXES = ['/api/auth', '/api/inngest', '/api/_', '/api/health']

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/')) return
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return

  try {
    const session = await useAuth().api.getSession({
      headers: event.headers,
    })

    if (session?.user) {
      event.context.userId = session.user.id
      event.context.user = session.user
      event.context.session = session.session
    }
  } catch {
    // Άκυρο ή ληγμένο session — αφήνουμε το route να απαντήσει 401
  }
})
