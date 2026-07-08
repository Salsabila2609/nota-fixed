import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'

const A4_W = 595.28
const A4_H = 841.89
const MG = 32
const HDR_H = 64
const FTR_H = 28

const HIGH_VALUE_THRESHOLD = 250000

const C = {
  red: rgb(237 / 255, 28 / 255, 36 / 255),
  yellow: rgb(255 / 255, 203 / 255, 5 / 255),
  teal: rgb(50 / 255, 188 / 255, 173 / 255),
  charcoal: rgb(77 / 255, 77 / 255, 79 / 255),
  bg: rgb(245 / 255, 245 / 255, 247 / 255),
  white: rgb(1, 1, 1),
  border: rgb(232 / 255, 232 / 255, 234 / 255),
  hdrBg: rgb(22 / 255, 22 / 255, 24 / 255),
  labelBg: rgb(36 / 255, 36 / 255, 38 / 255),
  textMid: rgb(0.45, 0.45, 0.46),
  textLight: rgb(0.72, 0.72, 0.74),
  subtotalBg: rgb(15 / 255, 45 / 255, 74 / 255),
}

export type CSESubmission = {
  id: string
  cse_name: string
  mc_name: string
  category: string
  description?: string | null
  amount?: number | null
  bill_date?: string | null
  submission_date: string
  imageData?: Uint8Array
  proofImageData?: Uint8Array
  markingImageData?: Uint8Array
}

export type GenerateCSEBranchPDFParams = {
  branchName: string
  brand: 'IM3' | '3ID'
  dateRange: { from: string; to: string }
  submissions: CSESubmission[]
  companyName?: string
  subtitle?: string
  proposalTitle?: string
}

function fmtDate(d?: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtAmt(n?: number | null): string {
  return new Intl.NumberFormat('id-ID').format(n || 0)
}
function getPrimaryDate(s: CSESubmission): string {
  return s.bill_date || s.submission_date || ''
}
function itemLabel(category: string, description?: string | null): string {
  const c = (category || '').toLowerCase()
  if (c.includes('bensin') || c.includes('bbm')) return 'BBM'
  if (c.includes('tol')) return 'Toll'
  if (c.includes('parkir')) return 'Parkir'
  if (c === 'lainnya') return description ? description : 'Lainnya'
  return category
}
function sortSubs(subs: CSESubmission[]): CSESubmission[] {
  return [...subs].sort((a, b) => {
    const byCse = a.cse_name.localeCompare(b.cse_name)
    if (byCse !== 0) return byCse
    return new Date(getPrimaryDate(a)).getTime() - new Date(getPrimaryDate(b)).getTime()
  })
}
function groupByCse(subs: CSESubmission[]): { cseName: string; mcName: string; items: CSESubmission[] }[] {
  const groups: { cseName: string; mcName: string; items: CSESubmission[] }[] = []
  for (const s of subs) {
    const last = groups[groups.length - 1]
    if (last && last.cseName === s.cse_name) last.items.push(s)
    else groups.push({ cseName: s.cse_name, mcName: s.mc_name, items: [s] })
  }
  return groups
}

async function embedAny(pdfDoc: PDFDocument, data: Uint8Array) {
  try { return await pdfDoc.embedJpg(data) } catch { return await pdfDoc.embedPng(data) }
}

function drawHeaderBar(page: PDFPage, opts: {
  bold: PDFFont; reg: PDFFont; title: string
  branchName: string; brand: string; dateRange: { from: string; to: string }
  companyName: string; subtitle: string; pageNum: number; totalPages: number
}) {
  const { bold, reg, title, branchName, brand, dateRange, companyName, subtitle, pageNum, totalPages } = opts
  const y0 = A4_H - HDR_H
  page.drawRectangle({ x: 0, y: y0, width: A4_W, height: HDR_H, color: C.hdrBg })
  page.drawRectangle({ x: 0, y: y0, width: 4, height: HDR_H, color: C.teal })

  page.drawText(title, { x: MG, y: A4_H - 22, font: bold, size: 12, color: C.white, maxWidth: A4_W - MG * 2 - 130 })
  page.drawText(subtitle || companyName, { x: MG, y: A4_H - 36, font: reg, size: 8, color: C.textLight })
  page.drawText(`Branch: ${branchName}  -  Brand: ${brand}`, { x: MG, y: A4_H - 50, font: bold, size: 8.5, color: C.teal })
  page.drawText(`Periode: ${fmtDate(dateRange.from)} - ${fmtDate(dateRange.to)}`, {
    x: A4_W - MG - 190, y: A4_H - 36, font: reg, size: 7.5, color: C.textLight,
  })
  page.drawText(`Hal. ${pageNum} / ${totalPages}`, {
    x: A4_W - MG - 60, y: A4_H - 50, font: reg, size: 7.5, color: C.textMid,
  })
}

function drawFooterBar(page: PDFPage, reg: PDFFont) {
  const y = 10
  page.drawLine({ start: { x: MG, y: y + 14 }, end: { x: A4_W - MG, y: y + 14 }, thickness: 0.4, color: C.border })
  page.drawText('Digenerate otomatis oleh sistem reimburse', { x: MG, y, font: reg, size: 6.5, color: C.textLight })
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  page.drawText(`Dicetak: ${now} WIB`, { x: A4_W - MG - 128, y, font: reg, size: 6.5, color: C.textLight })
}

// ── Halaman foto per CSE ─────────────────────────────────────────────────
const ROWS_PER_IMG_PAGE = 3
const CELL_LABEL_H = 16

async function drawCellImage(
  pdfDoc: PDFDocument, page: PDFPage, data: Uint8Array | undefined,
  x: number, y: number, w: number, h: number, reg: PDFFont, placeholderMsg: string,
) {
  if (!data) {
    page.drawRectangle({ x, y, width: w, height: h, color: C.bg, borderColor: C.border, borderWidth: 0.5 })
    const tw = reg.widthOfTextAtSize(placeholderMsg, 7)
    page.drawText(placeholderMsg, { x: x + (w - tw) / 2, y: y + h / 2 - 3, font: reg, size: 7, color: C.textMid })
    return
  }
  try {
    const emb = await embedAny(pdfDoc, data)
    const d = emb.scaleToFit(w - 6, h - 6)
    page.drawRectangle({ x, y, width: w, height: h, color: C.white, borderColor: C.border, borderWidth: 0.5 })
    page.drawImage(emb, { x: x + (w - d.width) / 2, y: y + (h - d.height) / 2, width: d.width, height: d.height })
  } catch {
    page.drawRectangle({ x, y, width: w, height: h, color: C.bg, borderColor: C.border, borderWidth: 0.5 })
  }
}

type ImgCtx = { branchName: string; brand: string; dateRange: { from: string; to: string }; companyName: string; subtitle: string }

// [BARU] numberOffset dihapus — nomor SELALU restart dari 1 untuk setiap grup CSE,
// supaya "No. 1" di halaman foto CSE manapun = "No. 1" di tabel Excel & rekap CSE yang sama.
async function drawCseImagePages(
  pdfDoc: PDFDocument, bold: PDFFont, reg: PDFFont,
  group: { cseName: string; mcName: string; items: CSESubmission[] },
  ctx: ImgCtx, startPageNum: number, totalPages: number,
): Promise<number> {
  const numPages = Math.ceil(group.items.length / ROWS_PER_IMG_PAGE) || 1
  const availH = A4_H - MG * 2 - HDR_H - FTR_H
  const rowH = availH / ROWS_PER_IMG_PAGE
  const rowInnerH = rowH - 6
  const TW = A4_W - MG * 2

  for (let pi = 0; pi < numPages; pi++) {
    const page = pdfDoc.addPage([A4_W, A4_H])
    drawHeaderBar(page, {
      bold, reg, title: `LAMPIRAN FOTO NOTA - CSE: ${group.cseName.toUpperCase()}`,
      branchName: ctx.branchName, brand: ctx.brand, dateRange: ctx.dateRange,
      companyName: ctx.companyName, subtitle: ctx.subtitle, pageNum: startPageNum + pi, totalPages,
    })

    const slice = group.items.slice(pi * ROWS_PER_IMG_PAGE, (pi + 1) * ROWS_PER_IMG_PAGE)
    for (let ri = 0; ri < slice.length; ri++) {
      const s = slice[ri]
      // [BARU] tanpa offset — restart 1 per grup
      const rowNum = pi * ROWS_PER_IMG_PAGE + ri + 1
      const rowTop = A4_H - MG - HDR_H - ri * rowH
      const cellY = rowTop - rowInnerH - CELL_LABEL_H

      page.drawRectangle({ x: MG, y: rowTop - CELL_LABEL_H, width: TW, height: CELL_LABEL_H, color: C.labelBg })
      page.drawText(
        `No. ${rowNum}  -  BBM MC ${group.mcName}  -  ${fmtDate(getPrimaryDate(s))}  -  Rp ${fmtAmt(s.amount)}`,
        { x: MG + 6, y: rowTop - CELL_LABEL_H + 4, font: bold, size: 7.5, color: C.white, maxWidth: TW - 12 }
      )

      const needsBankProof = (s.amount || 0) > HIGH_VALUE_THRESHOLD

      if (needsBankProof) {
        const colW = (TW - 8) / 3
        await drawCellImage(pdfDoc, page, s.imageData, MG, cellY, colW, rowInnerH, reg, 'Nota tidak ada')
        await drawCellImage(pdfDoc, page, s.proofImageData, MG + colW + 4, cellY, colW, rowInnerH, reg, 'Bukti transfer belum ada')
        await drawCellImage(pdfDoc, page, s.markingImageData, MG + (colW + 4) * 2, cellY, colW, rowInnerH, reg, 'Dokumentasi tidak ada')
        if (ri === 0) {
          ;['Nota', 'Bukti Transaksi Bank (>Rp250rb)', 'Dokumentasi'].forEach((lbl, ci) => {
            page.drawText(lbl, { x: MG + ci * (colW + 4) + 2, y: rowTop - CELL_LABEL_H - 8, font: reg, size: 6, color: C.textLight })
          })
        }
      } else {
        const colW = (TW - 4) / 2
        await drawCellImage(pdfDoc, page, s.imageData, MG, cellY, colW, rowInnerH, reg, 'Nota tidak ada')
        await drawCellImage(pdfDoc, page, s.markingImageData, MG + colW + 4, cellY, colW, rowInnerH, reg, 'Dokumentasi tidak ada')
        if (ri === 0) {
          ;['Nota', 'Dokumentasi'].forEach((lbl, ci) => {
            page.drawText(lbl, { x: MG + ci * (colW + 4) + 2, y: rowTop - CELL_LABEL_H - 8, font: reg, size: 6, color: C.textLight })
          })
        }
      }
    }

    drawFooterBar(page, reg)
  }

  return numPages
}

// ── Halaman rekap (di akhir) ─────────────────────────────────────────────
const ROW_H = 20

// [BARU] tipe baris render: entri biasa (nomor restart per CSE) atau baris subtotal per CSE
type RecapRenderRow =
  | { type: 'entry'; no: number; sub: CSESubmission }
  | { type: 'subtotal'; cseName: string; total: number }

// [BARU] bangun daftar baris rekap: per grup CSE, nomor 1..N lokal, lalu 1 baris subtotal
function buildRecapRenderRows(groups: { cseName: string; mcName: string; items: CSESubmission[] }[]): RecapRenderRow[] {
  const rows: RecapRenderRow[] = []
  for (const g of groups) {
    let no = 0
    let total = 0
    for (const s of g.items) {
      no++
      total += s.amount || 0
      rows.push({ type: 'entry', no, sub: s })
    }
    rows.push({ type: 'subtotal', cseName: g.cseName, total })
  }
  return rows
}

function drawRecapPages(
  pdfDoc: PDFDocument, bold: PDFFont, reg: PDFFont,
  groups: { cseName: string; mcName: string; items: CSESubmission[] }[], // [BARU] terima groups, bukan flat subs
  ctx: ImgCtx & { proposalTitle?: string },
  startPageNum: number, totalPages: number,
): number {
  const renderRows = buildRecapRenderRows(groups) // [BARU]

  const availH = A4_H - MG * 2 - HDR_H - FTR_H
  const headerBlockH = 70
  const rowsFirstPage = Math.floor((availH - headerBlockH - 24) / ROW_H)
  const rowsOtherPage = Math.floor((availH - 24) / ROW_H)

  let remaining = renderRows.length
  let numPages = 1
  if (remaining > rowsFirstPage) {
    remaining -= rowsFirstPage
    numPages += Math.ceil(remaining / rowsOtherPage)
  }

  let grandTotal = 0
  let cursor = 0

  for (let pi = 0; pi < numPages; pi++) {
    const page = pdfDoc.addPage([A4_W, A4_H])
    drawHeaderBar(page, {
      bold, reg, title: 'REKAP REIMBURSEMENT / SETTLEMENT',
      branchName: ctx.branchName, brand: ctx.brand, dateRange: ctx.dateRange,
      companyName: ctx.companyName, subtitle: ctx.subtitle, pageNum: startPageNum + pi, totalPages,
    })

    let y = A4_H - MG - HDR_H - 6
    const TW = A4_W - MG * 2

    if (pi === 0) {
      page.drawText(`Proposal${ctx.proposalTitle ? ': ' + ctx.proposalTitle : ' : ______________________'}`, {
        x: MG, y, font: reg, size: 9, color: C.charcoal,
      })
      y -= 16
      page.drawText(`Periode : ${fmtDate(ctx.dateRange.from)} - ${fmtDate(ctx.dateRange.to)}`, {
        x: MG, y, font: reg, size: 9, color: C.charcoal,
      })
      y -= 16
      page.drawText(`Regional : ${ctx.branchName}`, { x: MG, y, font: reg, size: 9, color: C.charcoal })
      y -= 24
    }

    page.drawRectangle({ x: MG, y: y - 16, width: TW, height: 20, color: C.labelBg })
    const cols = [
      { label: 'No', x: MG + 6 },
      { label: 'Tanggal', x: MG + 30 },
      { label: 'Branch', x: MG + 100 },
      { label: 'Brand', x: MG + 155 },
      { label: 'Nama Kegiatan', x: MG + 200 },
      { label: 'Item', x: MG + 340 },
      { label: 'Total', x: MG + 385 },
      { label: 'Nama CSE', x: MG + 450 },
    ]
    cols.forEach(c => page.drawText(c.label, { x: c.x, y: y - 10, font: bold, size: 7.5, color: C.white }))
    y -= 20

    const rowsThisPage = pi === 0 ? rowsFirstPage : rowsOtherPage
    const slice = renderRows.slice(cursor, cursor + rowsThisPage)
    cursor += slice.length

    slice.forEach((rr, i) => {
      const bg = i % 2 === 0 ? C.white : C.bg

      // [BARU] baris subtotal per CSE — mirip pola driver "SUMANTO | TOTAL"
      if (rr.type === 'subtotal') {
        page.drawRectangle({ x: MG, y: y - 15, width: TW, height: ROW_H, color: C.subtotalBg })
        page.drawText(`${rr.cseName}  -  TOTAL`, { x: MG + 6, y: y - 10, font: bold, size: 7.5, color: C.white })
        const totStr = fmtAmt(rr.total)
        const totW = bold.widthOfTextAtSize(totStr, 7.5)
        page.drawText(totStr, { x: MG + 385, y: y - 10, font: bold, size: 7.5, color: C.yellow })
        y -= ROW_H
        return
      }

      const s = rr.sub
      page.drawRectangle({ x: MG, y: y - 15, width: TW, height: ROW_H, color: bg, borderColor: C.border, borderWidth: 0.3 })
      page.drawText(String(rr.no), { x: MG + 6, y: y - 10, font: reg, size: 7.5, color: C.charcoal })
      page.drawText(fmtDate(getPrimaryDate(s)), { x: MG + 30, y: y - 10, font: reg, size: 7, color: C.charcoal })
      page.drawText(ctx.branchName, { x: MG + 100, y: y - 10, font: reg, size: 7, color: C.charcoal, maxWidth: 52 })
      page.drawText(ctx.brand, { x: MG + 155, y: y - 10, font: reg, size: 7, color: C.charcoal })
      page.drawText(`BBM MC ${s.mc_name}`, { x: MG + 200, y: y - 10, font: reg, size: 7, color: C.charcoal, maxWidth: 138 })
      page.drawText(itemLabel(s.category, s.description), { x: MG + 340, y: y - 10, font: reg, size: 7, color: C.charcoal, maxWidth: 42 })
      page.drawText(fmtAmt(s.amount), { x: MG + 385, y: y - 10, font: reg, size: 7, color: C.charcoal })
      page.drawText(s.cse_name, { x: MG + 450, y: y - 10, font: reg, size: 7, color: C.charcoal, maxWidth: TW - 450 - 6 })
      grandTotal += s.amount || 0
      y -= ROW_H
    })

    if (pi === numPages - 1) {
      y -= 6
      page.drawRectangle({ x: MG, y: y - 18, width: TW, height: 22, color: C.hdrBg })
      page.drawText('TOTAL PENGELUARAN', { x: MG + 8, y: y - 11, font: bold, size: 9, color: C.white })
      const totStr = `Rp ${fmtAmt(grandTotal)}`
      const totW = bold.widthOfTextAtSize(totStr, 10)
      page.drawText(totStr, { x: MG + TW - totW - 6, y: y - 11, font: bold, size: 10, color: C.yellow })
      y -= 50

      const sigW = (TW - 40) / 2
      page.drawText('Proposed by,', { x: MG, y, font: reg, size: 9, color: C.charcoal })
      page.drawText('Approved by,', { x: MG + sigW + 40, y, font: reg, size: 9, color: C.charcoal })
      y -= 60
      page.drawLine({ start: { x: MG, y }, end: { x: MG + sigW, y }, thickness: 0.6, color: C.charcoal })
      page.drawLine({ start: { x: MG + sigW + 40, y }, end: { x: MG + sigW + 40 + sigW, y }, thickness: 0.6, color: C.charcoal })
      y -= 12
      page.drawText('( Nama )', { x: MG, y, font: reg, size: 8, color: C.textMid })
      page.drawText('( Nama )', { x: MG + sigW + 40, y, font: reg, size: 8, color: C.textMid })
      y -= 14
      page.drawText('Title: ______________________', { x: MG, y, font: reg, size: 8, color: C.textMid })
      page.drawText('Title: ______________________', { x: MG + sigW + 40, y, font: reg, size: 8, color: C.textMid })
    }

    drawFooterBar(page, reg)
  }

  return numPages
}

// ── Main export ───────────────────────────────────────────────────────────
export async function generateCSEBranchPDF(params: GenerateCSEBranchPDFParams): Promise<Uint8Array> {
  const { branchName, brand, dateRange, companyName = 'Company', subtitle = '', proposalTitle } = params
  const subs = sortSubs(params.submissions)
  const groups = groupByCse(subs)

  const pdfDoc = await PDFDocument.create()
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const reg = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const ctx = { branchName, brand, dateRange, companyName, subtitle }

  const imagePagesPerGroup = groups.map(g => Math.ceil(g.items.length / ROWS_PER_IMG_PAGE) || 1)
  const totalImagePages = imagePagesPerGroup.reduce((a, b) => a + b, 0)

  // [BARU] hitung ulang estimasi halaman rekap dengan menambahkan baris subtotal per CSE
  const renderRowsCount = subs.length + groups.length // tiap grup nambah 1 baris subtotal
  const availH = A4_H - MG * 2 - HDR_H - FTR_H
  const rowsFirstPage = Math.floor((availH - 70 - 24) / ROW_H)
  const rowsOtherPage = Math.floor((availH - 24) / ROW_H)
  let recapPages = 1
  if (renderRowsCount > rowsFirstPage) {
    recapPages += Math.ceil((renderRowsCount - rowsFirstPage) / rowsOtherPage)
  }

  const totalPages = totalImagePages + recapPages

  let pageCursor = 1
  // [BARU] numberOffset dihapus dari pemanggilan — tiap grup restart sendiri
  for (let gi = 0; gi < groups.length; gi++) {
    const added = await drawCseImagePages(pdfDoc, bold, reg, groups[gi], ctx, pageCursor, totalPages)
    pageCursor += added
  }

  // [BARU] kirim groups (bukan flat subs) supaya drawRecapPages bisa insert subtotal per CSE
  drawRecapPages(pdfDoc, bold, reg, groups, { ...ctx, proposalTitle }, pageCursor, totalPages)

  return pdfDoc.save()
}