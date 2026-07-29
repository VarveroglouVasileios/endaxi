/**
 * INTEGRATION TESTS — ΑΡΙΘΜΗΣΗ ΠΑΡΑΣΤΑΤΙΚΩΝ
 *
 * Αυτό είναι το μοναδικό σημείο του συστήματος όπου ένα bug
 * μεταφράζεται απευθείας σε πρόστιμο για τον πελάτη.
 *
 * Ο νόμος απαιτεί σειρά και αύξοντα αριθμό, συνεχόμενα, ΧΩΡΙΣ ΚΕΝΑ.
 * Τα unit tests δεν μπορούν να το αποδείξουν — χρειάζεται πραγματική
 * Postgres με αληθινό transaction isolation.
 *
 * Απαιτεί τρέχουσα βάση:
 *   docker compose up -d
 * ή TEST_DATABASE_URL προς οποιαδήποτε Postgres.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import {
  createTestDb,
  createSchema,
  truncateAll,
  seedUser,
  seedProperty,
  seedStay,
  VALID_TEST_AFM,
  type TestDb,
} from './helpers/db'
import {
  issueTakkDocuments,
  findReceiptsForStay,
  cancelTakkDocument,
  verifySeriesIntegrity,
  formatFullNumber,
  NumberingError,
} from '../server/utils/takk/numbering'
import { takkDocuments, takkSeries, properties } from '../server/database/schema'

let db: TestDb
let close: () => Promise<void>

beforeAll(async () => {
  const t = createTestDb()
  db = t.db
  close = t.close
  await createSchema(db)
}, 60_000)

afterAll(async () => {
  await close?.()
})

beforeEach(async () => {
  await truncateAll(db)
})

// ════════════════════════════════════════════════════════════
// ΤΟ ΚΡΙΣΙΜΟ TEST
// ════════════════════════════════════════════════════════════

describe('Concurrency — το test που έχει σημασία', () => {
  it('50 ταυτόχρονες εκδόσεις: μηδέν διπλά, μηδέν κενά', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)

    // 50 ΔΙΑΦΟΡΕΤΙΚΕΣ διαμονές — κάθε μία δικαιούται δικό της παραστατικό
    const staysCreated = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        seedStay(db, property.id, {
          checkIn: '2026-07-01',
          checkOut: '2026-07-04',
          nights: 3,
          externalUid: `stay-${i}`,
        }),
      ),
    )

    // Όλες ταυτόχρονα — εδώ σπάει μια αφελής υλοποίηση
    const results = await Promise.all(
      staysCreated.map((s) => issueTakkDocuments(db, { stayId: s.id })),
    )

    // Κάθε διαμονή είναι εντός ενός μήνα → ένα παραστατικό η καθεμία
    const numbers = results.flat().map((r) => r.number).sort((a, b) => a - b)

    // ── Μηδέν διπλά ──
    expect(new Set(numbers).size).toBe(50)

    // ── Μηδέν κενά: ακριβώς 1..50 ──
    expect(numbers).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))

    // ── Ο counter συμφωνεί ──
    const [series] = await db
      .select()
      .from(takkSeries)
      .where(eq(takkSeries.propertyId, property.id))
    expect(series!.lastNumber).toBe(50)

    // ── Ο ελεγκτής ακεραιότητας δεν βρίσκει τίποτα ──
    const integrity = await verifySeriesIntegrity(db, property.id, 'Α', 2026)
    expect(integrity.ok).toBe(true)
    expect(integrity.gaps).toEqual([])
    expect(integrity.found).toBe(50)
  }, 120_000)

  it('ταυτόχρονες εκδόσεις για ΤΗΝ ΙΔΙΑ διαμονή → ένα μόνο παραστατικό', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    // 20 παράλληλες προσπάθειες στην ίδια διαμονή
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => issueTakkDocuments(db, { stayId: stay.id })),
    )

    const ok = results.filter((r) => r.status === 'fulfilled')
    expect(ok.length).toBeGreaterThan(0)

    // Στη βάση πρέπει να υπάρχει ΑΚΡΙΒΩΣ ένα
    const docs = await db
      .select()
      .from(takkDocuments)
      .where(
        and(
          eq(takkDocuments.stayId, stay.id),
          eq(takkDocuments.documentType, 'takk_receipt'),
        ),
      )
    expect(docs).toHaveLength(1)
  }, 60_000)

  it('δύο ακίνητα δεν μοιράζονται counter — ξεχωριστές σειρές', async () => {
    const user = await seedUser(db, { declaredPropertyCount: 2 })
    const p1 = await seedProperty(db, user.id, { ama: 'AMA-1' })
    const p2 = await seedProperty(db, user.id, { ama: 'AMA-2' })

    const s1 = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        seedStay(db, p1.id, { externalUid: `p1-${i}` }),
      ),
    )
    const s2 = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        seedStay(db, p2.id, { externalUid: `p2-${i}` }),
      ),
    )

    await Promise.all(
      [...s1, ...s2].map((s) => issueTakkDocuments(db, { stayId: s.id })),
    )

    const i1 = await verifySeriesIntegrity(db, p1.id, 'Α', 2026)
    const i2 = await verifySeriesIntegrity(db, p2.id, 'Α', 2026)

    expect(i1.ok).toBe(true)
    expect(i2.ok).toBe(true)
    // Κάθε ακίνητο ξεκινά από το 1
    expect(i1.found).toBe(10)
    expect(i2.found).toBe(10)
    expect(i1.expected).toBe(10)
    expect(i2.expected).toBe(10)
  }, 120_000)
})

// ════════════════════════════════════════════════════════════

describe('Ιδιοδυναμία', () => {
  it('δεύτερη κλήση επιστρέφει το ίδιο παραστατικό', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    const first = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!
    const second = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!

    expect(second.id).toBe(first.id)
    expect(second.number).toBe(first.number)

    const [series] = await db
      .select()
      .from(takkSeries)
      .where(eq(takkSeries.propertyId, property.id))
    // Ο counter ΔΕΝ προχώρησε
    expect(series!.lastNumber).toBe(1)
  })
})

describe('Υπολογισμός & snapshot', () => {
  it('ΝΟΜΙΚΗ ΑΠΑΙΤΗΣΗ: διαμονή που διασχίζει μήνες → ΔΥΟ παραστατικά', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, {
      checkIn: '2026-10-30',
      checkOut: '2026-11-02',
      nights: 3,
    })

    const docs = await issueTakkDocuments(db, { stayId: stay.id })

    // ΑΑΔΕ FAQ ΤΑΚΚ ερ.7: «εκδίδεται για κάθε μήνα ξεχωριστά»
    expect(docs).toHaveLength(2)

    // Οκτώβριος: 2 θερινές νύχτες = 16€, δηλώνεται τον Νοέμβριο
    expect(docs[0]).toMatchObject({
      totalAmountCents: 1600,
      remittancePeriod: '2026-10',
      nights: 2,
      year: 2026,
    })

    // Νοέμβριος: 1 χειμερινή νύχτα = 2€, δηλώνεται τον Δεκέμβριο
    expect(docs[1]).toMatchObject({
      totalAmountCents: 200,
      remittancePeriod: '2026-11',
      nights: 1,
      year: 2026,
    })

    // Διαδοχική αρίθμηση
    expect(docs[1]!.number).toBe(docs[0]!.number + 1)

    // Το σύνολο παραμένει σωστό
    const total = docs.reduce((s, d) => s + d.totalAmountCents, 0)
    expect(total).toBe(1800)
  })

  it('εκδίδει κάθε μηνιαίο τμήμα μόλις ολοκληρωθεί, χωρίς να περιμένει το τελικό checkout', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, {
      checkIn: '2026-10-30',
      checkOut: '2026-11-02',
      nights: 3,
    })

    const october = await issueTakkDocuments(db, {
      stayId: stay.id,
      asOfDate: '2026-11-01',
    })
    expect(october).toHaveLength(1)
    expect(october[0]!.remittancePeriod).toBe('2026-10')

    const november = await issueTakkDocuments(db, {
      stayId: stay.id,
      asOfDate: '2026-11-02',
    })
    expect(november).toHaveLength(1)
    expect(november[0]!.remittancePeriod).toBe('2026-11')

    const all = await findReceiptsForStay(db, stay.id)
    expect(all.map(document => document.remittancePeriod)).toEqual([
      '2026-10',
      '2026-11',
    ])
  })

  it('τα τμήματα κρατούν τις ΔΙΚΕΣ ΤΟΥΣ ημερομηνίες, όχι της διαμονής', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, {
      checkIn: '2026-10-30',
      checkOut: '2026-11-02',
      nights: 3,
    })

    const docs = await issueTakkDocuments(db, { stayId: stay.id })

    const [oct] = await db
      .select()
      .from(takkDocuments)
      .where(eq(takkDocuments.id, docs[0]!.id))
    const [nov] = await db
      .select()
      .from(takkDocuments)
      .where(eq(takkDocuments.id, docs[1]!.id))

    // Τμήμα Οκτωβρίου: 30/10 → 01/11 (2 νύχτες)
    expect(oct!.checkIn).toBe('2026-10-30')
    expect(oct!.checkOut).toBe('2026-11-01')
    // Τμήμα Νοεμβρίου: 01/11 → 02/11 (1 νύχτα)
    expect(nov!.checkIn).toBe('2026-11-01')
    expect(nov!.checkOut).toBe('2026-11-02')
  })

  it('διαμονή που διασχίζει έτος → παραστατικά σε ΔΙΑΦΟΡΕΤΙΚΕΣ σειρές έτους', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, {
      checkIn: '2026-12-30',
      checkOut: '2027-01-02',
      nights: 3,
    })

    const docs = await issueTakkDocuments(db, { stayId: stay.id })

    expect(docs).toHaveLength(2)
    expect(docs[0]!.year).toBe(2026)
    expect(docs[1]!.year).toBe(2027)
    // Κάθε έτος ξεκινά τη δική του αρίθμηση από το 1
    expect(docs[0]!.number).toBe(1)
    expect(docs[1]!.number).toBe(1)
  })

  it('βίλα χρεώνεται με 15€/διαν. σε θερινή περίοδο', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id, { category: 'str_villa' })
    const stay = await seedStay(db, property.id, {
      checkIn: '2026-08-01',
      checkOut: '2026-08-08',
      nights: 7,
    })

    const doc = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!
    expect(doc.totalAmountCents).toBe(10_500)
  })

  it('κρατά snapshot — αλλαγή ακινήτου δεν αλλοιώνει εκδοθέν παραστατικό', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id, {
      ama: 'AMA-ORIGINAL',
      name: 'Αρχικό όνομα',
      addressLine: 'Αρχική 1',
      category: 'str_standard',
    })
    const stay = await seedStay(db, property.id)

    const doc = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!

    // Αλλαγή νομικών/υπολογιστικών στοιχείων ΜΕΤΑ την έκδοση
    await db
      .update(properties)
      .set({
        name: 'Νέο όνομα',
        ama: 'AMA-CHANGED',
        addressLine: 'Νέα 99',
        category: 'str_villa',
      })
      .where(eq(properties.id, property.id))

    const [stored] = await db
      .select()
      .from(takkDocuments)
      .where(eq(takkDocuments.id, doc.id))

    expect(stored!.propertyName).toBe('Αρχικό όνομα')
    expect(stored!.propertyAma).toBe('AMA-ORIGINAL')
    expect(stored!.propertyAddressLine).toBe('Αρχική 1')
    expect(stored!.propertyCategory).toBe('str_standard')
    expect(stored!.rateBreakdown).toHaveLength(stored!.nights)
  })
})

describe('Ακύρωση — αντιλογιστικό, ποτέ διαγραφή', () => {
  it('εκδίδει αντιλογιστικό με αρνητικό ποσό και επόμενο αριθμό', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    const original = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!
    const cancellation = await cancelTakkDocument(db, original.id, 'Ακύρωση κράτησης')

    expect(cancellation.number).toBe(original.number + 1)
    expect(cancellation.totalAmountCents).toBe(-original.totalAmountCents)

    // Το αρχικό παραμένει ΑΝΕΠΑΦΟ
    const [stillThere] = await db
      .select()
      .from(takkDocuments)
      .where(eq(takkDocuments.id, original.id))
    expect(stillThere).toBeDefined()
    expect(stillThere!.totalAmountCents).toBe(original.totalAmountCents)

    // Καμία τρύπα στην αρίθμηση
    const integrity = await verifySeriesIntegrity(db, property.id, 'Α', 2026)
    expect(integrity.ok).toBe(true)
  })

  it('δεν ακυρώνει δύο φορές', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    const original = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!
    await cancelTakkDocument(db, original.id, 'πρώτη')

    await expect(cancelTakkDocument(db, original.id, 'δεύτερη')).rejects.toThrow(
      /ήδη ακυρωθεί/,
    )
  })

  it('η βάση επιτρέπει μόνο ένα αντιλογιστικό υπό ταυτόχρονα αιτήματα', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)
    const original = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!

    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        cancelTakkDocument(db, original.id, 'Ταυτόχρονη ακύρωση'),
      ),
    )
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1)

    const cancellations = await db
      .select()
      .from(takkDocuments)
      .where(eq(takkDocuments.cancelsDocumentId, original.id))
    expect(cancellations).toHaveLength(1)
  })

  it('δεν ακυρώνει αντιλογιστικό', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    const original = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!
    const cancellation = await cancelTakkDocument(db, original.id, 'λόγος')

    await expect(cancelTakkDocument(db, cancellation.id, 'ξανά')).rejects.toThrow(
      /αντιλογιστικό/,
    )
  })
})

describe('Στοιχεία εκδότη — χωρίς αυτά το παραστατικό είναι ελαττωματικό', () => {
  it('ΑΡΝΕΙΤΑΙ έκδοση χωρίς ΑΦΜ', async () => {
    const user = await seedUser(db, { afm: null })
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow(
      /ΕΛΛΙΠΗ_ΣΤΟΙΧΕΙΑ.*ΑΦΜ/s,
    )

    // Κρίσιμο: ούτε ο counter δεν προχώρησε
    const series = await db.select().from(takkSeries)
    expect(series).toHaveLength(0)
  })

  it('ΑΡΝΕΙΤΑΙ έκδοση με άκυρο ΑΦΜ (λάθος checksum)', async () => {
    const user = await seedUser(db, { afm: '111111111' })
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow(
      /ΕΛΛΙΠΗ_ΣΤΟΙΧΕΙΑ/,
    )
  })

  it('ΑΡΝΕΙΤΑΙ έκδοση χωρίς ονοματεπώνυμο', async () => {
    const user = await seedUser(db, { name: null, fullName: null })
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow(
      /ονοματεπώνυμο/,
    )
  })

  it('ΑΡΝΕΙΤΑΙ έκδοση χωρίς νόμιμη διεύθυνση εκδότη', async () => {
    const user = await seedUser(db, { legalAddressLine: null })
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow(
      /νόμιμη διεύθυνση/,
    )
    expect(await db.select().from(takkSeries)).toHaveLength(0)
  })

  it('αποθηκεύει το ΑΦΜ κανονικοποιημένο', async () => {
    const user = await seedUser(db, { afm: `${VALID_TEST_AFM.slice(0, 3)} ${VALID_TEST_AFM.slice(3, 6)} ${VALID_TEST_AFM.slice(6)}` })
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    const doc = (await issueTakkDocuments(db, { stayId: stay.id }))[0]!
    const [stored] = await db
      .select()
      .from(takkDocuments)
      .where(eq(takkDocuments.id, doc.id))

    expect(stored!.issuerAfm).toBe(VALID_TEST_AFM)
  })
})

describe('Δωρεάν διαμονές — δεν επιβαρύνονται με ΤΑΚΚ', () => {
  it('δωρεάν διαμονή → κανένα παραστατικό, χωρίς σφάλμα', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, { isComplimentary: true })

    const docs = await issueTakkDocuments(db, { stayId: stay.id })

    expect(docs).toEqual([])

    // Κρίσιμο: ο counter ΔΕΝ προχώρησε — δεν σπαταλήθηκε αριθμός
    const series = await db.select().from(takkSeries)
    expect(series).toHaveLength(0)
  })

  it('κανονική διαμονή στο ίδιο ακίνητο εκδίδεται κανονικά', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)

    await seedStay(db, property.id, {
      isComplimentary: true,
      externalUid: 'free',
    })
    const paid = await seedStay(db, property.id, { externalUid: 'paid' })

    const docs = await issueTakkDocuments(db, { stayId: paid.id })

    expect(docs).toHaveLength(1)
    // Η αρίθμηση ξεκινά από το 1 — η δωρεάν δεν κατανάλωσε αριθμό
    expect(docs[0]!.number).toBe(1)
  })
})

describe('Το gate — 3+ ακίνητα', () => {
  it('ΑΡΝΕΙΤΑΙ έκδοση σε επιτηδευματία', async () => {
    const user = await seedUser(db, {
      taxRegime: 'business_3_plus',
      declaredPropertyCount: 3,
    })
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id)

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow(
      /επιτηδευματίας/,
    )

    const docs = await db.select().from(takkDocuments)
    expect(docs).toHaveLength(0)
  })
})

describe('Άρνηση σε άκυρες καταστάσεις', () => {
  it('δεν εκδίδει για ακυρωμένη διαμονή', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, { status: 'cancelled' })

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow(
      NumberingError,
    )
  })

  it('δεν εκδίδει για ημερολογιακό block', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, { status: 'blocked' })

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow()
  })

  it('δεν εκδίδει για 0 διανυκτερεύσεις', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)
    const stay = await seedStay(db, property.id, {
      checkIn: '2026-07-10',
      checkOut: '2026-07-10',
      nights: 0,
    })

    await expect(issueTakkDocuments(db, { stayId: stay.id })).rejects.toThrow(
      /0 διανυκτερεύσεων/,
    )
  })

  it('πετάει καθαρό σφάλμα για ανύπαρκτη διαμονή', async () => {
    await expect(
      issueTakkDocuments(db, { stayId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow(/Δεν βρέθηκε διαμονή/)
  })
})

describe('verifySeriesIntegrity — ανιχνεύει πραγματικά κενά', () => {
  it('βρίσκει κενό όταν σβηστεί παραστατικό στο χέρι', async () => {
    const user = await seedUser(db)
    const property = await seedProperty(db, user.id)

    const created = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        seedStay(db, property.id, { externalUid: `s-${i}` }),
      ),
    )
    const docs = (
      await Promise.all(created.map((s) => issueTakkDocuments(db, { stayId: s.id })))
    ).flat()

    expect((await verifySeriesIntegrity(db, property.id, 'Α', 2026)).ok).toBe(true)

    // Προσομοίωση καταστροφής: κάποιος σβήνει το #3
    const target = docs.find((d) => d.number === 3)!
    await db.delete(takkDocuments).where(eq(takkDocuments.id, target.id))

    const after = await verifySeriesIntegrity(db, property.id, 'Α', 2026)
    expect(after.ok).toBe(false)
    expect(after.gaps).toEqual([3])
  }, 60_000)
})

describe('Μορφοποίηση αριθμού', () => {
  it('Α-2026-0000042', () => {
    expect(formatFullNumber('Α', 42, 2026)).toBe('Α-2026-0000042')
  })
})
