/**
 * ΑΦΜ — επαλήθευση με τον επίσημο αλγόριθμο ελέγχου.
 *
 * Γιατί δεν αρκεί «9 ψηφία»: το ΑΦΜ τυπώνεται σε **φορολογικό
 * παραστατικό**. Ένα τυπογραφικό λάθος δεν είναι κοσμητικό — είναι
 * ελαττωματικό παραστατικό. Ο αλγόριθμος πιάνει τα περισσότερα
 * λάθη πληκτρολόγησης (μεταθέσεις ψηφίων, λάθος ψηφίο).
 *
 * Αλγόριθμος: τα 8 πρώτα ψηφία πολλαπλασιάζονται με 2^8 … 2^1,
 * το άθροισμα mod 11 mod 10 πρέπει να ισούται με το 9ο ψηφίο.
 */

export function normalizeAfm(input: string): string {
  return input.replace(/\D/g, '')
}

export function isValidAfm(input: string): boolean {
  const afm = normalizeAfm(input)

  if (afm.length !== 9) return false

  // Το 000000000 περνά τον αλγόριθμο αλλά δεν είναι υπαρκτό ΑΦΜ
  if (/^0+$/.test(afm)) return false

  const digits = afm.split('').map(Number)

  let sum = 0
  for (let i = 0; i < 8; i++) {
    sum += digits[i]! * 2 ** (8 - i)
  }

  return (sum % 11) % 10 === digits[8]
}

/** Μορφοποίηση για εμφάνιση: 123456789 → 123 456 789 */
export function formatAfm(input: string): string {
  const afm = normalizeAfm(input)
  if (afm.length !== 9) return input
  return `${afm.slice(0, 3)} ${afm.slice(3, 6)} ${afm.slice(6)}`
}

/** Μήνυμα σφάλματος στα ελληνικά, χρήσιμο στον χρήστη. */
export function afmError(input: string): string | null {
  const afm = normalizeAfm(input)
  if (afm.length === 0) return 'Συμπλήρωσε το ΑΦΜ σου.'
  if (afm.length !== 9) return 'Το ΑΦΜ πρέπει να έχει 9 ψηφία.'
  if (!isValidAfm(afm)) return 'Το ΑΦΜ δεν φαίνεται σωστό. Έλεγξε τα ψηφία.'
  return null
}
