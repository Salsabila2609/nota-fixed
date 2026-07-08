import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateCSEBranchExcel, prepareCSEReportRows } from '@/lib/excel-generator-cse'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // [BARU] admin bebas export branch mana saja; CSE cuma boleh export branch-nya sendiri
  if (session.role !== 'admin' && session.role !== 'cse') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    let { branch_id, cse_id } = body
    const { date_from, date_to, subtitle } = body

    // [BARU] sama seperti cse-pdf: CSE dikunci ke branch-nya sendiri, gabungan
    // semua CSE di branch itu (saling tau, sesuai keputusan bisnis).
    if (session.role === 'cse') {
      const { data: me, error: meErr } = await supabaseAdmin
        .from('users')
        .select('branch_id')
        .eq('id', session.id)
        .single()
      if (meErr || !me?.branch_id) {
        return NextResponse.json({ error: 'Akun kamu belum terdaftar di branch manapun' }, { status: 400 })
      }
      branch_id = me.branch_id
      cse_id = undefined
    }

    if (!branch_id || !date_from || !date_to) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
    }

    const { data: branch, error: branchErr } = await supabaseAdmin
      .from('branches').select('*').eq('id', branch_id).single()
    if (branchErr || !branch) {
      return NextResponse.json({ error: 'Branch tidak ditemukan' }, { status: 404 })
    }

    const { data: cseUsersAll, error: usersErr } = await supabaseAdmin
      .from('users').select('id, name, mc_name').eq('role', 'cse').eq('branch_id', branch_id)
    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })
    if (!cseUsersAll?.length) {
      return NextResponse.json({ error: 'Tidak ada CSE di branch ini' }, { status: 404 })
    }

    const cseUsers = cse_id ? cseUsersAll.filter(u => u.id === cse_id) : cseUsersAll
    if (cse_id && !cseUsers.length) {
      return NextResponse.json({ error: 'CSE tidak ditemukan di branch ini' }, { status: 404 })
    }

    const cseIds = cseUsers.map(u => u.id)
    const mcByUser = new Map(cseUsers.map(u => [u.id, u.mc_name || '-']))

    const { data: submissions, error: subErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .in('driver_id', cseIds)
      .is('archived_at', null)
      .gte('bill_date', date_from)
      .lte('bill_date', date_to)

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
    if (!submissions?.length) {
      return NextResponse.json({ error: 'Tidak ada nota untuk periode ini' }, { status: 404 })
    }

    const rows = prepareCSEReportRows(
      submissions.map(s => ({
        driver_name: s.driver_name,
        mc_name: mcByUser.get(s.driver_id) || '-',
        category: s.category,
        description: s.description,
        amount: s.amount,
        bill_date: s.bill_date,
        submission_date: s.submission_date,
      })),
      branch.name,
      branch.brand,
    )

    const buffer = await generateCSEBranchExcel({
      branchName: branch.name,
      brand: branch.brand,
      title: 'REKAP REIMBURSE CSE',
      subtitle: subtitle || '',
      dateRange: { from: date_from, to: date_to },
      rows,
      reportDate: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
    })

    const cseNamePart = cse_id ? `_${(cseUsers[0].mc_name || cseUsers[0].name).replace(/\s+/g, '_')}` : ''
    const filename = `Rekap_CSE_${branch.name.replace(/\s+/g, '_')}${cseNamePart}_${date_from}_${date_to}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('CSE Excel generation error:', err)
    return NextResponse.json({ error: 'Gagal generate Excel' }, { status: 500 })
  }
}