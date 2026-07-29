import { applyRequestBodyLimit } from '../utils/body-limit'

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler((event) => {
  const method = event.method.toUpperCase()
  if (!BODY_METHODS.has(method)) return

  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  const request = toWebRequest(event)
  const limitedRequest = applyRequestBodyLimit(
    request,
    path,
    () =>
      createError({
        statusCode: 413,
        statusMessage: 'PAYLOAD_TOO_LARGE',
        data: { message: 'Το αίτημα είναι υπερβολικά μεγάλο.' },
      }),
  )

  event.web ??= {}
  event.web.request = limitedRequest
})
