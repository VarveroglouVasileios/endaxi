const ALLOWED_PRIVATE_PATHS = ['/app', '/onboarding'] as const

export function safePrivateRedirect(candidate: unknown, fallback = '/app'): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback
  }

  try {
    const parsed = new URL(candidate, 'https://endaxi.invalid')
    const isAllowed = ALLOWED_PRIVATE_PATHS.some(
      prefix => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
    )

    if (parsed.origin !== 'https://endaxi.invalid' || !isAllowed) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
