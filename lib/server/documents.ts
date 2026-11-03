import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ApiSession } from '@/lib/api-auth'
import { coachTeamIds, inCoachScope } from '@/lib/server/coach-scope'

// Photos and legal papers for students and for staff accounts. Files live in a
// private storage bucket and are only ever served through /api/documents, which
// applies the rules below on every request.

export const DOCUMENTS_BUCKET = 'documents'
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024 // under the 4.5 MB request cap of serverless hosts
export const MAX_DOCUMENTS_PER_OWNER = 25

export type OwnerType = 'student' | 'user'
export const OWNER_TYPES: readonly OwnerType[] = ['student', 'user']

export type DocType = 'photo' | 'id_card' | 'passport' | 'civil_record' | 'other'
export const DOC_TYPES: readonly DocType[] = ['photo', 'id_card', 'passport', 'civil_record', 'other']

export interface DocumentRow {
  id: string
  owner_type: OwnerType
  owner_id: string
  doc_type: DocType
  label: string
  file_name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  uploaded_by: string | null
  uploaded_at: string
}

export const DOCUMENT_COLUMNS =
  'id, owner_type, owner_id, doc_type, label, file_name, mime_type, size_bytes, storage_path, uploaded_by, uploaded_at'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/** Accepted types → storage extension. The extension comes from here, never from the uploaded filename. */
export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Check the first bytes really match the declared type, so a renamed file can't be stored as an image or PDF. */
export function matchesMagicBytes(mime: string, b: Uint8Array): boolean {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x)
  switch (mime) {
    case 'image/jpeg': return at(0, 0xff, 0xd8, 0xff)
    case 'image/png':  return at(0, 0x89, 0x50, 0x4e, 0x47)
    case 'image/webp': return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)
    case 'image/gif':  return at(0, 0x47, 0x49, 0x46, 0x38)
    case 'application/pdf': return at(0, 0x25, 0x50, 0x44, 0x46)
    default: return false
  }
}

export interface Access { view: boolean; upload: boolean }

/**
 * What a signed-in user may do with an owner's documents.
 *  - admin: everything, for everyone.
 *  - parent / student: their own linked student record only.
 *  - any account: its own staff documents.
 * Coaches get no access to a student's papers (see coachCanSeePhoto for photos).
 */
export function accessFor(session: ApiSession, ownerType: OwnerType, ownerId: string): Access {
  if (session.role === 'admin') return { view: true, upload: true }
  if (ownerType === 'user') {
    const own = ownerId === session.id
    return { view: own, upload: own }
  }
  if ((session.role === 'parent' || session.role === 'student') && session.studentId === ownerId) {
    return { view: true, upload: true }
  }
  return { view: false, upload: false }
}

/** Only an admin or the person who uploaded a file may delete it. */
export function canDelete(session: ApiSession, doc: Pick<DocumentRow, 'uploaded_by'>): boolean {
  return session.role === 'admin' || doc.uploaded_by === session.id
}

/** A coach may see the profile photo (only) of students in their own team / academy. */
export async function coachCanSeePhoto(session: ApiSession, doc: DocumentRow): Promise<boolean> {
  if (session.role !== 'coach' || doc.doc_type !== 'photo' || doc.owner_type !== 'student') return false
  const { data } = await getSupabaseAdmin().from('students').select('team_id, academy').eq('id', doc.owner_id).maybeSingle()
  if (!data) return false
  return inCoachScope(await coachTeamIds(session), session, data)
}

export async function ownerExists(ownerType: OwnerType, ownerId: string): Promise<boolean> {
  const table = ownerType === 'student' ? 'students' : 'app_users'
  const { data } = await getSupabaseAdmin().from(table).select('id').eq('id', ownerId).maybeSingle()
  return !!data
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const { data } = await getSupabaseAdmin().from('person_documents').select(DOCUMENT_COLUMNS).eq('id', id).maybeSingle()
  return (data as DocumentRow | null) ?? null
}

/** Remove a set of documents: storage objects first, then rows. */
export async function removeDocuments(rows: Pick<DocumentRow, 'id' | 'storage_path'>[]): Promise<void> {
  if (rows.length === 0) return
  const db = getSupabaseAdmin()
  await db.storage.from(DOCUMENTS_BUCKET).remove(rows.map(r => r.storage_path))
  await db.from('person_documents').delete().in('id', rows.map(r => r.id))
}

/** Used when a student or account is deleted, so no private files are left behind. */
export async function removeOwnerDocuments(ownerType: OwnerType, ownerId: string): Promise<void> {
  const { data } = await getSupabaseAdmin()
    .from('person_documents').select('id, storage_path').eq('owner_type', ownerType).eq('owner_id', ownerId)
  await removeDocuments((data ?? []) as Pick<DocumentRow, 'id' | 'storage_path'>[])
}

export function photoUrl(id: string): string {
  return `/api/documents/${id}/file`
}
