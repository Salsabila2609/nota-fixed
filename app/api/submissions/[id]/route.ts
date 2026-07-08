import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { r2Delete } from '@/lib/r2'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // 'driver' & 'cse' cuma boleh edit punya sendiri, dan hanya saat pending
  if (session.role !== 'admin') {
    const { data: sub } = await supabaseAdmin
      .from('submissions')
      .select('driver_id, status')
      .eq('id', id)
      .single()

    if (!sub || sub.driver_id !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (sub.status !== 'pending') {
      return NextResponse.json({ error: 'Tidak bisa edit nota yang sudah diproses' }, { status: 400 })
    }
  }

  const allowedFields: Record<string, boolean> = {
    category: true,
    amount: true,
    description: true,
    submission_date: true,
    bill_date: true,
  }

  if (session.role === 'admin') {
    allowedFields.status = true
  }

  const updates: Record<string, any> = {}
  for (const [key, val] of Object.entries(body)) {
    if (allowedFields[key]) updates[key] = val
  }

  if (updates.status && !['pending', 'approved', 'rejected'].includes(updates.status)) {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Tidak ada field yang valid' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submission: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: sub } = await supabaseAdmin
    .from('submissions')
    .select('driver_id, image_path, marking_image_path, proof_image_path')
    .eq('id', id)
    .single()

  if (!sub) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  if (session.role !== 'admin' && sub.driver_id !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Hapus gambar dari R2
  if (sub.image_path) await r2Delete(sub.image_path)
  if (sub.marking_image_path) await r2Delete(sub.marking_image_path)
  if (sub.proof_image_path) await r2Delete(sub.proof_image_path)

  const { error } = await supabaseAdmin.from('submissions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}