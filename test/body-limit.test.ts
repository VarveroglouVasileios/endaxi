import { describe, expect, it } from 'vitest'
import {
  API_BODY_LIMIT,
  applyRequestBodyLimit,
  CHAT_BODY_LIMIT,
  INNGEST_BODY_LIMIT,
  requestBodyLimitForPath,
} from '../server/utils/body-limit'

function bodyTooLargeError(): Error & { statusCode: number } {
  return Object.assign(new Error('PAYLOAD_TOO_LARGE'), { statusCode: 413 })
}

describe('request body limits', () => {
  it('uses the strict chat limit and larger signed-webhook limit', () => {
    expect(requestBodyLimitForPath('/api/help/chat')).toBe(CHAT_BODY_LIMIT)
    expect(requestBodyLimitForPath('/api/properties')).toBe(API_BODY_LIMIT)
    expect(requestBodyLimitForPath('/api/inngest')).toBe(INNGEST_BODY_LIMIT)
  })

  it('rejects an oversized chunked body without Content-Length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(CHAT_BODY_LIMIT))
        controller.enqueue(new Uint8Array(1))
        controller.close()
      },
    })
    const request = new Request('http://localhost/api/help/chat', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit)
    const limited = applyRequestBodyLimit(
      request,
      '/api/help/chat',
      bodyTooLargeError,
    )

    await expect(limited.text()).rejects.toMatchObject({ statusCode: 413 })
  })

  it('rejects an oversized declared Content-Length before reading', async () => {
    const request = new Request('http://localhost/api/help/chat', {
      method: 'POST',
      headers: { 'Content-Length': String(CHAT_BODY_LIMIT + 1) },
      body: '{}',
    })
    const limited = applyRequestBodyLimit(
      request,
      '/api/help/chat',
      bodyTooLargeError,
    )

    await expect(limited.text()).rejects.toMatchObject({ statusCode: 413 })
  })
})
