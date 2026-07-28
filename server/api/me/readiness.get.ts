/**
 * ΕΤΟΙΜΟΤΗΤΑ ΕΚΔΟΣΗΣ
 *
 * Απαντά στο ερώτημα: «θα εκδοθεί το επόμενο παραστατικό ή θα χαθεί;»
 *
 * Το ΑΦΜ και η διεύθυνση είναι νομικά υποχρεωτικά στο ειδικό στοιχείο
 * (Α.1202/2024). Δεν τα ζητάμε στην εγγραφή για να μη διώξουμε τον χρήστη —
 * αλλά ΠΡΕΠΕΙ να τα ζητήσουμε πριν την πρώτη αναχώρηση, αλλιώς η κράτηση
 * περνά και το παραστατικό δεν βγαίνει.
 *
 * Γι' αυτό υπολογίζουμε την **επόμενη αναχώρηση**: δίνει στον χρήστη
 * συγκεκριμένη προθεσμία αντί για αόριστη προειδοποίηση.
 */

import { eq, and, gte, asc, sql } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { users, properties, stays, icalSources } from '../../database/schema'
import { isValidAfm } from '../../utils/afm'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'Δεν βρέθηκε' })

  const missing: Array<{ field: string; label: string; where: string }> = []

  const name = u.name ?? u.fullName
  if (!name?.trim()) {
    missing.push({
      field: 'name',
      label: 'Ονοματεπώνυμο',
      where: '/app/rythmiseis',
    })
  }
  if (!u.afm || !isValidAfm(u.afm)) {
    missing.push({ field: 'afm', label: 'ΑΦΜ', where: '/app/rythmiseis' })
  }

  // Ακίνητα χωρίς διεύθυνση — και αυτή είναι υποχρεωτική στο παραστατικό
  const props = await db
    .select()
    .from(properties)
    .where(and(eq(properties.userId, userId), eq(properties.isActive, true)))

  const withoutAddress = props.filter((p) => !p.addressLine?.trim())
  for (const p of withoutAddress) {
    missing.push({
      field: 'address',
      label: `Διεύθυνση για «${p.name}»`,
      where: '/app/akinita',
    })
  }

  // Ακίνητα χωρίς συνδεδεμένο ημερολόγιο — δεν θα έρθει ποτέ κράτηση
  const sources = props.length
    ? await db.select().from(icalSources).where(eq(icalSources.isActive, true))
    : []
  const withoutCalendar = props.filter(
    (p) => !sources.some((s) => s.propertyId === p.id),
  )

  // Η επόμενη αναχώρηση — δίνει συγκεκριμένη προθεσμία
  const today = new Date().toISOString().slice(0, 10)
  const [next] = props.length
    ? await db
        .select({ checkOut: stays.checkOut, propertyId: stays.propertyId })
        .from(stays)
        .innerJoin(properties, eq(stays.propertyId, properties.id))
        .where(
          and(
            eq(properties.userId, userId),
            eq(stays.status, 'confirmed'),
            gte(stays.checkOut, today),
            sql`${stays.nights} > 0`,
          ),
        )
        .orderBy(asc(stays.checkOut))
        .limit(1)
    : []

  return {
    ready: missing.length === 0,
    missing,
    propertiesWithoutCalendar: withoutCalendar.map((p) => ({
      id: p.id,
      name: p.name,
    })),
    nextCheckOut: next?.checkOut ?? null,
  }
})
