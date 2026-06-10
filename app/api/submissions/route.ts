export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { processReceiptImage } from '@/lib/image-processing'
import { runOCR } from '@/lib/ocr'
import { r2Upload, r2SignedUrl, r2Delete } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const driverFilter = searchParams.get('driver_id')
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const status = searchParams.get('status')

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

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const imageKeys = Array.from(formData.keys()).filter(k => k.startsWith('image'))
    const images = imageKeys.sort().map(k => formData.get(k) as File).filter(Boolean)
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

    await Promise.all(
      images.map(async (image) => {
        const imageBuffer = Buffer.from(await image.arrayBuffer())

        const processed = await processReceiptImage(imageBuffer)
        if (!processed.ok) {
          results.push({ ok: false, error: processed.reason, filename: image.name })
          return
        }

        const [ocrResult] = await Promise.all([runOCR(processed.buffer)])

        const fileId = uuidv4()
        const imagePath = `${uploadDriverId}/${submission_date}/${fileId}.jpg`

        try {
          await r2Upload(imagePath, processed.buffer, 'image/jpeg')
        } catch {
          results.push({ ok: false, error: 'Gagal upload ke storage', filename: image.name })
          return
        }

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

    const succeeded = results.filter(r => r.ok).length

    return NextResponse.json({
      results,
      summary: { total: images.length, succeeded, failed: results.filter(r => !r.ok).length },
    }, { status: succeeded > 0 ? 201 : 422 })

  } catch (err) {
    console.error('Submission error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}