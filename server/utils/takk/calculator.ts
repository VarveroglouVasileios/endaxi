/**
 * ΤΑΚΚ Calculator — καθαρές συναρτήσεις, μηδέν side effects.
 *
 * Όλα τα ποσά σε ΛΕΠΤΑ (integer). Ποτέ float για χρήμα.
 * Όλες οι ημερομηνίες σε ISO 'YYYY-MM-DD', χωρίς ώρα, χωρίς timezone.
 * Οι ημερομηνίες διαμονής είναι ημερολογιακές — δεν επηρεάζονται από
 * το timezone του server.
 */

import type { PropertyCategory } from '../../database/schema'
import { getRateForNight, getSeasonForNight, getRateSet, type Season } from './rates'

export interface NightBreakdown {
  /** Η ημερομηνία που ΞΕΚΙΝΑΕΙ η νύχτα */
  date: string
  season: Season
  rateCents: number
}

export interface TakkCalculation {
  nights: number
  breakdown: NightBreakdown[]
  totalAmountCents: number
  /**
   * Συντελεστής ανά νύχτα, ΜΟΝΟ αν είναι ενιαίος σε όλη τη διαμονή.
   */
  uniformRateCents: number | null
  /**
   * Μήνας απόδοσης 'YYYY-MM' — από την ΑΝΑΧΩΡΗΣΗ, για ΟΛΟΚΛΗΡΗ τη διαμονή.
   *
   * ⚠️ ΜΗΝ το χρησιμοποιήσεις για την πραγματική έκδοση παραστατικών —
   * σε διαμονή που διασχίζει μήνες είναι ΛΑΘΟΣ (θα δήλωνε τον πρώτο μήνα
   * εκπρόθεσμα, βλ. σχόλιο στο `TakkSegment`). Είναι εδώ μόνο για
   * ενημερωτική/συνοπτική εμφάνιση μονο-μηνιαίων διαμονών. Η πραγματική
   * έκδοση χρησιμοποιεί ΠΑΝΤΑ `segments[].remittancePeriod`
   * (βλ. server/utils/takk/numbering.ts).
   */
  remittancePeriod: string
  /**
   * Τα ΞΕΧΩΡΙΣΤΑ παραστατικά που πρέπει να εκδοθούν.
   * Σε διαμονή εντός ενός μήνα: ένα. Διασχίζοντας μήνες: ένα ανά μήνα.
   */
  segments: TakkSegment[]
}

/**
 * ΤΜΗΜΑ ΠΑΡΑΣΤΑΤΙΚΟΥ — ένα ανά ημερολογιακό μήνα διαμονής.
 *
 * ⚠️ ΝΟΜΙΚΗ ΑΠΑΙΤΗΣΗ, όχι σχεδιαστική επιλογή.
 *
 * ΑΑΔΕ, Συχνές Ερωτήσεις ΤΑΚΚ (Ιαν 2026), ερώτηση 7:
 *   «για περιόδους διαμονής που εκτείνονται σε μήνες κατά τους οποίους
 *    ισχύουν διαφορετικά ποσά τέλους, το ειδικό στοιχείο–απόδειξη
 *    ΕΚΔΙΔΕΤΑΙ ΓΙΑ ΚΑΘΕ ΜΗΝΑ ΞΕΧΩΡΙΣΤΑ και ΟΧΙ κατά την αναχώρηση.»
 *
 * Γιατί έχει σημασία: κάθε μήνας δηλώνεται τον επόμενό του. Με ένα
 * ενιαίο παραστατικό, το ποσό του πρώτου μήνα θα δηλωνόταν έναν μήνα
 * αργά — δηλαδή εκπρόθεσμα.
 */
export interface TakkSegment {
  /** Ημερολογιακός μήνας 'YYYY-MM' */
  month: string
  /** Πρώτη νύχτα του τμήματος */
  firstNight: string
  /** Τελευταία νύχτα του τμήματος */
  lastNight: string
  nights: number
  breakdown: NightBreakdown[]
  totalAmountCents: number
  uniformRateCents: number | null
  /**
   * Μήνας απόδοσης του τμήματος = ο ίδιος ο μήνας διαμονής.
   * ΟΧΙ ο μήνας αναχώρησης.
   */
  remittancePeriod: string
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertIsoDate(value: string, label: string): void {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`${label}: αναμενόταν ημερομηνία 'YYYY-MM-DD', ελήφθη '${value}'`)
  }
  // Έλεγχος υπαρκτής ημερομηνίας (π.χ. 2026-02-30)
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m! - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`${label}: ανύπαρκτη ημερομηνία '${value}'`)
  }
}

/** Προσθέτει ημέρες σε ISO date, σε UTC ώστε να μην παίζει το DST. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * Ανώτατο όριο ασφαλείας για διανυκτερεύσεις μιας διαμονής.
 *
 * ΒΡΕΘΗΚΕ ΣΕ ΔΙΚΟ ΜΟΥ SECURITY AUDIT: χωρίς αυτό, ένα iCal event με
 * αλλοιωμένη/ακραία ημερομηνία αναχώρησης (π.χ. DTEND πολλά χρόνια στο
 * μέλλον, τυχαία ή κακόβουλα) θα έκανε το `calculateTakk()` να χτίσει
 * πίνακα εκατομμυρίων εγγραφών (μία ανά νύχτα) — resource exhaustion στο
 * Inngest step, και ρίσκο overflow στο `total_amount_cents` (Postgres
 * integer, 4 bytes) όταν το ποσό αθροίζεται σε τόσο μεγάλο εύρος.
 *
 * 366 μέρες καλύπτει γενναιόδωρα κάθε πραγματική βραχυχρόνια μίσθωση
 * (νομικά ούτως ή άλλως ορίζεται ως τέτοια μόνο για σύντομες διαμονές) —
 * δεν μπλοκάρει καμία νόμιμη κράτηση, μόνο αλλοιωμένα/κακόβουλα δεδομένα.
 */
export const MAX_STAY_NIGHTS = 366

/** Διανυκτερεύσεις μεταξύ άφιξης και αναχώρησης. */
export function countNights(checkIn: string, checkOut: string): number {
  assertIsoDate(checkIn, 'checkIn')
  assertIsoDate(checkOut, 'checkOut')

  const a = Date.parse(`${checkIn}T00:00:00Z`)
  const b = Date.parse(`${checkOut}T00:00:00Z`)
  const nights = Math.round((b - a) / 86_400_000)

  if (nights < 0) {
    throw new Error('Η αναχώρηση δεν μπορεί να προηγείται της άφιξης')
  }
  if (nights > MAX_STAY_NIGHTS) {
    throw new Error(
      `Η διαμονή διαρκεί ${nights} διανυκτερεύσεις — υπερβαίνει το όριο ` +
      `ασφαλείας των ${MAX_STAY_NIGHTS}. Πιθανό αλλοιωμένο ή άκυρο iCal event.`,
    )
  }
  return nights
}

/**
 * Μήνας απόδοσης ΤΑΚΚ.
 *
 * Καθορίζεται από την ΗΜΕΡΟΜΗΝΙΑ ΑΝΑΧΩΡΗΣΗΣ, γιατί το ειδικό στοιχείο
 * εκδίδεται μετά τη διαμονή και πριν την αναχώρηση.
 *
 * Αυτό λύνει το λάθος που κοστίζει πρόστιμα:
 * check-out την 1η Μαΐου → ανήκει στον ΜΑΪΟ (δηλώνεται τον Ιούνιο),
 * όχι στον Απρίλιο, ακόμα κι αν όλες οι νύχτες ήταν Απρίλιο.
 */
export function getRemittancePeriod(checkOut: string): string {
  assertIsoDate(checkOut, 'checkOut')
  return checkOut.slice(0, 7)
}

/**
 * Προθεσμία υποβολής μηνιαίας δήλωσης:
 * τελευταία ημέρα του ΕΠΟΜΕΝΟΥ μήνα από τον μήνα απόδοσης.
 */
export function getRemittanceDeadline(remittancePeriod: string): string {
  const [y, m] = remittancePeriod.split('-').map(Number)
  // Ημέρα 0 του μεθεπόμενου μήνα = τελευταία ημέρα του επόμενου
  const dt = new Date(Date.UTC(y!, m! + 1, 0))
  return dt.toISOString().slice(0, 10)
}

/**
 * Ο κύριος υπολογισμός.
 *
 * Κάθε νύχτα τιμολογείται ξεχωριστά με βάση τον μήνα στον οποίο ΞΕΚΙΝΑΕΙ.
 * Διαμονή 30/10 → 02/11 = 3 νύχτες: 30/10 (υψηλή), 31/10 (υψηλή), 01/11 (χαμηλή).
 */
export function calculateTakk(params: {
  checkIn: string
  checkOut: string
  category: PropertyCategory
}): TakkCalculation {
  const { checkIn, checkOut, category } = params

  const nights = countNights(checkIn, checkOut)

  if (nights === 0) {
    return {
      nights: 0,
      breakdown: [],
      totalAmountCents: 0,
      uniformRateCents: null,
      remittancePeriod: getRemittancePeriod(checkOut),
      segments: [],
    }
  }

  const breakdown: NightBreakdown[] = []
  let totalAmountCents = 0

  for (let i = 0; i < nights; i++) {
    const date = addDays(checkIn, i)
    const rateSet = getRateSet(date)
    const season = getSeasonForNight(date, rateSet)
    const rateCents = getRateForNight(date, category)

    breakdown.push({ date, season, rateCents })
    totalAmountCents += rateCents
  }

  const rates = new Set(breakdown.map((b) => b.rateCents))
  const uniformRateCents = rates.size === 1 ? breakdown[0]!.rateCents : null

  return {
    nights,
    breakdown,
    totalAmountCents,
    uniformRateCents,
    remittancePeriod: getRemittancePeriod(checkOut),
    segments: splitIntoMonthlySegments(breakdown),
  }
}

/**
 * Χωρίζει τις νύχτες σε τμήματα ανά ημερολογιακό μήνα.
 *
 * Κάθε τμήμα γίνεται ΞΕΧΩΡΙΣΤΟ παραστατικό με δικό του αύξοντα αριθμό
 * και δικό του μήνα απόδοσης. Δες το σχόλιο στο TakkSegment για το γιατί.
 */
export function splitIntoMonthlySegments(
  breakdown: NightBreakdown[],
): TakkSegment[] {
  if (breakdown.length === 0) return []

  const byMonth = new Map<string, NightBreakdown[]>()

  for (const night of breakdown) {
    const month = night.date.slice(0, 7)
    const bucket = byMonth.get(month)
    if (bucket) bucket.push(night)
    else byMonth.set(month, [night])
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, nights]) => {
      const total = nights.reduce((s, n) => s + n.rateCents, 0)
      const rates = new Set(nights.map((n) => n.rateCents))

      return {
        month,
        firstNight: nights[0]!.date,
        lastNight: nights.at(-1)!.date,
        nights: nights.length,
        breakdown: nights,
        totalAmountCents: total,
        uniformRateCents: rates.size === 1 ? nights[0]!.rateCents : null,
        // Ο μήνας απόδοσης είναι ο ΙΔΙΟΣ ο μήνας διαμονής
        remittancePeriod: month,
      }
    })
}

/** Μορφοποίηση λεπτών σε ελληνικό νόμισμα: 800 → "8,00 €" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
