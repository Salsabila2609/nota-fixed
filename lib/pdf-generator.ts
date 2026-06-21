import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import { Submission } from './supabase'

// ── Canvas ─────────────────────────────────────────────────────────────────
const A4_W  = 595.28
const A4_H  = 841.89
const MG    = 32          // margin kiri/kanan
const HDR_H = 64          // header height
const FTR_H = 28          // footer height
const COLS  = 3
const ROWS  = 3

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  red:       rgb(237/255,  28/255,  36/255),
  yellow:    rgb(255/255, 203/255,   5/255),
  teal:      rgb( 50/255, 188/255, 173/255),
  charcoal:  rgb( 77/255,  77/255,  79/255),
  bg:        rgb(245/255, 245/255, 247/255),
  white:     rgb(1, 1, 1),
  border:    rgb(232/255, 232/255, 234/255),
  hdrBg:     rgb( 22/255,  22/255,  24/255),
  labelBg:   rgb( 36/255,  36/255,  38/255),
  rowAlt:    rgb(250/255, 250/255, 251/255),
  textMid:   rgb(0.45, 0.45, 0.46),
  textLight: rgb(0.72, 0.72, 0.74),
}

// ── Types ──────────────────────────────────────────────────────────────────
type Sub = Submission & {
  imageData?:      Uint8Array
  proofImageData?: Uint8Array
  bill_date?:      string
  submission_date?: string
}

export type GeneratePDFParams = {
  driverName?:       string
  drivers?:          { id: string; name: string; submissions: Sub[] }[]
  dateRange:         { from: string; to: string }
  submissions?:      Sub[]
  companyName?:      string
  subtitle?:         string
  createdBy?:        string
  createdByTitle?:   string
  approvedBy?:       string
  approvedByTitle?:  string
}

// ── Slot ───────────────────────────────────────────────────────────────────
type Slot =
  | { type: 'nota';  sub: Sub; num: number }
  | { type: 'proof'; sub: Sub; num: number }

function buildSlots(subs: Sub[]): Slot[] {
  const slots: Slot[] = []
  let n = 1
  for (const sub of subs) {
    slots.push({ type: 'nota', sub, num: n })
    if ((sub.amount ?? 0) > 250_000 && (sub.proofImageData || sub.proof_image_path)) {
      slots.push({ type: 'proof', sub, num: n })
    }
    n++
  }
  return slots
}

// ── PERUBAHAN #1 (PDF gen): Image embed cache ──────────────────────────────
// pdf-lib embedJpg/embedPng membuat objek baru setiap kali dipanggil,
// meski buffer-nya identik. Untuk nota HV yang punya slot 'nota' DAN 'proof',
// gambar yang sama akan di-embed dua kali tanpa cache ini.
// Cache ini menyimpan referensi embed per identity buffer → embed sekali, pakai berkali.
type EmbedCache = Map<Uint8Array, Awaited<ReturnType<PDFDocument['embedJpg']>>>

async function getOrEmbedImage(
  pdfDoc: PDFDocument,
  cache: EmbedCache,
  data: Uint8Array,
): Promise<Awaited<ReturnType<PDFDocument['embedJpg']>>> {
  if (cache.has(data)) return cache.get(data)!
  let emb
  try {
    emb = await pdfDoc.embedJpg(data)
  } catch {
    emb = await pdfDoc.embedPng(data)
  }
  cache.set(data, emb)
  return emb
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sortByDate(subs: Sub[]): Sub[] {
  return [...subs].sort((a, b) => {
    const da = new Date(a.bill_date || a.submission_date || '').getTime()
    const db = new Date(b.bill_date || b.submission_date || '').getTime()
    return da - db
  })
}

function getPrimaryDate(sub: Sub): string {
  return sub.bill_date || sub.submission_date || ''
}

function getCategoryLabel(cat: string, desc?: string | null): string {
  const map: Record<string, string> = {
    parkir: 'Parkir', tol: 'Tol', bensin: 'Bensin', lainnya: 'Lainnya',
  }
  const base = map[cat?.toLowerCase()] ?? cat
  if (cat === 'lainnya' && desc) return `${base}: ${desc}`
  return base
}

function fmtDate(d: string): string {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtAmt(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

function groupByCategory(subs: Sub[]) {
  const g: Record<string, { count: number; total: number }> = {}
  for (const s of subs) {
    const k = s.category === 'lainnya'
      ? `lainnya${s.description ? ': ' + s.description : ''}`
      : s.category
    if (!g[k]) g[k] = { count: 0, total: 0 }
    g[k].count++
    g[k].total += s.amount || 0
  }
  return g
}

// ── Header ─────────────────────────────────────────────────────────────────
function drawHeader(page: PDFPage, opts: {
  bold: PDFFont; reg: PDFFont
  driverName: string; dateRange: { from: string; to: string }
  companyName: string; subtitle: string
  pageNum: number; totalPages: number
}) {
  const { bold, reg, driverName, dateRange, companyName, subtitle, pageNum, totalPages } = opts
  const y0 = A4_H - HDR_H

  page.drawRectangle({ x: 0, y: y0, width: A4_W, height: HDR_H, color: C.hdrBg })
  page.drawRectangle({ x: 0, y: y0, width: 4, height: HDR_H, color: C.teal })

  page.drawText('LAPORAN REIMBURSE NOTA', {
    x: MG, y: A4_H - 22, font: bold, size: 12, color: C.white,
  })
  page.drawText(subtitle || companyName, {
    x: MG, y: A4_H - 36, font: reg, size: 8, color: C.textLight,
  })
  page.drawText(`Driver: ${driverName}`, {
    x: MG, y: A4_H - 50, font: bold, size: 8.5, color: C.teal,
  })
  page.drawText(`Periode: ${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`, {
    x: A4_W - MG - 190, y: A4_H - 36, font: reg, size: 7.5, color: C.textLight,
  })
  page.drawText(`Hal. ${pageNum} / ${totalPages}`, {
    x: A4_W - MG - 60, y: A4_H - 50, font: reg, size: 7.5, color: C.textMid,
  })
}

// ── Footer ─────────────────────────────────────────────────────────────────
function drawFooter(page: PDFPage, opts: { reg: PDFFont }) {
  const y = 10
  page.drawLine({
    start: { x: MG, y: y + 14 }, end: { x: A4_W - MG, y: y + 14 },
    thickness: 0.4, color: C.border,
  })
  page.drawText('Digenerate otomatis oleh sistem reimburse', {
    x: MG, y, font: opts.reg, size: 6.5, color: C.textLight,
  })
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  page.drawText(`Dicetak: ${now} WIB`, {
    x: A4_W - MG - 128, y, font: opts.reg, size: 6.5, color: C.textLight,
  })
}

// ── Single cell ────────────────────────────────────────────────────────────
const LABEL_H   = 30
const IMG_PAD   = 6
const BANNER_H  = 18

async function drawCell(
  pdfDoc: PDFDocument,
  page: PDFPage,
  slot: Slot,
  cx: number, cy: number,
  cw: number, ch: number,
  bold: PDFFont, reg: PDFFont,
  // PERUBAHAN #2 (PDF gen): Terima embed cache dari luar
  // Semua cell dalam satu PDF berbagi cache yang sama
  embedCache: EmbedCache,
) {
  const isProof = slot.type === 'proof'

  page.drawRectangle({
    x: cx + 2, y: cy + 2, width: cw - 4, height: ch - 4,
    color: C.white, borderColor: C.border, borderWidth: 0.6,
  })

  if (isProof) {
    page.drawRectangle({
      x: cx + 2, y: cy + ch - BANNER_H - 2, width: cw - 4, height: BANNER_H,
      color: C.teal,
    })
    page.drawText(`Bukti Transaksi Nota No. ${slot.num}`, {
      x: cx + 8, y: cy + ch - BANNER_H + 4,
      font: bold, size: 7.5, color: C.white,
    })
  }

  const bannerOffset = isProof ? BANNER_H : 0
  const imgX = cx + IMG_PAD + 2
  const imgY = cy + LABEL_H + IMG_PAD
  const imgW = cw - IMG_PAD * 2 - 4
  const imgH = ch - LABEL_H - IMG_PAD * 2 - bannerOffset - 2

  const rawData = isProof ? slot.sub.proofImageData : slot.sub.imageData

  if (rawData) {
    try {
      // PERUBAHAN #2 (PDF gen): Pakai cache — embed sekali, gambar sama tidak di-proses ulang
      const emb = await getOrEmbedImage(pdfDoc, embedCache, rawData)
      const d = emb.scaleToFit(imgW, imgH)
      page.drawImage(emb, {
        x: imgX + (imgW - d.width) / 2,
        y: imgY + (imgH - d.height) / 2,
        width: d.width, height: d.height,
      })
    } catch {
      drawNoImage(page, imgX, imgY, imgW, imgH, reg, isProof ? 'Bukti tidak tersedia' : 'Gambar tidak tersedia')
    }
  } else {
    const msg = isProof
      ? (slot.sub.proof_image_path ? 'Foto tidak ada' : 'Belum diupload')
      : 'Foto tidak ada'
    drawNoImage(page, imgX, imgY, imgW, imgH, reg, msg)
  }

  page.drawRectangle({
    x: cx + 2, y: cy + 2, width: cw - 4, height: LABEL_H,
    color: C.labelBg,
  })

  if (isProof) {
    const amtStr = slot.sub.amount ? `Rp ${fmtAmt(slot.sub.amount)}` : '–'
    page.drawText(amtStr, {
      x: cx + 8, y: cy + 11, font: bold, size: 8, color: C.yellow,
    })
    page.drawText(`Nota #${slot.num}`, {
      x: cx + 8, y: cy + 22, font: reg, size: 6.5, color: C.textMid,
    })
  } else {
    const dateStr = fmtDate(getPrimaryDate(slot.sub))
    const catStr  = getCategoryLabel(slot.sub.category, slot.sub.description)

    page.drawRectangle({
      x: cx + 4, y: cy + ch - (isProof ? BANNER_H + 2 : 0) - 20,
      width: 18, height: 14,
      color: C.charcoal,
    })
    page.drawText(String(slot.num), {
      x: cx + (slot.num >= 10 ? 6 : 8),
      y: cy + ch - (isProof ? BANNER_H + 2 : 0) - 15,
      font: bold, size: 8, color: C.white,
    })

    page.drawText(catStr, {
      x: cx + 8, y: cy + 22, font: reg, size: 7, color: rgb(0.75, 0.75, 0.77),
      maxWidth: cw - 16,
    })
    page.drawText(dateStr, {
      x: cx + 8, y: cy + 13, font: reg, size: 6.5, color: C.textMid,
    })
    if (slot.sub.amount) {
      const amtW = bold.widthOfTextAtSize(`Rp ${fmtAmt(slot.sub.amount)}`, 7.5)
      page.drawText(`Rp ${fmtAmt(slot.sub.amount)}`, {
        x: cx + cw - amtW - 10, y: cy + 13,
        font: bold, size: 7.5, color: C.yellow,
      })
    }
  }
}

function drawNoImage(page: PDFPage, x: number, y: number, w: number, h: number, reg: PDFFont, msg: string) {
  page.drawRectangle({ x, y, width: w, height: h, color: C.bg })
  const tw = reg.widthOfTextAtSize(msg, 7.5)
  page.drawText(msg, {
    x: x + (w - tw) / 2, y: y + h / 2 - 4,
    font: reg, size: 7.5, color: C.textMid,
  })
}

// ── Nota pages untuk satu driver ───────────────────────────────────────────
const SLOTS_PER_PAGE = COLS * ROWS  // 9

async function drawNotaPages(
  pdfDoc: PDFDocument,
  opts: {
    bold: PDFFont; reg: PDFFont
    driverName: string; dateRange: { from: string; to: string }
    companyName: string; subtitle: string
    submissions: Sub[]
    startPageNum: number; totalPages: number
    // PERUBAHAN #3 (PDF gen): Cache di-pass dari luar agar lintas halaman
    embedCache: EmbedCache
  }
) {
  const { bold, reg, driverName, dateRange, companyName, subtitle, submissions, startPageNum, totalPages, embedCache } = opts
  const slots     = buildSlots(submissions)
  const numPages  = Math.ceil(slots.length / SLOTS_PER_PAGE) || 1

  const availW = A4_W - MG * 2
  const availH = A4_H - MG * 2 - HDR_H - FTR_H
  const cw     = availW / COLS
  const ch     = availH / ROWS

  for (let pi = 0; pi < numPages; pi++) {
    const page       = pdfDoc.addPage([A4_W, A4_H])
    const pageSlots  = slots.slice(pi * SLOTS_PER_PAGE, (pi + 1) * SLOTS_PER_PAGE)

    drawHeader(page, {
      bold, reg, driverName, dateRange, companyName, subtitle,
      pageNum: startPageNum + pi, totalPages,
    })

    for (let i = 0; i < pageSlots.length; i++) {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const cx  = MG + col * cw
      const cy  = A4_H - MG - HDR_H - (row + 1) * ch
      await drawCell(pdfDoc, page, pageSlots[i], cx, cy, cw, ch, bold, reg, embedCache)
    }

    drawFooter(page, { reg })
  }

  return numPages
}

// ── Summary page ───────────────────────────────────────────────────────────
function drawSummaryPage(
  pdfDoc: PDFDocument,
  opts: {
    bold: PDFFont; reg: PDFFont
    dateRange: { from: string; to: string }; companyName: string; subtitle: string
    createdBy?: string; createdByTitle?: string
    approvedBy?: string; approvedByTitle?: string
    driverName?: string; submissions?: Sub[]
    drivers?: { name: string; submissions: Sub[] }[]
  }
) {
  const {
    bold, reg, dateRange, companyName, subtitle,
    createdBy, createdByTitle, approvedBy, approvedByTitle,
    driverName, submissions, drivers,
  } = opts

  const isMulti = !!drivers && drivers.length > 1
  const page    = pdfDoc.addPage([A4_W, A4_H])

  page.drawRectangle({ x: 0, y: A4_H - HDR_H, width: A4_W, height: HDR_H, color: C.hdrBg })
  page.drawRectangle({ x: 0, y: A4_H - HDR_H, width: 4, height: HDR_H, color: C.teal })
  page.drawText('RINGKASAN REIMBURSE', {
    x: MG, y: A4_H - 22, font: bold, size: 12, color: C.white,
  })
  page.drawText(
    isMulti
      ? `${drivers!.length} Driver  ·  ${subtitle || companyName}`
      : `Driver: ${driverName}  ·  ${subtitle || companyName}`,
    { x: MG, y: A4_H - 36, font: reg, size: 8, color: C.textLight }
  )
  page.drawText(`Periode: ${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`, {
    x: MG, y: A4_H - 50, font: reg, size: 8, color: C.textMid,
  })

  const TW = A4_W - MG * 2
  const TX = MG
  let y    = A4_H - HDR_H - 24

  function drawTableHeader(yy: number) {
    page.drawRectangle({ x: TX, y: yy - 16, width: TW, height: 22, color: C.labelBg })
    page.drawRectangle({ x: TX, y: yy - 16, width: 3, height: 22, color: C.teal })
    page.drawText('Kategori',    { x: TX + 12, y: yy - 7, font: bold, size: 8, color: C.white })
    page.drawText('Jumlah Nota', { x: TX + 280, y: yy - 7, font: bold, size: 8, color: C.white })
    page.drawText('Total (Rp)', { x: TX + 380, y: yy - 7, font: bold, size: 8, color: C.white })
  }

  if (isMulti) {
    let grandTotal = 0
    let grandCount = 0

    for (const drv of drivers!) {
      if (!drv.submissions.length) continue

      page.drawRectangle({ x: TX, y: y - 14, width: TW, height: 20, color: rgb(0.12, 0.12, 0.14) })
      page.drawRectangle({ x: TX, y: y - 14, width: 3, height: 20, color: C.teal })
      page.drawText(drv.name.toUpperCase(), {
        x: TX + 10, y: y - 6, font: bold, size: 8.5, color: C.teal,
      })
      y -= 22

      drawTableHeader(y)
      y -= 24

      const grouped = groupByCategory(drv.submissions)
      let drvTotal = 0; let ri = 0
      for (const [cat, data] of Object.entries(grouped)) {
        page.drawRectangle({
          x: TX, y: y - 13, width: TW, height: 18,
          color: ri % 2 === 0 ? C.bg : C.white,
          borderColor: C.border, borderWidth: 0.3,
        })
        page.drawText(cat.charAt(0).toUpperCase() + cat.slice(1), { x: TX + 10, y: y - 5, font: reg, size: 8, color: C.charcoal })
        page.drawText(String(data.count),     { x: TX + 290, y: y - 5, font: reg,  size: 8, color: C.charcoal })
        page.drawText(fmtAmt(data.total),     { x: TX + 380, y: y - 5, font: reg,  size: 8, color: C.charcoal })
        drvTotal += data.total; ri++; y -= 18
      }

      page.drawRectangle({ x: TX, y: y - 13, width: TW, height: 18, color: rgb(0.10, 0.10, 0.12) })
      page.drawText(`Subtotal ${drv.name}`, { x: TX + 10, y: y - 5, font: bold, size: 8, color: C.white })
      page.drawText(`${drv.submissions.length} nota`, { x: TX + 290, y: y - 5, font: bold, size: 8, color: C.teal })
      page.drawText(`Rp ${fmtAmt(drvTotal)}`, { x: TX + 370, y: y - 5, font: bold, size: 8.5, color: C.yellow })

      grandTotal += drvTotal
      grandCount += drv.submissions.length
      y -= 26
    }

    page.drawRectangle({ x: TX, y: y - 16, width: TW, height: 24, color: C.hdrBg })
    page.drawRectangle({ x: TX, y: y - 16, width: 4, height: 24, color: C.teal })
    page.drawText('TOTAL KESELURUHAN', { x: TX + 12, y: y - 6, font: bold, size: 9.5, color: C.white })
    page.drawText(`${grandCount} nota`, { x: TX + 280, y: y - 6, font: bold, size: 9, color: C.teal })
    page.drawText(`Rp ${fmtAmt(grandTotal)}`, { x: TX + 360, y: y - 6, font: bold, size: 10, color: C.yellow })
    y -= 42

  } else {
    const subs       = submissions || drivers?.[0]?.submissions || []
    const grouped    = groupByCategory(subs)
    const grandTotal = subs.reduce((s, sub) => s + (sub.amount || 0), 0)

    drawTableHeader(y)
    y -= 24

    let ri = 0
    for (const [cat, data] of Object.entries(grouped)) {
      page.drawRectangle({
        x: TX, y: y - 14, width: TW, height: 20,
        color: ri % 2 === 0 ? C.bg : C.white,
        borderColor: C.border, borderWidth: 0.3,
      })
      page.drawText(cat.charAt(0).toUpperCase() + cat.slice(1), { x: TX + 10, y: y - 6, font: reg, size: 8.5, color: C.charcoal })
      page.drawText(String(data.count),     { x: TX + 288, y: y - 6, font: reg,  size: 8.5, color: C.charcoal })
      page.drawText(fmtAmt(data.total),     { x: TX + 380, y: y - 6, font: reg,  size: 8.5, color: C.charcoal })
      ri++; y -= 20
    }

    page.drawRectangle({ x: TX, y: y - 16, width: TW, height: 24, color: C.hdrBg })
    page.drawRectangle({ x: TX, y: y - 16, width: 4, height: 24, color: C.teal })
    page.drawText('TOTAL KESELURUHAN', { x: TX + 12, y: y - 6, font: bold, size: 9.5, color: C.white })
    page.drawText(`${subs.length} nota`, { x: TX + 288, y: y - 6, font: bold, size: 9, color: C.teal })
    page.drawText(`Rp ${fmtAmt(grandTotal)}`, { x: TX + 370, y: y - 6, font: bold, size: 10, color: C.yellow })
    y -= 42
  }

  page.drawRectangle({
    x: TX, y: y - 12, width: TW, height: 18,
    color: C.bg, borderColor: C.border, borderWidth: 0.4,
  })
  page.drawText(
    'Nota dengan nominal > Rp 250.000 dilengkapi foto bukti transaksi pada halaman nota.',
    { x: TX + 10, y: y - 4, font: reg, size: 7, color: C.textMid, maxWidth: TW - 20 }
  )
  y -= 30

  page.drawText('* Urutan nomor berdasarkan tanggal struk (bill date)', {
    x: TX, y, font: reg, size: 7, color: C.textLight,
  })
  y -= 50

  const SIG_W = 160

  page.drawText('Dibuat oleh,', { x: TX, y, font: reg, size: 8.5, color: C.textMid })
  page.drawLine({
    start: { x: TX, y: y - 46 }, end: { x: TX + SIG_W, y: y - 46 },
    thickness: 0.5, color: C.border,
  })
  page.drawText(createdByTitle || 'Driver', { x: TX, y: y - 58, font: reg, size: 8, color: C.textMid })
  page.drawText(createdBy || driverName || '', { x: TX, y: y - 70, font: bold, size: 8.5, color: C.charcoal })

  const sigR = TX + TW - SIG_W
  page.drawText('Disetujui oleh,', { x: sigR, y, font: reg, size: 8.5, color: C.textMid })
  page.drawLine({
    start: { x: sigR, y: y - 46 }, end: { x: sigR + SIG_W, y: y - 46 },
    thickness: 0.5, color: C.border,
  })
  page.drawText(approvedByTitle || 'Admin / Finance', { x: sigR, y: y - 58, font: reg, size: 8, color: C.textMid })
  page.drawText(approvedBy || '', { x: sigR, y: y - 70, font: bold, size: 8.5, color: C.charcoal })
}

// ── Main export ────────────────────────────────────────────────────────────
export async function generateReimbursementPDF(params: GeneratePDFParams): Promise<Uint8Array> {
  const {
    dateRange,
    companyName = 'Company',
    subtitle    = '',
    createdBy, createdByTitle,
    approvedBy, approvedByTitle,
  } = params

  const pdfDoc = await PDFDocument.create()
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // PERUBAHAN #2 + #3 (PDF gen): Satu embed cache untuk seluruh PDF.
  // Gambar yang sama (misal nota yang muncul di slot 'nota' dan 'proof')
  // hanya di-embed satu kali ke dalam dokumen PDF, bukan dua kali.
  // Ini menghemat memori dan waktu embed, terutama untuk nota HV (> 250rb).
  const embedCache: EmbedCache = new Map()

  const isMulti = !!params.drivers && params.drivers.length > 1

  if (isMulti) {
    const drivers = params.drivers!.map(d => ({ ...d, submissions: sortByDate(d.submissions) }))

    const totalNotaPages = drivers.reduce((sum, d) => {
      return sum + (Math.ceil(buildSlots(d.submissions).length / SLOTS_PER_PAGE) || 1)
    }, 0)
    const totalPages = totalNotaPages + 1

    let cur = 1
    for (const drv of drivers) {
      if (!drv.submissions.length) continue
      const added = await drawNotaPages(pdfDoc, {
        bold, reg,
        driverName: drv.name, dateRange, companyName, subtitle,
        submissions: drv.submissions,
        startPageNum: cur, totalPages,
        embedCache,
      })
      cur += added
    }

    drawSummaryPage(pdfDoc, {
      bold, reg, dateRange, companyName, subtitle,
      createdBy, createdByTitle, approvedBy, approvedByTitle,
      drivers: drivers.map(d => ({ name: d.name, submissions: d.submissions })),
    })

  } else {
    const name  = params.driverName || params.drivers?.[0]?.name || 'Driver'
    const raw   = params.submissions || params.drivers?.[0]?.submissions || []
    const subs  = sortByDate(raw)
    const slots = buildSlots(subs)

    const notaPages  = Math.ceil(slots.length / SLOTS_PER_PAGE) || 1
    const totalPages = notaPages + 1

    await drawNotaPages(pdfDoc, {
      bold, reg,
      driverName: name, dateRange, companyName, subtitle,
      submissions: subs,
      startPageNum: 1, totalPages,
      embedCache,
    })

    drawSummaryPage(pdfDoc, {
      bold, reg, dateRange, companyName, subtitle,
      createdBy, createdByTitle, approvedBy, approvedByTitle,
      driverName: name, submissions: subs,
    })
  }

  // Setelah selesai, bersihkan cache — tidak perlu lagi
  embedCache.clear()

  return pdfDoc.save()
}
