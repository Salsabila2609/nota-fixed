import { NextRequest, NextResponse } from 'next/server'
import pLimit from 'p-limit'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateCSEBranchPDF, CSESubmission } from '@/lib/pdf-generator-cse'
import { r2Download } from '@/lib/r2'

export const maxDuration = 300

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
    const { date_from, date_to, company_name, subtitle } = body

    // [BARU] Kalau yang minta adalah CSE (bukan admin), abaikan branch_id/cse_id
    // dari body — paksa pakai branch dia sendiri, dan selalu gabungan SEMUA
    // CSE di branch itu (bukan filter 1 orang), sesuai keputusan bisnis:
    // "saling tau antar CSE dalam 1 branch+brand yang sama gapapa".
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

    // Narrow ke 1 CSE spesifik kalau cse_id dikirim (hanya berlaku utk admin,
    // karena utk CSE cse_id sudah dipaksa undefined di atas)
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

    const downloadLimit = pLimit(8)
    const withImages: CSESubmission[] = await Promise.all(
      submissions.map(sub => downloadLimit(async () => {
        const result: CSESubmission = {
          id: sub.id,
          cse_name: sub.driver_name,
          mc_name: mcByUser.get(sub.driver_id) || '-',
          category: sub.category,
          description: sub.description,
          amount: sub.amount,
          bill_date: sub.bill_date,
          submission_date: sub.submission_date,
        }
        if (sub.image_path) { try { result.imageData = await r2Download(sub.image_path) } catch {} }
        if (sub.marking_image_path) { try { result.markingImageData = await r2Download(sub.marking_image_path) } catch {} }
        if (sub.proof_image_path) { try { result.proofImageData = await r2Download(sub.proof_image_path) } catch {} }
        return result
      }))
    )

    const pdfBytes = await generateCSEBranchPDF({
      branchName: branch.name,
      brand: branch.brand,
      dateRange: { from: date_from, to: date_to },
      submissions: withImages,
      companyName: company_name || 'PT. Perusahaan',
      subtitle: subtitle || '',
    })

    const cseNamePart = cse_id ? `_${(cseUsers[0].mc_name || cseUsers[0].name).replace(/\s+/g, '_')}` : ''
    const filename = `Reimburse_CSE_${branch.name.replace(/\s+/g, '_')}${cseNamePart}_${date_from}_${date_to}.pdf`

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (err) {
    console.error('CSE PDF generation error:', err)
    return NextResponse.json({ error: 'Gagal generate PDF' }, { status: 500 })
  }
}