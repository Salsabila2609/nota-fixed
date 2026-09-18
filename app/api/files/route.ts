import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import {
  verifyLocalSignature,
  localFilePath,
  contentTypeFor,
  r2PresignKey,
} from '@/lib/r2'

export const dynamic = 'force-dynamic'

/**
 * Melayani foto yang sedang antre di disk server (path "local/...").
 * URL dibuat oleh r2SignedUrl dan berlaku terbatas.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('k') || ''
  const exp = Number(searchParams.get('e') || 0)
  const sig = searchParams.get('s') || ''

  if (!verifyLocalSignature(key, exp, sig)) {
    return NextResponse.json({ error: 'Link tidak valid atau kedaluwarsa' }, { status: 403 })
  }

  try {
    const buffer = await fs.readFile(localFilePath(key))
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentTypeFor(key),
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    // File sudah dipindah ke R2 oleh worker -> arahkan ke R2
    try {
      return NextResponse.redirect(await r2PresignKey(key), 302)
    } catch {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }
  }
}
