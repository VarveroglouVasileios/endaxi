/**
 * LIVE END-TO-END TEST — πραγματική Neon + R2 + Resend, όχι mocks.
 * Δεν κάνει TRUNCATE. Χρησιμοποιεί το υπάρχον QA fixture (ama QA5510668)
 * και προσθέτει καθαρά, αναγνωρίσιμα δεδομένα δίπλα του.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { parseIcalFeed, diffStays } from '../server/utils/ical/parser'
import { validateIcalUrl } from '../server/utils/ical/validate'
import { calculateTakk, countNights, formatCents } from '../server/utils/takk/calculator'
import { issueTakkDocuments, verifySeriesIntegrity } from '../server/utils/takk/numbering'
import { renderTakkReceiptPdf } from '../server/utils/pdf/takk-receipt'
import { putPdf, getObject, takkDocumentKey, signedDownloadUrl } from '../server/utils/storage'
import { sendEmailVerificationEmail } from '../server/utils/email/email-verification'
import { sendPasswordResetEmail } from '../server/utils/email/password-reset'

const line = (c = '─') => console.log(c.repeat(70))
const money = (cents: number) => formatCents(cents)
const RESULTS: Record<string, unknown> = {}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 5, prepare: false, ssl: 'require' })
  const db = drizzle(client, { schema })

  console.log('\n🧪 ΕΝΤΑΞΕΙ — LIVE END-TO-END TEST (πραγματική υποδομή)\n')

  // ═══ Α. Πραγματικό δίκτυο: validateIcalUrl() σε ήδη-δημόσιο, σταθερό feed ═══
  line('═')
  console.log('Α. ΠΡΑΓΜΑΤΙΚΟ HTTP FETCH + VALIDATION (validateIcalUrl, ίδια συνάρτηση με το onboarding)')
  line('═')
  const publicIcsUrl =
    'https://calendar.google.com/calendar/ical/en.greek%23holiday%40group.v.calendar.google.com/public/basic.ics'
  const validation = await validateIcalUrl(publicIcsUrl)
  console.log(`   URL: ${publicIcsUrl}`)
  console.log(`   ok=${validation.ok} platform=${validation.platform} totalEvents=${validation.totalEvents}`)
  console.log(`   μήνυμα: ${validation.message}`)
  RESULTS.realFetchValidation = { ok: validation.ok, totalEvents: validation.totalEvents }

  // ═══ Β. Ρεαλιστικό booking-shaped feed → πραγματική βάση (QA fixture) ═══
  line('═')
  console.log('Β. iCAL SYNC → STAYS στο υπάρχον QA ακίνητο (ama QA5510668)')
  line('═')

  const [property] = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.ama, 'QA5510668'))
  if (!property) throw new Error('Δεν βρέθηκε το QA property — σταματάω.')
  console.log(`   Ακίνητο: ${property.name} (${property.id})`)

  const stamp = Date.now()
  const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260810
DTEND;VALUE=DATE:20260813
UID:qa-live-${stamp}-a@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Guest: Ελένη Παπαδοπούλου (QA live test)
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260828
DTEND;VALUE=DATE:20260901
UID:qa-live-${stamp}-b@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Guest: Marco Rossi (QA live test)
END:VEVENT
END:VCALENDAR`

  const [icalSource] = await db
    .insert(schema.icalSources)
    .values({
      propertyId: property.id,
      url: `https://www.airbnb.com/calendar/ical/qa-live-${stamp}.ics`,
      source: 'ical_airbnb',
      label: `QA live test ${new Date(stamp).toISOString()}`,
      lastSyncedAt: new Date(),
      lastSyncStatus: 'ok',
    })
    .returning()

  const events = await parseIcalFeed(SAMPLE_ICAL)
  const diff = diffStays([], events)
  console.log(`   Γεγονότα στο feed: ${events.length} · κρατήσεις: ${diff.toCreate.length}`)

  const stayIds: string[] = []
  for (const ev of diff.toCreate) {
    const nights = countNights(ev.checkIn, ev.checkOut)
    const [row] = await db
      .insert(schema.stays)
      .values({
        propertyId: property.id,
        icalSourceId: icalSource!.id,
        externalUid: ev.uid,
        source: 'ical_airbnb',
        checkIn: ev.checkIn,
        checkOut: ev.checkOut,
        nights,
        guestName: ev.guestName,
        status: 'confirmed',
        rawPayload: ev.raw,
      })
      .returning()
    stayIds.push(row!.id)
    console.log(`   · stay ${row!.id}: ${ev.checkIn} → ${ev.checkOut} (${nights}ν) ${ev.guestName}`)
  }
  RESULTS.staysCreated = stayIds.length

  // ═══ Γ. ΤΑΚΚ calc + πραγματική αρίθμηση με locking ═══
  line('═')
  console.log('Γ. ΥΠΟΛΟΓΙΣΜΟΣ ΤΑΚΚ + ΕΚΔΟΣΗ (πραγματικό transactional locking στη Neon)')
  line('═')

  for (const stayId of stayIds) {
    const [s] = await db.select().from(schema.stays).where(eq(schema.stays.id, stayId))
    const calc = calculateTakk({ checkIn: s!.checkIn, checkOut: s!.checkOut, category: property.category })
    console.log(`   ${s!.checkIn} → ${s!.checkOut}: σύνολο ${money(calc.totalAmountCents)}, απόδοση ${calc.remittancePeriod}`)
  }

  const docsNested = await Promise.all(stayIds.map((stayId) => issueTakkDocuments(db, { stayId })))
  const docs = docsNested.flat()
  for (const d of docs) {
    console.log(`   ✓ ${d.fullNumber}   ${money(d.totalAmountCents)}   περίοδος ${d.remittancePeriod}`)
  }

  const integrity = await verifySeriesIntegrity(db, property.id, property.documentSeries, new Date().getFullYear())
  console.log(`   Ακεραιότητα σειράς '${property.documentSeries}': ${integrity.ok ? '✓ χωρίς κενά' : '✗ ΚΕΝΑ: ' + integrity.gaps}`)
  RESULTS.docsIssued = docs.map((d) => d.fullNumber)
  RESULTS.seriesIntegrity = integrity.ok

  // ═══ Δ. Πραγματικό PDF + πραγματικό R2 (upload/signed URL/download) ═══
  line('═')
  console.log('Δ. PDF + ΠΡΑΓΜΑΤΙΚΟ CLOUDFLARE R2 (upload → signed URL → download)')
  line('═')

  const uploadedKeys: string[] = []
  for (const d of docs) {
    const [doc] = await db.select().from(schema.takkDocuments).where(eq(schema.takkDocuments.id, d.id))
    const calc = calculateTakk({ checkIn: doc!.checkIn, checkOut: doc!.checkOut, category: property.category })

    const pdf = await renderTakkReceiptPdf({
      series: doc!.series,
      number: doc!.number,
      year: doc!.year,
      issuedAt: doc!.issuedAt,
      isCancellation: false,
      issuerName: doc!.issuerName,
      issuerAfm: doc!.issuerAfm,
      propertyAma: doc!.propertyAma,
      propertyName: doc!.propertyName,
      propertyAddress: `${property.addressLine}, ${property.city} ${property.postalCode}`,
      checkIn: doc!.checkIn,
      checkOut: doc!.checkOut,
      nights: doc!.nights,
      guestName: doc!.guestName,
      breakdown: calc.breakdown,
      uniformRateCents: calc.uniformRateCents,
      totalAmountCents: doc!.totalAmountCents,
      remittancePeriod: doc!.remittancePeriod,
    })

    const isPdf = pdf.subarray(0, 4).toString('latin1') === '%PDF'
    console.log(`   PDF παράχθηκε: ${(pdf.length / 1024).toFixed(1)} KB, valid header: ${isPdf}`)

    const key = takkDocumentKey({
      userId: property.userId,
      propertyId: property.id,
      year: doc!.year,
      series: doc!.series,
      number: doc!.number,
    })
    await putPdf(key, pdf)
    uploadedKeys.push(key)
    console.log(`   ✓ ανέβηκε στο R2: ${key}`)

    const signedUrl = await signedDownloadUrl(key, 300)
    console.log(`   ✓ signed URL παράχθηκε (λήγει σε 5 λεπτά)`)

    const downloaded = await getObject(key)
    const byteMatch = Buffer.compare(pdf, downloaded) === 0
    console.log(`   ✓ κατέβηκε ξανά από R2: ${downloaded.length} bytes, ταυτόσημο με το ανεβασμένο: ${byteMatch}`)

    const httpRes = await fetch(signedUrl)
    console.log(`   ✓ HTTP GET στο signed URL: ${httpRes.status} ${httpRes.headers.get('content-type')}`)

    RESULTS[`pdf_${doc!.series}${doc!.number}`] = { bytes: pdf.length, isPdf, byteMatch, httpStatus: httpRes.status }
  }

  // ═══ Ε. Πραγματικό Resend: verification + password reset email ═══
  line('═')
  console.log('Ε. ΠΡΑΓΜΑΤΙΚΟ EMAIL (Resend API, στέλνεται στο δικό σου inbox)')
  line('═')

  const testEmail = 'varveroglouvas+endaxi-qa-test@gmail.com'
  const fakeVerifyUrl = `https://endaxi.app/api/auth/verify-email?token=qa-live-test-${stamp}`
  const fakeResetUrl = `https://endaxi.app/reset-password?token=qa-live-test-${stamp}`

  try {
    await sendEmailVerificationEmail(testEmail, fakeVerifyUrl)
    console.log(`   ✓ email επιβεβαίωσης εστάλη πραγματικά στο ${testEmail} (θέμα: "Επιβεβαίωσε το email σου — Endaxi")`)
    RESULTS.verificationEmailSent = true
  } catch (e) {
    console.log(`   ✗ ΑΠΕΤΥΧΕ το email επιβεβαίωσης: ${(e as Error).message}`)
    RESULTS.verificationEmailSent = false
  }

  try {
    await sendPasswordResetEmail(testEmail, fakeResetUrl)
    console.log(`   ✓ email επαναφοράς κωδικού εστάλη πραγματικά στο ${testEmail} (θέμα: "Επαναφορά κωδικού — Εντάξει")`)
    RESULTS.resetEmailSent = true
  } catch (e) {
    console.log(`   ✗ ΑΠΕΤΥΧΕ το email επαναφοράς: ${(e as Error).message}`)
    RESULTS.resetEmailSent = false
  }

  // ═══ Σύνοψη ═══
  line('═')
  console.log('ΣΥΝΟΨΗ (JSON):')
  console.log(JSON.stringify(RESULTS, null, 2))
  line('═')

  console.log('\nΔεδομένα που δημιουργήθηκαν (για δική σου αναφορά/καθαρισμό):')
  console.log(`   ical_source: ${icalSource!.id}`)
  console.log(`   stays: ${stayIds.join(', ')}`)
  console.log(`   takk_documents: ${docs.map((d) => d.id).join(', ')}`)
  console.log(`   R2 keys: ${uploadedKeys.join(', ')}`)

  await client.end()
}

main().catch((e) => {
  console.error('\n✗ ΣΦΑΛΜΑ:', e)
  process.exit(1)
})
