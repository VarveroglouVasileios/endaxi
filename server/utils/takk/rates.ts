/**
 * ΤΑΚΚ — Τέλος Ανθεκτικότητας στην Κλιματική Κρίση
 * Συντελεστές ανά διανυκτέρευση.
 *
 * ΚΡΙΣΙΜΟ: Το ΤΑΚΚ είναι ΣΤΑΘΕΡΟ ΠΟΣΟ ανά διανυκτέρευση.
 * Δεν εξαρτάται από την τιμή της κράτησης, την προμήθεια, ή το payout.
 * Γι' αυτό το iCal (που δίνει μόνο ημερομηνίες) αρκεί απόλυτα.
 *
 * ⚠️ ΠΡΙΝ ΤΗΝ ΠΑΡΑΓΩΓΗ: επαλήθευσε τα ποσά και τους μήνες στο
 *    πρωτότυπο κείμενο της Α.1202/2024 και σε τυχόν μεταγενέστερες
 *    τροποποιήσεις. Οι συντελεστές έχουν ήδη αλλάξει μία φορά.
 *
 * Οι συντελεστές είναι version-ed κατά ημερομηνία έναρξης ισχύος,
 * ώστε η αναδρομική επανέκδοση παραστατικού να δίνει το ίδιο ποσό.
 */

import type { PropertyCategory } from '../../database/schema'

export type Season = 'high' | 'low'

export interface RateSet {
  /** Ημερομηνία έναρξης ισχύος (inclusive), ISO date */
  effectiveFrom: string
  /** Ημερομηνία λήξης ισχύος (inclusive), ISO date — null = ενεργό */
  effectiveTo: string | null
  /** Μήνες υψηλής περιόδου (1-12) */
  highSeasonMonths: number[]
  /** Ποσά σε λεπτά, ανά κατηγορία και εποχή */
  rates: Record<PropertyCategory, Record<Season, number>>
}

/**
 * Ιστορικό συντελεστών, νεότερο πρώτα.
 */
export const RATE_HISTORY: RateSet[] = [
  {
    // Α.1202/2024 — ισχύς από 1.1.2025
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    // Θερινή περίοδος: Απρίλιος – Οκτώβριος
    highSeasonMonths: [4, 5, 6, 7, 8, 9, 10],
    rates: {
      str_standard: { high: 800, low: 200 }, // €8,00 / €2,00
      str_villa: { high: 1500, low: 400 }, // €15,00 / €4,00
    },
  },
  {
    /**
     * Α.1217/2023 (ΦΕΚ Β' 7535/31.12.2023) — το ΠΡΩΤΟ έτος του ΤΑΚΚ.
     *
     * ⚠️ ΠΡΟΣΟΧΗ: δεν άλλαξαν μόνο τα ποσά το 2025 — άλλαξαν και τα
     * **όρια των εποχών**. Το 2024 η υψηλή περίοδος ξεκινούσε τον
     * ΜΑΡΤΙΟ· από το 2025 ξεκινά τον ΑΠΡΙΛΙΟ.
     *
     * Δηλαδή ο Μάρτιος μετακινήθηκε από υψηλή σε χαμηλή περίοδο.
     * Αν αγνοηθεί, μια διαμονή Μαρτίου 2024 υπολογίζεται λάθος.
     *
     * Χρειάζεται για αναδρομικά παραστατικά: η ΑΑΔΕ δέχεται δηλώσεις
     * «για φορολογικές περιόδους από 01/01/2024 και εφεξής».
     */
    effectiveFrom: '2024-01-01',
    effectiveTo: '2024-12-31',
    // Υψηλή περίοδος 2024: Μάρτιος – Οκτώβριος
    highSeasonMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    rates: {
      str_standard: { high: 150, low: 50 }, // €1,50 / €0,50
      str_villa: { high: 1000, low: 400 }, // €10,00 / €4,00
    },
  },
]

/**
 * Επιστρέφει το σετ συντελεστών που ισχύει για δεδομένη ημερομηνία.
 */
export function getRateSet(isoDate: string): RateSet {
  const set = RATE_HISTORY.find((r) => {
    if (isoDate < r.effectiveFrom) return false
    if (r.effectiveTo && isoDate > r.effectiveTo) return false
    return true
  })

  if (!set) {
    throw new Error(
      `Δεν υπάρχουν ορισμένοι συντελεστές ΤΑΚΚ για την ημερομηνία ${isoDate}`,
    )
  }
  return set
}

/**
 * Εποχή για συγκεκριμένη ΝΥΧΤΑ (όχι για ολόκληρη τη διαμονή).
 * Μια διαμονή 30/10 → 02/11 έχει νύχτες και στις δύο εποχές.
 */
export function getSeasonForNight(isoDate: string, rateSet: RateSet): Season {
  const month = Number(isoDate.slice(5, 7))
  return rateSet.highSeasonMonths.includes(month) ? 'high' : 'low'
}

/**
 * Συντελεστής σε λεπτά για μία συγκεκριμένη νύχτα.
 */
export function getRateForNight(
  isoDate: string,
  category: PropertyCategory,
): number {
  const rateSet = getRateSet(isoDate)
  const season = getSeasonForNight(isoDate, rateSet)
  return rateSet.rates[category][season]
}
