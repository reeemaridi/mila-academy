import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { signingSecret } from '@/lib/session-token'

// Password-reset links are stateless signed tokens, so no reset table is needed.
//
//   token = base64url(JSON {uid, exp, fp}) + "." + base64url(HMAC)
//
// `fp` is a fingerprint of the user's current password hash. Once the password
// changes the fingerprint no longer matches, so a link works exactly once and
// an old link can never undo a later change.

export const RESET_TTL_SECONDS = 60 * 60 // 1 hour

interface ResetPayload { uid: string; exp: number; fp: string }

const b64 = (b: Buffer) => b.toString('base64url')

function key(): string {
  const s = signingSecret()
  if (!s) throw new Error('No session secret: set SESSION_SECRET or SUPABASE_SECRET_KEY in .env.local')
  // Domain-separated from session tokens so one can never be used as the other.
  return `password-reset:${s}`
}

export function fingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 22)
}

export function signResetToken(uid: string, passwordHash: string): string {
  const payload: ResetPayload = {
    uid,
    exp: Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS,
    fp: fingerprint(passwordHash),
  }
  const body = b64(Buffer.from(JSON.stringify(payload)))
  return `${body}.${b64(createHmac('sha256', key()).update(body).digest())}`
}

/** The payload if the signature is valid and the link hasn't expired. */
export function verifyResetToken(token: string): ResetPayload | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = Buffer.from(token.slice(dot + 1), 'base64url')
  const expected = createHmac('sha256', key()).update(body).digest()
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as ResetPayload
    if (typeof p.uid !== 'string' || typeof p.fp !== 'string' || typeof p.exp !== 'number') return null
    if (p.exp < Math.floor(Date.now() / 1000)) return null
    return p
  } catch {
    return null
  }
}
