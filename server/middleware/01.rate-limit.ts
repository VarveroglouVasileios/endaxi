/**
 * RATE LIMITING — απλό, in-memory, ανά IP.
 *
 * Στοχεύει τα endpoints που κοστίζουν ή εκτίθενται:
 *  · /api/ical-sources/validate — κάνει εξερχόμενο fetch (SSRF/abuse vector)
 *  · /api/auth/*                — brute force κωδικών
 *
 * ⚠️ ΠΕΡΙΟΡΙΣΜΟΣ: in-memory σημαίνει ότι σε πολλαπλά instances κάθε ένα
 *    έχει τον δικό του μετρητή. Για σοβαρό φορτίο θέλει Redis ή
 *    Cloudflare Rate Limiting μπροστά. Για MVP με ένα instance αρκεί.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Καθαρισμός παλιών εγγραφών ώστε να μη φουσκώνει η μνήμη */
let lastSweep = Date.now()
function sweep() {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k)
  }
}

interface Rule {
  prefix: string
  limit: number
  windowMs: number
}

const RULES: Rule[] = [
  // Κάνει εξερχόμενο HTTP request — το πιο ακριβό endpoint
  { prefix: '/api/ical-sources/validate', limit: 20, windowMs: 60_000 },
  // Brute force προστασία
  { prefix: '/api/auth/sign-in', limit: 10, windowMs: 60_000 },
  { prefix: '/api/auth/sign-up', limit: 5, windowMs: 60_000 },
]

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const rule = RULES.find((r) => path.startsWith(r.prefix))
  if (!rule) return

  sweep()

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const key = `${rule.prefix}:${ip}`
  const now = Date.now()

  let b = buckets.get(key)
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + rule.windowMs }
    buckets.set(key, b)
  }

  b.count++

  const remaining = Math.max(0, rule.limit - b.count)
  setResponseHeaders(event, {
    'X-RateLimit-Limit': String(rule.limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(b.resetAt / 1000)),
  })

  if (b.count > rule.limit) {
    const retryAfter = Math.ceil((b.resetAt - now) / 1000)
    // Το h3 τυποποιεί το Retry-After ως number (RFC 9110: delta-seconds)
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: 'RATE_LIMITED',
      data: {
        message: `Πάρα πολλές προσπάθειες. Δοκίμασε ξανά σε ${retryAfter} δευτερόλεπτα.`,
      },
    })
  }
})
