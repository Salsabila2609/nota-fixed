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

/**
 * ── extractAmount (FIXED) ──────────────────────────────────────────────
 *
 * Bug-bug yang diperbaiki dari versi lama:
 *
 *  1. Baris "Saldo"/"Sisa"/"No Seri" dulu di-skip via frasa gabungan
 *     ("saldo awal", dst) di blok generic, sehingga baris seperti
 *     "SALDO: Rp.93.500" atau "MANDIRI ... Saldo Rp 151.500" tetap lolos
 *     jadi kandidat. Sekarang di-exclude keras (`continue`), bukan cuma
 *     diturunkan prioritasnya, baik di blok tol maupun generic.
 *
 *  2. Tie-break lama pakai `Math.max` di antara kandidat dengan priority
 *     SAMA. Kalau OCR gagal kenali keyword ("E-TOLL"/"Tarif" tidak
 *     terbaca persis), baris saldo (yang angkanya hampir selalu lebih
 *     besar dari nominal transaksi) otomatis menang di tie-break.
 *     Sekarang begitu baris dengan keyword kuat & bukan metadata
 *     ditemukan, langsung `return` — tidak pernah sampai ke tie-break
 *     yang salah pilih saldo.
 *
 *  3. Regex lama pakai `\bRp\.?\s*(\d{1,7})\b` dan `\b(\d{3,6})\b`.
 *     Masalahnya `\b` adalah boundary antara word-char & non-word-char,
 *     padahal digit dan huruf SAMA-SAMA word-char. Jadi kalau OCR
 *     menghasilkan angka nempel huruf seperti "100000Rp" atau
 *     "10000Rp/L" (umum di struk SPBU), regex itu TIDAK PERNAH match.
 *     Sekarang pakai lookahead/lookbehind (`(?<![\d.,])...(?![\d.,])`)
 *     yang tahan terhadap digit nempel huruf/simbol.
 *
 *  4. Regex khusus tol lama mensyaratkan `\d{5,7}` BERURUTAN tanpa
 *     separator ribuan, padahal tarif tol umumnya ditulis dengan titik
 *     ("6.500", "12.000") — jadi hampir tidak pernah match dan diam-diam
 *     jatuh ke generic logic yang rawan bug #1-3. Sekarang pakai
 *     `extractNumsFromLine` yang menangani kedua format (dengan & tanpa
 *     separator).
 */

// Regex angka yang tahan digit-nempel-huruf/simbol (mis. "100000Rp",
// "10000Rp/L"). `\b` TIDAK bisa dipakai untuk ini karena digit dan huruf
// sama-sama word-char, jadi \b tidak pernah "putus" di antara keduanya.
// Pakai lookaround sebagai gantinya.
function extractNumsFromLine(line: string, minVal = 500, maxVal = 5_000_000): number[] {
  const out: number[] = []

  // Format dengan separator ribuan: 6.500 / 12.000 / 100.000
  const withSep = /(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+)(?![\d.,])/g
  let m
  while ((m = withSep.exec(line)) !== null) {
    const num = parseInt(m[1].replace(/[.,]/g, ''), 10)
    if (num >= minVal && num <= maxVal) out.push(num)
  }

  // Format polos: 6500 / 100000 (boleh nempel huruf/simbol di sekitarnya)
  const plain = /(?<![\d.,])(\d{3,7})(?![\d.,])/g
  while ((m = plain.exec(line)) !== null) {
    const num = parseInt(m[1], 10)
    if (num >= minVal && num <= maxVal) out.push(num)
  }

  return out
}

function isDateOrTimeLine(line: string): boolean {
  return /\d{1,2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(line) || // 29/07/2026, 28-07-2026
         /\b\d{1,2}:\d{2}(:\d{2})?\b/.test(line)          // 17:30:23, 06:06AM
}

function extractAmount(text: string, category?: string): number | null {
  const lines = text.split('\n')

  // ── Kategori TOL ──────────────────────────────────────────────────────
  if (category === 'tol') {
    // Baris yang PASTI bukan nominal transaksi tol — dibuang total,
    // bukan sekadar diturunkan prioritasnya.
    const tolSkip = ['cn:', 'sn:', 'sisa', 'saldo', 'kembalian', 's/n', 'no seri', 'nik']
    const tolKeywords = ['gol', 'e-toll', 'etoll', 'e-pay', 'epay', 'tarif', 'debit']

    for (const line of lines) {
      const lineLower = line.toLowerCase()
      if (tolSkip.some(kw => lineLower.includes(kw))) continue
      if (isDateOrTimeLine(line)) continue
      if (!tolKeywords.some(kw => lineLower.includes(kw))) continue

      // Dulu regex ini mensyaratkan \d{5,7} BERURUTAN tanpa separator,
      // padahal tarif tol biasa ditulis pakai titik ribuan ("6.500",
      // "12.000") sehingga nyaris tidak pernah match.
      const nums = extractNumsFromLine(line, 500, 5_000_000)
      if (nums.length) return Math.max(...nums)
    }
    // Kalau tidak ada baris dengan keyword tol yang cocok, lanjut ke
    // generic logic di bawah sebagai fallback (bukan return null langsung).
  }

  // ── Kategori BENSIN ───────────────────────────────────────────────────
  if (category === 'bensin') {
    // Prioritas 1: cari "Dibayar Konsumen" lalu ambil angka dari baris berikutnya
    for (let i = 0; i < lines.length; i++) {
      if (/dibayar\s*konsumen/i.test(lines[i])) {
        const sameLineNums = extractNumsFromLine(lines[i], 10_000, 5_000_000)
        if (sameLineNums.length) return Math.max(...sameLineNums)
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const nums = extractNumsFromLine(lines[j], 10_000, 5_000_000)
          if (nums.length) return Math.max(...nums)
        }
      }
    }

    // Prioritas 2: baris CASH/TUNAI yang mengandung angka di baris yang sama
    for (const line of lines) {
      if (/(cash|tunai)/i.test(line)) {
        const nums = extractNumsFromLine(line, 10_000, 5_000_000)
        if (nums.length) return Math.max(...nums)
      }
    }

    // Prioritas 3: baris "CASH" sendiri, ambil angka dari baris berikutnya
    for (let i = 0; i < lines.length; i++) {
      if (/^cash$/i.test(lines[i].trim())) {
        for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
          const nums = extractNumsFromLine(lines[j], 10_000, 5_000_000)
          if (nums.length) return Math.max(...nums)
        }
      }
    }

    // Prioritas 4: TOTAL AMOUNT / TOTAL (kasus SPBU seperti "100000Rp")
    for (const line of lines) {
      if (/total\s*amount|^total\b/i.test(line)) {
        const nums = extractNumsFromLine(line, 500, 5_000_000)
        if (nums.length) return Math.max(...nums)
      }
    }

    // Prioritas 5: fallback — semua angka ribuan, skip baris harga per liter/saldo
    const bensinHardExclude = [
      'harga non subsidi', 'harga jual', 'subsidi pemerintah',
      'tanpa subsidi', 'rp/liter', '/l', 'saldo', 'sisa',
    ]
    const candidates: { num: number; priority: number }[] = []
    for (const line of lines) {
      const lineLower = line.toLowerCase()
      if (bensinHardExclude.some(kw => lineLower.includes(kw))) continue
      if (isDateOrTimeLine(line)) continue
      const isBayar = /dibayar|cash|tunai|total penjualan|total amount/.test(lineLower)
      const nums = extractNumsFromLine(line, 10_000, 5_000_000)
      for (const num of nums) candidates.push({ num, priority: isBayar ? 5 : 2 })
    }
    if (candidates.length) {
      const maxPriority = Math.max(...candidates.map(c => c.priority))
      const top = candidates.filter(c => c.priority === maxPriority)
      return Math.max(...top.map(c => c.num))
    }

    return null
  }

  // ── Generic logic (parkir, lainnya, dan fallback tol) ────────────────
  //
  // Baris yang PASTI bukan nominal transaksi — dibuang total (hardExclude),
  // bukan sekadar diturunkan prioritasnya seperti versi lama. Ini yang
  // memperbaiki kasus "SALDO: Rp.93.500" / "Saldo : Rp247.000" ikut
  // kepilih jadi amount.
  const hardExclude = [
    'saldo', 'balance', 'sisa', 'kembalian', 'kembali',
    'no seri', 'no. seri', ' seri', 's/n', 'sn:', 'cn:',
    'tid', 'mid', 'nik', 'vip',
  ]

  const strongKeywords = [
    'total amount', 'total', 'tarif', 'biaya', 'bayar', 'charge',
    'jumlah', 'nominal', 'tagihan', 'e-toll', 'e-pay', 'epay',
    'gol-', 'gol ', 'harga', 'amount',
  ]

  // PASS 1: baris dengan keyword kuat & bukan metadata -> ambil langsung.
  // Return di sini mencegah tie-break `Math.max` salah pilih saldo,
  // karena kita tidak pernah membandingkan lintas baris kalau baris
  // "benar" sudah ketemu duluan.
  for (const line of lines) {
    const lineLower = line.toLowerCase()
    if (hardExclude.some(kw => lineLower.includes(kw))) continue
    if (isDateOrTimeLine(line)) continue
    if (!strongKeywords.some(kw => lineLower.includes(kw))) continue

    const nums = extractNumsFromLine(line, 500, 5_000_000)
    if (nums.length) return Math.max(...nums)
  }

  // PASS 2: fallback — tidak ada baris dengan keyword kuat. Kumpulkan
  // semua angka valid selain baris metadata, ambil yang TERKECIL (bukan
  // terbesar) karena tanpa keyword, angka besar biasanya justru saldo/
  // nomor referensi yang entah kenapa lolos filter kata kunci di atas.
  const candidates: number[] = []
  for (const line of lines) {
    const lineLower = line.toLowerCase()
    if (hardExclude.some(kw => lineLower.includes(kw))) continue
    if (isDateOrTimeLine(line)) continue
    candidates.push(...extractNumsFromLine(line, 500, 5_000_000))
  }

  if (!candidates.length) return null
  return Math.min(...candidates)
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
