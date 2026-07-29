import { describe, expect, it } from 'vitest'
import {
  fetchPublicText,
  isPublicIpAddress,
  PublicFetchError,
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
})
