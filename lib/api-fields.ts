import 'server-only'
import { NextResponse } from 'next/server'

/**
 * Column whitelists for the admin write endpoints.
 *
 * These routes used to pass the parsed request body straight into
 * `.insert()` / `.update()`. Because the server client uses the Supabase secret
 * key and bypasses RLS, that let any authenticated caller set columns the UI
 * never exposes — `id`, `created_at`, or a student's `payment_status` and
 * `archived_at` — simply by adding them to the JSON.
 */

export const STUDENT_FIELDS = [
  'name', 'photo_url', 'dob', 'nationality', 'position', 'jersey_number',
  'team_id', 'academy', 'blood_type', 'allergies', 'injuries', 'doctor_contact', 'insured',
  'parent_name', 'parent_phone', 'parent_whatsapp', 'emergency_contact',
  'payment_type', 'payment_status', 'payment_amount', 'payment_due_date',
  'notes', 'awards', 'archived_at',
] as const

export const COACH_FIELDS = [
  'name', 'session_name', 'photo_url', 'specialty', 'team_ids', 'experience',
  'bio', 'phone', 'email', 'nationality', 'certifications', 'languages',
  'joined', 'salary', 'contract_end', 'archived_at',
] as const

export const TEAM_FIELDS = ['name', 'academy', 'age_group', 'coach_id'] as const

/** Copy across only the named columns, dropping anything else the client sent. */
export function pick<T extends string>(
  body: unknown,
  allowed: readonly T[],
): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) return {}
  const src = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (Object.hasOwn(src, key)) out[key] = src[key]
  }
  return out
}

/** Parse a JSON body, or null if it's malformed — an unparseable body used to
 *  throw and surface as an unhandled 500. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Log the real Postgres error server-side and return a generic message.
 * Supabase error text names columns and constraints, which handed a caller a
 * map of the schema.
 */
export function dbError(context: string, error: { message: string }, status = 500) {
  console.error(`[api:${context}]`, error.message)
  return NextResponse.json({ error: 'Something went wrong' }, { status })
}

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 })

export const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

export const notFound = (what = 'Not found') =>
  NextResponse.json({ error: what }, { status: 404 })
