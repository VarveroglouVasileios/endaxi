function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = config.public.appUrl.replace(/\/+$/u, '')

  setResponseHeaders(event, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${escapeXml(`${siteUrl}/`)}</loc>`,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n')
})
