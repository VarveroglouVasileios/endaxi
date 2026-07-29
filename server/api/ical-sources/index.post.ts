/**
 * Προσθήκη iCal πηγής — ΤΟ βήμα του onboarding.
 *
 * Επαληθεύει πραγματικά τον σύνδεσμο πριν τον αποθηκεύσει, και
 * πυροδοτεί άμεσο sync ώστε ο χρήστης να δει αποτέλεσμα τώρα.
 */

import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { icalSources, properties, auditLog } from '../../database/schema'
import { validateIcalUrl } from '../../utils/ical/validate'
import { getTrustedClientIp } from '../../utils/request-ip'
import { inngest } from '../../inngest/client'
import { icalSyncRequested } from '../../inngest/events'

const bodySchema = z.object({
  propertyId: z.string().uuid(),
  url: z.string().min(1).max(2048),
  label: z.string().max(80).optional(),
})

const PLATFORM_TO_SOURCE = {
  airbnb: 'ical_airbnb',
  booking: 'ical_booking',
  vrbo: 'ical_vrbo',
  other: 'ical_other',
} as const

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const userId = event.context.userId as string | undefined
  if (!userId) throw createError({ statusCode: 401, message: 'Απαιτείται σύνδεση' })

  const body = await readValidatedBody(event, bodySchema.parse)

  // ── Ανήκει το ακίνητο στον χρήστη; ──
  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, body.propertyId), eq(properties.userId, userId)))
    .limit(1)

  if (!property) {
    throw createError({ statusCode: 404, message: 'Δεν βρέθηκε το ακίνητο' })
  }

  // ── Πραγματική επαλήθευση, όχι regex ──
  const validation = await validateIcalUrl(body.url)
  if (!validation.ok) {
    throw createError({
      statusCode: 422,
      statusMessage: 'ICAL_INVALID',
      data: { message: validation.message, error: validation.error },
    })
  }

  // ── Υπάρχει ήδη; ──
  const [existing] = await db
    .select()
    .from(icalSources)
    .where(
      and(eq(icalSources.propertyId, property.id), eq(icalSources.url, body.url.trim())),
    )
    .limit(1)

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'ALREADY_CONNECTED',
      data: { message: 'Αυτό το ημερολόγιο είναι ήδη συνδεδεμένο.' },
    })
  }

  const [created] = await db
    .insert(icalSources)
    .values({
      propertyId: property.id,
      url: body.url.trim(),
      source: PLATFORM_TO_SOURCE[validation.platform],
      label: body.label ?? validation.platform,
      isActive: true,
    })
    .returning({
      id: icalSources.id,
      propertyId: icalSources.propertyId,
      source: icalSources.source,
      label: icalSources.label,
      isActive: icalSources.isActive,
      lastSyncedAt: icalSources.lastSyncedAt,
      lastSyncStatus: icalSources.lastSyncStatus,
      consecutiveFailures: icalSources.consecutiveFailures,
      createdAt: icalSources.createdAt,
    })

  await db.insert(auditLog).values({
    userId,
    action: 'ical_source.created',
    entityType: 'ical_source',
    entityId: created!.id,
    metadata: {
      platform: validation.platform,
      bookingsFound: validation.bookings,
    },
    ipAddress: getTrustedClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  // ── Άμεσο sync: ο χρήστης θέλει να δει κάτι ΤΩΡΑ ──
  //
  // ΒΡΕΘΗΚΕ ΜΕ ΠΡΑΓΜΑΤΙΚΟ BROWSER TEST: αν το Inngest δεν είναι διαθέσιμο
  // (τοπικά χωρίς `inngest dev`, ή στιγμιαίο πρόβλημα δικτύου/υπηρεσίας),
  // αυτό το `send` πετούσε ΑΠΡΟΣΤΆΤΕΥΤΟ σφάλμα και όλο το endpoint γύριζε
  // 500 — ΕΝΩ η πηγή είχε ήδη αποθηκευτεί επιτυχώς στη βάση. Ο χρήστης
  // έβλεπε «Κάτι πήγε στραβά» ακριβώς στο ΠΙΟ σημαντικό βήμα του onboarding,
  // ενώ στην πραγματικότητα η σύνδεση είχε πετύχει.
  //
  // Το άμεσο sync είναι μόνο βελτίωση εμπειρίας (näher feedback) — το
  // προγραμματισμένο sync θα το πιάσει έτσι κι αλλιώς. Άρα: best-effort,
  // ποτέ δεν πρέπει να ρίξει την κύρια λειτουργία. Ίδια φιλοσοφία με το
  // storage/email graceful degradation.
  try {
    await inngest.send(icalSyncRequested.create({ icalSourceId: created!.id }))
  } catch (err) {
    console.error('[ical-sources]', {
      status: 'sync_dispatch_failed',
      errorType: err instanceof Error ? err.name : 'UnknownError',
    })
  }

  setResponseStatus(event, 201)
  return { source: created, validation }
})
