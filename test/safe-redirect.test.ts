import { describe, expect, it } from 'vitest'
import { safePrivateRedirect } from '../shared/safe-redirect'

describe('safe private redirects', () => {
  it.each([
    ['/app', '/app'],
    ['/app/diamones?from=login', '/app/diamones?from=login'],
    ['/onboarding', '/onboarding'],
  ])('allows internal destination %s', (candidate, expected) => {
    expect(safePrivateRedirect(candidate)).toBe(expected)
  })

  it.each([
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example',
    '/logout',
    'javascript:alert(1)',
    undefined,
  ])('rejects external or unapproved destination %s', (candidate) => {
    expect(safePrivateRedirect(candidate)).toBe('/app')
  })
})
