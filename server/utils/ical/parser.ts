/**
 * iCal PARSER — η μοναδική πηγή δεδομένων που χρειάζεται το ΤΑΚΚ.
 *
 * Γιατί αρκεί: το ΤΑΚΚ είναι σταθερό ποσό ανά διανυκτέρευση, άρα
 * χρειαζόμαστε μόνο ακίνητο + ημερομηνίες. Το iCal τα δίνει δωρεάν,
 * χωρίς έγκριση partner, χωρίς API keys.
 *
 * Τι ΔΕΝ δίνει το iCal: τιμές, προμήθειες, στοιχεία πληρωμής.
 * Αυτά έρχονται από inbound email, για το reconciliation module.
 */

export type IcalPlatform = 'airbnb' | 'booking' | 'vrbo' | 'other'

export interface ParsedEvent {
  /** UID από το iCal — χρησιμοποιείται για idempotent sync */
  uid: string
  /** ISO 'YYYY-MM-DD' */
  checkIn: string
  /** ISO 'YYYY-MM-DD' — αποκλειστικό (η μέρα αναχώρησης) */
  checkOut: string
  summary: string | null
  description: string | null
  guestName: string | null
  /**
   * true αν πρόκειται για ημερολογιακό block και όχι πραγματική κράτηση.
   * ΔΕΝ παράγει ΤΑΚΚ.
   */
  isBlocked: boolean
  raw: Record<string, unknown>
}

/**
 * Φράσεις που δηλώνουν block αντί για κράτηση.
 * Airbnb: "Airbnb (Not available)" / "Blocked"
 * Booking: "CLOSED - Not available"
 */
const BLOCKED_PATTERNS = [
  /not available/i,
  /unavailable/i,
  /^blocked$/i,
  /^closed/i,
  /μη διαθέσιμο/i,
  /κλειστό/i,
]

export function isBlockedSummary(summary: string | null | undefined): boolean {
  if (!summary) return false
  return BLOCKED_PATTERNS.some((re) => re.test(summary.trim()))
}

/**
 * Εξάγει όνομα επισκέπτη όπου είναι δυνατόν.
 * Το Airbnb συνήθως δίνει μόνο "Reservation" — δεν πειράζει,
 * το όνομα δεν είναι υποχρεωτικό για το ΤΑΚΚ.
 */
export function extractGuestName(
  summary: string | null,
  description: string | null,
): string | null {
  if (summary) {
    // Booking.com: "John Smith" ή "CLOSED - Not available"
    const clean = summary.trim()
    if (
      !isBlockedSummary(clean) &&
      !/^reserved$/i.test(clean) &&
      !/^reservation$/i.test(clean) &&
      !/^airbnb/i.test(clean)
    ) {
      return clean.slice(0, 120)
    }
  }

  if (description) {
    // VRBO/Booking βάζουν συχνά "Name: John Smith" ή "Guest: ..."
    const m = description.match(/(?:name|guest|όνομα)\s*[:\-]\s*(.+)/i)
    if (m?.[1]) return m[1].trim().split('\n')[0]!.slice(0, 120)
  }

  return null
}

/** Η ζώνη ώρας στην οποία ορίζονται οι ημερολογιακές ημερομηνίες. */
export const PROPERTY_TIMEZONE = 'Europe/Athens'

/**
 * Date → ISO ημερομηνία 'YYYY-MM-DD'.
 *
 * ⚠️ ΕΔΩ ΚΡΥΒΕΤΑΙ ΤΟ ΠΙΟ ΥΠΟΥΛΟ BUG ΤΟΥ iCAL.
 *
 * Το node-ical παρσάρει το `DTSTART;VALUE=DATE:20260710` ως **τοπικά
 * μεσάνυχτα** — δηλαδή 2026-07-10T00:00:00+03:00 = 2026-07-09T21:00:00Z.
 * Αν διαβάσεις UTC components παίρνεις 2026-07-09: **μία μέρα πίσω**.
 *
 * Συνέπειες αν περάσει απαρατήρητο:
 *  · λάθος ημερομηνίες στο παραστατικό
 *  · λάθος μήνας απόδοσης στα όρια του μήνα
 *  · λάθος εποχή → λάθος ποσό (8€ αντί 2€ ή αντίστροφα)
 *
 * Γι' αυτό: για ημερομηνίες ολόκληρης ημέρας διαβάζουμε **τοπικά**
 * components. Για πραγματικά datetimes μετατρέπουμε στη ζώνη του ακινήτου.
 */
export function toIsoDate(d: Date, opts: { dateOnly?: boolean } = {}): string {
  // All-day: το node-ical το έφτιαξε ως τοπικά μεσάνυχτα — διάβασέ το έτσι.
  if (opts.dateOnly) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Πραγματικό datetime: ποια ημερολογιακή μέρα είναι στην Ελλάδα;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  return parts // en-CA δίνει ήδη 'YYYY-MM-DD'
}

/** Το node-ical σημαδεύει τις all-day ημερομηνίες. */
function isDateOnly(value: Date, event: Record<string, unknown>): boolean {
  return (
    (value as unknown as { dateOnly?: boolean }).dateOnly === true ||
    event.datetype === 'date'
  )
}

/**
 * Ανίχνευση πλατφόρμας από το URL του feed.
 */
export function detectPlatform(url: string): IcalPlatform {
  const u = url.toLowerCase()
  if (u.includes('airbnb')) return 'airbnb'
  if (u.includes('booking.com')) return 'booking'
  if (u.includes('vrbo') || u.includes('homeaway') || u.includes('expedia')) {
    return 'vrbo'
  }
  return 'other'
}

/**
 * Parse ενός iCal feed σε ParsedEvent[].
 *
 * Χρησιμοποιεί node-ical. Ο import γίνεται δυναμικά ώστε η συνάρτηση
 * να μένει testable χωρίς το dependency.
 */
export async function parseIcalFeed(icsText: string): Promise<ParsedEvent[]> {
  const ical = await import('node-ical')
  const parsed = ical.default.sync.parseICS(icsText)

  const events: ParsedEvent[] = []

  for (const key of Object.keys(parsed)) {
    const item = parsed[key] as Record<string, unknown>
    if (item?.type !== 'VEVENT') continue

    const start = item.start as Date | undefined
    const end = item.end as Date | undefined
    if (!start || !end) continue

    const summary = (item.summary as string | undefined) ?? null
    const description = (item.description as string | undefined) ?? null

    const startDateOnly = isDateOnly(start, item)
    const endDateOnly = isDateOnly(end, item)
    const checkIn = toIsoDate(start, { dateOnly: startDateOnly })
    const checkOut = toIsoDate(end, { dateOnly: endDateOnly })

    const uid = (item.uid as string | undefined) ?? `${checkIn}_${checkOut}`

    events.push({
      uid,
      checkIn,
      checkOut,
      summary,
      description,
      guestName: extractGuestName(summary, description),
      isBlocked: isBlockedSummary(summary),
      raw: {
        uid,
        summary,
        description,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    })
  }

  return events
}

/**
 * Διαφορά μεταξύ αυτών που έχουμε στη βάση και αυτών που ήρθαν τώρα.
 *
 * ΠΡΟΣΟΧΗ: μια κράτηση που εξαφανίζεται από ένα snapshot είναι μόνο
 * υποψήφια ακύρωση. Το sync layer πρέπει να ζητήσει επιβεβαίωση και δεν
 * επιτρέπεται να εκδώσει αντιλογιστικό από μία μόνο απουσία.
 */
export interface SyncDiff {
  toCreate: ParsedEvent[]
  toUpdate: Array<{ existingId: string; event: ParsedEvent }>
  /** Missing from this snapshot; requires confirmation before cancellation. */
  toCancel: string[]
  /** Reappeared after a previous cancellation; never restore automatically. */
  toReview: Array<{ existingId: string; event: ParsedEvent }>
  unchanged: number
}

export function diffStays(
  existing: Array<{
    id: string
    externalUid: string | null
    checkIn: string
    checkOut: string
    status: string
  }>,
  incoming: ParsedEvent[],
): SyncDiff {
  const byUid = new Map(existing.filter((e) => e.externalUid).map((e) => [e.externalUid!, e]))
  const incomingUids = new Set(incoming.map((e) => e.uid))

  const toCreate: ParsedEvent[] = []
  const toUpdate: Array<{ existingId: string; event: ParsedEvent }> = []
  const toReview: Array<{ existingId: string; event: ParsedEvent }> = []
  let unchanged = 0

  for (const event of incoming) {
    // Τα blocks δεν γίνονται stays — δεν παράγουν ΤΑΚΚ
    if (event.isBlocked) continue

    const match = byUid.get(event.uid)
    if (!match) {
      toCreate.push(event)
      continue
    }

    if (match.status !== 'confirmed') {
      toReview.push({ existingId: match.id, event })
      continue
    }

    // Άλλαξαν οι ημερομηνίες; (τροποποίηση κράτησης)
    if (match.checkIn !== event.checkIn || match.checkOut !== event.checkOut) {
      toUpdate.push({ existingId: match.id, event })
    } else {
      unchanged++
    }
  }

  // Ό,τι είχαμε ως confirmed και δεν ήρθε → ακυρώθηκε
  const toCancel = existing
    .filter(
      (e) =>
        e.status === 'confirmed' &&
        e.externalUid &&
        !incomingUids.has(e.externalUid),
    )
    .map((e) => e.id)

  return { toCreate, toUpdate, toCancel, toReview, unchanged }
}
