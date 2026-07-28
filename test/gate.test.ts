import { describe, it, expect } from 'vitest'
import {
  checkGate,
  checkAddProperty,
  determineRegime,
  INDIVIDUAL_PROPERTY_LIMIT,
} from '../server/utils/gate'

describe('determineRegime', () => {
  it('1-2 ακίνητα = ιδιώτης', () => {
    expect(determineRegime(1)).toBe('individual_upto_2')
    expect(determineRegime(2)).toBe('individual_upto_2')
  })

  it('3+ ακίνητα = επιτηδευματίας', () => {
    expect(determineRegime(3)).toBe('business_3_plus')
    expect(determineRegime(10)).toBe('business_3_plus')
  })

  it('το όριο είναι 2', () => {
    expect(INDIVIDUAL_PROPERTY_LIMIT).toBe(2)
  })
})

describe('checkGate', () => {
  it('επιτρέπει ιδιώτη με 1 ακίνητο', () => {
    const r = checkGate({ propertyCount: 1 })
    expect(r.allowed).toBe(true)
    expect(r.regime).toBe('individual_upto_2')
  })

  it('επιτρέπει ιδιώτη με 2 ακίνητα', () => {
    expect(checkGate({ propertyCount: 2 }).allowed).toBe(true)
  })

  it('ΜΠΛΟΚΑΡΕΙ στα 3 ακίνητα', () => {
    const r = checkGate({ propertyCount: 3 })
    expect(r.allowed).toBe(false)
    expect(r.regime).toBe('business_3_plus')
    expect(r.reason).toBe('property_count_exceeded')
    expect(r.notice).toContain('myDATA')
  })

  it('ΜΠΛΟΚΑΡΕΙ νομικό πρόσωπο ακόμα και με 1 ακίνητο', () => {
    const r = checkGate({ propertyCount: 1, isLegalEntity: true })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('legal_entity')
  })

  it('μπλοκάρει χωρίς ακίνητα', () => {
    const r = checkGate({ propertyCount: 0 })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('no_properties')
  })

  it('το μήνυμα εξηγεί τι σημαίνει, δεν λέει απλώς όχι', () => {
    const r = checkGate({ propertyCount: 5 })
    expect(r.notice).toContain('επιτηδευματίας')
    expect(r.notice).toContain('ΦΠΑ')
    expect(r.notice).toContain('λίστα αναμονής')
  })
})

describe('checkAddProperty — το πέρασμα 2 → 3', () => {
  it('επιτρέπει 0 → 1', () => {
    expect(checkAddProperty(0).allowed).toBe(true)
  })

  it('επιτρέπει 1 → 2', () => {
    expect(checkAddProperty(1).allowed).toBe(true)
  })

  it('ΜΠΛΟΚΑΡΕΙ 2 → 3 με προειδοποίηση', () => {
    const r = checkAddProperty(2)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('would_exceed_limit')
    expect(r.notice).toContain('τρίτο ακίνητο')
    expect(r.notice).toContain('λογιστή')
  })

  it('παραμένει μπλοκαρισμένο πάνω από το όριο', () => {
    expect(checkAddProperty(5).allowed).toBe(false)
  })
})
