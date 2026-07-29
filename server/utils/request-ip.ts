import { getHeader, getRequestIP, type H3Event } from 'h3'

/**
 * Εσωτερικό header όπου το `server/middleware/00.trusted-ip.ts` γράφει το
 * ήδη-υπολογισμένο έμπιστο IP, ΠΑΝΤΑ αντικαθιστώντας ό,τι έστειλε ο client.
 * Χρησιμοποιείται από το Better Auth (`utils/auth.ts`) ως single-value
 * header, ώστε να μην χρειάζεται να μαντέψουμε CIDR ranges (trustedProxies)
 * για τον Azure App Service front-end.
 */
export const TRUSTED_CLIENT_IP_HEADER = 'x-endaxi-client-ip'

/**
 * Azure App Service's front-end role APPENDS the real client IP to any
 * existing X-Forwarded-For value (like a standard nginx proxy), rather than
 * providing a dedicated header the way Cloudflare/Vercel do. So the trusted
 * value is the LAST entry, not the first — the first entries could have
 * been set by the client itself.
 */
function lastForwardedIp(value: string | undefined): string | undefined {
  const parts = value?.split(',').map(part => part.trim()).filter(Boolean)
  return parts?.at(-1)
}

export function getTrustedClientIp(event: H3Event): string | undefined {
  if (process.env.TRUST_AZURE_PROXY === '1') {
    return lastForwardedIp(getHeader(event, 'x-forwarded-for')) ?? getRequestIP(event)
  }

  return getRequestIP(event)
}
