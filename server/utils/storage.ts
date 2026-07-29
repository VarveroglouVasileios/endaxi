/**
 * STORAGE — Cloudflare R2 (S3-compatible)
 *
 * Γιατί R2 και όχι S3: μηδενικά egress fees. Ο host θα κατεβάζει τα
 * παραστατικά του συνέχεια — με S3 πληρώνεις κάθε κατέβασμα.
 *
 * Χρησιμοποιούμε `aws4fetch` αντί για το AWS SDK: ~10KB αντί για ~3MB,
 * δουλεύει σε κάθε runtime (Node, edge, workers).
 *
 * ⚠️ ΔΙΑΤΗΡΗΣΗ: τα φορολογικά παραστατικά έχουν υποχρέωση τήρησης.
 *    Μην βάλεις lifecycle rule που τα σβήνει. Το δικαίωμα διαγραφής
 *    του GDPR ΔΕΝ υπερισχύει της φορολογικής υποχρέωσης εδώ — αλλά
 *    τεκμηρίωσέ το στην πολιτική απορρήτου.
 */

import { AwsClient } from 'aws4fetch'

export class StorageError extends Error {
  // `cause` υπάρχει ήδη στο Error (ES2022) — χρησιμοποιούμε το native option
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'StorageError'
  }
}

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

function config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new StorageError(
      'Λείπουν μεταβλητές R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)',
    )
  }
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

let _client: AwsClient | null = null

function client(): AwsClient {
  if (_client) return _client
  const c = config()
  _client = new AwsClient({
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  return _client
}

// Μόνο γράμματα/αριθμοί ανά τμήμα διαδρομής — καμία `/`, `.` ή άλλος
// χαρακτήρας που θα μπορούσε να «σπάσει» έξω από το UUID-scoped δέντρο
// του χρήστη (π.χ. path traversal μέσω του `documentSeries`).
const SAFE_KEY_SEGMENT = /^[\p{L}\p{N}]+$/u

function assertSafeKeySegment(segment: string, field: string): string {
  if (!SAFE_KEY_SEGMENT.test(segment)) {
    throw new StorageError(`Μη έγκυρο τμήμα κλειδιού αποθήκευσης (${field}): "${segment}"`)
  }
  return segment
}

function endpoint(key: string): string {
  const c = config()
  // Defense-in-depth: κάθε τμήμα της διαδρομής πρέπει να είναι "ασφαλές" —
  // αποτρέπει path traversal ακόμα κι αν ένα κλειδί φτάσει εδώ χωρίς να
  // έχει περάσει από `takkDocumentKey()`.
  const segments = key.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new StorageError(`Μη έγκυρο κλειδί αποθήκευσης: "${key}"`)
    }
  }
  return `https://${c.accountId}.r2.cloudflarestorage.com/${c.bucket}/${key}`
}

/**
 * Κλειδί αποθήκευσης παραστατικού.
 * Ιεραρχία: χρήστης / ακίνητο / έτος — εύκολο export ανά φάκελο ελέγχου.
 */
export function takkDocumentKey(params: {
  userId: string
  propertyId: string
  year: number
  series: string
  number: number
}): string {
  const series = assertSafeKeySegment(params.series, 'series')
  const n = String(params.number).padStart(7, '0')
  return `takk/${params.userId}/${params.propertyId}/${params.year}/${series}-${n}.pdf`
}

/** Ανεβάζει PDF. Επιστρέφει το κλειδί. */
export async function putPdf(key: string, body: Buffer): Promise<string> {
  const res = await client().fetch(endpoint(key), {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(body.length),
    },
  })

  if (!res.ok) {
    throw new StorageError(
      `Αποτυχία ανεβάσματος (${res.status}): ${await res.text().catch(() => '')}`,
    )
  }
  return key
}

/** Κατεβάζει αρχείο. */
export async function getObject(key: string): Promise<Buffer> {
  const res = await client().fetch(endpoint(key))
  if (!res.ok) {
    throw new StorageError(`Αποτυχία λήψης (${res.status}) για ${key}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Προσωρινό υπογεγραμμένο URL για κατέβασμα από τον browser.
 * Default 15 λεπτά — αρκετά για ένα κλικ, όχι αρκετά για να διαρρεύσει.
 */
export async function signedDownloadUrl(
  key: string,
  expiresInSeconds = 900,
): Promise<string> {
  const signed = await client().sign(
    new Request(`${endpoint(key)}?X-Amz-Expires=${expiresInSeconds}`),
    { aws: { signQuery: true } },
  )
  return signed.url
}

/** Είναι ρυθμισμένο το storage; Για graceful degradation σε dev. */
export function isStorageConfigured(): boolean {
  try {
    config()
    return true
  } catch {
    return false
  }
}
