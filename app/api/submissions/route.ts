export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { processReceiptImage } from '@/lib/image-processing'
import { r2Upload, r2SignedUrl, r2Delete } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'
import { runOCRBatch } from '@/lib/ocr-google'
import { cpuLimit, ioLimit } from '@/lib/concurrency'
import { buildReceiptFolder, monthKeyFrom } from '@/lib/storage-paths'

const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const driverFilter = searchParams.get('driver_id')
  const branchFilter = searchParams.get('branch_id')
  const roleFilter = searchParams.get('role') 
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const billFrom = searchParams.get('bill_from')   
  const billTo = searchParams.get('bill_to')       
  const status = searchParams.get('status')
  const showArchived = searchParams.get('show_archived') === 'true'

  let query = supabaseAdmin
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })

  // 'driver' dan 'cse' cuma boleh lihat punya sendiri; admin bebas / bisa filter
  if (session.role !== 'admin') {
    query = query.eq('driver_id', session.id)
  } else if (driverFilter) {
    // 1 orang spesifik — bisa driver, bisa cse
    query = query.eq('driver_id', driverFilter)
  } else if (branchFilter) {
    // Semua CSE yang ada di 1 branch tertentu
    const { data: branchUsers, error: branchUsersErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'cse')
      .eq('branch_id', branchFilter)
    if (branchUsersErr) return NextResponse.json({ error: branchUsersErr.message }, { status: 500 })
    const ids = (branchUsers || []).map(u => u.id)
    query = query.in('driver_id', ids.length ? ids : [NO_MATCH_ID])
  } else if (roleFilter) {
    // Semua user dengan role tertentu (mis. role=cse -> semua nota CSE lintas branch)
    const { data: roleUsers, error: roleUsersErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', roleFilter)
    if (roleUsersErr) return NextResponse.json({ error: roleUsersErr.message }, { status: 500 })
    const ids = (roleUsers || []).map(u => u.id)
    query = query.in('driver_id', ids.length ? ids : [NO_MATCH_ID])
  }

  if (dateFrom) query = query.gte('submission_date', dateFrom)
  if (dateTo) query = query.lte('submission_date', dateTo)
  if (billFrom) query = query.gte('bill_date', billFrom)
  if (billTo) query = query.lte('bill_date', billTo)
  if (status) query = query.eq('status', status)

  if (session.role !== 'admin' || !showArchived) {
    query = query.is('archived_at', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withUrls = await Promise.all(
    (data || []).map(async (sub) => {
      const result: Record<string, any> = { ...sub }

      if (sub.image_path) {
        result.image_url = await r2SignedUrl(sub.image_path)
      }

      if (sub.marking_image_path) {
        result.marking_image_url = await r2SignedUrl(sub.marking_image_path)
      } else {
        result.marking_image_url = null
      }

      if (sub.proof_image_path) {
        result.proof_image_url = await r2SignedUrl(sub.proof_image_path)
      } else {
        result.proof_image_url = null
      }

      return result
    })
  )

  return NextResponse.json({ submissions: withUrls })
}

// formData keys look like "image0", "image1", ..., "image10", "image11".
// A plain string sort puts "image10" before "image2" (lexicographic order),
// which silently misaligns images with their OCR results later (matched by
// array index). Sort numerically by the trailing digits instead.
function sortImageKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10)
    const numB = parseInt(b.replace(/\D/g, ''), 10)
    if (Number.isNaN(numA) || Number.isNaN(numB)) {
      return a.localeCompare(b)
    }
    return numA - numB
  })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const imageKeys = Array.from(formData.keys()).filter(k => k.startsWith('image'))
    const sortedImageKeys = sortImageKeys(imageKeys)

    // Pasangkan tiap foto nota dengan foto bukti berdasarkan index numerik
    // di nama key (image_0 <-> marking_0, image_1 <-> marking_1, dst).
    const items = sortedImageKeys
      .map(key => {
        const image = formData.get(key) as File | null
        if (!image) return null
        const idx = parseInt(key.replace(/\D/g, ''), 10)
        const markingRaw = formData.get(`marking_${idx}`) as File | null
        const marking = markingRaw && markingRaw.size ? markingRaw : null
        return { image, marking }
      })
      .filter((v): v is { image: File; marking: File | null } => v !== null)

    const submission_date = formData.get('submission_date') as string

    if (!items.length || !submission_date) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    let uploadDriverId = session.id

    const formDriverId = formData.get('driver_id') as string | null
    if (session.role === 'admin' && formDriverId) {
      uploadDriverId = formDriverId
    }

    const { data: ownerData, error: ownerError } = await supabaseAdmin
      .from('users')
      .select('id, name, role, branch_id, mc_name')
      .eq('id', uploadDriverId)
      .single()

    if (ownerError || !ownerData) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 400 })
    }

    const uploadDriverName = ownerData.name

    let branchName: string | null = null
    if (ownerData.role === 'cse' && ownerData.branch_id) {
      const { data: branchData } = await supabaseAdmin
        .from('branches')
        .select('name')
        .eq('id', ownerData.branch_id)
        .single()
      branchName = branchData?.name || null
    }

    const folderOwnerName = ownerData.role === 'cse' ? (ownerData.mc_name || ownerData.name) : ownerData.name

    const results: { ok: boolean; error?: string; filename?: string; submission?: any }[] = []

    // CSE wajib sertakan foto bukti utk tiap nota — pisahkan yang kurang
    // dari yang lengkap sebelum masuk pipeline sharp/OCR/upload.
    const isCse = session.role === 'cse'
    const validItems = isCse ? items.filter(it => it.marking) : items

    if (isCse) {
      for (const it of items) {
        if (!it.marking) {
          results.push({ ok: false, error: 'Foto bukti wajib diupload', filename: it.image.name })
        }
      }
    }

    if (!validItems.length) {
      return NextResponse.json({
        results,
        summary: { total: items.length, succeeded: 0, failed: results.length },
      }, { status: 422 })
    }

    // ── FASE 1: Sharp semua foto nota paralel ───────────────────────────
    // Pakai cpuLimit (GLOBAL, shared across all requests) instead of a
    // per-request limiter. This means if 10 users upload at the same time,
    // their images all queue through the SAME limiter — only ~6 sharp jobs
    // run at once process-wide, not 6 per user (which could be 60 total).
    const tSharp = Date.now()
    const sharpResults = await Promise.all(
      validItems.map(({ image, marking }) =>
        cpuLimit(async () => {
          const imageBuffer = Buffer.from(await image.arrayBuffer())
          const processed = await processReceiptImage(imageBuffer)
          return { image, marking, processed }
        })
      )
    )
    console.log(`[ALL] Sharp batch: ${Date.now() - tSharp}ms`)

    // Pisahkan yang berhasil dan yang gagal
    const failed = sharpResults.filter(r => !r.processed.ok)
    const succeeded = sharpResults.filter(r => r.processed.ok) as
      { image: File; marking: File | null; processed: Extract<typeof sharpResults[0]['processed'], { ok: true }> }[]

    // Langsung push yang gagal ke results
    for (const { image, processed } of failed) {
      results.push({ ok: false, error: (processed as any).reason, filename: image.name })
    }

    if (succeeded.length === 0) {
      return NextResponse.json({
        results,
        summary: { total: items.length, succeeded: 0, failed: results.length },
      }, { status: 422 })
    }

    // ── FASE 2: OCR batch — 1 network call untuk semua ─────────────────
    const tOcr = Date.now()
    const ocrResults = await runOCRBatch(succeeded.map(r => r.processed.buffer))
    console.log(`[ALL] OCR batch (${succeeded.length} gambar): ${Date.now() - tOcr}ms`)

    // ── FASE 3: R2 upload (nota + bukti) + DB insert paralel ───────────
    // Pakai ioLimit (GLOBAL juga) — ceiling lebih longgar karena ini network
    // I/O, bukan rebutan CPU, tapi tetap dibatasi biar gak buka ratusan
    // koneksi sekaligus ke R2/Supabase saat banyak user upload bareng.
    await Promise.all(
      succeeded.map(({ image, marking, processed }, i) =>
        ioLimit(async () => {
          const ocrResult = ocrResults[i]
          const label = image.name

          // [BARU] folder per role/nama/branch/bulan (berdasarkan bill_date, fallback submission_date)
          const monthKey = monthKeyFrom(ocrResult.date, submission_date)
          const folder = buildReceiptFolder({
            role: ownerData.role,
            ownerName: folderOwnerName,
            branchName,
            monthKey,
          })

          const fileId = uuidv4()
          const imagePath = `${folder}/${fileId}.jpg`
          const t3 = Date.now()
          try {
            await r2Upload(imagePath, processed.buffer, 'image/jpeg')
            console.log(`[${label}] R2 Upload: ${Date.now() - t3}ms`)
          } catch {
            results.push({ ok: false, error: 'Gagal upload ke storage', filename: image.name })
            return
          }

          let markingPath: string | null = null
          if (marking) {
            markingPath = `${folder}/${fileId}-marking.jpg`
            try {
              const markingBuffer = Buffer.from(await marking.arrayBuffer())
              await r2Upload(markingPath, markingBuffer, marking.type || 'image/jpeg')
            } catch {
              await r2Delete(imagePath)
              results.push({ ok: false, error: 'Gagal upload foto bukti ke storage', filename: image.name })
              return
            }
          }
          
          // DB Insert
          const t4 = Date.now()
          const { data: submission, error: dbError } = await supabaseAdmin
            .from('submissions')
            .insert({
              driver_id: uploadDriverId,
              driver_name: uploadDriverName,
              category: ownerData.role === 'cse' ? 'bensin' : ocrResult.category, 
              description: ocrResult.description || null,
              amount: ocrResult.amount || null,
              submission_date,
              bill_date: ocrResult.date || null,
              image_path: imagePath,
              marking_image_path: markingPath,
              status: 'pending',
              ocr_raw_text: ocrResult.raw_text || null,
            })
            .select()
            .single()
          console.log(`[${label}] DB Insert: ${Date.now() - t4}ms`)

          if (dbError) {
            await r2Delete(imagePath)
            if (markingPath) await r2Delete(markingPath)
            results.push({ ok: false, error: dbError.message, filename: image.name })
            return
          }

          const imageUrl = await r2SignedUrl(imagePath)
          const markingUrl = markingPath ? await r2SignedUrl(markingPath) : null

          results.push({
            ok: true,
            submission: { ...submission, image_url: imageUrl, marking_image_url: markingUrl, proof_image_url: null },
            filename: image.name,
          })
        })
      )
    )

    const succeededCount = results.filter(r => r.ok).length
    return NextResponse.json({
      results,
      summary: { total: items.length, succeeded: succeededCount, failed: results.filter(r => !r.ok).length },
    }, { status: succeededCount > 0 ? 201 : 422 })

  } catch (err) {
    console.error('Submission error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}