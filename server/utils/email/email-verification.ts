import { sendEmail } from './client'

const VERIFICATION_LINK_TTL_MINUTES = 60

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function buildEmailVerificationEmail(url: string): {
  subject: string
  html: string
  text: string
} {
  const safeUrl = escapeHtml(url)

  return {
    subject: 'Επιβεβαίωσε το email σου — Endaxi',
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1a1a18;line-height:1.6">
        <h1 style="font-size:24px;margin:0 0 16px">Επιβεβαίωσε το email σου</h1>
        <p>Καλώς ήρθες στο Endaxi. Επιβεβαίωσε ότι αυτή η διεύθυνση email σου ανήκει.</p>
        <p style="margin:28px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">
            Επιβεβαίωση email
          </a>
        </p>
        <p>Ο σύνδεσμος ισχύει για ${VERIFICATION_LINK_TTL_MINUTES} λεπτά και χρησιμοποιείται μία φορά.</p>
        <p style="color:#57534e;font-size:14px">
          Αν δεν δημιούργησες λογαριασμό στο Endaxi, αγνόησε αυτό το email.
        </p>
      </div>
    `.trim(),
    text: [
      'Επιβεβαίωσε το email σου — Endaxi',
      '',
      'Καλώς ήρθες στο Endaxi. Επιβεβαίωσε ότι αυτή η διεύθυνση email σου ανήκει.',
      `Επιβεβαίωση email: ${url}`,
      '',
      `Ο σύνδεσμος ισχύει για ${VERIFICATION_LINK_TTL_MINUTES} λεπτά και χρησιμοποιείται μία φορά.`,
      'Αν δεν δημιούργησες λογαριασμό στο Endaxi, αγνόησε αυτό το email.',
    ].join('\n'),
  }
}

export async function sendEmailVerificationEmail(to: string, url: string): Promise<void> {
  await sendEmail({
    to,
    ...buildEmailVerificationEmail(url),
  })
}
