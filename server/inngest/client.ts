/**
 * INNGEST CLIENT — v4
 *
 * Σημαντικές διαφορές από v3 που επηρεάζουν αυτό το αρχείο:
 *  · Το default mode είναι πλέον "cloud" — απαιτείται signing key.
 *    Για τοπική ανάπτυξη θέτουμε `isDev`.
 *  · Τα serve options (signingKey, baseUrl) μετακινήθηκαν εδώ,
 *    από το `serve()`.
 *  · Το checkpointing είναι ενεργό by default· το `maxRuntime` μένει
 *    κάτω από το HTTP timeout της πλατφόρμας.
 */

import { Inngest } from 'inngest'

const isProduction = process.env.NODE_ENV === 'production'
if (isProduction && process.env.INNGEST_DEV === '1') {
  throw new Error('INNGEST_DEV cannot be enabled in production')
}

const isDev = !isProduction && (
  process.env.INNGEST_DEV === '1' || process.env.NODE_ENV === 'development'
)

/**
 * Το Azure App Service τερματίζει μακρόχρονα HTTP requests. Αφήνουμε
 * περιθώριο ώστε το Inngest checkpointing να αποθηκεύσει εγκαίρως.
 */
const maxRuntime = process.env.INNGEST_MAX_RUNTIME ?? '180s'

export const inngest = new Inngest({
  id: 'endaxi',
  isDev,
  // Διαβάζονται αυτόματα από INNGEST_SIGNING_KEY / INNGEST_EVENT_KEY
  // αν δεν δοθούν ρητά.
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
  checkpointing: { maxRuntime },
})
