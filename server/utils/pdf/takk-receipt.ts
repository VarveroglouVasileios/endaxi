/**
 * ΕΙΔΙΚΟ ΣΤΟΙΧΕΙΟ — ΑΠΟΔΕΙΞΗ ΕΙΣΠΡΑΞΗΣ
 * ΤΕΛΟΥΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ ΣΤΗΝ ΚΛΙΜΑΤΙΚΗ ΚΡΙΣΗ
 *
 * Ντετερμινιστική παραγωγή PDF με pdfmake — χωρίς Chromium.
 * Το layout είναι σταθερό· δεν θέλουμε browser rendering.
 *
 * ⚠️ ΠΡΙΝ ΤΗΝ ΠΑΡΑΓΩΓΗ: επαλήθευσε τα υποχρεωτικά πεδία και τη
 *    μορφή του εντύπου με φοροτεχνικό, βάσει Α.1202/2024.
 *    Το παρακάτω είναι εύλογη βάση, όχι επικυρωμένο έντυπο.
 */

import { resolve, join } from 'node:path'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces'
import { formatCents, type NightBreakdown } from '../takk/calculator'
import { formatFullNumber } from '../takk/numbering'

declare const useStorage: (base?: string) => {
  getItemRaw: (key: string) => Promise<unknown>
}

/**
 * ΒΡΕΘΗΚΕ ΜΕ ΠΡΑΓΜΑΤΙΚΟ Inngest end-to-end test (όχι tsx script bypass):
 * το παλιό `fontPath()` υπολόγιζε το path των γραμματοσειρών σχετικά με
 * το `import.meta.url` ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΑΡΧΕΙΟΥ. Αυτό δουλεύει όταν τρέχεις
 * το αρχείο απευθείας (π.χ. tsx), αλλά το Nitro **bundlάρει** όλο τον
 * server κώδικα σε ΕΝΑ αρχείο (`.nuxt/dev/index.mjs` σε dev,
 * `.output/server/**` σε production) — οπότε το `import.meta.url` πλέον
 * δείχνει στο bundle, όχι στο αρχικό `server/utils/pdf/takk-receipt.ts`,
 * και το σχετικό `../../assets/fonts` κατέληγε σε ΛΑΘΟΣ φάκελο
 * (`assets/fonts` αντί για `server/assets/fonts`) → ENOENT σε ΚΑΘΕ
 * πραγματική εκτέλεση μέσα από τον πραγματικό server (dev ή production),
 * παρόλο που δούλευε «τέλεια» όταν το έτρεχα ως αυτόνομο script.
 *
 * Λύση: οι γραμματοσειρές διαβάζονται μέσω του Nitro `useStorage`
 * (mount `assets:server` → `server/assets/**`, built-in convention, ΔΕΝ
 * σπάει με bundling) και γράφονται μία φορά σε πραγματικό tmp directory
 * — γιατί το pdfmake 0.3.x's API θέλει πραγματικά filesystem paths, όχι
 * buffers, λόγω του `setLocalAccessPolicy`.
 */
let fontDirReady: Promise<string> | null = null

const FONT_FILES = [
  'NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf',
  'NotoSans-Italic.ttf',
  'NotoSans-BoldItalic.ttf',
] as const

async function ensureFontsOnDisk(): Promise<string> {
  if (fontDirReady) return fontDirReady

  fontDirReady = (async () => {
    const dir = await mkdtemp(join(tmpdir(), 'endaxi-fonts-'))
    const storage = typeof useStorage === 'function' ? useStorage('assets:server') : null

    for (const file of FONT_FILES) {
      const bytes = storage
        ? await storage.getItemRaw(`fonts/${file}`)
        : await readFile(resolve(process.cwd(), 'server/assets/fonts', file))
      if (!bytes) {
        throw new Error(
          `Λείπει γραμματοσειρά '${file}' από server/assets/fonts/ — δεν μπορεί να παραχθεί PDF.`,
        )
      }
      await writeFile(join(dir, file), bytes as Uint8Array)
    }

    return dir
  })()

  return fontDirReady
}


export interface TakkReceiptData {
  // Ταυτότητα παραστατικού
  series: string
  number: number
  year: number
  issuedAt: Date
  isCancellation: boolean
  cancelsFullNumber?: string
  cancellationReason?: string

  // Εκδότης
  issuerName: string | null
  issuerAfm: string | null
  issuerAddress?: string | null

  // Ακίνητο
  propertyAma: string
  propertyName: string
  propertyAddress?: string | null

  // Διαμονή
  checkIn: string
  checkOut: string
  nights: number
  guestName: string | null

  // Ποσά
  breakdown: NightBreakdown[]
  uniformRateCents: number | null
  totalAmountCents: number
  remittancePeriod: string
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
function grDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Πλήρης ημερομηνία & ώρα — σε νομικό έγγραφο ποτέ διψήφιο έτος. */
function grDateTime(d: Date): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Athens',
  }).format(d)
}

const GR_MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

/** 'YYYY-MM' → 'Ιούλιος 2026' */
function grPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${GR_MONTHS[m! - 1]} ${y}`
}

const COLORS = {
  ink: '#111827',
  muted: '#6B7280',
  line: '#E5E7EB',
  accent: '#0F766E',
  danger: '#B91C1C',
}

export function buildTakkReceiptDefinition(data: TakkReceiptData): TDocumentDefinitions {
  const fullNumber = formatFullNumber(data.series, data.number, data.year)

  const title = data.isCancellation
    ? 'ΑΚΥΡΩΤΙΚΟ ΕΙΔΙΚΟ ΣΤΟΙΧΕΙΟ'
    : 'ΕΙΔΙΚΟ ΣΤΟΙΧΕΙΟ — ΑΠΟΔΕΙΞΗ ΕΙΣΠΡΑΞΗΣ'

  const content: Content[] = [
    // ── Κεφαλίδα ──
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: title, style: 'title', color: data.isCancellation ? COLORS.danger : COLORS.ink },
            {
              text: 'ΤΕΛΟΥΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ ΣΤΗΝ ΚΛΙΜΑΤΙΚΗ ΚΡΙΣΗ',
              style: 'subtitle',
            },
          ],
        },
        {
          width: 'auto',
          stack: [
            { text: 'ΑΡΙΘΜΟΣ', style: 'label', alignment: 'right' },
            { text: fullNumber, style: 'docNumber', alignment: 'right' },
            {
              text: `Σειρά ${data.series} · Α/Α ${data.number}`,
              style: 'small',
              alignment: 'right',
            },
          ],
        },
      ],
      margin: [0, 0, 0, 6],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: COLORS.accent }] },
    { text: '', margin: [0, 8, 0, 0] },
  ]

  if (data.isCancellation) {
    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: `Ακυρώνει το παραστατικό ${data.cancelsFullNumber ?? '—'}`,
                  style: 'bold',
                  color: COLORS.danger,
                },
                data.cancellationReason
                  ? { text: `Αιτιολογία: ${data.cancellationReason}`, style: 'small' }
                  : { text: '' },
              ],
              margin: [8, 6, 8, 6],
            },
          ],
        ],
      },
      layout: {
        hLineColor: () => COLORS.danger,
        vLineColor: () => COLORS.danger,
        hLineWidth: () => 1,
        vLineWidth: () => 1,
      },
      margin: [0, 0, 0, 12],
    })
  }

  // ── Εκδότης & Ακίνητο ──
  content.push({
    columns: [
      {
        width: '50%',
        stack: [
          { text: 'ΕΚΔΟΤΗΣ', style: 'label' },
          { text: data.issuerName ?? '—', style: 'value' },
          { text: data.issuerAfm ? `ΑΦΜ: ${data.issuerAfm}` : 'ΑΦΜ: —', style: 'small' },
          data.issuerAddress
            ? { text: data.issuerAddress, style: 'small' }
            : { text: '' },
        ],
      },
      {
        width: '50%',
        stack: [
          { text: 'ΚΑΤΑΛΥΜΑ', style: 'label' },
          { text: data.propertyName, style: 'value' },
          { text: `Α.Μ.Α.: ${data.propertyAma}`, style: 'small' },
          data.propertyAddress
            ? { text: data.propertyAddress, style: 'small' }
            : { text: '' },
        ],
      },
    ],
    margin: [0, 0, 0, 14],
  })

  // ── Στοιχεία διαμονής ──
  content.push({
    table: {
      widths: ['*', '*', 'auto', '*'],
      body: [
        [
          { text: 'ΑΦΙΞΗ', style: 'th' },
          { text: 'ΑΝΑΧΩΡΗΣΗ', style: 'th' },
          { text: 'ΔΙΑΝΥΚΤΕΡΕΥΣΕΙΣ', style: 'th', alignment: 'center' },
          { text: 'ΔΙΑΜΕΝΩΝ', style: 'th' },
        ],
        [
          { text: grDate(data.checkIn), style: 'td' },
          { text: grDate(data.checkOut), style: 'td' },
          { text: String(data.nights), style: 'td', alignment: 'center' },
          { text: data.guestName ?? '—', style: 'td' },
        ],
      ],
    },
    layout: tableLayout(),
    margin: [0, 0, 0, 14],
  })

  // ── Ανάλυση ──
  if (data.uniformRateCents !== null) {
    // Ενιαίος συντελεστής — απλή γραμμή
    content.push({
      table: {
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'ΠΕΡΙΓΡΑΦΗ', style: 'th' },
            { text: 'ΠΟΣΟΤΗΤΑ', style: 'th', alignment: 'center' },
            { text: 'ΤΙΜΗ/ΔΙΑΝ.', style: 'th', alignment: 'right' },
            { text: 'ΣΥΝΟΛΟ', style: 'th', alignment: 'right' },
          ],
          [
            { text: 'Τέλος ανθεκτικότητας στην κλιματική κρίση', style: 'td' },
            { text: String(data.nights), style: 'td', alignment: 'center' },
            { text: formatCents(data.uniformRateCents), style: 'td', alignment: 'right' },
            { text: formatCents(data.totalAmountCents), style: 'td', alignment: 'right' },
          ],
        ],
      },
      layout: tableLayout(),
      margin: [0, 0, 0, 10],
    })
  } else {
    // Διασχίζει εποχές — υποχρεωτική αναλυτική παράθεση ανά νύχτα
    content.push({
      text: 'Ανάλυση ανά διανυκτέρευση (η διαμονή καλύπτει περισσότερες της μίας περιόδους)',
      style: 'small',
      margin: [0, 0, 0, 4],
    })
    /**
     * Ο τύπος δηλώνεται ρητά: μέσα σε `.map()` δεν υπάρχει contextual typing,
     * οπότε το `alignment: 'right'` θα πλάταινε σε `string` και το pdfmake
     * θα το απέρριπτε (περιμένει `'left' | 'right' | 'center' | 'justify'`).
     */
    const breakdownRows: Content[][] = data.breakdown.map((b) => [
      { text: grDate(b.date), style: 'td' },
      {
        text: b.season === 'high' ? 'Θερινή' : 'Χειμερινή',
        style: 'td',
        alignment: 'center',
      },
      { text: formatCents(b.rateCents), style: 'td', alignment: 'right' },
    ])

    const breakdownTable: Content = {
      table: {
        widths: ['*', 'auto', 'auto'],
        body: [
          [
            { text: 'ΔΙΑΝΥΚΤΕΡΕΥΣΗ', style: 'th' },
            { text: 'ΠΕΡΙΟΔΟΣ', style: 'th', alignment: 'center' },
            { text: 'ΠΟΣΟ', style: 'th', alignment: 'right' },
          ],
          ...breakdownRows,
        ],
      },
      layout: tableLayout(),
      margin: [0, 0, 0, 10],
    }
    content.push(breakdownTable)
  }

  // ── Σύνολο ──
  content.push({
    columns: [
      { width: '*', text: '' },
      {
        width: 'auto',
        table: {
          widths: ['auto', 'auto'],
          body: [
            [
              { text: 'ΣΥΝΟΛΟ ΕΙΣΠΡΑΧΘΕΝΤΟΣ ΤΕΛΟΥΣ', style: 'totalLabel' },
              {
                text: formatCents(data.totalAmountCents),
                style: 'totalValue',
                alignment: 'right',
              },
            ],
          ],
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 ? 1.5 : 0),
          vLineWidth: () => 0,
          hLineColor: () => COLORS.accent,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 8,
          paddingRight: () => 4,
        },
      },
    ],
    margin: [0, 0, 0, 16],
  })

  // ── Υποσέλιδο ──
  content.push({
    stack: [
      {
        text: `Το τέλος βαρύνει τον διαμένοντα. Περίοδος απόδοσης: ${grPeriod(data.remittancePeriod)}`,
        style: 'small',
      },
      { text: `Ημερομηνία έκδοσης: ${grDateTime(data.issuedAt)}`, style: 'small' },
      {
        text: 'Το παραστατικό εκδόθηκε ηλεκτρονικά μέσω Εντάξει (endaxi.app) και δεν απαιτεί υπογραφή.',
        style: 'muted',
        margin: [0, 6, 0, 0],
      },
    ],
  })

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    info: {
      title: `${title} ${fullNumber}`,
      author: data.issuerName ?? 'Εντάξει',
      subject: 'Τέλος Ανθεκτικότητας στην Κλιματική Κρίση',
    },
    content,
    styles: {
      title: { fontSize: 14, bold: true, color: COLORS.ink },
      subtitle: { fontSize: 9, color: COLORS.muted, margin: [0, 2, 0, 0] },
      docNumber: { fontSize: 13, bold: true, color: COLORS.accent },
      label: { fontSize: 7, bold: true, color: COLORS.muted, margin: [0, 0, 0, 2] },
      value: { fontSize: 10, bold: true, color: COLORS.ink },
      th: { fontSize: 7, bold: true, color: COLORS.muted, margin: [0, 4, 0, 4] },
      td: { fontSize: 9.5, color: COLORS.ink, margin: [0, 4, 0, 4] },
      small: { fontSize: 8, color: COLORS.muted },
      muted: { fontSize: 7, color: COLORS.muted, italics: true },
      bold: { fontSize: 9.5, bold: true },
      totalLabel: { fontSize: 9, bold: true, color: COLORS.muted },
      totalValue: { fontSize: 14, bold: true, color: COLORS.accent },
    },
    defaultStyle: {
      font: 'NotoSans',
      fontSize: 9.5,
      color: COLORS.ink,
    },
  }
}

function tableLayout() {
  return {
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
      i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.3,
    vLineWidth: () => 0,
    hLineColor: (i: number) => (i <= 1 ? COLORS.line : '#F3F4F6'),
    paddingLeft: () => 4,
    paddingRight: () => 4,
  }
}

/**
 * Παράγει το PDF ως Buffer.
 *
 * ΓΡΑΜΜΑΤΟΣΕΙΡΑ: απαιτείται Noto Sans (ή άλλη με πλήρη ελληνική
 * κάλυψη). Οι default fonts του pdfmake (Roboto) καλύπτουν ελληνικά
 * μερικώς — μη βασιστείς σε αυτό.
 * Βάλε τα .ttf στο server/assets/fonts/.
 */
/**
 * pdfmake 0.3.x — singleton API.
 * Το setup τρέχει μία φορά· τα access policies είναι σημαντικά για
 * ασφάλεια: κλειδώνουν το τι μπορεί να διαβάσει ένα document definition.
 */
let pdfmakeReady: Promise<PdfMakeInstance> | null = null

interface PdfMakeInstance {
  setFonts(fonts: Record<string, Record<string, string>>): void
  setLocalAccessPolicy(cb: (path: string) => boolean): void
  setUrlAccessPolicy(cb: (url: string) => boolean): void
  createPdf(dd: TDocumentDefinitions): { getBuffer(): Promise<Uint8Array> }
}

async function getPdfMake(): Promise<PdfMakeInstance> {
  if (pdfmakeReady) return pdfmakeReady

  pdfmakeReady = (async () => {
    const mod = await import('pdfmake')
    const pdfmake = ((mod as unknown as { default?: PdfMakeInstance }).default ??
      mod) as PdfMakeInstance

    const fontDir = await ensureFontsOnDisk()

    pdfmake.setFonts({
      NotoSans: {
        normal: join(fontDir, 'NotoSans-Regular.ttf'),
        bold: join(fontDir, 'NotoSans-Bold.ttf'),
        italics: join(fontDir, 'NotoSans-Italic.ttf'),
        bolditalics: join(fontDir, 'NotoSans-BoldItalic.ttf'),
      },
    })

    // Ασφάλεια: μόνο ο (πραγματικός, tmp) φάκελος γραμματοσειρών είναι αναγνώσιμος.
    pdfmake.setLocalAccessPolicy((p) => resolve(p).startsWith(fontDir))

    // Δεν ενσωματώνουμε ποτέ απομακρυσμένους πόρους σε παραστατικό.
    pdfmake.setUrlAccessPolicy(() => false)

    return pdfmake
  })()

  return pdfmakeReady
}

export async function renderTakkReceiptPdf(data: TakkReceiptData): Promise<Buffer> {
  const pdfmake = await getPdfMake()
  const out = pdfmake.createPdf(buildTakkReceiptDefinition(data))
  return Buffer.from(await out.getBuffer())
}
