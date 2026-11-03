'use client'
import { useEffect, useSyncExternalStore } from 'react'
import { api } from '../components/admin-ui'

// Shared coach data, read from and written to the real `coaches` table via
// /api/admin/coaches.
//
// This module used to hold a hardcoded BASE_COACHES list plus a localStorage
// copy of anything staff added, so the seeded database rows were invisible and
// "Add Coach" never reached the database. Everything now goes through the API;
// the store exists so the Coaches page and the sidebar's global search share
// one fetch and see the same list after an edit.

/** A `coaches` row as the admin API returns it. */
export interface CoachRow {
  id: string
  name: string
  session_name: string  // short form used on attendance records, e.g. 'Coach Nader'
  photo_url: string | null
  specialty: string
  team_ids: string[]
  experience: number
  bio: string
  phone: string
  email: string
  nationality: string
  certifications: string[]
  languages: string[]
  joined: string | null
  salary: string
  contract_end: string | null
  archived_at: string | null
  created_at?: string
  /** administrators only: an account with this coach's email exists */
  has_login?: boolean
}

/** The columns POST and PATCH accept — see COACH_FIELDS in lib/api-fields.ts. */
export type CoachInput = Partial<Omit<CoachRow, 'id' | 'created_at'>>

const EMPTY: CoachRow[] = []

let coaches: CoachRow[] = EMPTY
let loading = true
let error = ''
let started = false

const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** Refetch the list and notify every subscriber. */
export async function reloadCoaches(): Promise<void> {
  loading = true
  error = ''
  emit()
  try {
    const { data } = await api<{ data: CoachRow[] }>('/api/admin/coaches')
    coaches = data ?? EMPTY
  } catch (e) {
    // Parents and students get 401 from this endpoint, which is correct — the
    // sidebar search simply has no coaches in it for them.
    coaches = EMPTY
    error = e instanceof Error ? e.message : 'Could not load coaches'
  } finally {
    loading = false
    emit()
  }
}

function ensureLoaded(): void {
  if (started) return
  started = true
  void reloadCoaches()
}

/**
 * The coach list, its loading flag and last error, kept in sync across every
 * component that asks. The array reference only changes on a fetch and the
 * other two are primitives, so useSyncExternalStore doesn't loop.
 */
export function useCoaches(): {
  coaches: CoachRow[]
  loading: boolean
  error: string
  reload: () => Promise<void>
} {
  useEffect(ensureLoaded, [])
  return {
    coaches: useSyncExternalStore(subscribe, () => coaches, () => EMPTY),
    loading: useSyncExternalStore(subscribe, () => loading, () => true),
    error:   useSyncExternalStore(subscribe, () => error,   () => ''),
    reload:  reloadCoaches,
  }
}

/** Just the list — what the sidebar's global search needs. */
export function useAllCoaches(): CoachRow[] {
  return useCoaches().coaches
}

// ── Mutations ─────────────────────────────────────────────────────────────────
// Admin-only; the API enforces that regardless of what the UI shows.

/** Sign-in details shown to the admin once, to pass on to the coach. */
export interface NewLogin { email: string; password: string }

/** Creates the coach together with their sign-in (the email is required). */
export async function createCoach(input: CoachInput): Promise<{ coach: CoachRow; login: NewLogin }> {
  const res = await api<{ data: CoachRow; temporaryPassword: string }>('/api/admin/coaches', { method: 'POST', json: input })
  await reloadCoaches()
  return { coach: res.data, login: { email: (input.email ?? '').trim().toLowerCase(), password: res.temporaryPassword } }
}

/** Gives an existing coach profile a sign-in. */
export async function createLoginForCoach(id: string, email?: string): Promise<NewLogin> {
  const res = await api<{ user: { email: string }; temporaryPassword: string }>(`/api/admin/coaches/${id}/login`, { method: 'POST', json: email ? { email } : {} })
  await reloadCoaches()
  return { email: res.user.email, password: res.temporaryPassword }
}

export async function updateCoach(id: string, patch: CoachInput): Promise<CoachRow> {
  const { data } = await api<{ data: CoachRow }>(`/api/admin/coaches/${id}`, { method: 'PATCH', json: patch })
  await reloadCoaches()
  return data
}

export async function deleteCoach(id: string): Promise<void> {
  await api(`/api/admin/coaches/${id}`, { method: 'DELETE' })
  await reloadCoaches()
}
