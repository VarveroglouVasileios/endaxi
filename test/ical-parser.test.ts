import { describe, it, expect } from 'vitest'
import {
  isBlockedSummary,
  extractGuestName,
  detectPlatform,
  toIsoDate,
  diffStays,
  parseIcalFeed,
  type ParsedEvent,
} from '../server/utils/ical/parser'

describe('isBlockedSummary — μην εκδώσεις ΤΑΚΚ για ημερολογιακό block', () => {
  it('αναγνωρίζει Airbnb blocks', () => {
    expect(isBlockedSummary('Airbnb (Not available)')).toBe(true)
    expect(isBlockedSummary('Not available')).toBe(true)
    expect(isBlockedSummary('Blocked')).toBe(true)
  })

  it('αναγνωρίζει Booking.com blocks', () => {
    expect(isBlockedSummary('CLOSED - Not available')).toBe(true)
  })

  it('αναγνωρίζει ελληνικά', () => {
    expect(isBlockedSummary('Μη διαθέσιμο')).toBe(true)
  })

  it('ΔΕΝ μπερδεύει πραγματικές κρατήσεις', () => {
    expect(isBlockedSummary('Reserved')).toBe(false)
    expect(isBlockedSummary('John Smith')).toBe(false)
    expect(isBlockedSummary('Γιάννης Παπαδόπουλος')).toBe(false)
    expect(isBlockedSummary(null)).toBe(false)
  })
})

describe('extractGuestName', () => {
  it('παίρνει όνομα από Booking summary', () => {
    expect(extractGuestName('John Smith', null)).toBe('John Smith')
  })

  it('αγνοεί γενικά labels', () => {
    expect(extractGuestName('Reserved', null)).toBeNull()
    expect(extractGuestName('Reservation', null)).toBeNull()
    expect(extractGuestName('Airbnb (Not available)', null)).toBeNull()
  })

  it('βρίσκει όνομα μέσα σε description', () => {
    expect(extractGuestName(null, 'Guest: Maria Papadopoulou\nPhone: 69...')).toBe(
      'Maria Papadopoulou',
    )
    expect(extractGuestName(null, 'Όνομα: Νίκος Δήμου')).toBe('Νίκος Δήμου')
  })

  it('επιστρέφει null όταν δεν υπάρχει τίποτα', () => {
    expect(extractGuestName(null, null)).toBeNull()
  })
})

describe('detectPlatform', () => {
  it('αναγνωρίζει πλατφόρμες από URL', () => {
    expect(detectPlatform('https://www.airbnb.com/calendar/ical/123.ics')).toBe('airbnb')
    expect(detectPlatform('https://admin.booking.com/hotel/ical.html?t=x')).toBe('booking')
    expect(detectPlatform('http://www.vrbo.com/icalendar/abc.ics')).toBe('vrbo')
    expect(detectPlatform('https://example.com/feed.ics')).toBe('other')
  })
})

describe('toIsoDate — το bug της μιας ημέρας', () => {
  it('all-day: διαβάζει ΤΟΠΙΚΑ components, δεν χάνει μέρα', () => {
    // Έτσι ακριβώς φτιάχνει το node-ical το VALUE=DATE:20260710
    // σε Europe/Athens: τοπικά μεσάνυχτα = 2026-07-09T21:00:00Z
    const d = new Date(2026, 6, 10, 0, 0, 0)
    expect(toIsoDate(d, { dateOnly: true })).toBe('2026-07-10')
  })

  it('all-day: σωστό και τον χειμώνα (UTC+2)', () => {
    const d = new Date(2026, 0, 15, 0, 0, 0)
    expect(toIsoDate(d, { dateOnly: true })).toBe('2026-01-15')
  })

  it('all-day: σωστό στα όρια του μήνα — εδώ αλλάζει και η εποχή', () => {
    // 1 Νοεμβρίου = χειμερινή (2€). Αν γλιστρήσει στις 31/10
    // γίνεται θερινή (8€) — τετραπλάσιο ποσό.
    expect(toIsoDate(new Date(2026, 10, 1, 0, 0, 0), { dateOnly: true })).toBe(
      '2026-11-01',
    )
    expect(toIsoDate(new Date(2026, 9, 31, 0, 0, 0), { dateOnly: true })).toBe(
      '2026-10-31',
    )
  })

  it('all-day: σωστό στην αλλαγή έτους', () => {
    expect(toIsoDate(new Date(2027, 0, 1, 0, 0, 0), { dateOnly: true })).toBe(
      '2027-01-01',
    )
  })

  it('datetime: μετατρέπει στη ζώνη του ακινήτου', () => {
    // 22:30 UTC = 01:30 επόμενης ημέρας στην Ελλάδα (θερινή ώρα)
    expect(toIsoDate(new Date('2026-07-10T22:30:00Z'))).toBe('2026-07-11')
    // 08:00 UTC = 11:00 ίδιας ημέρας
    expect(toIsoDate(new Date('2026-07-10T08:00:00Z'))).toBe('2026-07-10')
  })
})

describe('parseIcalFeed — regression: all-day dates', () => {
  const ICS = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261030',
    'DTEND;VALUE=DATE:20261102',
    'UID:cross-season@airbnb.com',
    'SUMMARY:Reserved',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')

  it('διατηρεί ΑΚΡΙΒΩΣ τις ημερομηνίες του feed', async () => {
    const events = await parseIcalFeed(ICS)
    expect(events).toHaveLength(1)
    // Το feed λέει 30/10 → 02/11. Αυτό ακριβώς πρέπει να βγει.
    expect(events[0]!.checkIn).toBe('2026-10-30')
    expect(events[0]!.checkOut).toBe('2026-11-02')
  })
})

describe('diffStays — sync logic', () => {
  const ev = (uid: string, checkIn: string, checkOut: string, blocked = false): ParsedEvent => ({
    uid,
    checkIn,
    checkOut,
    summary: blocked ? 'Not available' : 'Reserved',
    description: null,
    guestName: null,
    isBlocked: blocked,
    raw: {},
  })

  it('εντοπίζει νέες κρατήσεις', () => {
    const d = diffStays([], [ev('a', '2026-07-10', '2026-07-13')])
    expect(d.toCreate).toHaveLength(1)
    expect(d.toCancel).toHaveLength(0)
  })

  it('αγνοεί ημερολογιακά blocks', () => {
    const d = diffStays([], [ev('b', '2026-07-10', '2026-07-13', true)])
    expect(d.toCreate).toHaveLength(0)
  })

  it('δεν ξαναδημιουργεί υπάρχουσα κράτηση (idempotent)', () => {
    const existing = [
      { id: 's1', externalUid: 'a', checkIn: '2026-07-10', checkOut: '2026-07-13', status: 'confirmed' },
    ]
    const d = diffStays(existing, [ev('a', '2026-07-10', '2026-07-13')])
    expect(d.toCreate).toHaveLength(0)
    expect(d.toUpdate).toHaveLength(0)
    expect(d.unchanged).toBe(1)
  })

  it('εντοπίζει τροποποίηση ημερομηνιών', () => {
    const existing = [
      { id: 's1', externalUid: 'a', checkIn: '2026-07-10', checkOut: '2026-07-13', status: 'confirmed' },
    ]
    const d = diffStays(existing, [ev('a', '2026-07-10', '2026-07-15')])
    expect(d.toUpdate).toHaveLength(1)
    expect(d.toUpdate[0]!.existingId).toBe('s1')
  })

  it('σημειώνει την εξαφάνιση ως υποψήφια ακύρωση για επιβεβαίωση', () => {
    const existing = [
      { id: 's1', externalUid: 'a', checkIn: '2026-07-10', checkOut: '2026-07-13', status: 'confirmed' },
      { id: 's2', externalUid: 'b', checkIn: '2026-08-01', checkOut: '2026-08-05', status: 'confirmed' },
    ]
    const d = diffStays(existing, [ev('a', '2026-07-10', '2026-07-13')])
    expect(d.toCancel).toEqual(['s2'])
  })

  it('δεν ξανα-ακυρώνει ήδη ακυρωμένη', () => {
    const existing = [
      { id: 's1', externalUid: 'a', checkIn: '2026-07-10', checkOut: '2026-07-13', status: 'cancelled' },
    ]
    const d = diffStays(existing, [])
    expect(d.toCancel).toHaveLength(0)
  })

  it('στέλνει για έλεγχο κράτηση που επανεμφανίζεται μετά από ακύρωση', () => {
    const existing = [
      { id: 's1', externalUid: 'a', checkIn: '2026-07-10', checkOut: '2026-07-13', status: 'cancelled' },
    ]
    const d = diffStays(existing, [ev('a', '2026-07-10', '2026-07-13')])

    expect(d.unchanged).toBe(0)
    expect(d.toUpdate).toHaveLength(0)
    expect(d.toReview).toEqual([
      expect.objectContaining({ existingId: 's1' }),
    ])
  })

  it('συνδυασμένο σενάριο', () => {
    const existing = [
      { id: 's1', externalUid: 'a', checkIn: '2026-07-10', checkOut: '2026-07-13', status: 'confirmed' },
      { id: 's2', externalUid: 'b', checkIn: '2026-08-01', checkOut: '2026-08-05', status: 'confirmed' },
      { id: 's3', externalUid: 'c', checkIn: '2026-09-01', checkOut: '2026-09-03', status: 'confirmed' },
    ]
    const incoming = [
      ev('a', '2026-07-10', '2026-07-13'), // unchanged
      ev('b', '2026-08-01', '2026-08-07'), // extended
      ev('d', '2026-10-01', '2026-10-04'), // new
      ev('e', '2026-11-01', '2026-11-05', true), // block, ignore
    ]
    const d = diffStays(existing, incoming)
    expect(d.unchanged).toBe(1)
    expect(d.toUpdate).toHaveLength(1)
    expect(d.toCreate).toHaveLength(1)
    expect(d.toCancel).toEqual(['s3'])
  })
})
