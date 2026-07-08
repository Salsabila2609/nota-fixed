import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const VALID_ROLES = ['driver', 'admin', 'cse']

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, name, username, email, role, branch_id, mc_name, last_login_at, last_logout_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, username, email, password, role, branch_id, mc_name } = body

    if (!name || !username || !email || !password || !role) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // CSE wajib punya branch + nama MC — data ini yang dipakai laporan nanti
    if (role === 'cse') {
      if (!branch_id) {
        return NextResponse.json({ error: 'CSE wajib punya branch' }, { status: 400 })
      }
      if (!mc_name || !String(mc_name).trim()) {
        return NextResponse.json({ error: 'Nama MC wajib diisi untuk CSE' }, { status: 400 })
      }
    }

    const normalizedUsername = String(username).toLowerCase().trim()

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Username sudah dipakai' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 10)

    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        name: String(name).trim(),
        username: normalizedUsername,
        email: String(email).trim().toLowerCase(),
        password_hash,
        role,
        branch_id: role === 'cse' ? branch_id : null,
        mc_name: role === 'cse' ? String(mc_name).trim() : null,
      })
      .select('id, name, username, role, branch_id, mc_name, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (err) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}