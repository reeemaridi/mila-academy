'use client'
import { useEffect, useSyncExternalStore } from 'react'
import { fetchStudents, fetchTeams } from '../students/api'
import { setRoster } from '../students/data'

// Loads the real teams and students (from the database, already limited to what
// the signed-in user may see) into the shared lists the Attendance, Ratings,
// Payments, Matches and Reports screens read. Those screens used to read a
// fixed list in the code, so teams created on the Teams page never appeared in
// their "Select team" boxes. Calling this hook loads the lists once and makes
// the screen re-render when they arrive, or when reloadRoster() is called.

let version = 0
let started = false
const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }

export async function reloadRoster(): Promise<void> {
  try {
    const [teams, students] = await Promise.all([fetchTeams(), fetchStudents()])
    setRoster(teams.map(t => ({ id: t.id, name: t.name, academy: t.academy })), students)
  } catch {
    // Not allowed (e.g. a parent) or offline: the lists stay as they were.
  }
  version += 1
  listeners.forEach(l => l())
}

/** Starts loading on first use; the returned number changes whenever the lists do. */
export function useRoster(): number {
  useEffect(() => {
    if (started) return
    started = true
    void reloadRoster()
  }, [])
  return useSyncExternalStore(subscribe, () => version, () => 0)
}
