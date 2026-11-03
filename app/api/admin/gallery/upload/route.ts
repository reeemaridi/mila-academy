import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateSite } from '@/lib/server/revalidate'
import { dbError, badRequest, unauthorized } from '@/lib/api-fields'
import { matchesMagicBytes } from '@/lib/server/documents'

// Maps the accepted MIME types to the extension used in storage. The extension
// is derived from the (validated) content type rather than the uploaded
// filename, which is attacker-controlled and can carry path separators.
const EXT_BY_TYPE: Record<string, string> = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

// Must match the `check (category in (...))` constraint on gallery_photos.
const CATEGORIES = ['football', 'basketball', 'events'] as const

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('Expected multipart/form-data')
  }

  const file = form.get('file')
  const category = form.get('category')
  const caption = (form.get('caption') as string | null) ?? ''
  const rawSort = Number(form.get('sort_order') ?? 0)
  const sortOrder = Number.isFinite(rawSort) ? rawSort : 0

  if (!(file instanceof File)) return badRequest('file is required')

  // Validated against the allowed set before it is used to build the storage
  // path — an unchecked value went straight into `${category}/...`, so a
  // caller could steer the write elsewhere in the bucket with `../`.
  if (typeof category !== 'string' || !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    return badRequest(`category must be one of: ${CATEGORIES.join(', ')}`)
  }

  const ext = EXT_BY_TYPE[file.type]
  if (!ext) return badRequest('Unsupported file type')
  if (file.size === 0) return badRequest('File is empty')
  if (file.size > MAX_SIZE) return badRequest('File too large (max 5MB)')

  // The declared type is client-supplied; check the bytes really are that image.
  if (!matchesMagicBytes(file.type, new Uint8Array(await file.arrayBuffer()))) {
    return badRequest('The file contents do not match its type')
  }

  const path = `${category}/${crypto.randomUUID()}.${ext}`

  const admin = getSupabaseAdmin()
  const { error: uploadError } = await admin.storage
    .from('gallery')
    .upload(path, file, { contentType: file.type })

  if (uploadError) return dbError('gallery.upload', uploadError)

  const { data: urlData } = admin.storage.from('gallery').getPublicUrl(path)

  const { data, error } = await admin
    .from('gallery_photos')
    .insert({
      image_url: urlData.publicUrl,
      category,
      caption: String(caption).slice(0, 300),
      sort_order: sortOrder,
      storage_path: path,
    })
    .select()
    .single()

  if (error) {
    // Roll back the uploaded file if the DB insert failed
    await admin.storage.from('gallery').remove([path])
    return dbError('gallery.insert', error)
  }

  revalidateSite()
  return NextResponse.json({ data }, { status: 201 })
}
