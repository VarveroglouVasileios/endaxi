/**
 * EMAIL — Resend
 *
 * Τέσσερις ροές:
 *  1. Απόδειξη ΤΑΚΚ στον επισκέπτη (με το PDF συνημμένο)
 *  2. Μηνιαία υπενθύμιση προθεσμίας στον host
 *  3. Σύνδεσμος επαναφοράς κωδικού στον χρήστη
 *  4. Σύνδεσμος επιβεβαίωσης email κατά την εγγραφή
 *
 * ⚠️ Ποτέ δεν στέλνουμε τίποτα στην ΑΑΔΕ. Υπενθυμίζουμε στον χρήστη
 *    να υποβάλει· δεν υποβάλλουμε εμείς.
 */

export class EmailError extends Error {
  // `cause` υπάρχει ήδη στο Error (ES2022) — χρησιμοποιούμε το native option
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'EmailError'
  }
}

export interface Attachment {
  filename: string
  /** base64 */
  content: string
}

export interface SendParams {
  to: string
  subject: string
  html: string
  text: string
  attachments?: Attachment[]
  replyTo?: string
}

const FROM = process.env.EMAIL_FROM ?? 'Endaxi <noreply@endaxi.app>'

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function sendEmail(params: SendParams): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new EmailError('Λείπει το RESEND_API_KEY')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
      attachments: params.attachments,
    }),
  })

  if (!res.ok) {
    throw new EmailError(
      `Αποτυχία αποστολής (${res.status}): ${await res.text().catch(() => '')}`,
    )
  }

  return (await res.json()) as { id: string }
}
