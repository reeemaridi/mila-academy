// Signed session tokens for the `mila_session` cookie.
//
// Uses Web Crypto rather than node:crypto so the same code runs in proxy.ts
// and in route handlers. Deliberately free of `server-only` for that reason —
// it only ever touches the secret through process.env, which is never inlined
// into client bundles for a non-NEXT_PUBLIC_ name.
//
// The token only proves "the server issued this, for this user, at this
// session version". Whether that user still exists, is enabled and has that
// role is checked against the database on every API request (lib/api-auth.ts).

export const SESSION_COOKIE = 'mila_session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // seconds

export type Role = 'admin' | 'coach' | 'parent' | 'student'

export interface TokenPayload {
  /** app_users.id */
  uid: string
  role: Role
  /** app_users.session_version at the time of issue */
  ver: number
  /** expiry, unix seconds */
  exp: number
}

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * SESSION_SECRET if set; otherwise derived from SUPABASE_SECRET_KEY, which
 * every working install already has — so signing works with no new setup
 * step. Setting SESSION_SECRET explicitly lets sessions be rotated (sign
 * everyone out) without rotating the database key.
 */
function secret(): string | null {
  const explicit = process.env.SESSION_SECRET
  if (explicit && explicit.length >= 32) return explicit
  const db = process.env.SUPABASE_SECRET_KEY
  if (db && !/^sb_secret_x+$/.test(db)) return `mila-session:${db}`
  return null
}

let keyPromise: Promise<CryptoKey> | null = null
let keyFor: string | null = null

function hmacKey(s: string): Promise<CryptoKey> {
  if (keyPromise && keyFor === s) return keyPromise
  keyFor = s
  keyPromise = crypto.subtle.importKey(
    'raw', encoder.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  )
  return keyPromise
}

export async function signSession(payload: TokenPayload): Promise<string> {
  const s = secret()
  if (!s) throw new Error('No session secret: set SESSION_SECRET or SUPABASE_SECRET_KEY in .env.local')
  const body = b64url(encoder.encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(s), encoder.encode(body)))
  return `${body}.${b64url(sig)}`
}

/** The payload if the signature is valid and the token hasn't expired, else null. */
export async function verifySession(token: string | undefined | null): Promise<TokenPayload | null> {
  if (!token) return null
  const s = secret()
  if (!s) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const ok = await crypto.subtle.verify(
      'HMAC', await hmacKey(s), fromB64url(sig) as BufferSource, encoder.encode(body),
    )
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as TokenPayload
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** The signing secret, for other signed tokens (password reset links). Null if unconfigured. */
export function signingSecret(): string | null {
  return secret()
}
