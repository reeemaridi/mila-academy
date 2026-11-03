import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { unauthorized, notFound } from '@/lib/api-fields'
import { accessFor, canDelete, getDocument, isUuid, photoUrl, removeDocuments } from '@/lib/server/documents'

// An admin can delete any file; anyone else only a file they uploaded
// themselves, and only on a record they can see.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  if (!isUuid(id)) return notFound('File not found')
  const doc = await getDocument(id)
  if (!doc || !accessFor(session, doc.owner_type, doc.owner_id).view) return notFound('File not found')
  if (!canDelete(session, doc)) return NextResponse.json({ error: 'Only an administrator can delete this file' }, { status: 403 })

  await removeDocuments([doc])
  if (doc.doc_type === 'photo' && doc.owner_type === 'student') {
    await getSupabaseAdmin().from('students').update({ photo_url: null }).eq('id', doc.owner_id).eq('photo_url', photoUrl(doc.id))
  }
  return NextResponse.json({ ok: true })
}
