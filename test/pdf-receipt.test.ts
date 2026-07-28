import { describe, it, expect } from 'vitest'
import { renderTakkReceiptPdf, type TakkReceiptData } from '../server/utils/pdf/takk-receipt'
import { calculateTakk } from '../server/utils/takk/calculator'

function makeReceipt(
  checkIn: string,
  checkOut: string,
  opts: { cancel?: boolean; category?: 'str_standard' | 'str_villa' } = {},
): TakkReceiptData {
  const category = opts.category ?? 'str_standard'
  const c = calculateTakk({ checkIn, checkOut, category })

  return {
    series: 'Α',
    number: 42,
    year: Number(checkOut.slice(0, 4)),
    issuedAt: new Date('2026-11-02T18:30:00Z'),
    isCancellation: opts.cancel ?? false,
    cancelsFullNumber: opts.cancel ? 'Α-2026-0000041' : undefined,
    cancellationReason: opts.cancel ? 'Ακύρωση κράτησης' : undefined,
    issuerName: 'Βασίλης Βαρβέρογλου',
    issuerAfm: '123456789',
    propertyAma: '00001234567',
    propertyName: 'Διαμέρισμα Κουκάκι',
    propertyAddress: 'Δράκου 12, Αθήνα 11741',
    checkIn,
    checkOut,
    nights: c.nights,
    guestName: 'Ελένη Παπαδοπούλου',
    breakdown: c.breakdown,
    uniformRateCents: c.uniformRateCents,
    totalAmountCents: opts.cancel ? -c.totalAmountCents : c.totalAmountCents,
    remittancePeriod: c.remittancePeriod,
  }
}

/** Απλός έλεγχος ότι το buffer είναι έγκυρο PDF */
function isValidPdf(buf: Buffer): boolean {
  return (
    buf.subarray(0, 5).toString() === '%PDF-' &&
    buf.subarray(-1024).toString('latin1').includes('%%EOF')
  )
}

describe('Ειδικό Στοιχείο ΤΑΚΚ — παραγωγή PDF', () => {
  it('παράγει έγκυρο PDF με ενιαίο συντελεστή', async () => {
    const buf = await renderTakkReceiptPdf(makeReceipt('2026-07-10', '2026-07-13'))
    expect(isValidPdf(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(4000)
  }, 30_000)

  it('παράγει PDF με αναλυτικό πίνακα όταν η διαμονή διασχίζει εποχές', async () => {
    const data = makeReceipt('2026-10-30', '2026-11-02')

    // Προϋπόθεση: ο υπολογισμός όντως δίνει μικτούς συντελεστές
    expect(data.uniformRateCents).toBeNull()
    expect(data.totalAmountCents).toBe(1800)
    expect(data.breakdown).toHaveLength(3)

    const buf = await renderTakkReceiptPdf(data)
    expect(isValidPdf(buf)).toBe(true)
  }, 30_000)

  it('παράγει ακυρωτικό με αρνητικό ποσό', async () => {
    const data = makeReceipt('2026-07-10', '2026-07-13', { cancel: true })
    expect(data.totalAmountCents).toBe(-2400)

    const buf = await renderTakkReceiptPdf(data)
    expect(isValidPdf(buf)).toBe(true)
  }, 30_000)

  it('χειρίζεται βίλα με υψηλό συντελεστή', async () => {
    const data = makeReceipt('2026-08-01', '2026-08-08', { category: 'str_villa' })
    expect(data.totalAmountCents).toBe(10_500)

    const buf = await renderTakkReceiptPdf(data)
    expect(isValidPdf(buf)).toBe(true)
  }, 30_000)

  it('δεν σπάει χωρίς όνομα επισκέπτη ή διεύθυνση', async () => {
    const data = makeReceipt('2026-07-10', '2026-07-11')
    data.guestName = null
    data.propertyAddress = null
    data.issuerName = null
    data.issuerAfm = null

    const buf = await renderTakkReceiptPdf(data)
    expect(isValidPdf(buf)).toBe(true)
  }, 30_000)

  it('χειρίζεται πολύ μακρά διαμονή με αναλυτικό πίνακα', async () => {
    // 59 ημέρες που διασχίζουν εποχές → μεγάλος πίνακας, πολλαπλές σελίδες
    const data = makeReceipt('2026-09-15', '2026-11-13')
    expect(data.nights).toBe(59)
    expect(data.uniformRateCents).toBeNull()

    const buf = await renderTakkReceiptPdf(data)
    expect(isValidPdf(buf)).toBe(true)
  }, 30_000)
})
