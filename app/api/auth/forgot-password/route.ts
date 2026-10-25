import { NextRequest, NextResponse } from 'next/server'
import { readJson, badRequest } from '@/lib/api-fields'
import { findUserByEmail } from '@/lib/server/users'
import { signResetToken, RESET_TTL_SECONDS } from '@/lib/server/reset-token'
import { sendMail } from '@/lib/server/mailer'

// Always answers the same way, whether or not the email has an account, so the
// form can't be used to find out who is registered. In-memory brake like the
// login route: a speed bump against mail-bombing, not a policy.
const WINDOW_MS = 60 * 60 * 1000
const MAX_REQUESTS = 5
const requests = new Map<string, { count: number; first: number }>()

function tooMany(key: string): boolean {
  const r = requests.get(key)
  if (!r || Date.now() - r.first > WINDOW_MS) { requests.set(key, { count: 1, first: Date.now() }); return false }
  r.count += 1
  return r.count > MAX_REQUESTS
}

const SAME_ANSWER = {
  ok: true,
  message: 'If that email belongs to an account, a reset link has been sent. It is valid for 1 hour.',
}

export async function POST(req: NextRequest) {
  const body = await readJson(req)
  if (!body) return badRequest('Invalid JSON body')

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return badRequest('Email is required')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (tooMany(`e:${email}`) || tooMany(`ip:${ip}`)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  try {
    const user = await findUserByEmail(email)
    if (user && !user.disabled) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || req.nextUrl.origin
      const link = `${origin.replace(/\/$/, '')}/dashboard/reset-password?token=${signResetToken(user.id, user.password_hash)}`
      await sendMail(
        user.email,
        'Reset your Mila Academy password',
        `Hello ${user.name},\n\nUse this link to choose a new password (valid for ${RESET_TTL_SECONDS / 60} minutes, works once):\n\n${link}\n\nIf you didn't ask for this, ignore this email and your password stays the same.`,
      )
    }
  } catch (err) {
    console.error('[auth.forgot]', err instanceof Error ? err.message : err)
  }
  return NextResponse.json(SAME_ANSWER)
}
