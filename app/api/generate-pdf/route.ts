import { NextRequest, NextResponse } from 'next/server'
import pLimit from 'p-limit'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateReimbursementPDF } from '@/lib/pdf-generator'
import { r2Download } from '@/lib/r2'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      driver_id,
      driver_ids,
      date_from,
      date_to,
      submission_ids,
      company_name,
      subtitle,
      created_by,
      created_by_title,
      approved_by,
      approved_by_title,
    } = body

    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
    }

    // PERUBAHAN #1: Concurrency control dengan p-limit
    // Batasi 8 concurrent download dari R2 sekaligus.
    // Tanpa ini, 500+ Promise.all langsung = spike memori + thread starvation.
    // Angka 8 adalah sweet spot: cukup paralel, tidak overwhelm R2 atau RAM.
    const downloadLimit = pLimit(8)

    async function fetchDriverData(drvId: string) {
      let query = supabaseAdmin
        .from('submissions')
        .select('*')
        .eq('driver_id', drvId)
        .order('bill_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (submission_ids?.length > 0 && !driver_ids) {
        query = query.in('id', submission_ids)
      } else {
        query = query.gte('bill_date', date_from).lte('bill_date', date_to)
      }

      const { data: submissions, error } = await query
      if (error) throw new Error(error.message)
      if (!submissions?.length) return null

      const sorted = [...submissions].sort((a, b) => {
        const da = new Date(a.bill_date || a.submission_date).getTime()
        const db = new Date(b.bill_date || b.submission_date).getTime()
        if (da !== db) return da - db
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      // PERUBAHAN #1 (lanjutan): Setiap download dibungkus dalam downloadLimit().
      // Efeknya: maks 8 download berjalan bersamaan, sisanya antri otomatis.
      // Setelah salah satu selesai, antrian berikutnya langsung masuk.
      const withImages = await Promise.all(
        sorted.map((sub) =>
          downloadLimit(async () => {
            const result: Record<string, any> = { ...sub }

            // PERUBAHAN #2: Tidak ada lagi detectBlur() di sini.
            // Blur check sudah dilakukan saat user upload foto (di upload handler).
            // Gambar yang ada di R2 dijamin sudah lolos validasi.
            // Memanggil detectBlur() per-gambar di sini sebelumnya = +0.5-1 detik per gambar.

            if (sub.image_path) {
              try {
                result.imageData = await r2Download(sub.image_path)
              } catch {
                // Biarkan slot kosong — pdf-generator akan tampilkan placeholder
              }
            }

            // Download proof image hanya untuk nota > 250rb yang punya path
            if (sub.proof_image_path && (sub.amount ?? 0) > 250_000) {
              try {
                result.proofImageData = await r2Download(sub.proof_image_path)
              } catch {}
            }

            return result
          })
        )
      )

      return {
        id: drvId,
        name: sorted[0]?.driver_name || 'Unknown Driver',
        submissions: withImages,
      }
    }

    const sharedParams = {
      dateRange: { from: date_from, to: date_to },
      companyName: company_name || 'PT. Perusahaan',
      subtitle: subtitle || '',
      createdBy: created_by,
      createdByTitle: created_by_title,
      approvedBy: approved_by,
      approvedByTitle: approved_by_title,
    }

    // Mode gabung: driver_ids array
    if (driver_ids && Array.isArray(driver_ids) && driver_ids.length > 0) {
      // Fetch semua driver secara paralel (level driver, bukan level gambar)
      // Level gambar sudah dikontrol oleh downloadLimit di dalam fetchDriverData
      const driversData = (
        await Promise.all(driver_ids.map(fetchDriverData))
      ).filter(Boolean) as { id: string; name: string; submissions: any[] }[]

      if (driversData.length === 0) {
        return NextResponse.json({ error: 'Tidak ada nota untuk periode ini' }, { status: 404 })
      }

      const pdfBytes = await generateReimbursementPDF({
        ...sharedParams,
        drivers: driversData,
      })

      const filename =
        driversData.length === 1
          ? `Reimburse_${driversData[0].name.replace(/\s+/g, '_')}_${date_from}_${date_to}.pdf`
          : `Reimburse_Semua_Driver_${date_from}_${date_to}.pdf`

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBytes.length.toString(),
        },
      })
    }

    // Mode single driver
    if (!driver_id) {
      return NextResponse.json(
        { error: 'driver_id atau driver_ids wajib diisi' },
        { status: 400 }
      )
    }

    const driverData = await fetchDriverData(driver_id)
    if (!driverData) {
      return NextResponse.json(
        { error: 'Tidak ada nota untuk periode ini' },
        { status: 404 }
      )
    }

    const pdfBytes = await generateReimbursementPDF({
      ...sharedParams,
      driverName: driverData.name,
      submissions: driverData.submissions as any,
    })

    const filename = `Reimburse_${driverData.name.replace(/\s+/g, '_')}_${date_from}_${date_to}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Gagal generate PDF' }, { status: 500 })
  }
}
