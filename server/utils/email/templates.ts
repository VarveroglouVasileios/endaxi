/**
 * ΠΡΟΤΥΠΑ EMAIL — στα ελληνικά, χωρίς εταιρική φλυαρία.
 *
 * Ο τόνος ακολουθεί το brand: «Είσαι εντάξει». Ήρεμος, καθαρός,
 * χωρίς θαυμαστικά και χωρίς πανικό — ο host έχει ήδη αρκετό.
 */

import { formatCents } from '../takk/calculator'

const BRAND = '#0F766E'
const INK = '#111827'
const MUTED = '#6B7280'

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function safeSubjectText(value: string): string {
  return value.replace(/[\r\n]+/gu, ' ').trim()
}

function shell(body: string): string {
  return `<!doctype html>
<html lang="el"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#FAFAF9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${INK};">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:28px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRAND};margin-bottom:18px;">Εντάξει</div>
    ${body}
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:11px;color:${MUTED};line-height:1.6;">
    Το Εντάξει είναι εργαλείο υπολογισμού και οργάνωσης. Δεν αποτελεί
    φοροτεχνική συμβουλή και δεν υποβάλλει τίποτα στην ΑΑΔΕ για λογαριασμό σου.
  </p>
</body></html>`
}

function grDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MONTHS = [
  'Ιανουάριο', 'Φεβρουάριο', 'Μάρτιο', 'Απρίλιο', 'Μάιο', 'Ιούνιο',
  'Ιούλιο', 'Αύγουστο', 'Σεπτέμβριο', 'Οκτώβριο', 'Νοέμβριο', 'Δεκέμβριο',
]

function grPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS[m! - 1]} ${y}`
}

// ════════════════════════════════════════════════════════════
// 1. Απόδειξη ΤΑΚΚ στον επισκέπτη
// ════════════════════════════════════════════════════════════

export interface GuestReceiptParams {
  guestName: string | null
  propertyName: string
  checkIn: string
  checkOut: string
  nights: number
  totalAmountCents: number
  fullNumber: string
}

export function guestReceiptEmail(p: GuestReceiptParams) {
  const greetingText = p.guestName ? `Αγαπητέ/ή ${p.guestName},` : 'Καλησπέρα,'
  const greetingHtml = p.guestName
    ? `Αγαπητέ/ή ${escapeEmailHtml(p.guestName)},`
    : 'Καλησπέρα,'
  const amount = formatCents(p.totalAmountCents)
  const safePropertyName = escapeEmailHtml(p.propertyName)

  const subject = `Απόδειξη Τέλους Ανθεκτικότητας — ${safeSubjectText(p.propertyName)}`

  const html = shell(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${greetingHtml}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
      Επισυνάπτεται η απόδειξη είσπραξης του Τέλους Ανθεκτικότητας στην
      Κλιματική Κρίση για τη διαμονή σας στο <strong>${safePropertyName}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:${MUTED};">Άφιξη</td><td style="padding:6px 0;text-align:right;">${grDate(p.checkIn)}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Αναχώρηση</td><td style="padding:6px 0;text-align:right;">${grDate(p.checkOut)}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Διανυκτερεύσεις</td><td style="padding:6px 0;text-align:right;">${p.nights}</td></tr>
      <tr><td style="padding:10px 0 0;border-top:1px solid #E5E7EB;font-weight:600;">Σύνολο</td>
          <td style="padding:10px 0 0;border-top:1px solid #E5E7EB;text-align:right;font-weight:700;color:${BRAND};">${amount}</td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.6;">
      Παραστατικό ${p.fullNumber}. Το τέλος επιβάλλεται από το ελληνικό
      κράτος και βαρύνει τον διαμένοντα.
    </p>
  `)

  const text = [
    greetingText,
    '',
    `Επισυνάπτεται η απόδειξη είσπραξης του Τέλους Ανθεκτικότητας στην Κλιματική Κρίση για τη διαμονή σας στο ${p.propertyName}.`,
    '',
    `Άφιξη: ${grDate(p.checkIn)}`,
    `Αναχώρηση: ${grDate(p.checkOut)}`,
    `Διανυκτερεύσεις: ${p.nights}`,
    `Σύνολο: ${amount}`,
    '',
    `Παραστατικό ${p.fullNumber}.`,
    'Το τέλος επιβάλλεται από το ελληνικό κράτος και βαρύνει τον διαμένοντα.',
  ].join('\n')

  return { subject, html, text }
}

// ════════════════════════════════════════════════════════════
// 2. Μηνιαία υπενθύμιση στον host
// ════════════════════════════════════════════════════════════

export interface MonthlyReminderParams {
  hostName: string | null
  period: string
  deadline: string
  documentCount: number
  totalAmountCents: number
  isSecondReminder: boolean
  daysLeft: number
}

export function monthlyReminderEmail(p: MonthlyReminderParams) {
  const greetingText = p.hostName ? `${p.hostName},` : 'Καλησπέρα,'
  const greetingHtml = p.hostName ? `${escapeEmailHtml(p.hostName)},` : 'Καλησπέρα,'
  const amount = formatCents(p.totalAmountCents)
  const periodText = grPeriod(p.period)

  const subject = p.isSecondReminder
    ? `Υπενθύμιση: ${p.daysLeft} μέρες για τη δήλωση ΤΑΚΚ ${periodText}`
    : `ΤΑΚΚ ${periodText} — ${amount} προς απόδοση`

  const urgency = p.isSecondReminder
    ? `<div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:12px 14px;margin-bottom:20px;font-size:14px;">
         <strong>Απομένουν ${p.daysLeft} ημέρες.</strong> Η προθεσμία λήγει ${grDate(p.deadline)}.
       </div>`
    : ''

  const html = shell(`
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${greetingHtml}</p>
    ${urgency}
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
      Για τον <strong>${periodText}</strong> εκδόθηκαν
      <strong>${p.documentCount}</strong> ${p.documentCount === 1 ? 'παραστατικό' : 'παραστατικά'} ΤΑΚΚ.
    </p>
    <div style="background:#F9FAFB;border-radius:8px;padding:18px;text-align:center;margin-bottom:20px;">
      <div style="font-size:12px;color:${MUTED};margin-bottom:4px;">Ποσό προς απόδοση</div>
      <div style="font-size:28px;font-weight:700;color:${BRAND};">${amount}</div>
    </div>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">
      Η δήλωση υποβάλλεται στην ΑΑΔΕ έως <strong>${grDate(p.deadline)}</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">
      Τα παραστατικά είναι έτοιμα στον λογαριασμό σου. Την υποβολή την κάνεις
      εσύ — εμείς κρατάμε τους αριθμούς σωστούς.
    </p>
  `)

  const text = [
    greetingText,
    '',
    p.isSecondReminder ? `ΑΠΟΜΕΝΟΥΝ ${p.daysLeft} ΗΜΕΡΕΣ. Προθεσμία: ${grDate(p.deadline)}` : '',
    '',
    `Για τον ${periodText} εκδόθηκαν ${p.documentCount} παραστατικά ΤΑΚΚ.`,
    `Ποσό προς απόδοση: ${amount}`,
    '',
    `Η δήλωση υποβάλλεται στην ΑΑΔΕ έως ${grDate(p.deadline)}.`,
    'Την υποβολή την κάνεις εσύ — εμείς κρατάμε τους αριθμούς σωστούς.',
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}
