import { limitRequestBody } from 'srvx/body-limit'

export const CHAT_BODY_LIMIT = 12_000
export const AUTH_BODY_LIMIT = 64 * 1024
export const API_BODY_LIMIT = 64 * 1024
export const INNGEST_BODY_LIMIT = 2 * 1024 * 1024

export function requestBodyLimitForPath(path: string): number {
  if (path === '/api/help/chat') return CHAT_BODY_LIMIT
  if (path.startsWith('/api/auth/')) return AUTH_BODY_LIMIT
  if (path === '/api/inngest') return INNGEST_BODY_LIMIT
  return API_BODY_LIMIT
}

export function applyRequestBodyLimit<T extends Request>(
  request: T,
  path: string,
  createLimitError: () => unknown,
): T {
  return limitRequestBody(request, requestBodyLimitForPath(path), {
    createError: createLimitError,
  })
}
