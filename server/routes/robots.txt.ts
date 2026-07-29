export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = config.public.appUrl.replace(/\/+$/u, '')

  setResponseHeaders(event, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /app/',
    'Disallow: /onboarding/',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
})
