/**
 * INNGEST CLIENT — v4
 *
 * Σημαντικές διαφορές από v3 που επηρεάζουν αυτό το αρχείο:
 *  · Το default mode είναι πλέον "cloud" — απαιτείται signing key.
 *    Για τοπική ανάπτυξη θέτουμε `isDev`.
 *  · Τα serve options (signingKey, baseUrl) μετακινήθηκαν εδώ,
 *    από το `serve()`.
 *  · Το checkpointing είναι ενεργό by default· σε serverless πρέπει
 *    να οριστεί `maxRuntime` λίγο κάτω από το όριο της πλατφόρμας.
 */

import { Inngest } from 'inngest'

const isDev =
  process.env.INNGEST_DEV === '1' || process.env.NODE_ENV === 'development'

/**
 * Το Vercel κόβει τα functions στα 60s στο Hobby / 300s στο Pro.
 * Βάζουμε maxRuntime στο ~70% ώστε το checkpointing να προλαβαίνει
 * να αποθηκεύσει πριν μας τερματίσει η πλατφόρμα.
 */
const maxRuntime = process.env.INNGEST_MAX_RUNTIME ?? '50s'

export const inngest = new Inngest({
  id: 'endaxi',
  isDev,
  // Διαβάζονται αυτόματα από INNGEST_SIGNING_KEY / INNGEST_EVENT_KEY
  // αν δεν δοθούν ρητά.
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
  checkpointing: { maxRuntime },
})
