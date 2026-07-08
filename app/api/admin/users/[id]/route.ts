import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const VALID_ROLES = ['driver', 'admin', 'cse']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const { name, email, role, password, branch_id, mc_name } = body
    const updates: Record<string, any> = {}

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
      }
      updates.email = String(email).trim().toLowerCase()
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })
      }
      updates.name = String(name).trim()
    }

    // Role yang berlaku setelah update ini (dipakai buat validasi branch/mc di bawah)
    let effectiveRole: string | undefined = undefined

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
      }
      // Cegah admin yang lagi login mengubah role akun sendiri —
      // supaya gak ada skenario "gak ada admin lagi yang bisa akses panel ini"
      if (id === session.id && role !== 'admin') {
        return NextResponse.json({ error: 'Tidak bisa mengubah role akun sendiri' }, { status: 400 })
      }
      updates.role = role
      effectiveRole = role
    } else {
      const { data: current } = await supabaseAdmin.from('users').select('role').eq('id', id).single()
      effectiveRole = current?.role
    }

    // Branch & MC hanya relevan utk CSE. Kalau role (baru/existing) = cse dan
    // branch_id/mc_name dikirim di body, validasi & simpan. Kalau role bukan
    // cse, pastikan branch_id/mc_name dikosongkan biar gak nyangkut data basi.
    if (effectiveRole === 'cse') {
      if (branch_id !== undefined) {
        if (!branch_id) return NextResponse.json({ error: 'CSE wajib punya branch' }, { status: 400 })
        updates.branch_id = branch_id
      }
      if (mc_name !== undefined) {
        if (!String(mc_name).trim()) return NextResponse.json({ error: 'Nama MC wajib diisi untuk CSE' }, { status: 400 })
        updates.mc_name = String(mc_name).trim()
      }
    } else if (role !== undefined) {
      // role baru saja diubah menjadi bukan-cse -> bersihkan data cse lama
      updates.branch_id = null
      updates.mc_name = null
    }

    if (password !== undefined && password !== '') {
      if (String(password).length < 6) {
        return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
      }
      updates.password_hash = await bcrypt.hash(password, 10)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, name, username, role, branch_id, mc_name')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error('Update user error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  if (id === session.id) {
    return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}