/**
 * ΑΠΟΣΤΟΛΗ ΜΗΝΙΑΙΑΣ ΥΠΕΝΘΥΜΙΣΗΣ — η δεύτερη τρύπα.
 *
 * Πριν: το `takk/monthly.reminder` εκπεμπόταν και κανείς δεν το άκουγε.
 * Δηλαδή έλειπε ακριβώς το feature που κάνει το ΤΑΚΚ καλό wedge:
 * ο λόγος να ανοίγεις την εφαρμογή κάθε μήνα.
 *
 * ⚠️ Δεν υποβάλλουμε τίποτα. Υπενθυμίζουμε.
 */

import { eq, and, sum, count } from 'drizzle-orm'
import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { takkMonthlyReminder } from '../events'
import { useDatabase } from '../../database/client'
import { takkDocuments, properties, users } from '../../database/schema'
import { getRemittanceDeadline } from '../../utils/takk/calculator'
import { sendEmail, isEmailConfigured } from '../../utils/email/client'
import { monthlyReminderEmail } from '../../utils/email/templates'

function daysUntil(isoDate: string): number {
  const target = Date.parse(`${isoDate}T23:59:59+03:00`)
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000))
}

export const sendReminderEmail = inngest.createFunction(
  {
    id: 'send-takk-reminder-email',
    triggers: [takkMonthlyReminder],
    retries: 3,
    concurrency: { key: 'event.data.userId', limit: 1 },
  },
  async ({ event, step }) => {
    const db = useDatabase()
    const { userId, period } = event.data

    const summary = await step.run('load-summary', async () => {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      if (!user) throw new NonRetriableError(`Δεν βρέθηκε χρήστης ${userId}`)

      const [agg] = await db
        .select({
          documentCount: count(takkDocuments.id),
          totalCents: sum(takkDocuments.totalAmountCents),
        })
        .from(takkDocuments)
        .innerJoin(properties, eq(takkDocuments.propertyId, properties.id))
        .where(
          and(
            eq(properties.userId, userId),
            eq(takkDocuments.remittancePeriod, period),
          ),
        )

      return {
        user,
        documentCount: Number(agg?.documentCount ?? 0),
        // Το sum() γυρνά string ή null
        totalCents: Number(agg?.totalCents ?? 0),
      }
    })

    // Μηδενική δραστηριότητα → καμία υπενθύμιση.
    // Δεν στέλνουμε «είχες 0 παραστατικά» — είναι θόρυβος.
    if (summary.documentCount === 0) {
      return { sent: false, reason: 'no_documents' }
    }

    const deadline = getRemittanceDeadline(period)
    const daysLeft = daysUntil(deadline)
    // Η δεύτερη υπενθύμιση (25η) στέλνεται κοντά στην προθεσμία
    const isSecondReminder = daysLeft <= 10

    const result = await step.run('send', async () => {
      if (!isEmailConfigured()) {
        console.warn('[reminder] Resend δεν είναι ρυθμισμένο — παράλειψη')
        return { sent: false, reason: 'email_not_configured' as const }
      }

      const tpl = monthlyReminderEmail({
        hostName: summary.user.fullName,
        period,
        deadline,
        documentCount: summary.documentCount,
        totalAmountCents: summary.totalCents,
        isSecondReminder,
        daysLeft,
      })

      const { id } = await sendEmail({
        to: summary.user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      })

      return { sent: true as const, id }
    })

    return {
      ...result,
      period,
      deadline,
      documentCount: summary.documentCount,
      totalCents: summary.totalCents,
    }
  },
)
