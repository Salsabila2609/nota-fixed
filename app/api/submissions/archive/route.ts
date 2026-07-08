import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function resolveDriverIdsByRole(opts: { role?: string; branch_id?: string; cse_id?: string }): Promise<string[] | null> {
  const { role, branch_id, cse_id } = opts
  if (!role && !branch_id && !cse_id) return null

  let uq = supabaseAdmin.from('users').select('id')
  if (cse_id) {
    uq = uq.eq('id', cse_id)
  } else {
    if (role) uq = uq.eq('role', role)
    if (branch_id) uq = uq.eq('branch_id', branch_id)
  }
  const { data: users, error } = await uq
  if (error) throw new Error(error.message)
  return (users || []).map(u => u.id)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const now = new Date().toISOString()

  if (body.from && body.to) {
    let driverIds: string[] | null = body.driver_ids && body.driver_ids.length > 0 ? body.driver_ids : null


    if (!driverIds) {
      try {
        driverIds = await resolveDriverIdsByRole({ role: body.role, branch_id: body.branch_id, cse_id: body.cse_id })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
      if (driverIds && driverIds.length === 0) {
        // filter diterapkan tapi tidak ada user yang cocok — tidak ada yang perlu diarsipkan
        return NextResponse.json({ ok: true, archived: 0 })
      }
    }

    let query = supabaseAdmin
      .from('submissions')
      .update({ archived_at: now })
      .gte('bill_date', body.from)
      .lte('bill_date', body.to)
      .is('archived_at', null)

    if (driverIds) query = query.in('driver_id', driverIds)

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
  // [BARU] terima role/branch_id/cse_id dari query string
  const role = searchParams.get('role') || undefined
  const branchId = searchParams.get('branch_id') || undefined
  const cseId = searchParams.get('cse_id') || undefined

  let driverIds: string[] | null = null
  if (role || branchId || cseId) {
    try {
      driverIds = await resolveDriverIdsByRole({ role, branch_id: branchId, cse_id: cseId })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
    if (driverIds && driverIds.length === 0) {
      return NextResponse.json({ submissions: [] })
    }
  }

  let query = supabaseAdmin
    .from('submissions')
    .select('id, driver_id, driver_name, category, description, amount, bill_date, submission_date, archived_at, was_restored')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  if (from) query = query.gte('bill_date', from)
  if (to) query = query.lte('bill_date', to)
  if (driverIds) query = query.in('driver_id', driverIds) // [BARU]

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
    .update({
      archived_at: null,
      was_restored: true,
    })

  if (body.ids && body.ids.length > 0) {
    query = query.in('id', body.ids)
  } else {
    query = query.not('archived_at', 'is', null)
    if (body.from && body.to) {
      query = query.gte('bill_date', body.from).lte('bill_date', body.to)

      let driverIds: string[] | null = body.driver_ids && body.driver_ids.length > 0 ? body.driver_ids : null
      // [BARU] fallback role/branch_id/cse_id kalau driver_ids tidak dikirim (untuk konsistensi, walau ArchivePanel/ExportButton saat ini selalu kirim `ids` eksplisit)
      if (!driverIds && (body.role || body.branch_id || body.cse_id)) {
        try {
          driverIds = await resolveDriverIdsByRole({ role: body.role, branch_id: body.branch_id, cse_id: body.cse_id })
        } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 500 })
        }
      }
      if (driverIds && driverIds.length > 0) {
        query = query.in('driver_id', driverIds)
      }
    }
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}