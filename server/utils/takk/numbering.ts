/**
 * ΑΡΙΘΜΗΣΗ ΠΑΡΑΣΤΑΤΙΚΩΝ — το πιο κρίσιμο κομμάτι του συστήματος.
 *
 * Ο νόμος απαιτεί το «Ειδικό Στοιχείο – Απόδειξη Είσπραξης ΤΑΚΚ»
 * να φέρει ΣΕΙΡΑ και ΑΥΞΟΝΤΑ ΑΡΙΘΜΟ, συνεχόμενα, χωρίς κενά,
 * χωρίς αλλοιώσεις.
 *
 * ΚΑΝΟΝΕΣ ΠΟΥ ΔΕΝ ΣΠΑΜΕ ΠΟΤΕ:
 *  1. Η αύξηση του counter γίνεται ΜΟΝΟ μέσα σε transaction
 *     με SELECT ... FOR UPDATE. Ποτέ counter στη μνήμη.
 *  2. Ο πίνακας takk_documents είναι APPEND-ONLY.
 *     Ποτέ UPDATE σε εκδοθέν παραστατικό.
 *  3. Ακύρωση = έκδοση ΑΝΤΙΛΟΓΙΣΤΙΚΟΥ εγγράφου, όχι διαγραφή.
 *  4. Όλα τα δεδομένα αντιγράφονται (snapshot) τη στιγμή της έκδοσης,
 *     ώστε το παραστατικό να μένει αναλλοίωτο.
 */

import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../../database/client'
import { takkSeries, takkDocuments, properties, stays, users } from '../../database/schema'
import { calculateTakk, addDays } from './calculator'
import { isValidAfm, normalizeAfm } from '../afm'

export class NumberingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NumberingError'
  }
}

export interface IssueTakkParams {
  stayId: string
  /** Εκδίδονται μόνο μηνιαία τμήματα που έχουν ολοκληρωθεί έως αυτή την ημέρα. */
  asOfDate?: string
}

export interface IssuedDocument {
  id: string
  series: string
  number: number
  year: number
  fullNumber: string
  totalAmountCents: number
  remittancePeriod: string
  nights: number
}

/** Postgres: unique_violation */
const PG_UNIQUE_VIOLATION = '23505'

/**
 * ΒΡΕΘΗΚΕ ΜΕ ΠΡΑΓΜΑΤΙΚΟ 20-way concurrency test πάνω στην ζωντανή Neon DB
 * (bug #21): το drizzle-orm (όπως χρησιμοποιείται εδώ, μαζί με το
 * postgres-js driver) ΔΕΝ εκθέτει το πραγματικό σφάλμα της Postgres σαν
 * top-level `.code` — το τυλίγει σε ένα `DrizzleQueryError` και βάζει το
 * αρχικό driver error στο `.cause`. Επιβεβαιώθηκε με διαγνωστικό script
 * που προκάλεσε επίτηδες unique violation:
 *   e.code (top-level) → undefined
 *   e.cause?.code      → '23505'
 *   Object.keys(e)     → ['query', 'params', 'cause']
 *
 * Αποτέλεσμα πριν το fix: σε πραγματική κούρσα (π.χ. 20 ταυτόχρονες
 * κλήσεις issueTakkDocuments για το ίδιο stay), το `isUniqueViolation()`
 * ΠΟΤΕ δεν ταίριαζε, άρα το graceful recovery path (γύρνα το ήδη
 * εκδοθέν παραστατικό αντί να σκάσεις) ΔΕΝ ενεργοποιούνταν ποτέ — οι
 * «χαμένοι» της κούρσας έπαιρναν ανεπιτήρητο throw. Η ΑΚΕΡΑΙΟΤΗΤΑ των
 * δεδομένων παρέμενε σωστή χάρη στο partial unique index στη βάση
 * (ποτέ δεν δημιουργήθηκε διπλότυπο), αλλά η εμπειρία ήταν λάθος:
 * αποτυχημένα Inngest step runs (θόρυβος σε monitoring/retries) αντί
 * για ήσυχη ανάκτηση.
 *
 * Fix: ελέγχουμε ΚΑΙ το top-level `.code` (σε περίπτωση που κάποια
 * μελλοντική έκδοση ή διαφορετικός driver το εκθέτει άμεσα) ΚΑΙ το
 * `.cause?.code` (η σημερινή πραγματική τοποθεσία κάτω από drizzle-orm).
 */
function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === PG_UNIQUE_VIOLATION || err?.cause?.code === PG_UNIQUE_VIOLATION
}

/**
 * Εκδίδει ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ μιας διαμονής.
 *
 * ⚠️ Επιστρέφει ΠΙΝΑΚΑ, όχι ένα έγγραφο.
 *
 * Διαμονή εντός ενός μήνα → ένα παραστατικό.
 * Διαμονή που διασχίζει μήνες → **ένα ανά μήνα** (ΑΑΔΕ FAQ ΤΑΚΚ, ερ. 7):
 *   «το ειδικό στοιχείο εκδίδεται για κάθε μήνα ξεχωριστά και όχι κατά
 *    την αναχώρηση του διαμένοντος».
 *
 * Ιδιοδύναμο ανά (διαμονή, μήνα).
 */
export async function issueTakkDocuments(
  db: Database,
  params: IssueTakkParams,
): Promise<IssuedDocument[]> {
  try {
    return await issueTakkDocumentsInner(db, params)
  } catch (e) {
    /**
     * Χάσαμε την κούρσα: άλλο transaction πρόλαβε και το partial unique
     * index μας απέρριψε. ΔΕΝ είναι σφάλμα — είναι το σύστημα να
     * δουλεύει. Επιστρέφουμε ό,τι κέρδισε.
     */
    if (isUniqueViolation(e)) {
      const existing = await findReceiptsForStay(db, params.stayId)
      if (existing.length > 0) return existing
    }
    throw e
  }
}

/** Τα ενεργά παραστατικά μιας διαμονής, ταξινομημένα κατά μήνα. */
export async function findReceiptsForStay(
  db: Database,
  stayId: string,
): Promise<IssuedDocument[]> {
  const rows = await db
    .select()
    .from(takkDocuments)
    .where(
      and(
        eq(takkDocuments.stayId, stayId),
        eq(takkDocuments.documentType, 'takk_receipt'),
      ),
    )
    .orderBy(takkDocuments.remittancePeriod)

  return rows.map(toIssuedDocument)
}

function toIssuedDocument(d: typeof takkDocuments.$inferSelect): IssuedDocument {
  return {
    id: d.id,
    series: d.series,
    number: d.number,
    year: d.year,
    fullNumber: formatFullNumber(d.series, d.number, d.year),
    totalAmountCents: d.totalAmountCents,
    remittancePeriod: d.remittancePeriod,
    nights: d.nights,
  }
}

async function issueTakkDocumentsInner(
  db: Database,
  params: IssueTakkParams,
): Promise<IssuedDocument[]> {
  const { stayId } = params

  return await db.transaction(async (tx) => {
    /**
     * ΒΡΕΘΗΚΕ ΣΕ ΔΙΚΟ ΜΟΥ SECURITY AUDIT (race condition / TOCTOU): κλειδώνουμε
     * ΠΡΩΤΑ τη γραμμή του stay και μετά του property, ΠΡΙΝ διαβάσουμε
     * οτιδήποτε εξαρτάται από την "τρέχουσα" κατάστασή τους (isComplimentary,
     * ama, documentSeries). Δύο άλλα endpoints κλειδώνουν τις ΙΔΙΕΣ γραμμές
     * πριν αποφασίσουν τι επιτρέπεται:
     *  - server/api/stays/[id]/complimentary.patch.ts (κλειδώνει stay)
     *  - server/api/properties/[id].patch.ts (κλειδώνει property)
     * Χωρίς αυτό, μια ταυτόχρονη σήμανση "δωρεάν" ή αλλαγή ΑΜΑ/σειράς
     * ανάμεσα στο check και το commit της έκδοσης θα άφηνε ασυνεπή
     * κατάσταση. Σειρά κλειδώματος ΠΑΝΤΑ stay→property, ίδια παντού, ώστε
     * να μην υπάρχει πιθανότητα deadlock μεταξύ των δύο transactions.
     */
    const [stayLock] = await tx
      .select({ id: stays.id, propertyId: stays.propertyId })
      .from(stays)
      .where(eq(stays.id, stayId))
      .for('update')

    if (!stayLock) throw new NumberingError(`Δεν βρέθηκε διαμονή ${stayId}`)

    await tx
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, stayLock.propertyId))
      .for('update')

    // ── 1. Φόρτωση διαμονής + ακινήτου + ιδιοκτήτη ── (ΜΕΤΑ το κλείδωμα)
    const [row] = await tx
      .select({
        stay: stays,
        property: properties,
        user: users,
      })
      .from(stays)
      .innerJoin(properties, eq(stays.propertyId, properties.id))
      .innerJoin(users, eq(properties.userId, users.id))
      .where(eq(stays.id, stayId))
      .limit(1)

    if (!row) throw new NumberingError(`Δεν βρέθηκε διαμονή ${stayId}`)

    const { stay, property, user } = row

    // ── 2. Έλεγχοι εγκυρότητας ──
    if (stay.status !== 'confirmed') {
      throw new NumberingError(
        `Η διαμονή ${stayId} έχει κατάσταση "${stay.status}" — δεν εκδίδεται ΤΑΚΚ`,
      )
    }

    /**
     * Δωρεάν διαμονή → κανένα παραστατικό.
     *
     * ΑΑΔΕ FAQ ΤΑΚΚ: «Οι δωρεάν διαμονές δεν επιβαρύνονται με το τέλος».
     * Επιστρέφουμε κενό πίνακα, όχι σφάλμα — δεν είναι λάθος κατάσταση.
     */
    if (stay.isComplimentary) {
      return []
    }

    // ΚΡΙΣΙΜΟ GATE: 3+ ακίνητα = επιτηδευματίας = υποχρέωση myDATA
    if (user.taxRegime !== 'individual_upto_2') {
      throw new NumberingError(
        'Ο χρήστης είναι επιτηδευματίας (3+ ακίνητα). Απαιτείται διαβίβαση ' +
          'μέσω πιστοποιημένου παρόχου ηλεκτρονικής τιμολόγησης.',
      )
    }

    /**
     * Στοιχεία εκδότη — ΥΠΟΧΡΕΩΤΙΚΑ.
     *
     * Χωρίς ΑΦΜ και ονοματεπώνυμο το παραστατικό είναι νομικά
     * ελαττωματικό. Καλύτερα να μην εκδοθεί καθόλου παρά να εκδοθεί
     * άκυρο — ένα κενό στην αρίθμηση διορθώνεται, ένα ελαττωματικό
     * παραστατικό που στάλθηκε σε επισκέπτη όχι.
     */
    const issuerName = user.name ?? user.fullName
    if (!issuerName?.trim()) {
      throw new NumberingError(
        'ΕΛΛΙΠΗ_ΣΤΟΙΧΕΙΑ: Λείπει το ονοματεπώνυμο του εκδότη. ' +
          'Συμπλήρωσέ το στις ρυθμίσεις του λογαριασμού.',
      )
    }
    if (!user.afm || !isValidAfm(user.afm)) {
      throw new NumberingError(
        'ΕΛΛΙΠΗ_ΣΤΟΙΧΕΙΑ: Λείπει ή είναι άκυρο το ΑΦΜ του εκδότη. ' +
          'Συμπλήρωσέ το στις ρυθμίσεις του λογαριασμού.',
      )
    }
    if (
      !user.legalAddressLine?.trim()
      || !user.legalAddressCity?.trim()
      || !user.legalAddressPostalCode?.trim()
    ) {
      throw new NumberingError(
        'ΕΛΛΙΠΗ_ΣΤΟΙΧΕΙΑ: Λείπει η νόμιμη διεύθυνση του εκδότη. '
        + 'Συμπλήρωσέ τη στις ρυθμίσεις του λογαριασμού.',
      )
    }
    if (!property.addressLine?.trim() || !property.city?.trim() || !property.postalCode?.trim()) {
      throw new NumberingError('ΕΛΛΙΠΗ_ΣΤΟΙΧΕΙΑ: Λείπει η διεύθυνση του καταλύματος.')
    }

    /**
     * ── 3. Ιδιοδυναμία — γρήγορος έλεγχος ──
     *
     * Πιάνει τη συνηθισμένη περίπτωση (επανάληψη μετά από ώρα) χωρίς
     * να σπαταλήσει αριθμό. ΔΕΝ είναι όμως εγγύηση: υπό ταυτόχρονα
     * transactions όλα θα δουν «δεν υπάρχει». Την πραγματική εγγύηση
     * τη δίνει το partial unique index takk_documents_one_receipt_per_stay_idx,
     * και ο χειρισμός του γίνεται στο issueTakkDocument().
     */
    const existing = await tx
      .select({ remittancePeriod: takkDocuments.remittancePeriod })
      .from(takkDocuments)
      .where(
        and(
          eq(takkDocuments.stayId, stayId),
          eq(takkDocuments.documentType, 'takk_receipt'),
        ),
      )
    const existingPeriods = new Set(existing.map(document => document.remittancePeriod))

    // ── 4. Υπολογισμός ΤΑΚΚ ──
    const calc = calculateTakk({
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      category: property.category,
    })

    if (calc.nights === 0) {
      throw new NumberingError('Διαμονή 0 διανυκτερεύσεων — δεν εκδίδεται ΤΑΚΚ')
    }

    const series = property.documentSeries
    const issued: IssuedDocument[] = []
    const asOfDate = params.asOfDate ?? stay.checkOut
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      throw new NumberingError('Η ημερομηνία έκδοσης πρέπει να είναι YYYY-MM-DD')
    }

    /**
     * ── 5. ΕΝΑ ΠΑΡΑΣΤΑΤΙΚΟ ΑΝΑ ΜΗΝΑ ──
     *
     * Το έτος του παραστατικού ακολουθεί τον ΜΗΝΑ ΤΟΥ ΤΜΗΜΑΤΟΣ, όχι
     * την αναχώρηση: διαμονή 30/12/2026 → 02/01/2027 παράγει ένα
     * παραστατικό στη σειρά του 2026 και ένα στη σειρά του 2027.
     */
    for (const segment of calc.segments) {
      const segmentCompletedAt = addDays(segment.lastNight, 1)
      if (
        segmentCompletedAt > asOfDate
        || existingPeriods.has(segment.remittancePeriod)
      ) {
        continue
      }

      const year = Number(segment.month.slice(0, 4))

      // Upsert του counter — ασφαλές σε concurrency
      await tx
        .insert(takkSeries)
        .values({ propertyId: property.id, series, year, lastNumber: 0 })
        .onConflictDoNothing({
          target: [takkSeries.propertyId, takkSeries.series, takkSeries.year],
        })

      // SELECT ... FOR UPDATE — σειριοποιεί τα ταυτόχρονα αιτήματα
      const [locked] = await tx
        .select()
        .from(takkSeries)
        .where(
          and(
            eq(takkSeries.propertyId, property.id),
            eq(takkSeries.series, series),
            eq(takkSeries.year, year),
          ),
        )
        .for('update')
        .limit(1)

      if (!locked) throw new NumberingError('Αδυναμία κλειδώματος σειράς')

      const nextNumber = locked.lastNumber + 1

      await tx
        .update(takkSeries)
        .set({ lastNumber: nextNumber, updatedAt: new Date() })
        .where(eq(takkSeries.id, locked.id))

      // ── 6. Εγγραφή παραστατικού (append-only) ──
      const [doc] = await tx
        .insert(takkDocuments)
        .values({
          propertyId: property.id,
          stayId: stay.id,
          documentType: 'takk_receipt',
          series,
          number: nextNumber,
          year,
          // Snapshot — αναλλοίωτο ακόμα κι αν αλλάξουν τα originals
          propertyAma: property.ama,
          propertyName: property.name,
          issuerName,
          issuerAfm: normalizeAfm(user.afm),
          issuerAddressLine: user.legalAddressLine,
          issuerAddressCity: user.legalAddressCity,
          issuerAddressPostalCode: user.legalAddressPostalCode,
          propertyAddressLine: property.addressLine,
          propertyCity: property.city,
          propertyPostalCode: property.postalCode,
          propertyCategory: property.category,
          // Οι ημερομηνίες του ΤΜΗΜΑΤΟΣ, όχι όλης της διαμονής
          checkIn: segment.firstNight,
          checkOut: addDays(segment.lastNight, 1),
          nights: segment.nights,
          guestName: stay.guestName,
          ratePerNightCents: segment.uniformRateCents ?? 0,
          rateBreakdown: segment.breakdown,
          totalAmountCents: segment.totalAmountCents,
          remittancePeriod: segment.remittancePeriod,
        })
        .returning()

      if (!doc) throw new NumberingError('Αποτυχία εγγραφής παραστατικού')
      issued.push(toIssuedDocument(doc))
    }

    return issued
  })
}

/**
 * Ακυρώνει παραστατικό με ΑΝΤΙΛΟΓΙΣΤΙΚΟ έγγραφο.
 * Το αρχικό παραστατικό παραμένει αναλλοίωτο στη βάση.
 */
export async function cancelTakkDocument(
  db: Database,
  documentId: string,
  reason: string,
): Promise<IssuedDocument> {
  return await db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(takkDocuments)
      .where(eq(takkDocuments.id, documentId))
      .limit(1)

    if (!original) throw new NumberingError(`Δεν βρέθηκε παραστατικό ${documentId}`)

    if (original.documentType === 'takk_cancellation') {
      throw new NumberingError('Δεν ακυρώνεται αντιλογιστικό παραστατικό')
    }

    // Το αντιλογιστικό παίρνει τον ΕΠΟΜΕΝΟ αριθμό της ίδιας σειράς
    const [locked] = await tx
      .select()
      .from(takkSeries)
      .where(
        and(
          eq(takkSeries.propertyId, original.propertyId),
          eq(takkSeries.series, original.series),
          eq(takkSeries.year, original.year),
        ),
      )
      .for('update')
      .limit(1)

    if (!locked) throw new NumberingError('Αδυναμία κλειδώματος σειράς')

    // Επανέλεγχος ΜΕΤΑ το lock: δεύτερο concurrent transaction βλέπει
    // πλέον το commit του πρώτου. Το unique index είναι η τελική εγγύηση.
    const existing = await tx
      .select({ id: takkDocuments.id })
      .from(takkDocuments)
      .where(eq(takkDocuments.cancelsDocumentId, documentId))
      .limit(1)

    if (existing.length > 0) {
      throw new NumberingError('Το παραστατικό έχει ήδη ακυρωθεί')
    }

    const nextNumber = locked.lastNumber + 1

    await tx
      .update(takkSeries)
      .set({ lastNumber: nextNumber, updatedAt: new Date() })
      .where(eq(takkSeries.id, locked.id))

    const [doc] = await tx
      .insert(takkDocuments)
      .values({
        propertyId: original.propertyId,
        stayId: original.stayId,
        documentType: 'takk_cancellation',
        series: original.series,
        number: nextNumber,
        year: original.year,
        propertyAma: original.propertyAma,
        propertyName: original.propertyName,
        issuerName: original.issuerName,
        issuerAfm: original.issuerAfm,
        issuerAddressLine: original.issuerAddressLine,
        issuerAddressCity: original.issuerAddressCity,
        issuerAddressPostalCode: original.issuerAddressPostalCode,
        propertyAddressLine: original.propertyAddressLine,
        propertyCity: original.propertyCity,
        propertyPostalCode: original.propertyPostalCode,
        propertyCategory: original.propertyCategory,
        checkIn: original.checkIn,
        checkOut: original.checkOut,
        nights: original.nights,
        guestName: original.guestName,
        ratePerNightCents: original.ratePerNightCents,
        rateBreakdown: original.rateBreakdown,
        // Αρνητικό ποσό — αντιλογισμός
        totalAmountCents: -original.totalAmountCents,
        remittancePeriod: original.remittancePeriod,
        cancelsDocumentId: original.id,
        cancellationReason: reason,
      })
      .returning()

    if (!doc) throw new NumberingError('Αποτυχία έκδοσης αντιλογιστικού')

    return {
      id: doc.id,
      series: doc.series,
      number: doc.number,
      year: doc.year,
      fullNumber: formatFullNumber(doc.series, doc.number, doc.year),
      totalAmountCents: doc.totalAmountCents,
      remittancePeriod: doc.remittancePeriod,
      nights: doc.nights,
    }
  })
}

/** Μορφή εμφάνισης: «Α-2026-0000123» */
export function formatFullNumber(series: string, number: number, year: number): string {
  return `${series}-${year}-${String(number).padStart(7, '0')}`
}

/**
 * Έλεγχος ακεραιότητας: υπάρχουν κενά στην αρίθμηση;
 * Τρέχει ως περιοδικό job — αν βρει κενό, είναι ΚΡΙΣΙΜΟ σφάλμα.
 */
export async function verifySeriesIntegrity(
  db: Database,
  propertyId: string,
  series: string,
  year: number,
): Promise<{ ok: boolean; expected: number; found: number; gaps: number[] }> {
  const docs = await db
    .select({ number: takkDocuments.number })
    .from(takkDocuments)
    .where(
      and(
        eq(takkDocuments.propertyId, propertyId),
        eq(takkDocuments.series, series),
        eq(takkDocuments.year, year),
      ),
    )
    .orderBy(takkDocuments.number)

  const numbers = docs.map((d) => d.number)
  // Set αντί για numbers.includes() μέσα στο loop — αλλιώς είναι O(n²)
  // και σε ακίνητο με χιλιάδες παραστατικά καθυστερεί αδικαιολόγητα ενώ
  // κρατά ανοιχτή σύνδεση από το pool (βλ. statement_timeout στο
  // server/database/client.ts για το δεύτερο επίπεδο προστασίας).
  const numberSet = new Set(numbers)
  const gaps: number[] = []

  for (let i = 1; i <= (numbers.at(-1) ?? 0); i++) {
    if (!numberSet.has(i)) gaps.push(i)
  }

  return {
    ok: gaps.length === 0,
    expected: numbers.at(-1) ?? 0,
    found: numbers.length,
    gaps,
  }
}
