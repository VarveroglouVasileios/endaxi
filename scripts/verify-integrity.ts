/**
 * ΕΛΕΓΧΟΣ ΑΚΕΡΑΙΟΤΗΤΑΣ
 *
 * Τρέχει σε κάθε ακίνητο και σειρά, και ψάχνει:
 *  · κενά στην αρίθμηση (νομική παράβαση)
 *  · διπλά ενεργά παραστατικά ανά διαμονή
 *  · ασυμφωνία counter vs πραγματικών παραστατικών
 *  · παραστατικά με μήνα απόδοσης που δεν συμφωνεί με την αναχώρηση
 *
 * Τρέξε ΠΡΙΝ και ΜΕΤΑ από κάθε migration:
 *   pnpm db:verify
 *
 * Exit code 1 αν βρει οτιδήποτε — κατάλληλο για CI.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'

const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://endaxi:endaxi@127.0.0.1:54329/endaxi'

interface Problem {
  severity: 'critical' | 'warning'
  check: string
  detail: string
}

async function main() {
  const client = postgres(DB_URL, { max: 5, prepare: false })
  const db = drizzle(client, { schema })
  const problems: Problem[] = []

  console.log('\n🔍 Έλεγχος ακεραιότητας παραστατικών\n')

  // ── 1. Κενά στην αρίθμηση ──
  const gaps = await db.execute(sql`
    WITH expected AS (
      SELECT property_id, series, year,
             MAX(number) AS max_num,
             COUNT(*)    AS actual_count
      FROM takk_documents
      GROUP BY property_id, series, year
    )
    SELECT property_id, series, year, max_num, actual_count
    FROM expected
    WHERE max_num <> actual_count
  `)

  for (const r of gaps as unknown as Array<Record<string, unknown>>) {
    problems.push({
      severity: 'critical',
      check: 'κενά στην αρίθμηση',
      detail: `ακίνητο ${r.property_id} σειρά ${r.series}/${r.year}: μέγιστος αριθμός ${r.max_num} αλλά ${r.actual_count} παραστατικά`,
    })
  }
  console.log(`   ${gaps.length === 0 ? '✓' : '✗'} Συνεχόμενη αρίθμηση`)

  /**
   * ── 2. Διπλά ενεργά παραστατικά ανά διαμονή ΚΑΙ ΜΗΝΑ ──
   *
   * ⚠️ ΟΧΙ ανά διαμονή σκέτα: διαμονή που διασχίζει μήνες παράγει
   * νόμιμα ένα παραστατικό ανά μήνα (ΑΑΔΕ FAQ ΤΑΚΚ, ερ. 7).
   */
  const dupes = await db.execute(sql`
    SELECT stay_id, remittance_period, COUNT(*) AS n
    FROM takk_documents
    WHERE document_type = 'takk_receipt' AND stay_id IS NOT NULL
    GROUP BY stay_id, remittance_period
    HAVING COUNT(*) > 1
  `)

  for (const r of dupes as unknown as Array<Record<string, unknown>>) {
    problems.push({
      severity: 'critical',
      check: 'διπλά παραστατικά',
      detail: `διαμονή ${r.stay_id} έχει ${r.n} παραστατικά για την περίοδο ${r.remittance_period}`,
    })
  }
  console.log(`   ${dupes.length === 0 ? '✓' : '✗'} Ένα παραστατικό ανά διαμονή & μήνα`)

  // ── 3. Counter vs πραγματικότητα ──
  const drift = await db.execute(sql`
    SELECT s.property_id, s.series, s.year, s.last_number,
           COALESCE(MAX(d.number), 0) AS actual_max
    FROM takk_series s
    LEFT JOIN takk_documents d
      ON d.property_id = s.property_id
     AND d.series = s.series
     AND d.year = s.year
    GROUP BY s.property_id, s.series, s.year, s.last_number
    HAVING s.last_number <> COALESCE(MAX(d.number), 0)
  `)

  for (const r of drift as unknown as Array<Record<string, unknown>>) {
    problems.push({
      severity: 'critical',
      check: 'ασυμφωνία counter',
      detail: `σειρά ${r.series}/${r.year}: counter=${r.last_number} αλλά μέγιστο παραστατικό=${r.actual_max}`,
    })
  }
  console.log(`   ${drift.length === 0 ? '✓' : '✗'} Counter συμφωνεί με παραστατικά`)

  /**
   * ── 4. Μήνας απόδοσης = μήνας των ΝΥΧΤΩΝ του παραστατικού ──
   *
   * ⚠️ ΟΧΙ της αναχώρησης. Ήταν η αρχική λάθος υπόθεση.
   *
   * Κάθε παραστατικό καλύπτει νύχτες ΕΝΟΣ ημερολογιακού μήνα. Η πρώτη
   * νύχτα είναι το check_in, η τελευταία είναι check_out − 1 ημέρα.
   * Και οι δύο πρέπει να ανήκουν στον μήνα απόδοσης.
   */
  const badPeriod = await db.execute(sql`
    SELECT id, series, number, year, check_in, check_out, remittance_period
    FROM takk_documents
    WHERE remittance_period <> to_char(check_in, 'YYYY-MM')
       OR remittance_period <> to_char(check_out - INTERVAL '1 day', 'YYYY-MM')
  `)

  for (const r of badPeriod as unknown as Array<Record<string, unknown>>) {
    problems.push({
      severity: 'critical',
      check: 'λάθος μήνας απόδοσης',
      detail:
        `${r.series}-${r.year}-${r.number}: νύχτες ${r.check_in} έως ` +
        `${r.check_out} αλλά περίοδος ${r.remittance_period}`,
    })
  }
  console.log(`   ${badPeriod.length === 0 ? '✓' : '✗'} Μήνας απόδοσης = μήνας διαμονής`)

  /**
   * ── 4β. Παραστατικό που διασχίζει μήνες ──
   * Δεν επιτρέπεται: κάθε μήνας θέλει δικό του παραστατικό.
   */
  const spanning = await db.execute(sql`
    SELECT id, series, number, year, check_in, check_out
    FROM takk_documents
    WHERE to_char(check_in, 'YYYY-MM') <> to_char(check_out - INTERVAL '1 day', 'YYYY-MM')
  `)

  for (const r of spanning as unknown as Array<Record<string, unknown>>) {
    problems.push({
      severity: 'critical',
      check: 'παραστατικό διασχίζει μήνες',
      detail: `${r.series}-${r.year}-${r.number}: ${r.check_in} → ${r.check_out}. Θέλει ξεχωριστό παραστατικό ανά μήνα.`,
    })
  }
  console.log(`   ${spanning.length === 0 ? '✓' : '✗'} Κανένα παραστατικό δεν διασχίζει μήνες`)

  // ── 5. Ορφανά αντιλογιστικά ──
  const orphans = await db.execute(sql`
    SELECT c.id, c.series, c.number
    FROM takk_documents c
    WHERE c.document_type = 'takk_cancellation'
      AND (c.cancels_document_id IS NULL
           OR NOT EXISTS (SELECT 1 FROM takk_documents o WHERE o.id = c.cancels_document_id))
  `)

  for (const r of orphans as unknown as Array<Record<string, unknown>>) {
    problems.push({
      severity: 'critical',
      check: 'ορφανό αντιλογιστικό',
      detail: `${r.series}-${r.number} δεν δείχνει σε υπαρκτό παραστατικό`,
    })
  }
  console.log(`   ${orphans.length === 0 ? '✓' : '✗'} Αντιλογιστικά συνδεδεμένα`)

  // ── 6. Παραστατικά χωρίς PDF (warning, όχι critical) ──
  const noPdf = await db.execute(sql`
    SELECT COUNT(*) AS n FROM takk_documents
    WHERE pdf_storage_key IS NULL AND document_type = 'takk_receipt'
  `)
  const noPdfCount = Number((noPdf as unknown as Array<{ n: string }>)[0]?.n ?? 0)
  if (noPdfCount > 0) {
    problems.push({
      severity: 'warning',
      check: 'PDF εκκρεμεί',
      detail: `${noPdfCount} παραστατικά χωρίς αποθηκευμένο PDF`,
    })
  }
  console.log(`   ${noPdfCount === 0 ? '✓' : '⚠'} PDF αποθηκευμένα`)

  // ── Αποτέλεσμα ──
  console.log()
  const critical = problems.filter((p) => p.severity === 'critical')
  const warnings = problems.filter((p) => p.severity === 'warning')

  if (problems.length === 0) {
    console.log('✅ Καθαρό. Καμία παρατυπία.\n')
    await client.end()
    return
  }

  if (critical.length > 0) {
    console.log(`🔴 ${critical.length} ΚΡΙΣΙΜΑ:`)
    for (const p of critical) console.log(`   · [${p.check}] ${p.detail}`)
    console.log()
  }

  if (warnings.length > 0) {
    console.log(`🟡 ${warnings.length} προειδοποιήσεις:`)
    for (const p of warnings) console.log(`   · [${p.check}] ${p.detail}`)
    console.log()
  }

  await client.end()
  if (critical.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('\n✗ ΣΦΑΛΜΑ:', e)
  process.exit(1)
})
