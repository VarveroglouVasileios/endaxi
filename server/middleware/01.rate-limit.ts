import {
  checkRateLimits,
  createRateLimitIdentifier,
  RATE_LIMIT_RULES,
  RateLimitUnavailableError,
} from '../utils/rate-limit'
import { getTrustedClientIp } from '../utils/request-ip'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  const rules = RATE_LIMIT_RULES.filter(rule => path.startsWith(rule.prefix))
  if (rules.length === 0) return

  let results
  try {
    const identifier = createRateLimitIdentifier(getTrustedClientIp(event) ?? 'unknown')
    results = await checkRateLimits(rules, identifier)
  } catch (error) {
    if (!(error instanceof RateLimitUnavailableError)) throw error
    throw createError({
      statusCode: 503,
      statusMessage: 'RATE_LIMIT_UNAVAILABLE',
      data: { message: 'Η υπηρεσία είναι προσωρινά μη διαθέσιμη. Δοκίμασε ξανά σε λίγο.' },
    })
  }

  const exceeded = results.find(result => !result.success)
  const displayed = exceeded ?? results[0]!
  setResponseHeaders(event, {
    'X-RateLimit-Limit': String(displayed.limit),
    'X-RateLimit-Remaining': String(displayed.remaining),
    'X-RateLimit-Reset': String(Math.ceil(displayed.reset / 1000)),
  })

  if (exceeded) {
    const retryAfter = Math.max(1, Math.ceil((exceeded.reset - Date.now()) / 1000))
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
