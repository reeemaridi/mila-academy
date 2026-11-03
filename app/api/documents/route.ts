import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { dbError, badRequest, unauthorized } from '@/lib/api-fields'
import {
  DOCUMENTS_BUCKET, DOCUMENT_COLUMNS, DOC_TYPES, EXT_BY_MIME, MAX_DOCUMENT_BYTES, MAX_DOCUMENTS_PER_OWNER,
  OWNER_TYPES, accessFor, isUuid, matchesMagicBytes, ownerExists, photoUrl, removeDocuments,
  type DocType, type DocumentRow, type OwnerType,
} from '@/lib/server/documents'

const forbidden = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 })

// GET /api/documents?ownerType=student|user&ownerId=<uuid>
// Metadata only; the files themselves come from /api/documents/<id>/file.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const ownerType = req.nextUrl.searchParams.get('ownerType') as OwnerType | null
  const ownerId = req.nextUrl.searchParams.get('ownerId')
  if (!ownerType || !OWNER_TYPES.includes(ownerType) || !isUuid(ownerId)) return badRequest('ownerType and ownerId are required')
  if (!accessFor(session, ownerType, ownerId).view) return forbidden()

  const { data, error } = await getSupabaseAdmin()
    .from('person_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('uploaded_at', { ascending: false })
  if (error) return dbError('documents.list', error)

  // The storage path is internal; never send it to the browser.
  const rows = (data as DocumentRow[]).map(({ storage_path: _path, ...rest }) => rest)
  return NextResponse.json({ data: rows })
}

// POST multipart/form-data: file, ownerType, ownerId, docType, label?
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('Expected multipart/form-data')
  }

  const file = form.get('file')
  const ownerType = form.get('ownerType') as OwnerType | null
  const ownerId = form.get('ownerId')
  const docType = form.get('docType') as DocType | null
  const label = String(form.get('label') ?? '').trim().slice(0, 100)

  if (!(file instanceof File)) return badRequest('Choose a file to upload')
  if (!ownerType || !OWNER_TYPES.includes(ownerType) || !isUuid(ownerId)) return badRequest('ownerType and ownerId are required')
  if (!docType || !DOC_TYPES.includes(docType)) return badRequest(`Document type must be one of: ${DOC_TYPES.join(', ')}`)
  if (!accessFor(session, ownerType, ownerId).upload) return forbidden()

  const ext = EXT_BY_MIME[file.type]
  if (!ext) return badRequest('Only JPG, PNG, WebP or PDF files are accepted')
  if (docType === 'photo' && file.type === 'application/pdf') return badRequest('A photo must be an image (JPG, PNG or WebP)')
  if (file.size === 0) return badRequest('That file is empty')
  if (file.size > MAX_DOCUMENT_BYTES) return badRequest(`File too large (max ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB)`)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!matchesMagicBytes(file.type, bytes)) return badRequest('The file contents do not match its type')

  if (!(await ownerExists(ownerType, ownerId))) return badRequest('That record does not exist')

  const db = getSupabaseAdmin()
  const { count } = await db
    .from('person_documents').select('id', { count: 'exact', head: true }).eq('owner_type', ownerType).eq('owner_id', ownerId)
  if ((count ?? 0) >= MAX_DOCUMENTS_PER_OWNER) return badRequest(`At most ${MAX_DOCUMENTS_PER_OWNER} files per person. Delete one first.`)

  const path = `${ownerType}/${ownerId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await db.storage.from(DOCUMENTS_BUCKET).upload(path, bytes, { contentType: file.type })
  if (uploadError) return dbError('documents.upload', uploadError)

  const { data, error } = await db
    .from('person_documents')
    .insert({
      owner_type: ownerType, owner_id: ownerId, doc_type: docType, label,
      file_name: file.name.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || `file.${ext}`,
      mime_type: file.type, size_bytes: file.size, storage_path: path, uploaded_by: session.id,
    })
    .select(DOCUMENT_COLUMNS)
    .single()
  if (error) {
    await db.storage.from(DOCUMENTS_BUCKET).remove([path])
    return dbError('documents.insert', error)
  }
  const doc = data as DocumentRow

  // One profile photo per person: the newest replaces the older ones, and a
  // student's record points at it.
  if (docType === 'photo') {
    const { data: older } = await db
      .from('person_documents').select('id, storage_path')
      .eq('owner_type', ownerType).eq('owner_id', ownerId).eq('doc_type', 'photo').neq('id', doc.id)
    await removeDocuments((older ?? []) as Pick<DocumentRow, 'id' | 'storage_path'>[])
    if (ownerType === 'student') await db.from('students').update({ photo_url: photoUrl(doc.id) }).eq('id', ownerId)
  }

  const { storage_path: _path, ...publicDoc } = doc
  return NextResponse.json({ data: publicDoc }, { status: 201 })
}
