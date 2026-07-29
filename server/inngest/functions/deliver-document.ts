/**
 * ΠΑΡΑΔΟΣΗ ΠΑΡΑΣΤΑΤΙΚΟΥ — έκλεινε η μεγαλύτερη τρύπα του συστήματος.
 *
 * Πριν: το `takk/issued` εκπεμπόταν και κανείς δεν το άκουγε.
 * Το παραστατικό υπήρχε στη βάση αλλά PDF δεν παραγόταν ποτέ, δεν
 * αποθηκευόταν πουθενά, και ο επισκέπτης δεν έπαιρνε τίποτα.
 *
 * Τώρα: PDF → R2 → email στον επισκέπτη, με ξεχωριστά βήματα ώστε
 * μια αποτυχία αποστολής να μη χάνει το ήδη αποθηκευμένο PDF.
 */

import { eq } from 'drizzle-orm'
import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { takkIssued } from '../events'
import { useDatabase } from '../../database/client'
import { takkDocuments, properties, stays } from '../../database/schema'
import { formatFullNumber } from '../../utils/takk/numbering'
import { renderTakkReceiptPdf } from '../../utils/pdf/takk-receipt'
import {
  putPdf,
  takkDocumentKey,
  isStorageConfigured,
} from '../../utils/storage'
import { sendEmail, isEmailConfigured } from '../../utils/email/client'
import { guestReceiptEmail } from '../../utils/email/templates'

export const deliverTakkDocument = inngest.createFunction(
  {
    id: 'deliver-takk-document',
    triggers: [takkIssued],
    retries: 4,
    concurrency: { key: 'event.data.documentId', limit: 1 },
  },
  async ({ event, step }) => {
    const db = useDatabase()
    const { documentId } = event.data

    // ── 1. Φόρτωση παραστατικού + συμφραζομένων ──
    const ctx = await step.run('load-document', async () => {
      const [row] = await db
        .select({ doc: takkDocuments, property: properties })
        .from(takkDocuments)
        .innerJoin(properties, eq(takkDocuments.propertyId, properties.id))
        .where(eq(takkDocuments.id, documentId))
        .limit(1)

      if (!row) throw new NonRetriableError(`Δεν βρέθηκε παραστατικό ${documentId}`)

      let cancelsFullNumber: string | undefined
      if (row.doc.cancelsDocumentId) {
        const [original] = await db
          .select({
            series: takkDocuments.series,
            number: takkDocuments.number,
            year: takkDocuments.year,
          })
          .from(takkDocuments)
          .where(eq(takkDocuments.id, row.doc.cancelsDocumentId))
          .limit(1)
        if (!original) {
          throw new NonRetriableError('Το αντιλογιστικό δεν έχει έγκυρο αρχικό παραστατικό')
        }
        cancelsFullNumber = formatFullNumber(
          original.series,
          original.number,
          original.year,
        )
      }

      return { ...row, cancelsFullNumber }
    })

    const { doc, property, cancelsFullNumber } = ctx

    // ── 2. Παραγωγή PDF (αν δεν υπάρχει ήδη) ──
    if (doc.pdfStorageKey) {
      // Ήδη παραδόθηκε — ιδιοδύναμο
      return { status: 'already_delivered', key: doc.pdfStorageKey }
    }

    const pdfBase64 = await step.run('render-pdf', async () => {
      if (
        !doc.rateBreakdown
        || !doc.issuerAddressLine
        || !doc.issuerAddressCity
        || !doc.issuerAddressPostalCode
        || !doc.propertyAddressLine
        || !doc.propertyCity
        || !doc.propertyPostalCode
      ) {
        throw new NonRetriableError(
          'Το παραστατικό δεν έχει πλήρες immutable snapshot για ασφαλή παραγωγή PDF',
        )
      }

      const sign = doc.documentType === 'takk_cancellation' ? -1 : 1
      const breakdown = doc.rateBreakdown.map(night => ({
        ...night,
        rateCents: Math.abs(night.rateCents) * sign,
      }))
      const distinctRates = new Set(breakdown.map(night => night.rateCents))
      const uniformRateCents = distinctRates.size === 1
        ? breakdown[0]?.rateCents ?? null
        : null

      const buf = await renderTakkReceiptPdf({
        series: doc.series,
        number: doc.number,
        year: doc.year,
        // Το `step.run` σειριοποιεί σε JSON — το Date γυρνά ως string
        issuedAt: new Date(doc.issuedAt),
        isCancellation: doc.documentType === 'takk_cancellation',
        cancelsFullNumber,
        cancellationReason: doc.cancellationReason ?? undefined,
        issuerName: doc.issuerName,
        issuerAfm: doc.issuerAfm,
        issuerAddress: `${doc.issuerAddressLine}, ${doc.issuerAddressCity} ${doc.issuerAddressPostalCode}`,
        propertyAma: doc.propertyAma,
        propertyName: doc.propertyName,
        propertyAddress: `${doc.propertyAddressLine}, ${doc.propertyCity} ${doc.propertyPostalCode}`,
        checkIn: doc.checkIn,
        checkOut: doc.checkOut,
        nights: doc.nights,
        guestName: doc.guestName,
        breakdown,
        uniformRateCents,
        totalAmountCents: doc.totalAmountCents,
        remittancePeriod: doc.remittancePeriod,
      })

      // Τα step results πρέπει να είναι serializable — base64
      return buf.toString('base64')
    })

    // ── 3. Αποθήκευση στο R2 ──
    const storageKey = await step.run('store-pdf', async () => {
      if (!isStorageConfigured()) {
        // Σε dev χωρίς R2 δεν μπλοκάρουμε τη ροή
        console.warn('[deliver] R2 δεν είναι ρυθμισμένο — παράλειψη αποθήκευσης')
        return null
      }

      const key = takkDocumentKey({
        userId: property.userId,
        propertyId: property.id,
        year: doc.year,
        series: doc.series,
        number: doc.number,
      })

      await putPdf(key, Buffer.from(pdfBase64, 'base64'))
      return key
    })

    if (storageKey) {
      await step.run('persist-key', async () => {
        await db
          .update(takkDocuments)
          .set({ pdfStorageKey: storageKey })
          .where(eq(takkDocuments.id, doc.id))
      })
    }

    // ── 4. Αποστολή στον επισκέπτη ──
    // Χωριστό βήμα: αν αποτύχει, το PDF έχει ήδη σωθεί.
    const emailed = await step.run('email-guest', async () => {
      if (doc.documentType === 'takk_cancellation') {
        return { sent: false, reason: 'cancellation_not_emailed' }
      }
      if (!isEmailConfigured()) {
        return { sent: false, reason: 'email_not_configured' }
      }

      // Το email του επισκέπτη δεν έρχεται από iCal.
      // Θα γεμίσει από το inbound-email module (reconciliation).
      const [stay] = doc.stayId
        ? await db.select().from(stays).where(eq(stays.id, doc.stayId)).limit(1)
        : [null]

      const guestEmail = (stay?.rawPayload as { guestEmail?: string } | null)
        ?.guestEmail
      if (!guestEmail) {
        return { sent: false, reason: 'no_guest_email' }
      }

      const tpl = guestReceiptEmail({
        guestName: doc.guestName,
        propertyName: doc.propertyName,
        checkIn: doc.checkIn,
        checkOut: doc.checkOut,
        nights: doc.nights,
        totalAmountCents: doc.totalAmountCents,
        fullNumber: formatFullNumber(doc.series, doc.number, doc.year),
      })

      await sendEmail({
        to: guestEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        attachments: [
          {
            filename: `TAKK-${formatFullNumber(doc.series, doc.number, doc.year)}.pdf`,
            content: pdfBase64,
          },
        ],
      })

      await db
        .update(takkDocuments)
        .set({ sentToGuestAt: new Date() })
        .where(eq(takkDocuments.id, doc.id))

      // Ίδιο σχήμα και στα δύο μονοπάτια — αλλιώς το union κρύβει το `reason`
      return { sent: true, reason: null }
    })

    return {
      status: 'delivered',
      storageKey,
      emailed: emailed.sent,
      emailSkipReason: emailed.reason,
    }
  },
)
