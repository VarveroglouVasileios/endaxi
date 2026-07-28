import { describe, expect, it } from 'vitest'
import {
  isStrongPassword,
  isValidEmail,
  PASSWORD_MAX_LENGTH,
} from '../shared/auth-validation'

describe('auth validation', () => {
  it.each([
    'user@example.com',
    'onoma+tag@example.gr',
  ])('accepts valid email %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each([
    '',
    'user',
    'user@',
    '@example.com',
    'user@example',
    'user @example.com',
  ])('rejects invalid email %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it('accepts a password that satisfies every rule', () => {
    expect(isStrongPassword('Endaxi2026!')).toBe(true)
  })

  it.each([
    'Short1!',
    'endaxi2026!',
    'ENDAXI2026!',
    'EndaxiPass!',
    'Endaxi20260',
    `${'A'.repeat(PASSWORD_MAX_LENGTH)}a1!`,
  ])('rejects weak password %s', (password) => {
    expect(isStrongPassword(password)).toBe(false)
  })
})
