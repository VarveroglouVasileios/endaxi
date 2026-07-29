import { lookup } from 'node:dns/promises'
import type { LookupFunction } from 'node:net'
import * as ipaddr from 'ipaddr.js'
import { Agent, fetch } from 'undici'

const ALLOWED_PROTOCOL = 'https:'
const ALLOWED_PORTS = new Set(['', '443'])
const USER_AGENT = 'Endaxi/1.0 (+https://endaxi.app)'

export type PublicFetchErrorCode =
  | 'bad_url'
  | 'blocked_target'
  | 'timeout'
  | 'unreachable'
  | 'too_large'
  | 'too_many_redirects'

export class PublicFetchError extends Error {
  constructor(
    public readonly code: PublicFetchErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'PublicFetchError'
  }
}

export interface PublicTextResponse {
  status: number
  finalUrl: string
  text: string
}

export interface PublicTextFetchOptions {
  maxBytes: number
  timeoutMs: number
  maxRedirects?: number
}

interface ResolvedAddress {
  address: string
  family: 4 | 6
}

export function isPublicIpAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false

  let parsed = ipaddr.parse(address)
  if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address()
  }

  return parsed.range() === 'unicast'
}

function parseAllowedUrl(rawUrl: string, base?: URL): URL {
  let url: URL
  try {
    url = base ? new URL(rawUrl, base) : new URL(rawUrl.trim())
  } catch (error) {
    throw new PublicFetchError('bad_url', 'Μη έγκυρος σύνδεσμος.', { cause: error })
  }

  if (
    url.protocol !== ALLOWED_PROTOCOL
    || !ALLOWED_PORTS.has(url.port)
    || url.username
    || url.password
  ) {
    throw new PublicFetchError(
      'bad_url',
      'Επιτρέπονται μόνο HTTPS σύνδεσμοι στη θύρα 443 χωρίς στοιχεία σύνδεσης.',
    )
  }

  return url
}

async function resolvePublicAddresses(hostname: string): Promise<ResolvedAddress[]> {
  // Το URL API κρατά τις αγκύλες σε IPv6 literals (π.χ. "[::1]") μέσα στο
  // `.hostname` — το ipaddr.js δεν τις αναγνωρίζει, οπότε χωρίς αυτό ένα
  // bracketed IPv6 literal θα προσπερνούσε τον έλεγχο ιδιωτικής διεύθυνσης
  // και θα κατέληγε (αποτυχημένα) σαν DNS lookup αντί να μπλοκαριστεί ρητά.
  const unbracketed
    = hostname.length >= 2 && hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname

  if (ipaddr.isValid(unbracketed)) {
    if (!isPublicIpAddress(unbracketed)) {
      throw new PublicFetchError('blocked_target', 'Δεν επιτρέπεται ιδιωτική διεύθυνση.')
    }
    return [
      { address: unbracketed, family: ipaddr.parse(unbracketed).kind() === 'ipv6' ? 6 : 4 },
    ]
  }

  let addresses: ResolvedAddress[]
  try {
    addresses = (await lookup(hostname, { all: true, verbatim: true })) as ResolvedAddress[]
  } catch (error) {
    throw new PublicFetchError('unreachable', 'Αποτυχία επίλυσης του προορισμού.', {
      cause: error,
    })
  }

  if (
    addresses.length === 0
    || addresses.some(candidate => !isPublicIpAddress(candidate.address))
  ) {
    throw new PublicFetchError(
      'blocked_target',
      'Ο προορισμός επιλύεται σε μη δημόσια διεύθυνση.',
    )
  }

  return addresses
}

/**
 * Exported μόνο για tests: επιτρέπει να ελεγχθεί το byte-counting loop
 * απευθείας με ένα φτιαχτό Response — π.χ. gzip bomb όπου το undici έχει
 * ήδη αποσυμπιέσει το σώμα και το πραγματικό μέγεθος είναι πολύ
 * μεγαλύτερο από ό,τι δηλώνει (ή δεν δηλώνει καθόλου) το Content-Length.
 */
/** Minimal response shape — accepts undici or global/web Response in tests. */
type LimitedTextResponse = {
  headers: { get(name: string): string | null }
  body: ReadableStream<Uint8Array> | null
}

export async function readTextWithLimit(
  response: LimitedTextResponse,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel()
    throw new PublicFetchError('too_large', 'Η απόκριση είναι υπερβολικά μεγάλη.')
  }

  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new PublicFetchError('too_large', 'Η απόκριση είναι υπερβολικά μεγάλη.')
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

export async function fetchPublicText(
  rawUrl: string,
  options: PublicTextFetchOptions,
): Promise<PublicTextResponse> {
  const maxRedirects = options.maxRedirects ?? 3
  let url = parseAllowedUrl(rawUrl)

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const [pinned] = await resolvePublicAddresses(url.hostname)
    if (!pinned) throw new PublicFetchError('unreachable', 'Δεν βρέθηκε δημόσια διεύθυνση.')

    const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
      callback(null, pinned.address, pinned.family)
    }
    const dispatcher = new Agent({ connect: { lookup: pinnedLookup } })

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/calendar,text/plain;q=0.9' },
        signal: AbortSignal.timeout(options.timeoutMs),
        redirect: 'manual',
        dispatcher,
      })

      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel()
        const location = response.headers.get('location')
        if (!location) {
          throw new PublicFetchError('unreachable', 'Η ανακατεύθυνση δεν έχει προορισμό.')
        }
        if (redirectCount === maxRedirects) {
          throw new PublicFetchError(
            'too_many_redirects',
            'Υπερβολικά πολλές ανακατευθύνσεις.',
          )
        }
        url = parseAllowedUrl(location, url)
        continue
      }

      const text = response.ok ? await readTextWithLimit(response, options.maxBytes) : ''
      if (!response.ok) await response.body?.cancel()
      return { status: response.status, finalUrl: url.href, text }
    } catch (error) {
      if (error instanceof PublicFetchError) throw error
      if (
        error instanceof Error
        && (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new PublicFetchError('timeout', 'Ο προορισμός άργησε να απαντήσει.', {
          cause: error,
        })
      }
      throw new PublicFetchError('unreachable', 'Αποτυχία σύνδεσης με τον προορισμό.', {
        cause: error,
      })
    } finally {
      await dispatcher.close()
    }
  }

  throw new PublicFetchError('too_many_redirects', 'Υπερβολικά πολλές ανακατευθύνσεις.')
}
