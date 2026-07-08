// Letakkan di: app/api/admin/branches/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('branches')
    .select('*')
    .order('brand', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ branches: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, brand } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nama branch wajib diisi' }, { status: 400 })
  if (!['IM3', '3ID'].includes(brand)) return NextResponse.json({ error: 'Brand harus IM3 atau 3ID' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('branches')
    .insert({ name: name.trim(), brand })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ branch: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })

  // Lepas dulu semua CSE yang assign ke branch ini biar gak nyangkut FK
  await supabaseAdmin.from('users').update({ branch_id: null }).eq('branch_id', id)

  const { error } = await supabaseAdmin.from('branches').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}