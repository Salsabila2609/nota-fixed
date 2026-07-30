import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { processReceiptImage } from '@/lib/image-processing'
import { r2Upload, r2Delete, r2SignedUrl } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseAdmin = getSupabaseAdmin()
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Format file harus JPG, PNG, atau WEBP' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('image_path, driver_id, submission_date')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Submission tidak ditemukan' }, { status: 404 })
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer())
  const processed = await processReceiptImage(imageBuffer)
  if (!processed.ok) {
    return NextResponse.json({ error: processed.reason }, { status: 422 })
  }

  const fileId = uuidv4()
  const newPath = `${existing.driver_id}/${existing.submission_date}/${fileId}.jpg`

  try {
    await r2Upload(newPath, processed.buffer, 'image/jpeg')
  } catch {
    return NextResponse.json({ error: 'Gagal upload ke storage' }, { status: 500 })
  }

  const { error: dbError } = await supabaseAdmin
    .from('submissions')
    .update({ image_path: newPath })
    .eq('id', id)

  if (dbError) {
    await r2Delete(newPath)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Hapus foto lama dari R2
  if (existing.image_path) {
    await r2Delete(existing.image_path)
  }

  const imageUrl = await r2SignedUrl(newPath)

  return NextResponse.json({ success: true, image_url: imageUrl })
}