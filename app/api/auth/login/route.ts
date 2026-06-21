import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Allow at most 5 attempts per IP+username pair per minute, and a looser
// 20/minute cap per IP alone so one IP can't hammer many usernames.
const ATTEMPTS_PER_IDENTITY = 5
const ATTEMPTS_PER_IP = 20
const WINDOW_MS = 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }

    const ip = getClientIp(req)
    const normalizedUsername = username.toLowerCase().trim()

    const ipLimit = rateLimit(`login:ip:${ip}`, ATTEMPTS_PER_IP, WINDOW_MS)
    const identityLimit = rateLimit(
      `login:identity:${ip}:${normalizedUsername}`,
      ATTEMPTS_PER_IDENTITY,
      WINDOW_MS
    )

    if (!ipLimit.allowed || !identityLimit.allowed) {
      const resetAt = Math.max(ipLimit.resetAt, identityLimit.resetAt)
      const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      )
    }

    // Find user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, username, role, password_hash')
      .eq('username', normalizedUsername)
      .single()

    if (error || !user || !user.password_hash) {
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
      username: user.username,
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