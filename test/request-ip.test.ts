import type { H3Event } from 'h3'
import { afterEach, describe, expect, it } from 'vitest'
import { getTrustedClientIp } from '../server/utils/request-ip'

const originalTrustAzureProxy = process.env.TRUST_AZURE_PROXY

function requestEvent(
  headers: Record<string, string> = {},
  remoteAddress = '10.0.0.4',
): H3Event {
  return {
    context: {},
    node: {
      req: {
        headers,
        socket: { remoteAddress },
      },
    },
  } as unknown as H3Event
}

afterEach(() => {
  if (originalTrustAzureProxy === undefined) {
    delete process.env.TRUST_AZURE_PROXY
  } else {
    process.env.TRUST_AZURE_PROXY = originalTrustAzureProxy
  }
})

describe('Azure App Service client IP trust', () => {
  it('ignores spoofed forwarding headers when Azure proxy trust is disabled', () => {
    delete process.env.TRUST_AZURE_PROXY

    expect(
      getTrustedClientIp(requestEvent({ 'x-forwarded-for': '203.0.113.25' })),
    ).toBe('10.0.0.4')
  })

  it('uses the final address appended by the Azure front end', () => {
    process.env.TRUST_AZURE_PROXY = '1'

    expect(
      getTrustedClientIp(
        requestEvent({ 'x-forwarded-for': '198.51.100.9, 203.0.113.25' }),
      ),
    ).toBe('203.0.113.25')
  })

  it('falls back to the socket address when Azure omits the header', () => {
    process.env.TRUST_AZURE_PROXY = '1'

    expect(getTrustedClientIp(requestEvent())).toBe('10.0.0.4')
  })
})
