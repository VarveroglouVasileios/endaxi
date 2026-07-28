import { describe, it, expect } from 'vitest'
import {
  calculateTakk,
  countNights,
  addDays,
  getRemittancePeriod,
  getRemittanceDeadline,
  formatCents,
} from '../server/utils/takk/calculator'

describe('countNights', () => {
  it('μετράει σωστά απλές διαμονές', () => {
    expect(countNights('2026-07-10', '2026-07-13')).toBe(3)
    expect(countNights('2026-07-10', '2026-07-11')).toBe(1)
  })

  it('επιστρέφει 0 για ίδια ημερομηνία', () => {
    expect(countNights('2026-07-10', '2026-07-10')).toBe(0)
  })

  it('διασχίζει σωστά αλλαγή μήνα', () => {
    expect(countNights('2026-10-30', '2026-11-02')).toBe(3)
  })

  it('διασχίζει σωστά αλλαγή έτους', () => {
    expect(countNights('2026-12-30', '2027-01-02')).toBe(3)
  })

  it('χειρίζεται δίσεκτο έτος', () => {
    expect(countNights('2028-02-28', '2028-03-01')).toBe(2) // 29 Φεβ υπάρχει
    expect(countNights('2026-02-28', '2026-03-01')).toBe(1) // 2026 όχι δίσεκτο
  })

  it('πετάει σφάλμα αν η αναχώρηση προηγείται της άφιξης', () => {
    expect(() => countNights('2026-07-13', '2026-07-10')).toThrow()
  })

  it('απορρίπτει ανύπαρκτες ημερομηνίες', () => {
    expect(() => countNights('2026-02-30', '2026-03-01')).toThrow(/ανύπαρκτη/)
    expect(() => countNights('2026-13-01', '2026-13-02')).toThrow()
  })

  it('απορρίπτει λάθος μορφή', () => {
    expect(() => countNights('10/07/2026', '2026-07-13')).toThrow()
  })
})

describe('addDays — ανθεκτικό σε DST', () => {
  it('προσθέτει σωστά μέσα από την αλλαγή θερινής ώρας', () => {
    // Η Ελλάδα αλλάζει ώρα την τελευταία Κυριακή Μαρτίου/Οκτωβρίου
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('διασχίζει έτος', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('calculateTakk — τυπικές περιπτώσεις', () => {
  it('3 νύχτες θερινή περίοδος, standard → 3 × 8€ = 24€', () => {
    const r = calculateTakk({
      checkIn: '2026-07-10',
      checkOut: '2026-07-13',
      category: 'str_standard',
    })
    expect(r.nights).toBe(3)
    expect(r.totalAmountCents).toBe(2400)
    expect(r.uniformRateCents).toBe(800)
    expect(r.breakdown.every((b) => b.season === 'high')).toBe(true)
  })

  it('3 νύχτες χειμερινή περίοδος, standard → 3 × 2€ = 6€', () => {
    const r = calculateTakk({
      checkIn: '2027-01-10',
      checkOut: '2027-01-13',
      category: 'str_standard',
    })
    expect(r.totalAmountCents).toBe(600)
    expect(r.uniformRateCents).toBe(200)
  })

  it('βίλα θερινή → 15€/νύχτα', () => {
    const r = calculateTakk({
      checkIn: '2026-08-01',
      checkOut: '2026-08-08',
      category: 'str_villa',
    })
    expect(r.nights).toBe(7)
    expect(r.totalAmountCents).toBe(10500) // 7 × 15€
  })

  it('βίλα χειμερινή → 4€/νύχτα', () => {
    const r = calculateTakk({
      checkIn: '2026-12-01',
      checkOut: '2026-12-04',
      category: 'str_villa',
    })
    expect(r.totalAmountCents).toBe(1200) // 3 × 4€
  })
})

describe('calculateTakk — ΤΟ ΔΥΣΚΟΛΟ: διαμονή που διασχίζει εποχές', () => {
  it('30/10 → 02/11: δύο νύχτες υψηλής + μία χαμηλής', () => {
    const r = calculateTakk({
      checkIn: '2026-10-30',
      checkOut: '2026-11-02',
      category: 'str_standard',
    })

    expect(r.nights).toBe(3)
    expect(r.breakdown).toEqual([
      { date: '2026-10-30', season: 'high', rateCents: 800 },
      { date: '2026-10-31', season: 'high', rateCents: 800 },
      { date: '2026-11-01', season: 'low', rateCents: 200 },
    ])
    // 8 + 8 + 2 = 18€ — ΟΧΙ 3 × 8 = 24€ ούτε 3 × 2 = 6€
    expect(r.totalAmountCents).toBe(1800)
    // Δεν υπάρχει ενιαίος συντελεστής → το PDF πρέπει να δείξει ανάλυση
    expect(r.uniformRateCents).toBeNull()
  })

  it('31/03 → 02/04: χαμηλή → υψηλή', () => {
    const r = calculateTakk({
      checkIn: '2026-03-31',
      checkOut: '2026-04-02',
      category: 'str_standard',
    })
    expect(r.breakdown).toEqual([
      { date: '2026-03-31', season: 'low', rateCents: 200 },
      { date: '2026-04-01', season: 'high', rateCents: 800 },
    ])
    expect(r.totalAmountCents).toBe(1000)
  })

  it('τα όρια των μηνών: 31/10 είναι ΥΨΗΛΗ, 01/11 είναι ΧΑΜΗΛΗ', () => {
    const oct = calculateTakk({
      checkIn: '2026-10-31',
      checkOut: '2026-11-01',
      category: 'str_standard',
    })
    expect(oct.totalAmountCents).toBe(800)

    const nov = calculateTakk({
      checkIn: '2026-11-01',
      checkOut: '2026-11-02',
      category: 'str_standard',
    })
    expect(nov.totalAmountCents).toBe(200)
  })

  it('01/04 είναι ΥΨΗΛΗ, 31/03 είναι ΧΑΜΗΛΗ', () => {
    const mar = calculateTakk({
      checkIn: '2026-03-31',
      checkOut: '2026-04-01',
      category: 'str_standard',
    })
    expect(mar.totalAmountCents).toBe(200)

    const apr = calculateTakk({
      checkIn: '2026-04-01',
      checkOut: '2026-04-02',
      category: 'str_standard',
    })
    expect(apr.totalAmountCents).toBe(800)
  })
})

describe('Ιστορικοί συντελεστές 2024 — άλλαξαν και τα ΟΡΙΑ ΕΠΟΧΩΝ', () => {
  it('Μάρτιος 2024 ήταν ΥΨΗΛΗ περίοδος (1,50€)', () => {
    const r = calculateTakk({
      checkIn: '2024-03-10',
      checkOut: '2024-03-13',
      category: 'str_standard',
    })
    expect(r.breakdown.every((b) => b.season === 'high')).toBe(true)
    expect(r.totalAmountCents).toBe(450) // 3 × 1,50€
  })

  it('Μάρτιος 2026 είναι ΧΑΜΗΛΗ περίοδος (2€) — άλλαξε το όριο', () => {
    const r = calculateTakk({
      checkIn: '2026-03-10',
      checkOut: '2026-03-13',
      category: 'str_standard',
    })
    expect(r.breakdown.every((b) => b.season === 'low')).toBe(true)
    expect(r.totalAmountCents).toBe(600) // 3 × 2€
  })

  it('τα ποσά του 2024 ήταν πολύ χαμηλότερα', () => {
    const y2024 = calculateTakk({
      checkIn: '2024-07-10',
      checkOut: '2024-07-11',
      category: 'str_standard',
    })
    const y2026 = calculateTakk({
      checkIn: '2026-07-10',
      checkOut: '2026-07-11',
      category: 'str_standard',
    })
    expect(y2024.totalAmountCents).toBe(150) // 1,50€
    expect(y2026.totalAmountCents).toBe(800) // 8€ — πάνω από 5×
  })

  it('βίλα 2024: 10€ θερινή, 4€ χειμερινή', () => {
    expect(
      calculateTakk({
        checkIn: '2024-07-01',
        checkOut: '2024-07-02',
        category: 'str_villa',
      }).totalAmountCents,
    ).toBe(1000)
  })

  it('διαμονή που διασχίζει την αλλαγή συντελεστών 2024→2025', () => {
    const r = calculateTakk({
      checkIn: '2024-12-30',
      checkOut: '2025-01-02',
      category: 'str_standard',
    })
    // 30/12 & 31/12 με συντελεστές 2024 (0,50€), 01/01 με 2025 (2€)
    expect(r.breakdown[0]!.rateCents).toBe(50)
    expect(r.breakdown[1]!.rateCents).toBe(50)
    expect(r.breakdown[2]!.rateCents).toBe(200)
    expect(r.totalAmountCents).toBe(300)
  })

  it('πριν το 2024 δεν υπάρχουν συντελεστές — αποτυγχάνει θορυβωδώς', () => {
    expect(() =>
      calculateTakk({
        checkIn: '2023-07-10',
        checkOut: '2023-07-13',
        category: 'str_standard',
      }),
    ).toThrow(/Δεν υπάρχουν ορισμένοι συντελεστές/)
  })
})

describe('ΤΜΗΜΑΤΑ ΑΝΑ ΜΗΝΑ — νομική απαίτηση (ΑΑΔΕ FAQ ΤΑΚΚ, ερ. 7)', () => {
  it('διαμονή εντός ενός μήνα → ΕΝΑ τμήμα', () => {
    const r = calculateTakk({
      checkIn: '2026-07-10',
      checkOut: '2026-07-13',
      category: 'str_standard',
    })

    expect(r.segments).toHaveLength(1)
    expect(r.segments[0]).toMatchObject({
      month: '2026-07',
      nights: 3,
      totalAmountCents: 2400,
      remittancePeriod: '2026-07',
      uniformRateCents: 800,
    })
  })

  it('ΤΟ ΚΡΙΣΙΜΟ: 30/10 → 02/11 δίνει ΔΥΟ τμήματα, όχι ένα', () => {
    const r = calculateTakk({
      checkIn: '2026-10-30',
      checkOut: '2026-11-02',
      category: 'str_standard',
    })

    expect(r.segments).toHaveLength(2)

    // Οκτώβριος: 2 νύχτες θερινές = 16€, δηλώνεται ΤΟΝ ΝΟΕΜΒΡΙΟ
    expect(r.segments[0]).toMatchObject({
      month: '2026-10',
      firstNight: '2026-10-30',
      lastNight: '2026-10-31',
      nights: 2,
      totalAmountCents: 1600,
      remittancePeriod: '2026-10',
      uniformRateCents: 800,
    })

    // Νοέμβριος: 1 νύχτα χειμερινή = 2€, δηλώνεται ΤΟΝ ΔΕΚΕΜΒΡΙΟ
    expect(r.segments[1]).toMatchObject({
      month: '2026-11',
      firstNight: '2026-11-01',
      lastNight: '2026-11-01',
      nights: 1,
      totalAmountCents: 200,
      remittancePeriod: '2026-11',
      uniformRateCents: 200,
    })

    // Το σύνολο παραμένει σωστό
    const sum = r.segments.reduce((s, seg) => s + seg.totalAmountCents, 0)
    expect(sum).toBe(r.totalAmountCents)
    expect(sum).toBe(1800)
  })

  it('τα τμήματα καλύπτουν ΟΛΕΣ τις νύχτες, χωρίς επικάλυψη', () => {
    const r = calculateTakk({
      checkIn: '2026-09-28',
      checkOut: '2026-11-03',
      category: 'str_standard',
    })

    const totalNights = r.segments.reduce((s, seg) => s + seg.nights, 0)
    expect(totalNights).toBe(r.nights)

    const allDates = r.segments.flatMap((s) => s.breakdown.map((b) => b.date))
    expect(new Set(allDates).size).toBe(r.nights)
    expect(allDates).toEqual(r.breakdown.map((b) => b.date))
  })

  it('διασχίζει τρεις μήνες → τρία τμήματα σε σειρά', () => {
    const r = calculateTakk({
      checkIn: '2026-09-29',
      checkOut: '2026-11-02',
      category: 'str_standard',
    })

    expect(r.segments.map((s) => s.month)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ])
  })

  it('διασχίζει έτος → τμήματα με σωστά έτη', () => {
    const r = calculateTakk({
      checkIn: '2026-12-30',
      checkOut: '2027-01-02',
      category: 'str_standard',
    })

    expect(r.segments.map((s) => s.month)).toEqual(['2026-12', '2027-01'])
    // Και τα δύο χειμερινά: 2 × 2€ και 1 × 2€
    expect(r.segments[0]!.totalAmountCents).toBe(400)
    expect(r.segments[1]!.totalAmountCents).toBe(200)
  })

  it('μηδέν νύχτες → κανένα τμήμα', () => {
    const r = calculateTakk({
      checkIn: '2026-07-10',
      checkOut: '2026-07-10',
      category: 'str_standard',
    })
    expect(r.segments).toEqual([])
  })

  it('βίλα που διασχίζει εποχές: 15€ και 4€', () => {
    const r = calculateTakk({
      checkIn: '2026-10-31',
      checkOut: '2026-11-02',
      category: 'str_villa',
    })

    expect(r.segments).toHaveLength(2)
    expect(r.segments[0]!.totalAmountCents).toBe(1500) // 31/10 θερινή
    expect(r.segments[1]!.totalAmountCents).toBe(400) // 01/11 χειμερινή
  })
})

describe('getRemittancePeriod — το λάθος που κοστίζει πρόστιμα', () => {
  it('check-out την 1η Μαΐου ανήκει στον ΜΑΪΟ, όχι στον Απρίλιο', () => {
    // Πραγματική περίπτωση από την ομάδα Greek Hosts:
    // «Ο Derek έκανε check-out την 1η Μαΐου — σήμερα συνειδητοποίησα
    //  ότι ήταν λάθος, θα έπρεπε να το είχα δηλώσει με τον Μάιο»
    expect(getRemittancePeriod('2026-05-01')).toBe('2026-05')
  })

  it('όλες οι νύχτες Απρίλιο αλλά αναχώρηση Μάιο → Μάιος', () => {
    const r = calculateTakk({
      checkIn: '2026-04-28',
      checkOut: '2026-05-01',
      category: 'str_standard',
    })
    expect(r.breakdown.map((b) => b.date)).toEqual([
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
    ])
    expect(r.remittancePeriod).toBe('2026-05')
  })

  it('διασχίζει έτος: αναχώρηση 01/01 → Ιανουάριος νέου έτους', () => {
    expect(getRemittancePeriod('2027-01-01')).toBe('2027-01')
  })
})

describe('getRemittanceDeadline', () => {
  it('τελευταία ημέρα του επόμενου μήνα', () => {
    expect(getRemittanceDeadline('2026-05')).toBe('2026-06-30')
    expect(getRemittanceDeadline('2026-01')).toBe('2026-02-28')
    expect(getRemittanceDeadline('2028-01')).toBe('2028-02-29') // δίσεκτο
    expect(getRemittanceDeadline('2026-07')).toBe('2026-08-31')
  })

  it('Δεκέμβριος → 31 Ιανουαρίου επόμενου έτους', () => {
    expect(getRemittanceDeadline('2026-12')).toBe('2027-01-31')
  })
})

describe('Μηδενικές & ακραίες περιπτώσεις', () => {
  it('0 νύχτες → 0€, χωρίς ανάλυση', () => {
    const r = calculateTakk({
      checkIn: '2026-07-10',
      checkOut: '2026-07-10',
      category: 'str_standard',
    })
    expect(r.nights).toBe(0)
    expect(r.totalAmountCents).toBe(0)
    expect(r.breakdown).toEqual([])
  })

  it('πολύ μακρά διαμονή (59 ημέρες — το όριο βραχυχρόνιας)', () => {
    const r = calculateTakk({
      checkIn: '2026-06-01',
      checkOut: '2026-07-30',
      category: 'str_standard',
    })
    expect(r.nights).toBe(59)
    expect(r.totalAmountCents).toBe(59 * 800)
  })

  it('δεν υπάρχουν σφάλματα στρογγυλοποίησης — όλα ακέραια λεπτά', () => {
    for (let n = 1; n <= 100; n++) {
      const r = calculateTakk({
        checkIn: '2026-07-01',
        checkOut: addDays('2026-07-01', n),
        category: 'str_standard',
      })
      expect(Number.isInteger(r.totalAmountCents)).toBe(true)
      expect(r.totalAmountCents).toBe(n * 800)
    }
  })
})

describe('formatCents', () => {
  it('μορφοποιεί ελληνικά', () => {
    // Ελληνικό locale: κόμμα δεκαδικό, σύμβολο μετά
    expect(formatCents(800)).toContain('8')
    expect(formatCents(1800)).toContain('18')
    expect(formatCents(0)).toContain('0')
  })
})
