/**
 * Επαλήθευση υπογραφής webhook (σχήμα Svix — το χρησιμοποιεί ο Resend
 * για inbound emails: https://resend.com/docs/dashboard/receiving).
 *
 * Χωρίς αυτό, ΟΠΟΙΟΣΔΗΠΟΤΕ θα μπορούσε να POSTάρει ψεύτικα "emails" στο
 * webhook και να γράψει αυθαίρετα ποσά σε διαμονές τρίτων — κρίσιμος
 * έλεγχος, όχι προαιρετικός.
 *
 * Δεν προσθέτουμε το πακέτο `svix` ως dependency — το σχήμα είναι απλό
 * HMAC-SHA256 και υλοποιείται εδώ με το ενσωματωμένο `node:crypto`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const TOLERANCE_SECONDS = 5 * 60

export interface SvixHeaders {
  id: string | undefined
  timestamp: string | undefined
  signature: string | undefined
}

export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
): boolean {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false

  // Το secret έρχεται ως `whsec_<base64>`
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${id}.${timestamp}.${rawBody}`
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected)

  // Το header μπορεί να έχει πολλαπλές υπογραφές χωρισμένες με κενό: "v1,<sig> v1,<sig2>"
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) continue
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length !== expectedBuf.length) continue
    if (timingSafeEqual(sigBuf, expectedBuf)) return true
  }

  return false
}
