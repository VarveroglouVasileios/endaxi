import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildPasswordResetEmail,
  sendPasswordResetEmail,
} from '../server/utils/email/password-reset'

describe('password reset email', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key'
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    vi.unstubAllGlobals()
  })

  it('includes the one-time reset URL in HTML and text', () => {
    const url = 'https://endaxi.app/api/auth/reset-password/token?callbackURL=%2Freset'
    const email = buildPasswordResetEmail(url)

    expect(email.subject).toContain('Επαναφορά κωδικού')
    expect(email.html).toContain(url)
    expect(email.text).toContain(url)
    expect(email.text).toContain('60 λεπτά')
  })

  it('escapes the URL before inserting it into HTML', () => {
    const email = buildPasswordResetEmail('https://example.com/?next="><script>')

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('sends the reset message through the Resend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendPasswordResetEmail(
      'user@example.com',
      'https://endaxi.app/reset-password?token=token',
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(options.body)) as {
      to: string[]
      subject: string
      html: string
    }

    expect(url).toBe('https://api.resend.com/emails')
    expect(options.method).toBe('POST')
    expect(body.to).toEqual(['user@example.com'])
    expect(body.subject).toContain('Επαναφορά κωδικού')
    expect(body.html).toContain('reset-password?token=token')
  })
})
