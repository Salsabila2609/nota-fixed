/**
 * route.ts  —  API Export Excel
 * Lokasi: src/app/api/export/excel/route.ts
 *
 * POST /api/export/excel
 * Body JSON:
 * {
 *   driver_ids?: string[]   // filter driver tertentu (kosong = semua)
 *   date_from: string       // "2026-04-01"
 *   date_to: string         // "2026-04-30"
 *   cash_advance?: number   // nominal cash advance
 *   company_info?: {
 *     name?: string
 *     subtitle?: string
 *     report_date?: string
 *     created_by?: string
 *     created_by_title?: string
 *     approved_by?: string
 *     approved_by_title?: string
 *     acknowledged_by?: string
 *     acknowledged_by_title?: string
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  generateRekapExcel,
  type DriverData,
  type BillEntry,
} from '@/lib/excel-generator'

export async function POST(req: NextRequest) {
  // ── Auth: admin only ───────────────────────────────────────────────────────
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      driver_ids,
      date_from,
      date_to,
      cash_advance,
      company_info = {},
    } = body

    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'date_from dan date_to wajib diisi' }, { status: 400 })
    }

    // ── Ambil semua submissions dalam rentang tanggal (semua status) ──────
    let query = supabaseAdmin
      .from('submissions')
      .select('*')
      .gte('bill_date', date_from)
      .lte('bill_date', date_to)
      .order('driver_name', { ascending: true })
      .order('bill_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (driver_ids?.length > 0) {
      query = query.in('driver_id', driver_ids)
    }

    const { data: submissions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!submissions?.length) {
      return NextResponse.json(
        { error: 'Tidak ada nota untuk periode ini' },
        { status: 404 }
      )
    }

    // ── Ambil data driver (plat, type) ────────────────────────────────────
    const uniqueDriverIds = [...new Set(submissions.map((s: any) => s.driver_id))]

    const { data: driverUsers } = await supabaseAdmin
      .from('users')
      .select('id, name, plate_number, vehicle')
      .in('id', uniqueDriverIds)

    const userMap: Record<
      string,
      {
        name: string
        plate: string
        vehicle: string
      }
    > = {}

    for (const user of driverUsers || []) {
      userMap[user.id] = {
        name: user.name || '',
        plate: user.plate_number || '-',
        vehicle: user.vehicle || 'AVANZA 1.3 GMT',
      }
    }

    // ── Ambil metadata kendaraan dari tabel driver_vehicles (opsional) ────
    let vehicleMap: Record<string, { plate: string; type: string }> = {}
    try {
      const { data: vehicles } = await supabaseAdmin
        .from('driver_vehicles')
        .select('driver_id, plate_number, vehicle_type')
        .in('driver_id', uniqueDriverIds)

      if (vehicles) {
        for (const v of vehicles) {
          vehicleMap[v.driver_id] = { plate: v.plate_number, type: v.vehicle_type }
        }
      }
    } catch {
      // Tabel driver_vehicles belum ada, skip
    }

    // ── Kelompokkan submissions per driver ────────────────────────────────
    const driverMap: Record<string, { name: string; entries: any[] }> = {}

    for (const sub of submissions) {
      if (!driverMap[sub.driver_id]) {
        driverMap[sub.driver_id] = {
          name: sub.driver_name || 'Driver',
          entries: [],
        }
      }
      driverMap[sub.driver_id].entries.push(sub)
    }

    // ── Susun DriverData untuk generator ─────────────────────────────────
    const drivers: DriverData[] = Object.entries(driverMap).map(([driverId, data]) => {
      const driverInfo = userMap[driverId]

      // Urutkan entries per driver by bill_date lalu created_at
      const sortedEntries = [...data.entries].sort((a, b) => {
        const dateA = a.bill_date || a.submission_date
        const dateB = b.bill_date || b.submission_date
        if (dateA !== dateB) return dateA < dateB ? -1 : 1
        return a.created_at < b.created_at ? -1 : 1
      })

      const entries: BillEntry[] = sortedEntries.map((sub, i) => ({
        no: i + 1,
        date: sub.bill_date || sub.submission_date,
        category: mapCategory(sub.category),
        description: buildDescription(sub, driverInfo?.plate),
        amount: sub.amount || 0,
      }))

      return {
        name: data.name.toUpperCase(),
        plateNumber: driverInfo?.plate || '-',
        vehicleType: driverInfo?.vehicle || 'AVANZA 1.3 GMT',
        entries,
      }
    })

    if (!drivers.length) {
      return NextResponse.json({ error: 'Tidak ada data driver' }, { status: 404 })
    }

    // ── Parse periode untuk judul ─────────────────────────────────────────
    const periodeLabel = buildPeriodeLabel(date_from, date_to)

    // ── Generate Excel ────────────────────────────────────────────────────
    const excelBuffer = await generateRekapExcel({
      title: company_info.name
        ? `BBM DRIVER ${periodeLabel}`
        : `BBM DRIVER EAST JAVA ${periodeLabel}`,
      subtitle: company_info.subtitle
        || 'OPERASIONAL BBM COMMERCE  PT.INDOSAT Tbk.ISAT KAYOON',
      drivers,
      cashAdvance: cash_advance || 0,
      reportDate: company_info.report_date || buildReportDate(),
      createdBy: company_info.created_by,
      createdByTitle: company_info.created_by_title,
      approvedBy: company_info.approved_by,
      approvedByTitle: company_info.approved_by_title,
      acknowledgedBy: company_info.acknowledged_by,
      acknowledgedByTitle: company_info.acknowledged_by_title,
      month: periodeLabel,
    })

    // ── Return file ────────────────────────────────────────────────────────
    const filename = `REKAP_BBM_DRIVER_${date_from}_${date_to}.xlsx`
    const excelBody = new Uint8Array(excelBuffer)

    return new NextResponse(excelBody, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelBody.length.toString(),
      },
    })
  } catch (err) {
    console.error('Excel generation error:', err)
    return NextResponse.json({ error: 'Gagal generate Excel' }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCategory(cat: string): string {
  const lower = (cat || '').toLowerCase()
  if (lower === 'bensin' || lower.includes('bbm')) return 'BIAYA BBM'
  if (lower === 'tol' || lower.includes('toll')) return 'BIAYA TOLL'
  if (lower === 'parkir') return 'BIAYA PARKIR'
  return 'BIAYA LAINNYA'
}

function buildDescription(sub: any, plate?: string): string {
  const cat = mapCategory(sub.category)
  const platePart = plate ? ` ${plate}` : ''
  return `${cat} OPERS MOBIL${platePart}`
}

function buildPeriodeLabel(from: string, to: string): string {
  const fmtShort = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  // Kalau from dan to bulan+tahun sama, tampilkan sebagai "1-15 APR 2026"
  const df = new Date(from)
  const dt = new Date(to)
  if (df.getMonth() === dt.getMonth() && df.getFullYear() === dt.getFullYear()) {
    const monthNames = [
      'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
      'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
    ]
    // Kalau full bulan, tampilkan nama bulan saja
    const firstDay = new Date(df.getFullYear(), df.getMonth(), 1)
    const lastDay = new Date(df.getFullYear(), df.getMonth() + 1, 0)
    if (df.getDate() === 1 && dt.getDate() === lastDay.getDate()) {
      return `${monthNames[df.getMonth()]} ${df.getFullYear()}`
    }
    return `${df.getDate()}-${dt.getDate()} ${monthNames[df.getMonth()]} ${df.getFullYear()}`
  }
  // Beda bulan: tampilkan full range
  return `${fmtShort(from)} s/d ${fmtShort(to)}`
}

function buildReportDate(): string {
  const now = new Date()
  const monthId = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  return `Surabaya, ${now.getDate()} ${monthId[now.getMonth()]} ${now.getFullYear()}`
}