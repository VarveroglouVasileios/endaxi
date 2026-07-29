import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createHmac } from 'node:crypto'

export interface RateLimitRule {
  id: string
  prefix: string
  limit: number
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
  windowMs: number
}

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
    id: 'help-chat-minute',
    prefix: '/api/help/chat',
    limit: 8,
    window: '1 m',
    windowMs: 60_000,
  },
  {
    id: 'help-chat-day',
    prefix: '/api/help/chat',
    limit: 40,
    window: '1 d',
    windowMs: 86_400_000,
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
] as const

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
