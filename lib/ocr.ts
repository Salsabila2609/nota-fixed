import { createWorker } from 'tesseract.js'
import path from 'path'

export type OCRResult = {
  raw_text: string
  amount: number | null
  category: string
  description: string
  date: string | null
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase().replace(/\s+/g, ' ')
  const nospace = lower.replace(/\s/g, '')

  const patterns = [
    {
      cat: 'tol',
      keywords: ['tol', 'jasa marga', 'jasamarga', 'e-toll', 'etoll', 'transjawa', 'gerbang', 'ruas tol'],
      nospaceKeywords: ['jasamarga', 'etoll']
    },
    {
      cat: 'parkir',
      keywords: ['parkir', 'parking', 'park', 'retribusi', 'tiket parkir'],
      nospaceKeywords: ['tiketparkir']
    },
    {
      cat: 'bensin',
      keywords: ['pertamina', 'shell', 'spbu', 'bbm', 'pertalite', 'pertamax', 'solar', 'liter', 'biosolar'],
      nospaceKeywords: ['pertamina', 'spbu']
    },
  ]

  for (const { cat, keywords, nospaceKeywords } of patterns) {
    if (keywords.some(kw => lower.includes(kw))) return cat
    if (nospaceKeywords.some(kw => nospace.includes(kw))) return cat
  }
  return 'lainnya'
}

function extractAmount(text: string, category?: string): number | null {
  const lines = text.split('\n')

  // ── Khusus tol: cari baris yang mengandung Gol/e-Toll/tarif ──────────────
  // Nota Jasa Marga: "Gol-1 e-Toll MANDIRI 167500" → angka di akhir = tarif
  // Baris "CN:... Rp.61500" = sisa saldo, harus di-skip
  if (category === 'tol') {
    const tolLinePatterns = [
      /gol[\-\s]*\d[^\n\r]*?(\d{5,7})\s*$/i,   // min 5 digit → hindari match angka kecil
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
    // Kalau pattern khusus tol tidak ketemu, lanjut ke logic umum di bawah
  }

  // ── Logic umum untuk semua kategori ──────────────────────────────────────
  const skipKeywords = [
    'saldo awal', 'saldo akhir', 'saldo sebelum', 'saldo sesudah',
    'sisa', 'balance', 'sebelum', 'sesudah', 'kembalian', 'kembali'
  ]

  const biayaKeywords = [
    'biaya', 'tarif', 'total', 'bayar', 'charge', 'harga',
    'transaksi', 'tagihan', 'nominal', 'jumlah', 'amount',
    'tol', 'parkir', 'bbm', 'bensin'
  ]

  const candidates: { num: number; priority: number }[] = []

  for (const line of lines) {
    const lineLower = line.toLowerCase()
    if (skipKeywords.some(kw => lineLower.includes(kw))) continue

    // Skip baris CN untuk tol (sisa saldo e-toll)
    if (category === 'tol' && lineLower.includes('cn:')) continue

    const isBiaya = biayaKeywords.some(kw => lineLower.includes(kw))
    let match

    const rpShortPattern = /\bRp\.?\s*(\d{1,7})\b(?!\d)/gi
    while ((match = rpShortPattern.exec(line)) !== null) {
      const num = parseInt(match[1].replace(/[.,]/g, ''), 10)
      if (num >= 500 && num <= 5_000_000) {
        candidates.push({ num, priority: isBiaya ? 4 : 3 })
      }
    }

    const thousandPattern = /\b(\d{1,3}(?:[.,]\d{3})+)\b/g
    while ((match = thousandPattern.exec(line)) !== null) {
      const num = parseInt(match[1].replace(/[.,]/g, ''), 10)
      if (num >= 500 && num <= 5_000_000) {
        candidates.push({ num, priority: isBiaya ? 3 : 2 })
      }
    }

    const plainPattern = /\b(\d{3,6})\b/g
    while ((match = plainPattern.exec(line)) !== null) {
      const num = parseInt(match[1], 10)
      if (num >= 500 && num <= 500_000) {
        candidates.push({ num, priority: isBiaya ? 2 : 1 })
      }
    }
  }

  if (!candidates.length) return null
  const maxPriority = Math.max(...candidates.map(c => c.priority))
  const top = candidates.filter(c => c.priority === maxPriority)
  return Math.max(...top.map(c => c.num))
}

// Map nama bulan (Indonesia + Inggris, full + singkatan) → nomor bulan
const MONTH_MAP: Record<string, string> = {
  // Indonesia
  januari: '01', jan: '01',
  februari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  agustus: '08', agu: '08', ags: '08',
  september: '09', sep: '09',
  oktober: '10', okt: '10', oct: '10',
  november: '11', nov: '11',
  desember: '12', des: '12',
  // English
  january: '01',
  february: '02',
  march: '03',
  // april already covered
  may: '05',
  june: '06',
  july: '07',
  august: '08', aug: '08',
  // september, october, november already covered
  december: '12', dec: '12',
}

function extractDate(text: string): string | null {
  // ── 1. Format angka: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD MM YYYY ──────
  const numericPatterns: { re: RegExp; order: string }[] = [
    { re: /(\d{1,2})[\/\-](\d{2})[\/\-](20\d{2})/, order: 'dmy' },  // DD/MM/YYYY
    { re: /(20\d{2})[\/\-](\d{2})[\/\-](\d{1,2})/, order: 'ymd' },  // YYYY-MM-DD
    { re: /(\d{1,2})[\/\-](\d{2})[\/\-](\d{2})\b/, order: 'dmy' },  // DD/MM/YY
    { re: /(\d{1,2})\s(\d{2})\s(20\d{2})/, order: 'dmy' },           // DD MM YYYY
  ]

  for (const { re, order } of numericPatterns) {
    const match = text.match(re)
    if (!match) continue

    let day: string, month: string, year: string
    if (order === 'ymd') {
      year = match[1]; month = match[2]; day = match[3]
    } else {
      day = match[1]; month = match[2]
      year = match[3].length === 2 ? '20' + match[3] : match[3]
    }

    const dayN = parseInt(day), monthN = parseInt(month), yearN = parseInt(year)
    if (monthN < 1 || monthN > 12) continue
    if (dayN < 1 || dayN > 31) continue
    if (yearN < 2000 || yearN > new Date().getFullYear() + 1) continue

    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
  }

  // ── 2. Format nama bulan: DD <NamaBulan> YYYY atau DD <NamaBulan> YY ─────
  // Contoh: 28 April 2026 / 28 Apr 2026 / 28 apr 26 / 28 April 26
  // Juga handle separator opsional: "28-Apr-2026" / "28/Apr/2026"
  const monthNames = Object.keys(MONTH_MAP).join('|')
  const monthNameRe = new RegExp(
    `(\\d{1,2})[\\s\\-\\/]+(${monthNames})[\\s\\-\\.,]+(20\\d{2}|\\d{2})\\b`,
    'i'
  )

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

  console.log('extractDate: no match found in text:', text.slice(0, 300))
  return null
}

function buildDescription(text: string, category: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 60 && /[a-zA-Z]/.test(l))
  const labels: Record<string, string> = { tol: 'Tol', parkir: 'Parkir', bensin: 'Bensin/BBM', lainnya: 'Lainnya' }
  return lines[0] ? `${labels[category]} - ${lines[0]}` : labels[category]
}

export async function runOCR(imageBuffer: Buffer): Promise<OCRResult> {
  let worker
  try {
    const workerPath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js')

    worker = await createWorker(['ind', 'eng'], 1, {
      logger: () => {},
    })

    const { data } = await worker.recognize(imageBuffer)
    const raw_text = data.text || ''

    if (!raw_text.trim()) {
      return { raw_text: '', amount: null, category: 'lainnya', description: '', date: null }
    }

    // category harus dideklarasikan sebelum extractAmount dipanggil
    const category = detectCategory(raw_text)
    const amount = extractAmount(raw_text, category)
    const description = buildDescription(raw_text, category)
    const date = extractDate(raw_text)

    console.log('OCR raw (200 chars):', raw_text.slice(0, 200))
    console.log('OCR result:', { category, amount, date, description })

    return { raw_text, amount, category, description, date }

  } catch (err) {
    console.error('OCR error:', err)
    return { raw_text: '', amount: null, category: 'lainnya', description: '', date: null }
  } finally {
    if (worker) await worker.terminate()
  }
}