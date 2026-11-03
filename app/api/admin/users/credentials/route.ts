import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { dbError, unauthorized } from '@/lib/api-fields'
import { hashPassword } from '@/lib/server/passwords'
import { temporaryPassword } from '../validate'

// The sign-in sheet: one row for every coach, parent and student account, plus
// the coaches and students who don't have an account yet.
//
// Passwords are stored one-way, so an existing password can never be read back.
// What the sheet can honestly offer is a fresh temporary password for every
// account whose owner has NOT yet chosen their own (must_change_password), which
// replaces the one that was shown at creation. Accounts whose owner already
// chose a password are listed as such and left untouched.

type Sheet = {
  name: string
  role: string
  email: string
  linked: string
  password: string
  note: string
}

export async function POST() {
  if (!(await isAdminRequest())) return unauthorized()

  const db = getSupabaseAdmin()
  const [usersRes, studentsRes, coachesRes, teamsRes] = await Promise.all([
    db.from('app_users').select('*').in('role', ['coach', 'parent', 'student']).order('role').order('name'),
    db.from('students').select('id, name').is('archived_at', null),
    db.from('coaches').select('name, email, team_ids').is('archived_at', null),
    db.from('teams').select('id, name'),
  ])
  for (const r of [usersRes, studentsRes, coachesRes, teamsRes]) {
    if (r.error) return dbError('credentials.load', r.error)
  }

  const students = new Map((studentsRes.data ?? []).map(s => [s.id as string, s.name as string]))
  const teams = new Map((teamsRes.data ?? []).map(t => [t.id as string, t.name as string]))
  const coachByEmail = new Map((coachesRes.data ?? []).filter(c => c.email).map(c => [String(c.email).toLowerCase(), c]))

  const rows: Sheet[] = []
  const reset: string[] = []

  for (const u of usersRes.data ?? []) {
    let linked = ''
    if (u.role === 'coach') {
      const c = coachByEmail.get(String(u.email).toLowerCase())
      linked = c ? (c.team_ids as string[]).map(id => teams.get(id)).filter(Boolean).join(', ') || 'All teams in their academies' : (u.team_id ? teams.get(u.team_id) ?? '' : 'All teams in their academies')
    } else {
      linked = u.student_id ? students.get(u.student_id) ?? '' : ''
    }

    if (u.must_change_password && !u.disabled) {
      const password = temporaryPassword()
      const { error } = await db.from('app_users').update({
        password_hash: await hashPassword(password),
        session_version: (u.session_version as number) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', u.id)
      if (error) return dbError('credentials.reset', error)
      reset.push(u.id as string)
      rows.push({ name: u.name, role: u.role, email: u.email, linked, password, note: 'Temporary: must be changed at first sign-in' })
    } else {
      rows.push({
        name: u.name, role: u.role, email: u.email, linked,
        password: u.disabled ? '' : '(chosen by the user)',
        note: u.disabled ? 'Account disabled' : 'Already set their own password: use "Forgot password" if they lost it',
      })
    }
  }

  // People with no sign-in yet.
  const haveEmail = new Set((usersRes.data ?? []).map(u => String(u.email).toLowerCase()))
  for (const c of coachesRes.data ?? []) {
    if (!c.email || !haveEmail.has(String(c.email).toLowerCase())) {
      rows.push({ name: c.name, role: 'coach', email: c.email ?? '', linked: (c.team_ids as string[]).map(id => teams.get(id)).filter(Boolean).join(', '), password: '', note: 'No sign-in yet: open the coach and click Create sign-in' })
    }
  }
  const linkedStudents = new Set((usersRes.data ?? []).map(u => u.student_id).filter(Boolean))
  for (const [id, name] of students) {
    if (!linkedStudents.has(id)) {
      rows.push({ name, role: 'student', email: '', linked: name, password: '', note: 'No parent or student sign-in yet: use Add user, or tick "Create a sign-in" when adding' })
    }
  }

  return NextResponse.json({ rows, resetCount: reset.length })
}
