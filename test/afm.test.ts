import { describe, it, expect } from 'vitest'
import { isValidAfm, normalizeAfm, formatAfm, afmError } from '../server/utils/afm'

/**
 * Παράγει έγκυρο ΑΦΜ από 8 ψηφία, υπολογίζοντας το check digit.
 * Το χρησιμοποιούμε για να μη γράψουμε πραγματικά ΑΦΜ στα tests.
 */
function makeValidAfm(first8: string): string {
  const d = first8.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 8; i++) sum += d[i]! * 2 ** (8 - i)
  return first8 + String((sum % 11) % 10)
}

describe('normalizeAfm', () => {
  it('αφαιρεί κενά και σημεία', () => {
    expect(normalizeAfm('123 456 789')).toBe('123456789')
    expect(normalizeAfm('123.456.789')).toBe('123456789')
    expect(normalizeAfm('  123456789  ')).toBe('123456789')
  })
})

describe('isValidAfm — checksum', () => {
  it('δέχεται ΑΦΜ με σωστό ψηφίο ελέγχου', () => {
    const valid = makeValidAfm('12345678')
    expect(isValidAfm(valid)).toBe(true)
  })

  it('δέχεται πολλαπλά έγκυρα', () => {
    for (const base of ['09876543', '11111111', '99999999', '10000000']) {
      expect(isValidAfm(makeValidAfm(base))).toBe(true)
    }
  })

  it('απορρίπτει λάθος ψηφίο ελέγχου', () => {
    const valid = makeValidAfm('12345678')
    const lastDigit = Number(valid[8])
    const wrong = valid.slice(0, 8) + String((lastDigit + 1) % 10)
    expect(isValidAfm(wrong)).toBe(false)
  })

  it('πιάνει μετάθεση ψηφίων — το πιο συχνό λάθος πληκτρολόγησης', () => {
    const valid = makeValidAfm('12345678')
    // Αντιμετάθεση δύο διαδοχικών ψηφίων
    const swapped =
      valid.slice(0, 2) + valid[3] + valid[2] + valid.slice(4)
    // Δεν πιάνει ΚΑΘΕ μετάθεση, αλλά πρέπει να πιάνει τις περισσότερες
    if (swapped !== valid) {
      expect(isValidAfm(swapped)).toBe(false)
    }
  })

  it('απορρίπτει λάθος μήκος', () => {
    expect(isValidAfm('12345678')).toBe(false) // 8
    expect(isValidAfm('1234567890')).toBe(false) // 10
    expect(isValidAfm('')).toBe(false)
  })

  it('απορρίπτει μηδενικά', () => {
    expect(isValidAfm('000000000')).toBe(false)
  })

  it('απορρίπτει γράμματα', () => {
    expect(isValidAfm('12345678a')).toBe(false)
    expect(isValidAfm('ΑΒΓΔΕΖΗΘΙ')).toBe(false)
  })

  it('δέχεται με κενά και τελείες', () => {
    const valid = makeValidAfm('12345678')
    const spaced = `${valid.slice(0, 3)} ${valid.slice(3, 6)} ${valid.slice(6)}`
    expect(isValidAfm(spaced)).toBe(true)
  })
})

describe('formatAfm', () => {
  it('χωρίζει σε τριάδες', () => {
    expect(formatAfm('123456789')).toBe('123 456 789')
  })

  it('αφήνει ανέπαφο αν δεν είναι 9ψήφιο', () => {
    expect(formatAfm('123')).toBe('123')
  })
})

describe('afmError — μηνύματα στον χρήστη', () => {
  it('κενό', () => {
    expect(afmError('')).toContain('Συμπλήρωσε')
  })

  it('λάθος μήκος', () => {
    expect(afmError('12345')).toContain('9 ψηφία')
  })

  it('λάθος checksum', () => {
    const valid = makeValidAfm('12345678')
    const wrong = valid.slice(0, 8) + String((Number(valid[8]) + 1) % 10)
    expect(afmError(wrong)).toContain('δεν φαίνεται σωστό')
  })

  it('έγκυρο → null', () => {
    expect(afmError(makeValidAfm('12345678'))).toBeNull()
  })
})
