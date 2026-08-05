/**
 * Γεμίζει το `event.context` με τον συνδεδεμένο χρήστη.
 *
 * Πριν από αυτό, όλα τα API routes είχαν `event.context.userId` = undefined
 * και επέστρεφαν 401. Ήταν το μπλοκάρισμα όλου του backend.
 */

import { useAuth } from '../utils/auth'

/** Διαδρομές που δεν χρειάζονται session */
const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/help/chat',
  '/api/inngest',
  '/api/_',
  '/api/health',
  /**
   * Καλείται από τον Resend, όχι από browser session — η αυθεντικοποίηση
   * είναι η svix HMAC υπογραφή ΜΕΣΑ στο handler (βλ.
   * server/api/webhooks/resend-inbound.post.ts), όχι session cookie.
   */
  '/api/webhooks',
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/')) return
  if (PUBLIC_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) return

  try {
    const session = await useAuth().api.getSession({
      headers: event.headers,
    })

    if (session?.user?.emailVerified) {
      event.context.userId = session.user.id
      event.context.user = session.user
      event.context.session = session.session
    }
  } catch {
    // Άκυρο ή ληγμένο session — αφήνουμε το route να απαντήσει 401
  }
})
