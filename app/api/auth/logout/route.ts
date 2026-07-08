import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)

  if (session) {
    try {
      const now = new Date().toISOString()
      await Promise.all([
        supabaseAdmin.from('login_audit_log').insert({
          user_id: session.id,
          event: 'logout',
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          user_agent: req.headers.get('user-agent') || null,
        }),
        supabaseAdmin.from('users').update({ last_logout_at: now }).eq('id', session.id),
      ])
    } catch (e) {
      console.error('Audit log error (logout):', e)
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
  return response
}