import sharp from 'sharp'

// By default, a single sharp/libvips operation can use ALL available CPU

sharp.concurrency(1)

export type ProcessResult =
  | { ok: true; buffer: Buffer; width: number; height: number }
  | { ok: false; reason: string }

export async function processReceiptImage(
  inputBuffer: Buffer,
  blurThreshold = 100
): Promise<ProcessResult> {
  if (inputBuffer.length > 10 * 1024 * 1024) {
    return { ok: false, reason: 'File terlalu besar (max 10MB)' }
  }

  try {
    // 1 decode + auto-rotate — semua operasi dari sini
    const base = sharp(inputBuffer).rotate()

    // Blur check dan final output jalan paralel dari pipeline yang sama
    const [blurResult, outputResult] = await Promise.all([
      base.clone()
        .greyscale()
        .resize(200, 200, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true }),

      base.clone()
        .resize(600, 800, { fit: 'inside', withoutEnlargement: false })
        .jpeg({ quality: 70 })
        .toBuffer({ resolveWithObject: true }),
    ])

    // Hitung Laplacian variance untuk blur detection
    const pixels = new Uint8Array(blurResult.data)
    const { width, height } = blurResult.info
    let sum = 0, sumSq = 0, count = 0
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        const lap =
          pixels[idx - width] +
          pixels[idx + width] +
          pixels[idx - 1] +
          pixels[idx + 1] -
          4 * pixels[idx]
        sum += lap
        sumSq += lap * lap
        count++
      }
    }
    const mean = sum / count
    const variance = sumSq / count - mean * mean

    if (variance < blurThreshold) {
      return {
        ok: false,
        reason: `Foto terlalu blur (skor: ${variance.toFixed(1)}, minimum: ${blurThreshold}). Silakan foto ulang dengan lebih jelas.`,
      }
    }

    return {
      ok: true,
      buffer: outputResult.data,
      width: outputResult.info.width,
      height: outputResult.info.height,
    }
  } catch {
    return { ok: false, reason: 'File bukan gambar yang valid' }
  }
}

export async function createThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(300, 400, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 70 })
    .toBuffer()
}