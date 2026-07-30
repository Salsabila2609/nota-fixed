import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, created_at')
    .eq('role', 'driver')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ drivers: data })
}
