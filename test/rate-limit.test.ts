import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkRateLimits,
  createRateLimitIdentifier,
  EMAIL_VERIFICATION_EMAIL_RULE,
  RATE_LIMIT_RULES,
  RateLimitUnavailableError,
  resetDevelopmentRateLimits,
} from '../server/utils/rate-limit'

const originalNodeEnv = process.env.NODE_ENV

describe('shared rate limiting', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    resetDevelopmentRateLimits()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('uses a bounded in-memory fallback only outside production', async () => {
    process.env.NODE_ENV = 'test'
    const rule = RATE_LIMIT_RULES.find(candidate => candidate.id === 'sign-up-minute')!

    for (let attempt = 0; attempt < rule.limit; attempt += 1) {
      const [result] = await checkRateLimits([rule], '198.51.100.10')
      expect(result?.success).toBe(true)
    }

    const [blocked] = await checkRateLimits([rule], '198.51.100.10')
    expect(blocked?.success).toBe(false)
    expect(blocked?.remaining).toBe(0)
  })

  it('fails closed in production when Upstash is not configured', async () => {
    process.env.NODE_ENV = 'production'
    const rule = RATE_LIMIT_RULES[0]!

    await expect(checkRateLimits([rule], '198.51.100.10')).rejects.toBeInstanceOf(
      RateLimitUnavailableError,
    )
  })

  it('uses a stable pseudonymous identifier instead of storing the raw IP', () => {
    const identifier = createRateLimitIdentifier('198.51.100.10')

    expect(identifier).toHaveLength(64)
    expect(identifier).not.toContain('198.51.100.10')
    expect(createRateLimitIdentifier('198.51.100.10')).toBe(identifier)
  })

  it('limits verification delivery per normalized email identifier', async () => {
    process.env.NODE_ENV = 'test'
    const identifier = createRateLimitIdentifier('email:user@example.com')

    for (let attempt = 0; attempt < EMAIL_VERIFICATION_EMAIL_RULE.limit; attempt += 1) {
      const [result] = await checkRateLimits([EMAIL_VERIFICATION_EMAIL_RULE], identifier)
      expect(result?.success).toBe(true)
    }

    const [blocked] = await checkRateLimits([EMAIL_VERIFICATION_EMAIL_RULE], identifier)
    expect(blocked?.success).toBe(false)
  })
})
