import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const now = new Date().toISOString()

  if (body.from && body.to) {
    let query = supabaseAdmin
      .from('submissions')
      .update({ archived_at: now })
      .gte('submission_date', body.from)
      .lte('submission_date', body.to)
      .is('archived_at', null)

    // Kalau ada filter driver tertentu, arsipkan hanya driver itu
    if (body.driver_ids && body.driver_ids.length > 0) {
      query = query.in('driver_id', body.driver_ids)
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Parameter from dan to wajib diisi' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabaseAdmin
    .from('submissions')
    .select('id, driver_id, driver_name, category, description, amount, bill_date, submission_date, archived_at')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  if (from) query = query.gte('submission_date', from)
  if (to)   query = query.lte('submission_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data || [] })
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  let query = supabaseAdmin
    .from('submissions')
    .update({ archived_at: null })

  // Kalau ada IDs spesifik, restore hanya itu
  if (body.ids && body.ids.length > 0) {
    query = query.in('id', body.ids)
  } else {
    // Fallback: restore semua di periode
    query = query.not('archived_at', 'is', null)
    if (body.from && body.to) {
      query = query.gte('submission_date', body.from).lte('submission_date', body.to)
      if (body.driver_ids && body.driver_ids.length > 0) {
        query = query.in('driver_id', body.driver_ids)
      }
    }
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}