/**
 * ΤΥΠΟΙ ΓΕΓΟΝΟΤΩΝ — Inngest v4
 *
 * Στο v4 το `EventSchemas` καταργήθηκε. Οι τύποι ορίζονται
 * αποκεντρωμένα με `eventType()` και χρησιμοποιούνται παντού:
 * ως triggers, στο `inngest.send()` και στο `step.waitForEvent()`.
 *
 * Χρησιμοποιούμε Zod όπου θέλουμε ΠΡΑΓΜΑΤΙΚΟ runtime έλεγχο.
 * Σε φορολογικό σύστημα αυτό δεν είναι πολυτέλεια: ένα κακοσχηματισμένο
 * event που περνά αθόρυβα μπορεί να εκδώσει λάθος παραστατικό.
 */

import { eventType } from 'inngest'
import { z } from 'zod'

const uuid = z.string().uuid()

/** Ζητήθηκε συγχρονισμός συγκεκριμένης iCal πηγής */
export const icalSyncRequested = eventType('ical/sync.requested', {
  schema: z.object({ icalSourceId: uuid }),
})

/** Δημιουργήθηκε νέα διαμονή από το sync */
export const stayCreated = eventType('stay/created', {
  schema: z.object({ stayId: uuid }),
})

/** Η διαμονή εξαφανίστηκε από το feed → ακύρωση */
export const stayCancelled = eventType('stay/cancelled', {
  schema: z.object({ stayId: uuid }),
})

/** Ζητήθηκε έκδοση ΤΑΚΚ για διαμονή */
export const takkIssueRequested = eventType('takk/issue.requested', {
  schema: z.object({ stayId: uuid }),
})

/** Εκδόθηκε παραστατικό ΤΑΚΚ */
export const takkIssued = eventType('takk/issued', {
  schema: z.object({ documentId: uuid }),
})

/** Υπενθύμιση μηνιαίας απόδοσης */
export const takkMonthlyReminder = eventType('takk/monthly.reminder', {
  schema: z.object({
    userId: uuid,
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Περίοδος σε μορφή YYYY-MM'),
  }),
})

/** Ήρθε προωθημένο email από host (reconciliation module) */
export const inboundEmailReceived = eventType('email/inbound.received', {
  schema: z.object({ token: z.string().min(1), messageId: z.string().min(1) }),
})
