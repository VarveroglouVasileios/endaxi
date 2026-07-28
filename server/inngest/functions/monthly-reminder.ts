/**
 * ΜΗΝΙΑΙΑ ΥΠΕΝΘΥΜΙΣΗ ΑΠΟΔΟΣΗΣ ΤΑΚΚ
 *
 * Η δήλωση υποβάλλεται έως την τελευταία ημέρα του ΕΠΟΜΕΝΟΥ μήνα
 * από τον μήνα έκδοσης των παραστατικών.
 *
 * Στέλνουμε δύο υπενθυμίσεις: στην 1η και στις 25 του επόμενου μήνα.
 *
 * Inngest v4: πολλαπλά cron triggers ως πίνακας στο πρώτο όρισμα.
 */

import { eq, sum, count } from 'drizzle-orm'
import { cron } from 'inngest'
import { inngest } from '../client'
import { takkMonthlyReminder } from '../events'
import { useDatabase } from '../../database/client'
import { takkDocuments, properties, users } from '../../database/schema'
import { getRemittanceDeadline } from '../../utils/takk/calculator'

function previousPeriod(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 7)
}

export const sendMonthlyReminders = inngest.createFunction(
  {
    id: 'send-monthly-takk-reminders',
    triggers: [
      cron('TZ=Europe/Athens 0 9 1 * *'), // 1η του μήνα, 09:00
      cron('TZ=Europe/Athens 0 9 25 * *'), // 25η, δεύτερη υπενθύμιση
    ],
  },
  async ({ step }) => {
    const db = useDatabase()
    const period = previousPeriod()
    const deadline = getRemittanceDeadline(period)

    const summaries = await step.run('aggregate-by-user', async () =>
      db
        .select({
          userId: users.id,
          email: users.email,
          fullName: users.fullName,
          documentCount: count(takkDocuments.id),
          totalCents: sum(takkDocuments.totalAmountCents),
        })
        .from(takkDocuments)
        .innerJoin(properties, eq(takkDocuments.propertyId, properties.id))
        .innerJoin(users, eq(properties.userId, users.id))
        .where(eq(takkDocuments.remittancePeriod, period))
        .groupBy(users.id, users.email, users.fullName),
    )

    if (summaries.length === 0) return { sent: 0, period }

    await step.sendEvent(
      'dispatch-reminders',
      summaries.map((s) => takkMonthlyReminder.create({ userId: s.userId, period })),
    )

    return { sent: summaries.length, period, deadline }
  },
)
