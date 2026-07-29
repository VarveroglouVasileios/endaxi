const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler((event) => {
  if (!MUTATING_METHODS.has(event.method.toUpperCase())) return

  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || path === '/api/inngest') return

  const config = useRuntimeConfig(event)
  const allowedOrigin = new URL(config.public.appUrl).origin
  const origin = getHeader(event, 'origin')
  const fetchSite = getHeader(event, 'sec-fetch-site')

  // Σε development επιτρέπεται localhost ώστε να δουλεύει τοπικά χωρίς να αλλάξεις
  // την NUXT_PUBLIC_APP_URL (που πρέπει να δείχνει στο production URL).
  const isDev = process.env.NODE_ENV !== 'production'
  const isLocalhostOrigin
    = isDev
    && origin != null
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

  if (!isLocalhostOrigin && ((origin && origin !== allowedOrigin) || fetchSite === 'cross-site')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'ORIGIN_NOT_ALLOWED',
      data: { message: 'Το αίτημα δεν επιτρέπεται από αυτή την προέλευση.' },
    })
  }
})
