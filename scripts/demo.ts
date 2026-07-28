/**
 * END-TO-END DEMO
 *
 * Αποδεικνύει ολόκληρο το pipeline με πραγματικά δεδομένα:
 *
 *   iCal feed → parsing → stays → ΤΑΚΚ υπολογισμός →
 *   αρίθμηση με κλείδωμα → PDF → ακύρωση με αντιλογιστικό
 *
 * Τρέξε:
 *   docker compose up -d
 *   npx tsx scripts/demo.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { sql as sqlRaw } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { parseIcalFeed, diffStays } from '../server/utils/ical/parser'
import { calculateTakk, countNights, formatCents } from '../server/utils/takk/calculator'
import { issueTakkDocuments, cancelTakkDocument, verifySeriesIntegrity } from '../server/utils/takk/numbering'
import { renderTakkReceiptPdf } from '../server/utils/pdf/takk-receipt'

const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://endaxi:endaxi@127.0.0.1:54329/endaxi'

/** Ρεαλιστικό iCal feed όπως το δίνει η Airbnb */
const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260710
DTEND;VALUE=DATE:20260713
UID:aaaa-1111@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Guest: Ελένη Παπαδοπούλου
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261030
DTEND;VALUE=DATE:20261102
UID:bbbb-2222@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Guest: Marco Rossi
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260801
DTEND;VALUE=DATE:20260805
UID:cccc-3333@airbnb.com
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`

const line = (c = '─') => console.log(c.repeat(64))
const money = (cents: number) => formatCents(cents)

async function main() {
  const client = postgres(DB_URL, { max: 10, prepare: false })
  const db = drizzle(client, { schema })

  console.log('\n🏠 ΕΝΤΑΞΕΙ — End-to-end demo\n')

  // ── Καθαρισμός ──
  await db.execute(
    sqlRaw`TRUNCATE audit_log, takk_documents, takk_series, stays,
      ical_sources, properties, users RESTART IDENTITY CASCADE`,
  )

  // ── 1. Χρήστης & ακίνητο ──
  line()
  console.log('1️⃣  ΧΡΗΣΤΗΣ & ΑΚΙΝΗΤΟ')
  line()

  const [user] = await db
    .insert(schema.users)
    .values({
      email: 'vasilis@example.gr',
      name: 'Βασίλης Βαρβέρογλου',
      fullName: 'Βασίλης Βαρβέρογλου',
      // Συνθετικό ΑΦΜ που περνά τον αλγόριθμο ελέγχου (το 123456789 ΔΕΝ περνά)
      afm: '123456783',
      declaredPropertyCount: 1,
      taxRegime: 'individual_upto_2',
    })
    .returning()

  const [property] = await db
    .insert(schema.properties)
    .values({
      userId: user!.id,
      ama: '00001234567',
      name: 'Διαμέρισμα Κουκάκι',
      category: 'str_standard',
      addressLine: 'Δράκου 12',
      city: 'Αθήνα',
      postalCode: '11741',
      documentSeries: 'Α',
    })
    .returning()

  console.log(`   ${user!.fullName} · ΑΦΜ ${user!.afm}`)
  console.log(`   ${property!.name} · Α.Μ.Α. ${property!.ama}`)
  console.log(`   Καθεστώς: ${user!.taxRegime} ✓ (≤2 ακίνητα, εκτός myDATA)`)

  // ── 2. iCal sync ──
  line()
  console.log('2️⃣  iCAL SYNC — ο χρήστης έκανε paste ένα link, τίποτα άλλο')
  line()

  const [source] = await db
    .insert(schema.icalSources)
    .values({
      propertyId: property!.id,
      url: 'https://www.airbnb.com/calendar/ical/12345.ics',
      source: 'ical_airbnb',
      label: 'Airbnb',
    })
    .returning()

  const events = await parseIcalFeed(SAMPLE_ICAL)
  const diff = diffStays([], events)

  console.log(`   Γεγονότα στο feed: ${events.length}`)
  console.log(`   Ημερολογιακά blocks (αγνοούνται): ${events.filter((e) => e.isBlocked).length}`)
  console.log(`   Πραγματικές κρατήσεις: ${diff.toCreate.length}`)

  const created: string[] = []
  for (const ev of diff.toCreate) {
    const nights = countNights(ev.checkIn, ev.checkOut)
    const [row] = await db
      .insert(schema.stays)
      .values({
        propertyId: property!.id,
        icalSourceId: source!.id,
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
    created.push(row!.id)
    console.log(`   · ${ev.checkIn} → ${ev.checkOut}  (${nights} νύχτες)  ${ev.guestName ?? '—'}`)
  }

  // ── 3. Υπολογισμός ΤΑΚΚ ──
  line()
  console.log('3️⃣  ΥΠΟΛΟΓΙΣΜΟΣ ΤΑΚΚ')
  line()

  for (const stayId of created) {
    const [s] = await db.select().from(schema.stays).where(eq(schema.stays.id, stayId))
    const calc = calculateTakk({
      checkIn: s!.checkIn,
      checkOut: s!.checkOut,
      category: property!.category,
    })

    console.log(`\n   ${s!.checkIn} → ${s!.checkOut}`)
    for (const b of calc.breakdown) {
      const season = b.season === 'high' ? 'Θερινή  ' : 'Χειμερινή'
      console.log(`     ${b.date}  ${season}  ${money(b.rateCents)}`)
    }
    console.log(`     ${'─'.repeat(34)}`)
    console.log(`     ΣΥΝΟΛΟ: ${money(calc.totalAmountCents)}   →  απόδοση ${calc.remittancePeriod}`)
    if (calc.uniformRateCents === null) {
      console.log(`     ⚠️  διασχίζει εποχές — το PDF θα δείξει ανάλυση`)
    }
  }

  // ── 4. Έκδοση παραστατικών ──
  line()
  console.log('\n4️⃣  ΕΚΔΟΣΗ ΠΑΡΑΣΤΑΤΙΚΩΝ (ταυτόχρονα)')
  line()

  const docsNested = await Promise.all(
    created.map((stayId) => issueTakkDocuments(db, { stayId })),
  )
  const docs = docsNested.flat()

  for (const d of docs) {
    console.log(`   ${d.fullNumber}   ${money(d.totalAmountCents).padStart(10)}   περίοδος ${d.remittancePeriod}`)
  }

  const integrity = await verifySeriesIntegrity(db, property!.id, 'Α', 2026)
  console.log(`\n   Ακεραιότητα σειράς: ${integrity.ok ? '✓ χωρίς κενά' : '✗ ΚΕΝΑ: ' + integrity.gaps}`)

  // ── 5. PDF ──
  line()
  console.log('5️⃣  ΠΑΡΑΓΩΓΗ PDF')
  line()

  mkdirSync('./tmp', { recursive: true })

  for (const d of docs) {
    const [doc] = await db
      .select()
      .from(schema.takkDocuments)
      .where(eq(schema.takkDocuments.id, d.id))

    const calc = calculateTakk({
      checkIn: doc!.checkIn,
      checkOut: doc!.checkOut,
      category: property!.category,
    })

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
      propertyAddress: `${property!.addressLine}, ${property!.city} ${property!.postalCode}`,
      checkIn: doc!.checkIn,
      checkOut: doc!.checkOut,
      nights: doc!.nights,
      guestName: doc!.guestName,
      breakdown: calc.breakdown,
      uniformRateCents: calc.uniformRateCents,
      totalAmountCents: doc!.totalAmountCents,
      remittancePeriod: doc!.remittancePeriod,
    })

    const path = `./tmp/${doc!.series}-${doc!.year}-${String(doc!.number).padStart(7, '0')}.pdf`
    writeFileSync(path, pdf)
    console.log(`   ✓ ${path}  (${(pdf.length / 1024).toFixed(1)} KB)`)
  }

  // ── 6. Ακύρωση ──
  line()
  console.log('6️⃣  ΑΚΥΡΩΣΗ — αντιλογιστικό, ποτέ διαγραφή')
  line()

  const toCancel = docs[0]!
  const cancellation = await cancelTakkDocument(
    db,
    toCancel.id,
    'Ο επισκέπτης ακύρωσε την κράτηση',
  )

  console.log(`   Αρχικό:        ${toCancel.fullNumber}  ${money(toCancel.totalAmountCents)}`)
  console.log(`   Αντιλογιστικό: ${cancellation.fullNumber}  ${money(cancellation.totalAmountCents)}`)

  const [original] = await db
    .select()
    .from(schema.takkDocuments)
    .where(eq(schema.takkDocuments.id, toCancel.id))
  console.log(`   Το αρχικό υπάρχει ακόμα: ${original ? '✓ ανέπαφο' : '✗ ΧΑΘΗΚΕ'}`)

  const after = await verifySeriesIntegrity(db, property!.id, 'Α', 2026)
  console.log(`   Ακεραιότητα: ${after.ok ? '✓ χωρίς κενά' : '✗'}`)

  // ── Σύνοψη ──
  line('═')
  const all = await db
    .select()
    .from(schema.takkDocuments)
    .where(eq(schema.takkDocuments.propertyId, property!.id))
  const net = all.reduce((s, d) => s + d.totalAmountCents, 0)
  console.log(`ΣΥΝΟΛΟ: ${all.length} παραστατικά · καθαρό οφειλόμενο ΤΑΚΚ ${money(net)}`)
  line('═')
  console.log()

  await client.end()
}

main().catch((e) => {
  console.error('\n✗ ΣΦΑΛΜΑ:', e)
  process.exit(1)
})
