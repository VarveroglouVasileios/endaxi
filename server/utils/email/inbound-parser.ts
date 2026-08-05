/**
 * ΑΝΑΓΝΩΣΗ (best-effort) email κράτησης/payout από Airbnb ή Booking.com.
 *
 * ⚠️ ΕΙΝΑΙ ΕΓΓΕΝΩΣ ΕΥΘΡΑΥΣΤΟ: δεν υπάρχει επίσημο API/schema για αυτά τα
 * emails — οι πλατφόρμες αλλάζουν το template τους χωρίς προειδοποίηση.
 * Γι' αυτό ο σχεδιασμός είναι ΣΥΝΤΗΡΗΤΙΚΟΣ: παράγει αποτέλεσμα ΜΟΝΟ όταν
 * βρει ποσό ΚΑΙ ημερομηνία άφιξης με λογική βεβαιότητα — διαφορετικά
 * επιστρέφει `null` και το email καταγράφεται ως `unrecognized_format`
 * (server/api/webhooks/resend-inbound.post.ts), πέφτοντας πίσω στη
 * χειροκίνητη καταχώρηση (σελίδα Εισόδημα) — ΠΟΤΕ δεν μαντεύει λάθος.
 *
 * Χρειάζεται συντονισμό με πραγματικά δείγματα emails μόλις υπάρξουν.
 */

export interface ParsedBookingEmail {
  amountCents: number | null
  checkIn: string | null // ISO date
  checkOut: string | null // ISO date
}

const AMOUNT_KEYWORDS = [
  'σύνολο',
  'συνολικό',
  'total',
  'payout',
  "you'll get",
  'you will get',
  'you earned',
  'κέρδισες',
  'κερδίζετε',
  'αποδοχές',
  'net payout',
  'host payout',
  'earnings',
]

/**
 * ΒΡΕΘΗΚΕ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΠΑΡΑΔΕΙΓΜΑ (μοντάλ «Έσοδα» της Airbnb): η ίδια
 * κράτηση δείχνει ΔΥΟ διαφορετικά «Σύνολο (EUR)» ανάλογα με tab —
 * 385,12€ («Κερδίζετε», μετά την προμήθεια οικοδεσπότη) και 470,02€
 * («Ο επισκέπτης πλήρωσε», μαζί με την προμήθεια επισκέπτη). ΚΑΝΕΝΑ από
 * τα δύο δεν είναι το δηλωτέο ποσό — αυτό είναι η τιμή διαμονής χωρίς
 * καμία προμήθεια (στο παράδειγμα: 400,00€). Γραμμές με αυτές τις λέξεις
 * ΔΕΝ πρέπει ποτέ να επιλέγονται ως το δηλωτέο ποσό.
 */
const EXCLUDE_KEYWORDS = [
  'προμήθεια',
  'υπηρεσιών',
  'service fee',
  'guest fee',
  'host fee',
  'commission',
  'φπα',
  'vat',
  'κρατήσεις πλατφόρμας',
  'cleaning fee',
  'καθαρισμ',
]

/** '1.234,56' ή '1,234.56' ή '965,00' ή '965.00' → 96500 (λεπτά) */
function parseEuroToCents(raw: string): number | null {
  const cleaned = raw.trim()
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')

  let normalized: string
  if (hasComma && hasDot) {
    // Το τελευταίο σύμβολο είναι το δεκαδικό διαχωριστικό
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    // '965,00' → δεκαδικό. '1,234' (3ψήφιο μετά) → χιλιάδες.
    const parts = cleaned.split(',')
    normalized
      = parts.length === 2 && parts[1]!.length === 2
        ? cleaned.replace(',', '.')
        : cleaned.replace(/,/g, '')
  } else {
    normalized = cleaned
  }

  const value = Number.parseFloat(normalized)
  if (Number.isNaN(value) || value <= 0 || value > 100_000) return null
  return Math.round(value * 100)
}

/**
 * Συντηρητική εξαγωγή ποσού: γυρίζει τιμή ΜΟΝΟ όταν υπάρχει ΕΝΑΣ σαφής
 * υποψήφιος. Αν βρεθούν πολλαπλά, ΔΙΑΦΟΡΕΤΙΚΑ ποσά κοντά σε λέξη-κλειδί
 * «συνόλου» (π.χ. δύο tabs «Κερδίζετε» / «Ο επισκέπτης πλήρωσε» με
 * διαφορετικό ποσό το καθένα) — ΔΕΝ μαντεύει ποιο είναι σωστό, γυρίζει
 * `null` (unrecognized_format) και αφήνει τον host να το καταχωρήσει.
 */
function findBestAmount(text: string): number | null {
  const re = /(?:€|EUR)[\s:)]{0,3}([0-9][0-9.,]*[0-9]|[0-9])|([0-9][0-9.,]*[0-9]|[0-9])[\s:]{0,2}(?:€|EUR)/g
  const candidates: { cents: number; score: number; excluded: boolean }[] = []

  let match: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(text)) !== null) {
    const raw = match[1] ?? match[2]
    if (!raw) continue
    const cents = parseEuroToCents(raw)
    if (cents === null) continue

    // ΣΗΜΑΝΤΙΚΟ: το παράθυρο context ΔΕΝ πρέπει να διασχίζει αλλαγή γραμμής —
    // βρέθηκε bug όπου η λέξη «υπηρεσιών» από την ΠΡΟΗΓΟΥΜΕΝΗ γραμμή (π.χ.
    // «Προμήθεια υπηρεσιών») αλλοίωνε λανθασμένα το σκορ ενός εντελώς
    // άσχετου ποσού στην ΕΠΟΜΕΝΗ γραμμή («Σύνολο»). Κάθε γραμμή κρίνεται
    // μόνο από το δικό της περιεχόμενο.
    const lineStart = text.lastIndexOf('\n', match.index) + 1
    const windowStart = Math.max(lineStart, match.index - 40)
    const context = text.slice(windowStart, match.index).toLowerCase()
    const excluded = EXCLUDE_KEYWORDS.some(k => context.includes(k))
    const score = AMOUNT_KEYWORDS.some(k => context.includes(k)) ? 1 : 0

    candidates.push({ cents, score, excluded })
  }

  const usable = candidates.filter(c => !c.excluded)
  if (usable.length === 0) return null

  const scored = usable.filter(c => c.score > 0)
  const pool = scored.length > 0 ? scored : usable

  const distinctValues = new Set(pool.map(c => c.cents))
  if (distinctValues.size > 1) return null // ασαφές — δεν μαντεύουμε

  return pool[0]!.cents
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  ιαν: 1, φεβ: 2, μαρ: 3, απρ: 4, μαι: 5, μάι: 5, ιουν: 6, ιούν: 6,
  ιουλ: 7, ιούλ: 7, αυγ: 8, σεπ: 9, οκτ: 10, νοε: 11, δεκ: 12,
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Βρίσκει ΟΛΕΣ τις ημερομηνίες στο κείμενο, με σειρά εμφάνισης. */
function findDates(text: string): string[] {
  const found: string[] = []

  // ISO: 2026-07-10
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    found.push(`${m[1]}-${m[2]}-${m[3]}`)
  }

  // '10 Jul 2026' / '10 Ιουλίου 2026' / 'Jul 10, 2026'
  // \p{L}* (μαζί με το flag 'u') καλύπτει ΟΠΟΙΑΔΗΠΟΤΕ κατάληξη πτώσης
  // (Ιουλίου, Ιουνίου, Αυγούστου...) χωρίς να χρειάζεται λίστα τόνων/πτώσεων.
  const monthNames = Object.keys(MONTHS).join('|')
  const reDMY = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\p{L}*\\s+(20\\d{2})\\b`, 'giu')
  for (const m of text.matchAll(reDMY)) {
    const month = MONTHS[m[2]!.toLowerCase()]
    if (!month) continue
    found.push(`${m[3]}-${pad2(month)}-${pad2(Number(m[1]))}`)
  }
  const reMDY = new RegExp(`\\b(${monthNames})\\p{L}*\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, 'giu')
  for (const m of text.matchAll(reMDY)) {
    const month = MONTHS[m[1]!.toLowerCase()]
    if (!month) continue
    found.push(`${m[3]}-${pad2(month)}-${pad2(Number(m[2]))}`)
  }

  return found
}

export function parseBookingEmail(subject: string, text: string): ParsedBookingEmail {
  const full = `${subject}\n${text}`

  const amountCents = findBestAmount(full)
  const dates = [...new Set(findDates(full))].sort()

  return {
    amountCents,
    checkIn: dates.length > 0 ? dates[0]! : null,
    checkOut: dates.length > 1 ? dates[dates.length - 1]! : null,
  }
}
