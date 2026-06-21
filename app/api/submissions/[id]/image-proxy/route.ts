import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { r2Download } from '@/lib/r2'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Ambil image_path dari DB — tentukan mana yang diminta via query param
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'nota' // 'nota' | 'proof'

  const { data: sub, error } = await supabaseAdmin
    .from('submissions')
    .select('image_path, proof_image_path, driver_id')
    .eq('id', id)
    .single()

  if (error || !sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Kalau driver, pastikan hanya akses miliknya
  if (session.role === 'driver' && sub.driver_id !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const path = type === 'proof' ? sub.proof_image_path : sub.image_path
  if (!path) return NextResponse.json({ error: 'Gambar tidak ada' }, { status: 404 })

  const buffer = await r2Download(path)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
    },
  })
}