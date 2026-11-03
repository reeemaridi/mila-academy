import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { dbError, unauthorized, notFound } from '@/lib/api-fields'
import { DOCUMENTS_BUCKET, accessFor, coachCanSeePhoto, getDocument, isUuid } from '@/lib/server/documents'

// Streams a private file after checking who is asking. The browser sends the
// session cookie with <img> and link requests, so this works for thumbnails
// and "open" links alike; the file is never reachable by a public URL.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  if (!isUuid(id)) return notFound('File not found')
  const doc = await getDocument(id)
  if (!doc) return notFound('File not found')

  const allowed = accessFor(session, doc.owner_type, doc.owner_id).view || (await coachCanSeePhoto(session, doc))
  // Same answer as "missing", so ids can't be probed for existence.
  if (!allowed) return notFound('File not found')

  const { data, error } = await getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).download(doc.storage_path)
  if (error || !data) return dbError('documents.download', error ?? { message: 'empty download' })

  return new NextResponse(data.stream(), {
    headers: {
      'Content-Type': doc.mime_type,
      'Content-Length': String(data.size),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  })
}
