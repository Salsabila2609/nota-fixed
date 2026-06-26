export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { processReceiptImage } from '@/lib/image-processing'
import { r2Upload, r2SignedUrl, r2Delete } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'
import { runOCRBatch } from '@/lib/ocr-google'
import { cpuLimit, ioLimit } from '@/lib/concurrency'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const driverFilter = searchParams.get('driver_id')
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const status = searchParams.get('status')
  const showArchived = searchParams.get('show_archived') === 'true'

  let query = supabaseAdmin
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (session.role === 'driver') {
    query = query.eq('driver_id', session.id)
  } else if (driverFilter) {
    query = query.eq('driver_id', driverFilter)
  }

  if (dateFrom) query = query.gte('submission_date', dateFrom)
  if (dateTo) query = query.lte('submission_date', dateTo)
  if (status) query = query.eq('status', status)

  if (!showArchived) {
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
    const images = sortImageKeys(imageKeys).map(k => formData.get(k) as File).filter(Boolean)
    const submission_date = formData.get('submission_date') as string

    if (!images.length || !submission_date) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    let uploadDriverId = session.id
    let uploadDriverName = session.name

    const formDriverId = formData.get('driver_id') as string | null
    if (session.role === 'admin' && formDriverId) {
      const { data: driverData, error: driverError } = await supabaseAdmin
        .from('users')
        .select('id, name')
        .eq('id', formDriverId)
        .single()

      if (driverError || !driverData) {
        return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 400 })
      }

      uploadDriverId = driverData.id
      uploadDriverName = driverData.name
    }

    const results: { ok: boolean; error?: string; filename?: string; submission?: any }[] = []

    // ── FASE 1: Sharp semua gambar paralel ──────────────────────────────
    // Pakai cpuLimit (GLOBAL, shared across all requests) instead of a
    // per-request limiter. This means if 10 users upload at the same time,
    // their images all queue through the SAME limiter — only ~6 sharp jobs
    // run at once process-wide, not 6 per user (which could be 60 total).
    const tSharp = Date.now()
    const sharpResults = await Promise.all(
      images.map((image) =>
        cpuLimit(async () => {
          const imageBuffer = Buffer.from(await image.arrayBuffer())
          const processed = await processReceiptImage(imageBuffer)
          return { image, processed }
        })
      )
    )
    console.log(`[ALL] Sharp batch: ${Date.now() - tSharp}ms`)

    // Pisahkan yang berhasil dan yang gagal
    const failed = sharpResults.filter(r => !r.processed.ok)
    const succeeded = sharpResults.filter(r => r.processed.ok) as
      { image: File; processed: Extract<typeof sharpResults[0]['processed'], { ok: true }> }[]

    // Langsung push yang gagal ke results
    for (const { image, processed } of failed) {
      results.push({ ok: false, error: (processed as any).reason, filename: image.name })
    }

    if (succeeded.length === 0) {
      return NextResponse.json({
        results,
        summary: { total: images.length, succeeded: 0, failed: results.length },
      }, { status: 422 })
    }

    // ── FASE 2: OCR batch — 1 network call untuk semua ─────────────────
    const tOcr = Date.now()
    const ocrResults = await runOCRBatch(succeeded.map(r => r.processed.buffer))
    console.log(`[ALL] OCR batch (${succeeded.length} gambar): ${Date.now() - tOcr}ms`)

    // ── FASE 3: R2 upload + DB insert paralel ──────────────────────────
    // Pakai ioLimit (GLOBAL juga) — ceiling lebih longgar karena ini network
    // I/O, bukan rebutan CPU, tapi tetap dibatasi biar gak buka ratusan
    // koneksi sekaligus ke R2/Supabase saat banyak user upload bareng.
    await Promise.all(
      succeeded.map(({ image, processed }, i) =>
        ioLimit(async () => {
          const ocrResult = ocrResults[i]
          const label = image.name

          // R2 Upload
          const fileId = uuidv4()
          const imagePath = `${uploadDriverId}/${submission_date}/${fileId}.jpg`
          const t3 = Date.now()
          try {
            await r2Upload(imagePath, processed.buffer, 'image/jpeg')
            console.log(`[${label}] R2 Upload: ${Date.now() - t3}ms`)
          } catch {
            results.push({ ok: false, error: 'Gagal upload ke storage', filename: image.name })
            return
          }

          // DB Insert
          const t4 = Date.now()
          const { data: submission, error: dbError } = await supabaseAdmin
            .from('submissions')
            .insert({
              driver_id: uploadDriverId,
              driver_name: uploadDriverName,
              category: ocrResult.category,
              description: ocrResult.description || null,
              amount: ocrResult.amount || null,
              submission_date,
              bill_date: ocrResult.date || null,
              image_path: imagePath,
              status: 'pending',
              ocr_raw_text: ocrResult.raw_text || null,
            })
            .select()
            .single()
          console.log(`[${label}] DB Insert: ${Date.now() - t4}ms`)

          if (dbError) {
            await r2Delete(imagePath)
            results.push({ ok: false, error: dbError.message, filename: image.name })
            return
          }

          const imageUrl = await r2SignedUrl(imagePath)

          results.push({
            ok: true,
            submission: { ...submission, image_url: imageUrl, proof_image_url: null },
            filename: image.name,
          })
        })
      )
    )

    const succeededCount = results.filter(r => r.ok).length
    return NextResponse.json({
      results,
      summary: { total: images.length, succeeded: succeededCount, failed: results.filter(r => !r.ok).length },
    }, { status: succeededCount > 0 ? 201 : 422 })

  } catch (err) {
    console.error('Submission error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}