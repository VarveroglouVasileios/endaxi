import { sendEmail } from './client'

const RESET_LINK_TTL_MINUTES = 60

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function buildPasswordResetEmail(url: string): {
  subject: string
  html: string
  text: string
} {
  const safeUrl = escapeHtml(url)

  return {
    subject: 'Επαναφορά κωδικού — Εντάξει',
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1a1a18;line-height:1.6">
        <h1 style="font-size:24px;margin:0 0 16px">Επαναφορά κωδικού</h1>
        <p>Λάβαμε αίτημα για αλλαγή του κωδικού πρόσβασης στον λογαριασμό σου.</p>
        <p style="margin:28px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">
            Όρισε νέο κωδικό
          </a>
        </p>
        <p>Ο σύνδεσμος ισχύει για ${RESET_LINK_TTL_MINUTES} λεπτά και χρησιμοποιείται μία φορά.</p>
        <p style="color:#57534e;font-size:14px">
          Αν δεν ζήτησες επαναφορά, αγνόησε αυτό το email. Ο κωδικός σου δεν αλλάζει.
        </p>
      </div>
    `.trim(),
    text: [
      'Επαναφορά κωδικού — Εντάξει',
      '',
      'Λάβαμε αίτημα για αλλαγή του κωδικού πρόσβασης στον λογαριασμό σου.',
      `Όρισε νέο κωδικό: ${url}`,
      '',
      `Ο σύνδεσμος ισχύει για ${RESET_LINK_TTL_MINUTES} λεπτά και χρησιμοποιείται μία φορά.`,
      'Αν δεν ζήτησες επαναφορά, αγνόησε αυτό το email. Ο κωδικός σου δεν αλλάζει.',
    ].join('\n'),
  }
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  await sendEmail({
    to,
    ...buildPasswordResetEmail(url),
  })
}
