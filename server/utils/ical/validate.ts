/**
 * ΕΠΑΛΗΘΕΥΣΗ iCAL LINK
 *
 * Το paste του iCal είναι ΤΟ βήμα του onboarding. Αν αποτύχει σιωπηλά,
 * ο host νομίζει ότι είναι εντάξει και ανακαλύπτει τον Ιούλιο ότι δεν
 * εκδόθηκε τίποτα. Άρα: επαληθεύουμε ΤΩΡΑ, μπροστά του, με πραγματικό
 * κατέβασμα — και του λέμε τι βρήκαμε.
 */

import { parseIcalFeed, detectPlatform, type IcalPlatform } from './parser'

export interface ValidationResult {
  ok: boolean
  platform: IcalPlatform
  /** Τι να δείξουμε στον χρήστη */
  message: string
  totalEvents: number
  bookings: number
  blocks: number
  /** Δείγμα για επιβεβαίωση: «αυτές είναι οι κρατήσεις σου;» */
  sample: Array<{ checkIn: string; checkOut: string; nights: number }>
  error?: 'unreachable' | 'not_ical' | 'empty' | 'timeout' | 'bad_url'
}

const MAX_BYTES = 5 * 1024 * 1024 // 5MB — κανένα λογικό feed δεν είναι μεγαλύτερο

function fail(
  error: NonNullable<ValidationResult['error']>,
  message: string,
  platform: IcalPlatform = 'other',
): ValidationResult {
  return {
    ok: false,
    platform,
    message,
    totalEvents: 0,
    bookings: 0,
    blocks: 0,
    sample: [],
    error,
  }
}

export async function validateIcalUrl(rawUrl: string): Promise<ValidationResult> {
  // ── Έλεγχος μορφής ──
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return fail('bad_url', 'Ο σύνδεσμος δεν φαίνεται έγκυρος. Έλεγξε ότι τον αντέγραψες ολόκληρο.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return fail('bad_url', 'Ο σύνδεσμος πρέπει να ξεκινά με https://')
  }

  // SSRF προστασία: μόνο δημόσιοι προορισμοί
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return fail('bad_url', 'Δεν επιτρέπονται τοπικές διευθύνσεις.')
  }

  const platform = detectPlatform(url.href)

  // ── Κατέβασμα ──
  let text: string
  try {
    const res = await fetch(url.href, {
      headers: { 'User-Agent': 'Endaxi/1.0 (+https://endaxi.app)' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    })

    if (!res.ok) {
      return fail(
        'unreachable',
        res.status === 404
          ? 'Ο σύνδεσμος δεν βρέθηκε. Ίσως άλλαξε — πάρε τον ξανά από την πλατφόρμα.'
          : `Η πλατφόρμα απάντησε με σφάλμα ${res.status}. Δοκίμασε ξανά σε λίγο.`,
        platform,
      )
    }

    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_BYTES) {
      return fail('not_ical', 'Το αρχείο είναι υπερβολικά μεγάλο.', platform)
    }

    text = await res.text()
  } catch (e) {
    const timedOut = (e as Error)?.name === 'TimeoutError'
    return fail(
      timedOut ? 'timeout' : 'unreachable',
      timedOut
        ? 'Η πλατφόρμα άργησε να απαντήσει. Δοκίμασε ξανά.'
        : 'Δεν μπορέσαμε να κατεβάσουμε το ημερολόγιο. Έλεγξε τον σύνδεσμο.',
      platform,
    )
  }

  // ── Είναι όντως iCal; ──
  if (!text.includes('BEGIN:VCALENDAR')) {
    return fail(
      'not_ical',
      'Αυτός ο σύνδεσμος δεν είναι ημερολόγιο. Βεβαιώσου ότι αντέγραψες τον σύνδεσμο εξαγωγής (export/iCal) και όχι τη διεύθυνση της αγγελίας.',
      platform,
    )
  }

  // ── Parsing ──
  const events = await parseIcalFeed(text)
  const bookings = events.filter((e) => !e.isBlocked)
  const blocks = events.length - bookings.length

  const sample = bookings
    .slice()
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 3)
    .map((e) => ({
      checkIn: e.checkIn,
      checkOut: e.checkOut,
      nights: Math.round(
        (Date.parse(`${e.checkOut}T00:00:00Z`) - Date.parse(`${e.checkIn}T00:00:00Z`)) /
          86_400_000,
      ),
    }))

  // Άδειο ημερολόγιο δεν είναι σφάλμα — απλά δεν έχει κρατήσεις ακόμα
  if (bookings.length === 0) {
    return {
      ok: true,
      platform,
      message:
        'Ο σύνδεσμος δουλεύει, αλλά δεν βρήκαμε κρατήσεις αυτή τη στιγμή. Θα ελέγχουμε κάθε 2 ώρες.',
      totalEvents: events.length,
      bookings: 0,
      blocks,
      sample: [],
    }
  }

  const platformName =
    platform === 'airbnb'
      ? 'Airbnb'
      : platform === 'booking'
        ? 'Booking.com'
        : platform === 'vrbo'
          ? 'Vrbo'
          : 'το ημερολόγιο'

  return {
    ok: true,
    platform,
    message: `Συνδέθηκε με ${platformName}. Βρήκαμε ${bookings.length} ${bookings.length === 1 ? 'κράτηση' : 'κρατήσεις'}.`,
    totalEvents: events.length,
    bookings: bookings.length,
    blocks,
    sample,
  }
}
