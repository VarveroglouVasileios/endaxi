/** Μορφοποιήσεις για το UI. Πάντα ελληνικά. */

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

/** 'YYYY-MM-DD' → '30/10/2026' */
export function grDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

/** 'YYYY-MM' → 'Νοέμβριος 2026' */
export function grPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS[m! - 1]} ${y}`
}

export function fullNumber(series: string, number: number, year: number): string {
  return `${series}-${year}-${String(number).padStart(7, '0')}`
}

/** Ημέρες μέχρι μια ISO ημερομηνία (0 αν πέρασε) */
export function daysUntil(iso: string): number {
  const target = Date.parse(`${iso}T23:59:59+03:00`)
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000))
}
