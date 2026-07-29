import { describe, expect, it } from 'vitest'
import { guestReceiptEmail, monthlyReminderEmail } from '../server/utils/email/templates'

describe('email template security', () => {
  it('escapes calendar and property data in receipt HTML', () => {
    const email = guestReceiptEmail({
      guestName: '<img src=x onerror=alert(1)>',
      propertyName: '</strong><script>alert(1)</script>',
      checkIn: '2026-07-01',
      checkOut: '2026-07-02',
      nights: 1,
      totalAmountCents: 800,
      fullNumber: 'TAKK-2026-1',
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('<img src=x')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).toContain('&lt;img src=x')
    expect(email.text).toContain('<img src=x')
  })

  it('escapes the host name in reminder HTML', () => {
    const email = monthlyReminderEmail({
      hostName: '<svg onload=alert(1)>',
      period: '2026-07',
      deadline: '2026-08-31',
      documentCount: 1,
      totalAmountCents: 800,
      isSecondReminder: false,
      daysLeft: 30,
    })

    expect(email.html).not.toContain('<svg onload')
    expect(email.html).toContain('&lt;svg onload')
  })

  it('removes newlines from user-controlled subject text', () => {
    const email = guestReceiptEmail({
      guestName: null,
      propertyName: 'Ακίνητο\r\nBcc: attacker@example.com',
      checkIn: '2026-07-01',
      checkOut: '2026-07-02',
      nights: 1,
      totalAmountCents: 800,
      fullNumber: 'TAKK-2026-1',
    })

    expect(email.subject).not.toMatch(/[\r\n]/u)
  })
})
