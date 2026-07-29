/**
 * Γράφει το ήδη-υπολογισμένο, έμπιστο client IP (βλ. `utils/request-ip.ts`)
 * σε ένα εσωτερικό header, ΠΑΝΤΑ αντικαθιστώντας ό,τι έστειλε ο client —
 * άρα δεν μπορεί να πλαστογραφηθεί.
 *
 * Γιατί χρειάζεται: το Better Auth (`utils/auth.ts`) δέχεται μόνο λίστα
 * header names για IP tracking, όχι custom resolver function. Το δικό μας
 * `getTrustedClientIp()` ξέρει ήδη πώς να διαβάσει σωστά το proxy chain του
 * Azure App Service, οπότε το περνάμε
 * εδώ σε ΕΝΑ single-value header που το Better Auth μπορεί να εμπιστευτεί
 * απευθείας, χωρίς να χρειάζεται να μαντέψουμε CIDR ranges για trustedProxies.
 */

import { getTrustedClientIp, TRUSTED_CLIENT_IP_HEADER } from '../utils/request-ip'

export default defineEventHandler((event) => {
  const ip = getTrustedClientIp(event)
  if (ip) {
    event.node.req.headers[TRUSTED_CLIENT_IP_HEADER] = ip
  } else {
    delete event.node.req.headers[TRUSTED_CLIENT_IP_HEADER]
  }
})
