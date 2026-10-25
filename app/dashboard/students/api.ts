// Client-side helpers for the real (Supabase-backed) Students + Teams API.
// Bridges the new DB shape to the existing StudentRow type so the detail
// page's Ratings/Attendance/Payments/Medical tabs keep working unchanged —
// those still run on their own localStorage system pending their own
// migration; only the student *record* itself (name, contact info, team,
// etc.) is real now.
import type { StudentRow } from './data'
import { logout, isAuthPage } from '@/lib/auth'

export interface TeamRow {
  id: string
  name: string
  academy: 'MFA' | 'MBA'
  age_group: string
  coach_id: string | null
}

type ApiStudent = Omit<StudentRow, 'attendance_rate' | 'overall_rating' | 'awards'> & {
  awards: string[] | null
  archived_at: string | null
}

function toStudentRow(s: ApiStudent): StudentRow {
  return {
    ...s,
    awards: s.awards ?? [],
    // Not tracked on the student record itself yet — Ratings/Attendance
    // tabs compute their own demo numbers from these as a seed until
    // those subsystems get their own migration.
    attendance_rate: 0,
    overall_rating: 0,
  }
}

async function json(res: Response) {
  const body = await res.json().catch(() => ({}))
  if (res.status === 401 && typeof window !== 'undefined' && !isAuthPage()) {
    // The stored sign-in is stale (account removed, password changed elsewhere,
    // or the cookie expired): clear it and send the user to sign in again
    // instead of leaving the page on a raw "Unauthorized" error.
    void logout().finally(() => { window.location.href = '/dashboard/login' })
    throw new Error('Your session has ended — sign in again.')
  }
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body
}

/** Active students, or every student including archived ones. */
export async function fetchStudents(includeArchived = false): Promise<StudentRow[]> {
  const { data } = await json(await fetch(`/api/admin/students${includeArchived ? '?includeArchived=1' : ''}`))
  return (data as ApiStudent[]).map(toStudentRow)
}

export async function fetchStudent(id: string): Promise<StudentRow | null> {
  const res = await fetch(`/api/admin/students/${id}`)
  if (res.status === 404) return null
  const { data } = await json(res)
  return toStudentRow(data as ApiStudent)
}

export interface CreatedStudent {
  student: StudentRow
  /** Present when a sign-in was created with the student; shown to the admin once. */
  login?: { email: string; password: string }
}

export async function createStudent(input: Record<string, unknown>): Promise<CreatedStudent> {
  const { data, temporaryPassword } = await json(await fetch('/api/admin/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }))
  const account = input.account as { email?: string } | undefined
  return {
    student: toStudentRow(data as ApiStudent),
    login: temporaryPassword && account?.email
      ? { email: account.email.trim().toLowerCase(), password: temporaryPassword }
      : undefined,
  }
}

export async function updateStudent(id: string, patch: Record<string, unknown>): Promise<StudentRow> {
  const { data } = await json(await fetch(`/api/admin/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }))
  return toStudentRow(data as ApiStudent)
}

/**
 * Archive or restore a student. Archiving is the reversible option and keeps
 * the record (and its history) intact; it just drops out of the default list.
 */
export function archiveStudent(id: string, archived: boolean): Promise<StudentRow> {
  return updateStudent(id, { archived_at: archived ? new Date().toISOString() : null })
}

/** Permanent delete — admin only, and it takes the student's records with it. */
export async function deleteStudent(id: string): Promise<void> {
  await json(await fetch(`/api/admin/students/${id}`, { method: 'DELETE' }))
}

export async function fetchTeams(): Promise<TeamRow[]> {
  const { data } = await json(await fetch('/api/admin/teams'))
  return data as TeamRow[]
}
