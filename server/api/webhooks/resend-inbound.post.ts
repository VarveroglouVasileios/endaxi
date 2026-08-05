/**
 * INBOUND EMAIL WEBHOOK — Resend "Inbound" (event.received)
 * https://resend.com/docs/dashboard/receiving/introduction
 *
 * Ο host προωθεί το email κράτησης/payout της Airbnb/Booking στη δική
 * του διεύθυνση `<token>@in.endaxi.app` (server/utils/email/inbound-token.ts).
 * Ο Resend το λαμβάνει, το κάνει parse, και καλεί ΕΔΩ.
 *
 * Ροή:
 *   1. Επαλήθευση υπογραφής (svix HMAC) — ΧΩΡΙΣ αυτό, ο handler απορρίπτεται.
 *   2. Εξαγωγή token από τον παραλήπτη → εύρεση χρήστη.
 *   3. Best-effort parsing (ποσό + ημερομηνία άφιξης) — inbound-parser.ts.
 *   4. Matching σε ΑΚΡΙΒΩΣ μία υποψήφια διαμονή (συντηρητικό — καμία
 *      αμφισημία δεν οδηγεί σε αυτόματη εγγραφή).
 *   5. ΚΑΘΕ email καταγράφεται στο inbound_emails (matched ή όχι) — ο
 *      host δεν χάνει ποτέ σιωπηλά ένα forwarded email.
 *
 * ⚠️ ΔΕΝ ΕΙΝΑΙ ΕΝΕΡΓΟ μέχρι να ρυθμιστεί το Resend Inbound dashboard +
 * DNS για το υποτομέα `in.endaxi.app` + το env var
 * RESEND_INBOUND_WEBHOOK_SECRET — βήματα που χρειάζονται πρόσβαση στο
 * Resend account και στο DNS, άρα ΔΕΝ μπορούν να γίνουν από εδώ.
 */

import { eq, and, ne, isNull } from 'drizzle-orm'
import { useDatabase } from '../../database/client'
import { users, stays, properties, inboundEmails } from '../../database/schema'
import { verifySvixSignature } from '../../utils/email/verify-webhook-signature'
import { parseBookingEmail } from '../../utils/email/inbound-parser'

interface ResendInboundPayload {
  type?: string
  data?: {
    from?: string
    to?: string[] | string
    subject?: string
    text?: string
    html?: string
  }
}

function extractLocalPart(address: string): string {
  const at = address.indexOf('@')
  return at === -1 ? address : address.slice(0, at)
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default defineEventHandler(async (event) => {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET
  if (!secret) {
    // Το feature δεν είναι ενεργοποιημένο ακόμα σε αυτό το περιβάλλον.
    throw createError({ statusCode: 503, statusMessage: 'INBOUND_EMAIL_NOT_CONFIGURED' })
  }

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) throw createError({ statusCode: 400, message: 'Άδειο σώμα αιτήματος' })

  const valid = verifySvixSignature(
    secret,
    {
      id: getRequestHeader(event, 'svix-id'),
      timestamp: getRequestHeader(event, 'svix-timestamp'),
      signature: getRequestHeader(event, 'svix-signature'),
    },
    rawBody,
  )
  if (!valid) throw createError({ statusCode: 401, message: 'Μη έγκυρη υπογραφή' })

  const payload = JSON.parse(rawBody) as ResendInboundPayload
  const data = payload.data ?? {}

  const toRaw = Array.isArray(data.to) ? data.to[0] : data.to
  const toAddress = toRaw ?? ''
  const subject = data.subject ?? ''
  const text = data.text ?? (data.html ? stripHtml(data.html) : '')

  const db = useDatabase()

  const token = extractLocalPart(toAddress)
  const [owner] = token
    ? await db.select().from(users).where(eq(users.inboundEmailToken, token)).limit(1)
    : []

  if (!owner) {
    await db.insert(inboundEmails).values({
      userId: null,
      toAddress,
      fromAddress: data.from ?? null,
      subject,
      status: 'unknown_recipient',
      textExcerpt: text.slice(0, 2000),
    })
    // 200 — δεν είναι σφάλμα του Resend, δεν πρέπει να ξαναπροσπαθήσει.
    return { ok: true, matched: false }
  }

  const parsed = parseBookingEmail(subject, text)

  if (parsed.amountCents === null || parsed.checkIn === null) {
    await db.insert(inboundEmails).values({
      userId: owner.id,
      toAddress,
      fromAddress: data.from ?? null,
      subject,
      status: 'unrecognized_format',
      parsedAmountCents: parsed.amountCents,
      parsedCheckIn: parsed.checkIn,
      parsedCheckOut: parsed.checkOut,
      textExcerpt: text.slice(0, 2000),
    })
    return { ok: true, matched: false }
  }

  // Υποψήφιες διαμονές: ίδιος χρήστης, ίδια ημερομηνία άφιξης (±0 —
  // συντηρητικό επίτηδες), χωρίς ήδη καταχωρημένο ποσό.
  const dateWindow = and(
    eq(stays.checkIn, parsed.checkIn),
    isNull(stays.grossAmountCents),
    ne(stays.status, 'cancelled'),
  )
  const candidates = await db
    .select({ id: stays.id, checkOut: stays.checkOut })
    .from(stays)
    .innerJoin(properties, eq(stays.propertyId, properties.id))
    .where(and(eq(properties.userId, owner.id), dateWindow))

  const matches = parsed.checkOut
    ? candidates.filter(c => c.checkOut === parsed.checkOut)
    : candidates

  const finalMatches = matches.length > 0 ? matches : candidates

  if (finalMatches.length !== 1) {
    await db.insert(inboundEmails).values({
      userId: owner.id,
      toAddress,
      fromAddress: data.from ?? null,
      subject,
      status: 'unmatched_stay',
      parsedAmountCents: parsed.amountCents,
      parsedCheckIn: parsed.checkIn,
      parsedCheckOut: parsed.checkOut,
      textExcerpt: text.slice(0, 2000),
    })
    return { ok: true, matched: false }
  }

  const stayId = finalMatches[0]!.id

  await db
    .update(stays)
    .set({
      grossAmountCents: parsed.amountCents,
      amountSource: 'email_auto',
      updatedAt: new Date(),
    })
    .where(eq(stays.id, stayId))

  await db.insert(inboundEmails).values({
    userId: owner.id,
    toAddress,
    fromAddress: data.from ?? null,
    subject,
    status: 'matched',
    parsedAmountCents: parsed.amountCents,
    parsedCheckIn: parsed.checkIn,
    parsedCheckOut: parsed.checkOut,
    matchedStayId: stayId,
    textExcerpt: text.slice(0, 2000),
  })

  return { ok: true, matched: true }
})
