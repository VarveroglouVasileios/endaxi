import { describe, expect, it } from 'vitest'
import {
  fetchPublicText,
  isPublicIpAddress,
  PublicFetchError,
  readTextWithLimit,
} from '../server/utils/http/safe-public-fetch'

describe('safe public fetch', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('blocks non-public address %s', (address) => {
    expect(isPublicIpAddress(address)).toBe(false)
  })

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])(
    'allows public address %s',
    (address) => {
      expect(isPublicIpAddress(address)).toBe(true)
    },
  )

  it('rejects private literal targets before any request', async () => {
    await expect(
      fetchPublicText('https://127.0.0.1/calendar.ics', {
        maxBytes: 1024,
        timeoutMs: 100,
      }),
    ).rejects.toMatchObject({ code: 'blocked_target' } satisfies Partial<PublicFetchError>)
  })

  it.each([
    'http://example.com/calendar.ics',
    'https://user:password@example.com/calendar.ics',
    'https://example.com:8443/calendar.ics',
  ])('rejects unsafe URL %s', async (url) => {
    await expect(
      fetchPublicText(url, { maxBytes: 1024, timeoutMs: 100 }),
    ).rejects.toMatchObject({ code: 'bad_url' } satisfies Partial<PublicFetchError>)
  })

  describe('readTextWithLimit (gzip-bomb protection)', () => {
    function fakeResponse(chunks: Uint8Array[], headers: Record<string, string> = {}) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk)
          controller.close()
        },
      })
      return new Response(stream, { headers })
    }

    it('rejects a body that streams past maxBytes even with no Content-Length', async () => {
      // Προσομοιώνει gzip bomb: το undici έχει ήδη αποσυμπιέσει το σώμα,
      // οπότε δεν υπάρχει αξιόπιστο Content-Length να το προλάβει νωρίς —
      // πρέπει να το πιάσει το ίδιο το streaming loop.
      const maxBytes = 1024
      const bigChunk = new Uint8Array(maxBytes + 1).fill(65)
      const response = fakeResponse([bigChunk])

      await expect(readTextWithLimit(response, maxBytes)).rejects.toMatchObject({
        code: 'too_large',
      } satisfies Partial<PublicFetchError>)
    })

    it('rejects a body that exceeds maxBytes only after several small chunks', async () => {
      const maxBytes = 100
      const chunks = Array.from({ length: 20 }, () => new Uint8Array(10).fill(66))
      const response = fakeResponse(chunks)

      await expect(readTextWithLimit(response, maxBytes)).rejects.toMatchObject({
        code: 'too_large',
      } satisfies Partial<PublicFetchError>)
    })

    it('rejects up front when a lying Content-Length declares an oversized body', async () => {
      const maxBytes = 1024
      const response = fakeResponse([new Uint8Array(10)], {
        'content-length': String(maxBytes * 10),
      })

      await expect(readTextWithLimit(response, maxBytes)).rejects.toMatchObject({
        code: 'too_large',
      } satisfies Partial<PublicFetchError>)
    })

    it('accepts a body within the limit', async () => {
      const maxBytes = 1024
      const response = fakeResponse([new Uint8Array(10).fill(67)])

      await expect(readTextWithLimit(response, maxBytes)).resolves.toContain('C')
    })
  })
})
