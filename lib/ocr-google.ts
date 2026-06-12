import * as vision from '@google-cloud/vision'

export type OCRResult = {
  raw_text: string
  amount: number | null
  category: string
  description: string
  date: string | null
}

// ── Cache client supaya tidak re-auth di setiap panggilan ──────────────────
let _client: vision.ImageAnnotatorClient | null = null
function getClient() {
  if (_client) return _client
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64!, 'base64').toString('utf-8')
  )
  _client = new vision.ImageAnnotatorClient({ credentials })
  return _client
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase().replace(/\s+/g, ' ')
  const nospace = lower.replace(/\s/g, '')
  const patterns = [
    { cat: 'parkir', keywords: ['parkir', 'parking', 'park', 'retribusi', 'tiket parkir'], nospaceKeywords: ['tiketparkir'] },
    { cat: 'bensin', keywords: ['pertamina', 'shell', 'spbu', 'bbm', 'pertalite', 'pertamax', 'solar', 'biosolar'], nospaceKeywords: ['pertamina', 'spbu'] },
    { cat: 'tol', keywords: ['tol', 'jasa marga', 'jasamarga', 'e-toll', 'etoll', 'transjawa', 'gerbang', 'ruas tol'], nospaceKeywords: ['jasamarga', 'etoll'] },
  ]
  for (const { cat, keywords, nospaceKeywords } of patterns) {
    if (keywords.some(kw => lower.includes(kw))) return cat
    if (nospaceKeywords.some(kw => nospace.includes(kw))) return cat
  }
  return 'lainnya'
}

function extractAmount(text: string, category?: string): number | null {
  const lines = text.split('\n')

  if (category === 'tol') {
    const tolLinePatterns = [
      /gol[\-\s]*\d[^\n\r]*?(\d{5,7})\s*$/i,
      /e[\-\s]?toll[^\n\r]*?(\d{5,7})\s*$/i,
      /tarif\s*[:\s]+[^\n\r]*?(\d{4,7})/i,
      /debit\s*[:\s]+[^\n\r]*?(\d{4,7})/i,
    ]
    const tolSkip = ['cn:', 'sn:', 'sisa', 'saldo', 'kembalian']
    for (const line of lines) {
      const lineLower = line.toLowerCase()
      if (tolSkip.some(kw => lineLower.includes(kw))) continue
      for (const re of tolLinePatterns) {
        const m = line.match(re)
        if (m) {
          const num = parseInt(m[1].replace(/[.,]/g, ''), 10)
          if (num >= 1000 && num <= 5_000_000) return num
        }
      }
    }
  }

  if (category === 'bensin') {
    // Prioritas 1: cari "Dibayar Konsumen" lalu ambil angka dari baris berikutnya
    for (let i = 0; i < lines.length; i++) {
      if (/dibayar\s*konsumen/i.test(lines[i])) {
        // Cek di baris yang sama dulu
        const sameLine = lines[i].match(/(\d{1,3}(?:[.,]\d{3})+)/)
        if (sameLine) {
          const num = parseInt(sameLine[1].replace(/[.,]/g, ''), 10)
          if (num >= 10_000 && num <= 5_000_000) return num
        }
        // Cek 3 baris ke depan
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const cleaned = lines[j].replace(/[^\d.,]/g, ' ').trim()
          const m = cleaned.match(/(\d{1,3}(?:[.,]\d{3})+)/)
          if (m) {
            const num = parseInt(m[1].replace(/[.,]/g, ''), 10)
            if (num >= 10_000 && num <= 5_000_000) return num
          }
        }
      }
    }

    // Prioritas 2: baris CASH yang mengandung angka
    for (const line of lines) {
      const m = line.match(/(?:cash|tunai)[^\n]*?(\d{1,3}(?:[.,]\d{3})+)/i)
      if (m) {
        const num = parseInt(m[1].replace(/[.,]/g, ''), 10)
        if (num >= 10_000 && num <= 5_000_000) return num
      }
    }

    // Prioritas 3: baris "CASH" sendiri, ambil angka dari baris berikutnya
    for (let i = 0; i < lines.length; i++) {
      if (/^cash$/i.test(lines[i].trim())) {
        for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
          const cleaned = lines[j].replace(/[^\d.,]/g, ' ').trim()
          const m = cleaned.match(/(\d{1,3}(?:[.,]\d{3})+)/)
          if (m) {
            const num = parseInt(m[1].replace(/[.,]/g, ''), 10)
            if (num >= 10_000 && num <= 5_000_000) return num
          }
        }
      }
    }

    // Prioritas 4: fallback — semua angka ribuan, skip baris harga per liter
    const bensinSkipKeywords = [
      'harga non subsidi',
      'harga jual',
      'subsidi pemerintah',
      'tanpa subsidi',
      'rp/liter',
    ]
    const candidates: { num: number; priority: number }[] = []
    for (const line of lines) {
      const lineLower = line.toLowerCase()
      if (bensinSkipKeywords.some(kw => lineLower.includes(kw))) continue
      const isBayar = /dibayar|cash|tunai|total penjualan/.test(lineLower)
      const match = line.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/)
      if (match) {
        const num = parseInt(match[1].replace(/[.,]/g, ''), 10)
        if (num >= 10_000 && num <= 5_000_000) {
          candidates.push({ num, priority: isBayar ? 5 : 2 })
        }
      }
    }
    if (candidates.length) {
      const maxPriority = Math.max(...candidates.map(c => c.priority))
      const top = candidates.filter(c => c.priority === maxPriority)
      return Math.max(...top.map(c => c.num))
    }

    return null
  }

  // Generic logic untuk kategori lainnya (tol sudah return di atas, bensin juga)
  const skipKeywords = ['saldo awal', 'saldo akhir', 'sisa', 'balance', 'sebelum', 'sesudah', 'kembalian']
  const biayaKeywords = ['biaya', 'tarif', 'total', 'bayar', 'charge', 'harga', 'transaksi', 'tagihan', 'nominal', 'jumlah', 'amount', 'tol', 'parkir', 'bbm', 'bensin']
  const candidates: { num: number; priority: number }[] = []
  for (const line of lines) {
    const lineLower = line.toLowerCase()
    if (skipKeywords.some(kw => lineLower.includes(kw))) continue
    if (category === 'tol' && lineLower.includes('cn:')) continue
    const isBiaya = biayaKeywords.some(kw => lineLower.includes(kw))
    let match
    const rpShortPattern = /\bRp\.?\s*(\d{1,7})\b(?!\d)/gi
    while ((match = rpShortPattern.exec(line)) !== null) {
      const num = parseInt(match[1].replace(/[.,]/g, ''), 10)
      if (num >= 500 && num <= 5_000_000) candidates.push({ num, priority: isBiaya ? 4 : 3 })
    }
    const thousandPattern = /\b(\d{1,3}(?:[.,]\d{3})+)\b/g
    while ((match = thousandPattern.exec(line)) !== null) {
      const num = parseInt(match[1].replace(/[.,]/g, ''), 10)
      if (num >= 500 && num <= 5_000_000) candidates.push({ num, priority: isBiaya ? 3 : 2 })
    }
    const plainPattern = /\b(\d{3,6})\b/g
    while ((match = plainPattern.exec(line)) !== null) {
      const num = parseInt(match[1], 10)
      if (num >= 500 && num <= 500_000) candidates.push({ num, priority: isBiaya ? 2 : 1 })
    }
  }
  if (!candidates.length) return null
  const maxPriority = Math.max(...candidates.map(c => c.priority))
  const top = candidates.filter(c => c.priority === maxPriority)
  return Math.max(...top.map(c => c.num))
}

const MONTH_MAP: Record<string, string> = {
  januari: '01', jan: '01', februari: '02', feb: '02', maret: '03', mar: '03',
  april: '04', apr: '04', mei: '05', juni: '06', jun: '06', juli: '07', jul: '07',
  agustus: '08', agu: '08', ags: '08', september: '09', sep: '09',
  oktober: '10', okt: '10', oct: '10', november: '11', nov: '11',
  desember: '12', des: '12', january: '01', february: '02', march: '03',
  may: '05', june: '06', july: '07', august: '08', aug: '08', december: '12', dec: '12',
}

function extractDate(text: string): string | null {
  const numericPatterns: { re: RegExp; order: string }[] = [
    { re: /(\d{1,2})[\/\-](\d{2})[\/\-](20\d{2})/, order: 'dmy' },
    { re: /(20\d{2})[\/\-](\d{2})[\/\-](\d{1,2})/, order: 'ymd' },
    { re: /(\d{1,2})[\/\-](\d{2})[\/\-](\d{2})\b/, order: 'dmy' },
    { re: /(\d{1,2})\s(\d{2})\s(20\d{2})/, order: 'dmy' },
  ]
  for (const { re, order } of numericPatterns) {
    const match = text.match(re)
    if (!match) continue
    let day: string, month: string, year: string
    if (order === 'ymd') { year = match[1]; month = match[2]; day = match[3] }
    else { day = match[1]; month = match[2]; year = match[3].length === 2 ? '20' + match[3] : match[3] }
    const dayN = parseInt(day), monthN = parseInt(month), yearN = parseInt(year)
    if (monthN < 1 || monthN > 12) continue
    if (dayN < 1 || dayN > 31) continue
    if (yearN < 2000 || yearN > new Date().getFullYear() + 1) continue
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const monthNames = Object.keys(MONTH_MAP).join('|')
  const monthNameRe = new RegExp(`(\\d{1,2})[\\s\\-\\/]+(${monthNames})[\\s\\-\\.,]+(20\\d{2}|\\d{2})\\b`, 'i')
  const m = text.match(monthNameRe)
  if (m) {
    const day = m[1].padStart(2, '0')
    const monthNum = MONTH_MAP[m[2].toLowerCase()]
    const rawYear = m[3]
    const year = rawYear.length === 2 ? '20' + rawYear : rawYear
    const dayN = parseInt(day), yearN = parseInt(year)
    if (dayN >= 1 && dayN <= 31 && yearN >= 2000 && yearN <= new Date().getFullYear() + 1) {
      return `${year}-${monthNum}-${day}`
    }
  }
  return null
}

function buildDescription(text: string, category: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 60 && /[a-zA-Z]/.test(l))
  const labels: Record<string, string> = { tol: 'Tol', parkir: 'Parkir', bensin: 'Bensin/BBM', lainnya: 'Lainnya' }
  return lines[0] ? `${labels[category]} - ${lines[0]}` : labels[category]
}

// ── Parse hasil mentah dari Vision API jadi OCRResult ───────────────────────
function parseOCRText(raw_text: string): OCRResult {
  if (!raw_text.trim()) {
    return { raw_text: '', amount: null, category: 'lainnya', description: '', date: null }
  }
  const category = detectCategory(raw_text)
  const amount = extractAmount(raw_text, category)
  const description = buildDescription(raw_text, category)
  const date = extractDate(raw_text)
  return { raw_text, amount, category, description, date }
}

/**
 * OCR untuk satu gambar (dipakai jika hanya ada 1 file).
 */
export async function runOCR(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    const client = getClient()
    const [result] = await client.textDetection({ image: { content: imageBuffer } })
    const raw_text = result.fullTextAnnotation?.text || ''
    return parseOCRText(raw_text)
  } catch (err) {
    console.error('Google Vision OCR error:', err)
    return { raw_text: '', amount: null, category: 'lainnya', description: '', date: null }
  }
}

/**
 * OCR untuk banyak gambar sekaligus dalam 1 API call (batchAnnotateImages).
 * Jauh lebih cepat dibanding memanggil runOCR() berkali-kali secara paralel,
 * karena hanya ada 1 network round-trip ke Google Vision.
 *
 * Hasil dikembalikan dalam urutan yang sama dengan input buffers.
 * Jika satu gambar gagal di-OCR, gambar lain tetap dapat hasilnya
 * (errornya di-fallback ke OCRResult kosong untuk index tersebut).
 */
export async function runOCRBatch(imageBuffers: Buffer[]): Promise<OCRResult[]> {
  if (imageBuffers.length === 0) return []

  // Google Vision batchAnnotateImages punya limit ~16 requests per call.
  // Kalau suatu saat ada >16 gambar, pecah jadi beberapa batch.
  const BATCH_LIMIT = 16
  const chunks: Buffer[][] = []
  for (let i = 0; i < imageBuffers.length; i += BATCH_LIMIT) {
    chunks.push(imageBuffers.slice(i, i + BATCH_LIMIT))
  }

  const allResults: OCRResult[] = []

  try {
    const client = getClient()

    for (const chunk of chunks) {
      const requests = chunk.map(buffer => ({
        image: { content: buffer },
        features: [{ type: 'TEXT_DETECTION' as const }],
      }))

      const [response] = await client.batchAnnotateImages({ requests })
      const responses = response.responses || []

      for (let i = 0; i < chunk.length; i++) {
        const res = responses[i]
        if (res?.error) {
          console.error('Vision batch item error:', res.error.message)
          allResults.push({ raw_text: '', amount: null, category: 'lainnya', description: '', date: null })
          continue
        }
        const raw_text = res?.fullTextAnnotation?.text || ''
        allResults.push(parseOCRText(raw_text))
      }
    }

    return allResults
  } catch (err) {
    console.error('Google Vision batch OCR error:', err)
    // Fallback: kembalikan hasil kosong untuk semua gambar agar proses lain tetap jalan
    return imageBuffers.map(() => ({ raw_text: '', amount: null, category: 'lainnya', description: '', date: null }))
  }
}