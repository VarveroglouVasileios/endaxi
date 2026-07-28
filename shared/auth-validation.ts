export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

export interface PasswordRule {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'symbol'
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `Τουλάχιστον ${PASSWORD_MIN_LENGTH} χαρακτήρες`,
    test: password => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'Ένα κεφαλαίο γράμμα',
    test: password => /\p{Lu}/u.test(password),
  },
  {
    id: 'lowercase',
    label: 'Ένα πεζό γράμμα',
    test: password => /\p{Ll}/u.test(password),
  },
  {
    id: 'number',
    label: 'Έναν αριθμό',
    test: password => /\p{N}/u.test(password),
  },
  {
    id: 'symbol',
    label: 'Ένα σύμβολο, π.χ. !@#',
    test: password => /[^\p{L}\p{N}\s]/u.test(password),
  },
]

export function isStrongPassword(password: string): boolean {
  return (
    password.length <= PASSWORD_MAX_LENGTH
    && PASSWORD_RULES.every(rule => rule.test(password))
  )
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email.trim())
}
