import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)

  // Ringkasan per user: kapan login/logout terakhir
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, name, username, role, last_login_at, last_logout_at')
    .order('name', { ascending: true })

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  // Histori mentah — opsional, buat drill-down per user
  let logQuery = supabaseAdmin
    .from('login_audit_log')
    .select('id, user_id, event, ip_address, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) logQuery = logQuery.eq('user_id', userId)

  const { data: logs, error: logsError } = await logQuery
  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 })

  return NextResponse.json({ users, logs })
}