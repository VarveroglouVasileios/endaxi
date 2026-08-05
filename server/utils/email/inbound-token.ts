/**
 * Προσωπική διεύθυνση inbound email ανά host.
 *
 * Format: `<slug>-<4bytes hex>@in.endaxi.app` (π.χ. `vasilis-a1b2c3d4@in.endaxi.app`).
 * Το token είναι το ΟΛΟΚΛΗΡΟ local-part (πριν το @) — μοναδικό
 * (unique index `users_inbound_token_idx`), δεν χρειάζεται μαντεψιά.
 *
 * Ο host δίνει προς τα ΕΞΩ αυτή τη διεύθυνση (forwarding rule στο Gmail/
 * Outlook για emails από την Airbnb/Booking) — βλ. server/api/webhooks/
 * resend-inbound.post.ts για το πώς διαβάζεται.
 */

import { randomBytes } from 'node:crypto'

export const INBOUND_EMAIL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? 'in.endaxi.app'

function slugify(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // αφαίρεση τόνων (combining diacritics μετά το NFD)
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
    .slice(0, 20)
  return ascii || 'host'
}

export function generateInboundToken(displayName: string | null | undefined): string {
  const slug = slugify(displayName ?? 'host')
  const suffix = randomBytes(4).toString('hex')
  return `${slug}-${suffix}`
}

export function buildInboundAddress(token: string): string {
  return `${token}@${INBOUND_EMAIL_DOMAIN}`
}
