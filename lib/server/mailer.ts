import 'server-only'

// Sends one plain-text email through Resend (https://resend.com, free tier).
// Needs RESEND_API_KEY and MAIL_FROM (e.g. "Mila Academy <no-reply@yourdomain.com>").
// Without them nothing is sent: the message is printed to the server log
// instead, so password reset can still be tried locally.

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM
  if (!apiKey || !from) {
    console.warn(`[mailer] RESEND_API_KEY / MAIL_FROM not set — email NOT sent.\nTo: ${to}\nSubject: ${subject}\n${text}`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    if (!res.ok) {
      console.error('[mailer] Resend rejected the message:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[mailer] send failed:', err instanceof Error ? err.message : err)
    return false
  }
}
