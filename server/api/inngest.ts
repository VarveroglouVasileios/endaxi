/**
 * Inngest serve endpoint.
 *
 * v4: τα signingKey / baseUrl / fetch μετακινήθηκαν στον client
 * (server/inngest/client.ts) — εδώ μένουν μόνο client & functions.
 *
 * ⚠️ Κάθε νέα function ΠΡΕΠΕΙ να δηλωθεί εδώ. Αν ξεχαστεί, το event
 *    εκπέμπεται και κανείς δεν το ακούει — σιωπηλά.
 */

import { serve } from 'inngest/nuxt'
import { inngest } from '../inngest/client'
import { scheduleIcalSync, syncIcalSource } from '../inngest/functions/sync-ical'
import {
  issueDueTakkDocuments,
  issueTakkForStay,
  handleStayCancellation,
} from '../inngest/functions/issue-takk'
import { handleNewStay } from '../inngest/functions/handle-new-stay'
import { deliverTakkDocument } from '../inngest/functions/deliver-document'
import { sendMonthlyReminders } from '../inngest/functions/monthly-reminder'
import { sendReminderEmail } from '../inngest/functions/send-reminder'

export default defineEventHandler(
  serve({
    client: inngest,
    functions: [
      // ── iCal sync ──
      scheduleIcalSync, //  cron 2h        → ical/sync.requested
      syncIcalSource, //    ical/sync.*    → stay/created, stay/cancelled
      // ── Νέες διαμονές ──
      handleNewStay, //     stay/created   → takk/issue.requested
      // ── Έκδοση ──
      issueDueTakkDocuments, // cron 20:00 → takk/issue.requested
      issueTakkForStay, //  takk/issue.*   → takk/issued
      handleStayCancellation, // stay/cancelled
      // ── Παράδοση ──
      deliverTakkDocument, // takk/issued  → PDF + R2 + email
      // ── Υπενθυμίσεις ──
      sendMonthlyReminders, // cron 1η/25η → takk/monthly.reminder
      sendReminderEmail, //  takk/monthly.* → email
    ],
  }),
)
