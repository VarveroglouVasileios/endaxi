import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createHmac } from 'node:crypto'

export interface RateLimitRule {
  id: string
  prefix: string
  limit: number
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
  windowMs: number
  /**
   * Αν true, ο κανόνας μοιράζεται ΕΝΑ κοινό identifier ('global') αντί για
   * το per-IP identifier — λειτουργεί σαν circuit breaker ανεξάρτητο από
   * IP. Χωρίς αυτό, ένα distributed botnet με rotating IPs παίρνει το
   * πλήρες per-IP όριο ξανά και ξανά (κάθε IP είναι "νέος" χρήστης).
   */
  global?: boolean
}

export const GLOBAL_RATE_LIMIT_IDENTIFIER = 'global'

export interface RateLimitResult {
  rule: RateLimitRule
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export class RateLimitUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Το σύστημα περιορισμού αιτημάτων δεν είναι διαθέσιμο.', { cause })
    this.name = 'RateLimitUnavailableError'
  }
}

export const RATE_LIMIT_RULES: readonly RateLimitRule[] = [
  {
    id: 'ical-minute',
    prefix: '/api/ical-sources/validate',
    limit: 20,
    window: '1 m',
    windowMs: 60_000,
  },
  // Καλύπτει και το POST /api/ical-sources (δημιουργία πηγής) που κάνει
  // πραγματικό εξωτερικό fetch στο iCal URL — χωρίς αυτό ήταν απεριόριστο.
  {
    id: 'ical-sources-minute',
    prefix: '/api/ical-sources',
    limit: 30,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'sign-in-minute',
    prefix: '/api/auth/sign-in',
    limit: 10,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'sign-up-minute',
    prefix: '/api/auth/sign-up',
    limit: 5,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'password-reset-minute',
    prefix: '/api/auth/request-password-reset',
    limit: 5,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'verification-email-minute',
    prefix: '/api/auth/send-verification-email',
    limit: 3,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    // ΣΦΙΞΙΜΟ (security audit, Αύγ 2026): 8→5 — το /api/help/chat δεν
    // απαιτεί login (Origin header ΔΕΝ είναι authentication, ένα script
    // εκτός browser το πλαστογραφεί εύκολα). Χαμηλότερο per-minute όριο
    // περιορίζει την ταχύτητα burst ενός μεμονωμένου attacker.
    id: 'help-chat-minute',
    prefix: '/api/help/chat',
    limit: 5,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    // ΣΦΙΞΙΜΟ: 40→15 ανά IP/μέρα — βασικός μοχλός άμυνας απέναντι σε ένα
    // μεμονωμένο IP που προσπαθεί να καταναλώσει Groq quota.
    id: 'help-chat-day',
    prefix: '/api/help/chat',
    limit: 15,
    window: '1 d',
    windowMs: 86_400_000,
  },
  // Circuit breaker ανεξάρτητο από IP: ένα distributed botnet με rotating
  // IPs παρακάμπτει το per-IP όριο παραπάνω γιατί κάθε IP ξεκινά "καθαρό".
  // Αυτό μπλοκάρει ΟΛΗ την κίνηση προς το AI chat όταν ξεπεραστεί ένα
  // λογικό ημερήσιο budget, ανεξάρτητα από το πόσες διαφορετικές IPs
  // στέλνουν τα requests. Ρυθμίσιμο via env για να μη μπλοκάρει πραγματική
  // αύξηση χρηστών χωρίς παρέμβαση.
  // ΣΦΙΞΙΜΟ: default 300→150 — μειώνει το χειρότερο σενάριο ημερήσιου
  // κόστους από distributed abuse στο μισό, παραμένει ρυθμίσιμο.
  {
    id: 'help-chat-global-day',
    prefix: '/api/help/chat',
    limit: Number(process.env.HELP_CHAT_DAILY_BUDGET ?? 150),
    window: '1 d',
    windowMs: 86_400_000,
    global: true,
  },
  // Κάθε λήψη παράγει ένα signed R2 URL — χωρίς όριο ένας λογαριασμός θα
  // μπορούσε να ζητά χιλιάδες signed URLs σε λίγα λεπτά.
  {
    id: 'documents-download-minute',
    prefix: '/api/documents',
    limit: 60,
    window: '1 m',
    windowMs: 60_000,
  },
  // ΝΕΟ (security audit): /api/properties, /api/stays, /api/me,
  // /api/onboarding ήταν εντελώς εκτός rate-limit — ένας συνδεδεμένος
  // χρήστης (ή κλεμμένο session) μπορούσε να κάνει απεριόριστα PATCH/POST.
  // Γενικό, αρκετά γενναιόδωρο όριο ώστε να μην ενοχλεί κανονική χρήση
  // (dashboard polling, onboarding flow), αλλά να κόβει scripted abuse.
  {
    id: 'authenticated-api-minute',
    prefix: '/api/properties',
    limit: 60,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'stays-api-minute',
    prefix: '/api/stays',
    limit: 60,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'me-api-minute',
    prefix: '/api/me',
    limit: 30,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'onboarding-api-minute',
    prefix: '/api/onboarding',
    limit: 20,
    window: '1 m',
    windowMs: 60_000,
  },
  // ΝΕΟ: /api/health έτρεχε `select 1` στη Neon σε ΚΑΘΕ αίτημα χωρίς κανένα
  // όριο — φθηνό μεμονωμένα, αλλά φθηνός ενισχυτής (amplifier) για κάποιον
  // που θέλει να πιέσει τη βάση. Γενναιόδωρο όριο ώστε να μην ενοχλεί
  // health checks / load balancer probes (συνήθως κάθε 5-30 δευτ.).
  {
    id: 'health-minute',
    prefix: '/api/health',
    limit: 30,
    window: '1 m',
    windowMs: 60_000,
  },
  // ΝΕΟ (δικός μου security audit): αυτά τα Better Auth endpoints δεν
  // καλύπτονταν από το δικό μας distributed (Upstash) rate-limit — έπεφταν
  // πίσω στο built-in in-memory limiter του Better Auth, που είναι
  // per-instance και άρα παρακάμψιμο σε multi-instance deployment (Azure
  // App Service autoscale). /api/auth/reset-password είναι η ΚΑΤΑΝΑΛΩΣΗ
  // του token (διαφορετικό endpoint από το /request-password-reset).
  {
    id: 'reset-password-minute',
    prefix: '/api/auth/reset-password',
    limit: 5,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'verify-email-minute',
    prefix: '/api/auth/verify-email',
    limit: 10,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'change-password-minute',
    prefix: '/api/auth/change-password',
    limit: 10,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'change-email-minute',
    prefix: '/api/auth/change-email',
    limit: 10,
    window: '1 m',
    windowMs: 60_000,
  },
  // Πρόθεμα '/api/auth/revoke-session' καλύπτει ΚΑΙ το /revoke-session
  // (μία session) ΚΑΙ το /revoke-sessions (όλες) — σκόπιμο, όχι ατύχημα.
  {
    id: 'revoke-session-minute',
    prefix: '/api/auth/revoke-session',
    limit: 10,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'delete-user-minute',
    prefix: '/api/auth/delete-user',
    limit: 5,
    window: '1 m',
    windowMs: 60_000,
  },
] as const

/**
 * Per-account (όχι per-IP) throttle στο sign-in — δικός μου security audit:
 * το per-IP `sign-in-minute` παραπάνω δίνει σε ΚΑΘΕ IP δικό του "καθαρό"
 * μπάτζετ 10 προσπαθειών/λεπτό. Ένας distributed attacker (πολλά IPs) που
 * στοχεύει ΕΝΑ email έχει ουσιαστικά απεριόριστο συνολικό budget χωρίς
 * αυτό. Εφαρμόζεται χειροκίνητα στο server/utils/auth.ts (hooks.before),
 * όχι μέσω του γενικού middleware, γιατί χρειάζεται πρόσβαση στο email
 * του request body.
 */
export const SIGN_IN_EMAIL_RULE: RateLimitRule = {
  id: 'sign-in-address-window',
  prefix: '/api/auth/sign-in',
  limit: 15,
  window: '15 m',
  windowMs: 900_000,
}

export const EMAIL_VERIFICATION_EMAIL_RULE: RateLimitRule = {
  id: 'verification-email-address-hour',
  prefix: '/api/auth/send-verification-email',
  limit: 3,
  window: '1 h',
  windowMs: 3_600_000,
}

export function createRateLimitIdentifier(ipAddress: string): string {
  const key = process.env.BETTER_AUTH_SECRET ?? 'endaxi-development-rate-limit'
  return createHmac('sha256', key).update(ipAddress).digest('hex')
}

interface Bucket {
  count: number
  resetAt: number
}

const developmentBuckets = new Map<string, Bucket>()
const upstashLimiters = new Map<string, Ratelimit>()
let redis: Redis | null = null

function getUpstashRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  return (redis ??= new Redis({ url, token }))
}

function getUpstashLimiter(rule: RateLimitRule, client: Redis): Ratelimit {
  const existing = upstashLimiters.get(rule.id)
  if (existing) return existing

  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
    analytics: false,
    prefix: `endaxi:rate-limit:${rule.id}`,
    timeout: 2_000,
  })
  upstashLimiters.set(rule.id, limiter)
  return limiter
}

function checkDevelopmentLimit(rule: RateLimitRule, identifier: string): RateLimitResult {
  const now = Date.now()
  const key = `${rule.id}:${identifier}`
  let bucket = developmentBuckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + rule.windowMs }
    developmentBuckets.set(key, bucket)
  }

  bucket.count += 1
  return {
    rule,
    success: bucket.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - bucket.count),
    reset: bucket.resetAt,
  }
}

interface UpstashLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  reason?: string
}

function mapUpstashResult(rule: RateLimitRule, result: UpstashLimitResult): RateLimitResult {
  if (result.reason === 'timeout') throw new RateLimitUnavailableError()

  return {
    rule,
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

export async function checkRateLimits(
  rules: readonly RateLimitRule[],
  identifier: string,
): Promise<RateLimitResult[]> {
  const client = getUpstashRedis()

  if (!client) {
    if (process.env.NODE_ENV === 'production') throw new RateLimitUnavailableError()
    return rules.map(rule => checkDevelopmentLimit(rule, identifier))
  }

  try {
    return await Promise.all(
      rules.map(async (rule) => {
        const result = await getUpstashLimiter(rule, client).limit(identifier)
        return mapUpstashResult(rule, result)
      }),
    )
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) throw error
    throw new RateLimitUnavailableError(error)
  }
}

export function resetDevelopmentRateLimits(): void {
  developmentBuckets.clear()
}
