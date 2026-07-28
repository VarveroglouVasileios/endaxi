/**
 * ΤΟ GATE — η πιο σημαντική επιχειρησιακή απόφαση του προϊόντος.
 *
 * Φυσικό πρόσωπο με ≤2 ακίνητα βραχυχρόνιας μίσθωσης:
 *   · δεν είναι επιτηδευματίας, δεν τηρεί βιβλία ΕΛΠ
 *   · παράγουμε εμείς το Ειδικό Στοιχείο, χωρίς πιστοποίηση ΑΑΔΕ
 *
 * 3+ ακίνητα ή νομικό πρόσωπο:
 *   · επιτηδευματίας → βιβλία, ΦΠΑ 13%, τέλος παρεπιδημούντων,
 *     υποχρέωση διαβίβασης myDATA
 *   · ΔΕΝ τους εξυπηρετούμε μέχρι να υπάρξει integration με
 *     πιστοποιημένο πάροχο ηλεκτρονικής τιμολόγησης
 *
 * ⚠️ Το όριο πρέπει να επιβεβαιωθεί από φοροτεχνικό.
 */

export const INDIVIDUAL_PROPERTY_LIMIT = 2

export type TaxRegime = 'individual_upto_2' | 'business_3_plus'

export interface GateResult {
  allowed: boolean
  regime: TaxRegime
  reason?: string
  /** Τι πρέπει να δει ο χρήστης */
  notice?: string
}

/** Καθορίζει καθεστώς από τον αριθμό ακινήτων. */
export function determineRegime(propertyCount: number): TaxRegime {
  return propertyCount > INDIVIDUAL_PROPERTY_LIMIT
    ? 'business_3_plus'
    : 'individual_upto_2'
}

/**
 * Ελέγχει αν ο χρήστης μπορεί να χρησιμοποιήσει το ΤΑΚΚ Engine.
 */
export function checkGate(params: {
  propertyCount: number
  isLegalEntity?: boolean
}): GateResult {
  const { propertyCount, isLegalEntity = false } = params

  if (propertyCount < 1) {
    return {
      allowed: false,
      regime: 'individual_upto_2',
      reason: 'no_properties',
      notice: 'Πρόσθεσε τουλάχιστον ένα ακίνητο για να ξεκινήσεις.',
    }
  }

  if (isLegalEntity) {
    return {
      allowed: false,
      regime: 'business_3_plus',
      reason: 'legal_entity',
      notice:
        'Τα νομικά πρόσωπα τηρούν βιβλία και έχουν υποχρέωση διαβίβασης στο myDATA. ' +
        'Ετοιμάζουμε σύνδεση με πιστοποιημένο πάροχο ηλεκτρονικής τιμολόγησης — ' +
        'μπες στη λίστα αναμονής και θα σε ειδοποιήσουμε.',
    }
  }

  if (propertyCount > INDIVIDUAL_PROPERTY_LIMIT) {
    return {
      allowed: false,
      regime: 'business_3_plus',
      reason: 'property_count_exceeded',
      notice:
        `Με ${propertyCount} ακίνητα θεωρείσαι επιτηδευματίας: τήρηση βιβλίων, ` +
        'ΦΠΑ 13%, τέλος παρεπιδημούντων και υποχρέωση διαβίβασης στο myDATA. ' +
        'Ετοιμάζουμε σύνδεση με πιστοποιημένο πάροχο — μπες στη λίστα αναμονής.',
    }
  }

  return { allowed: true, regime: 'individual_upto_2' }
}

/**
 * Έλεγχος όταν ο χρήστης προσπαθεί να προσθέσει ακίνητο.
 * Το πέρασμα 2 → 3 αλλάζει φορολογικό καθεστώς και ΠΡΕΠΕΙ
 * να μπλοκάρει με προειδοποίηση, όχι να συνεχίσει σιωπηλά.
 */
export function checkAddProperty(currentCount: number): GateResult {
  const next = currentCount + 1

  if (next > INDIVIDUAL_PROPERTY_LIMIT) {
    return {
      allowed: false,
      regime: 'business_3_plus',
      reason: 'would_exceed_limit',
      notice:
        'Προσοχή: με το τρίτο ακίνητο αλλάζει το φορολογικό σου καθεστώς. ' +
        'Γίνεσαι επιτηδευματίας — χρειάζεσαι έναρξη, βιβλία, ΦΠΑ 13% και ' +
        'διαβίβαση myDATA. Μίλα πρώτα με τον λογιστή σου.',
    }
  }

  return { allowed: true, regime: 'individual_upto_2' }
}
