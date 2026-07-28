/**
 * ΝΕΑ ΔΙΑΜΟΝΗ — η τρίτη τρύπα.
 *
 * Πριν: το `stay/created` εκπεμπόταν και κανείς δεν το άκουγε.
 * Λειτουργικά «δούλευε» επειδή το νυχτερινό cron μάζευε τις εκκρεμείς
 * εκδόσεις — αλλά με έως 24 ώρες καθυστέρηση.
 *
 * Το πρόβλημα φαίνεται στο πρώτο sync: όταν ο host συνδέει το iCal του,
 * κατεβαίνουν και οι ΠΑΛΙΕΣ κρατήσεις που έχουν ήδη αναχωρήσει. Αυτές
 * πρέπει να πάρουν παραστατικό αμέσως, όχι αύριο το βράδυ — γιατί ο
 * host μόλις έκανε εγγραφή και θέλει να δει ότι κάτι έγινε.
 */

import { eq } from 'drizzle-orm'
import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { stayCreated, takkIssueRequested } from '../events'
import { useDatabase } from '../../database/client'
import { stays, properties, users } from '../../database/schema'

export const handleNewStay = inngest.createFunction(
  {
    id: 'handle-new-stay',
    triggers: [stayCreated],
    retries: 2,
  },
  async ({ event, step }) => {
    const db = useDatabase()

    const info = await step.run('load-stay', async () => {
      const [row] = await db
        .select({ stay: stays, regime: users.taxRegime })
        .from(stays)
        .innerJoin(properties, eq(stays.propertyId, properties.id))
        .innerJoin(users, eq(properties.userId, users.id))
        .where(eq(stays.id, event.data.stayId))
        .limit(1)

      if (!row) throw new NonRetriableError(`Δεν βρέθηκε διαμονή ${event.data.stayId}`)
      return row
    })

    const { stay, regime } = info

    // Το gate: οι επιτηδευματίες περιμένουν myDATA integration
    if (regime !== 'individual_upto_2') {
      return { action: 'skipped', reason: 'business_regime' }
    }

    if (stay.status !== 'confirmed' || stay.nights === 0) {
      return { action: 'skipped', reason: `status=${stay.status} nights=${stay.nights}` }
    }

    // Έχει ήδη αναχωρήσει; → έκδοση τώρα, όχι αύριο
    const today = new Date().toISOString().slice(0, 10)
    if (stay.checkOut > today) {
      return { action: 'deferred', reason: 'future_checkout', checkOut: stay.checkOut }
    }

    await step.sendEvent(
      'request-issuance',
      takkIssueRequested.create({ stayId: stay.id }),
    )

    return { action: 'issuance_requested', checkOut: stay.checkOut }
  },
)
