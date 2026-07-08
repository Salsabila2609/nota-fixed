import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { r2Upload, r2Delete, r2SignedUrl } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: sub, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('driver_id, marking_image_path')
    .eq('id', id)
    .single()

  if (fetchError || !sub) {
    return NextResponse.json({ error: 'Submission tidak ditemukan' }, { status: 404 })
  }

  if (session.role !== 'admin' && sub.driver_id !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let file: File | null = null
  try {
    const formData = await req.formData()
    file = formData.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Form data tidak valid' }, { status: 400 })
  }

  if (!file || !file.size) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File harus berupa gambar' }, { status: 400 })
  }

  // Hapus foto timestamp lama dari R2 kalau ada
  if (sub.marking_image_path) {
    await r2Delete(sub.marking_image_path)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const markingPath = `${sub.driver_id}/marking/${id}-${uuidv4()}.${ext}`

  try {
    await r2Upload(markingPath, buffer, file.type)
  } catch {
    return NextResponse.json({ error: 'Gagal upload foto timestamp ke storage' }, { status: 500 })
  }

  const { data: updated, error: dbError } = await supabaseAdmin
    .from('submissions')
    .update({ marking_image_path: markingPath })
    .eq('id', id)
    .select()
    .single()

  if (dbError) {
    await r2Delete(markingPath)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const markingImageUrl = await r2SignedUrl(markingPath)

  return NextResponse.json({
    ok: true,
    marking_image_url: markingImageUrl,
    submission: updated,
  }, { status: 200 })
}