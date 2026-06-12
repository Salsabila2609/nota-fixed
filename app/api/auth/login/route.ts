import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }

    // Find user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, username, role, password_hash')
      .eq('username', username.toLowerCase().trim())
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Create session
    const token = await createSession({
      id: user.id,
      name: user.name,
      role: user.role
    })

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, username: user.username, role: user.role }
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}