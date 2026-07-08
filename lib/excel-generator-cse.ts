import * as ExcelJS from 'exceljs'

export type CSEReportRow = {
  no: number
  date: string
  branchName: string
  brand: 'IM3' | '3ID'
  cseName: string
  mcName: string
  category: string
  description?: string | null
  amount: number
  imageData?: Uint8Array
  proofImageData?: Uint8Array
  markingImageData?: Uint8Array
}

export type CSEBranchExcelParams = {
  branchName: string
  brand: 'IM3' | '3ID'
  title: string
  subtitle: string
  proposalTitle?: string
  dateRange: { from: string; to: string }
  rows: CSEReportRow[]
  reportDate?: string
}

const HIGH_VALUE_THRESHOLD = 250000
const FONT_NAME = 'Arial'

const COLOR = {
  headerBg: 'FF1A1A1C',
  headerText: 'FFFFFFFF',
  subheaderBg: 'FF2D2D30',
  totalBg: 'FF0F2D4A',
  altRow: 'FFF5F5F7',
  border: 'FFD0D0D4',
  accentYellow: 'FFFFCB05',
  accentTeal: 'FF32BCAD', // [BARU] dipakai untuk baris "ALL" biar konsisten dgn driver
}

function border(style: ExcelJS.BorderStyle = 'thin'): ExcelJS.Borders {
  const s = { style, color: { argb: COLOR.border } }
  return { top: s, bottom: s, left: s, right: s } as ExcelJS.Borders
}
function centerAlign(wrap = false): Partial<ExcelJS.Alignment> { return { horizontal: 'center', vertical: 'middle', wrapText: wrap } }
function leftAlign(wrap = false): Partial<ExcelJS.Alignment> { return { horizontal: 'left', vertical: 'middle', wrapText: wrap } }
function rightAlign(): Partial<ExcelJS.Alignment> { return { horizontal: 'right', vertical: 'middle' } }

function setCell(ws: ExcelJS.Worksheet, row: number, col: number, value: any, style: {
  font?: Partial<ExcelJS.Font>; fill?: ExcelJS.Fill; alignment?: Partial<ExcelJS.Alignment>
  border?: Partial<ExcelJS.Borders>; numFmt?: string
} = {}) {
  const cell = ws.getCell(row, col)
  if (value !== undefined && value !== null) cell.value = value
  if (style.font) cell.font = style.font
  if (style.fill) cell.fill = style.fill
  if (style.alignment) cell.alignment = style.alignment
  if (style.border) cell.border = style.border
  if (style.numFmt) cell.numFmt = style.numFmt
}

function fmtExcelDate(dateStr: string): string {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return dateStr }
}

function itemLabel(category: string, description?: string | null): string {
  const c = (category || '').toLowerCase()
  if (c.includes('bensin') || c.includes('bbm')) return 'BBM'
  if (c.includes('tol')) return 'Toll'
  if (c.includes('parkir')) return 'Parkir'
  if (c === 'lainnya') return description ? description : 'Lainnya'
  return category
}

function detectExt(data: Uint8Array): 'jpeg' | 'png' {
  if (data.length > 4 && data[0] === 0x89 && data[1] === 0x50) return 'png'
  return 'jpeg'
}

// ─── Signature block (dipakai di Rekap & Disposisi) ───────────────────────
// [BARU] Sebelumnya "Proposed by," -> (jarak 5 baris) -> "Nama" -> (jarak 5
// baris) -> "Title" — jaraknya sama-rata dan kejauhan, gak ada kotak/border
// buat area tanda tangan sama sekali. Sekarang:
//   - Ada KOTAK BORDER berisi ruang kosong buat tanda tangan asli (3 baris).
//   - "Nama" nempel tepat di bawah kotak itu (underline, jadi kelihatan
//     seperti garis tanda tangan).
//   - "Title" nempel tepat di bawah "Nama" (gak ada jarak jauh lagi).
// Mengembalikan nomor baris terakhir yang dipakai (buat elemen setelahnya).
function buildSignatureBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  leftCols: [number, number],   // [colStart, colEnd] untuk "Proposed by,"
  rightCols: [number, number],  // [colStart, colEnd] untuk "Approved by,"
): number {
  const SIGN_SPACE_ROWS = 3 // ruang kosong buat tanda tangan asli, dikasih border

  const label = (row: number, cols: [number, number], text: string) => {
    setCell(ws, row, cols[0], text, { font: { size: 9, name: FONT_NAME }, alignment: centerAlign() })
    if (cols[1] > cols[0]) ws.mergeCells(row, cols[0], row, cols[1])
  }

  // Baris label "Proposed by," / "Approved by,"
  label(startRow, leftCols, 'Proposed by,')
  label(startRow, rightCols, 'Approved by,')

  // Kotak kosong (border) buat ruang tanda tangan asli
  const boxStart = startRow + 1
  const boxEnd = boxStart + SIGN_SPACE_ROWS - 1
  for (const cols of [leftCols, rightCols]) {
    for (let r = boxStart; r <= boxEnd; r++) {
      setCell(ws, r, cols[0], '', {})
      if (cols[1] > cols[0]) ws.mergeCells(r, cols[0], r, cols[1])
      const b: Partial<ExcelJS.Borders> = {
        left: { style: 'thin', color: { argb: COLOR.border } },
        right: { style: 'thin', color: { argb: COLOR.border } },
        top: r === boxStart ? { style: 'thin', color: { argb: COLOR.border } } : undefined,
        bottom: r === boxEnd ? { style: 'thin', color: { argb: COLOR.border } } : undefined,
      } as any
      ws.getCell(r, cols[0]).border = b
    }
  }

  // "Nama" tepat di bawah kotak — underline biar kelihatan kayak garis TTD
  const nameRow = boxEnd + 1
  const nameStyle = { font: { size: 9, name: FONT_NAME, underline: true }, alignment: centerAlign() }
  label(nameRow, leftCols, 'Nama')
  ws.getCell(nameRow, leftCols[0]).font = nameStyle.font
  ws.getCell(nameRow, leftCols[0]).alignment = nameStyle.alignment
  label(nameRow, rightCols, 'Nama')
  ws.getCell(nameRow, rightCols[0]).font = nameStyle.font
  ws.getCell(nameRow, rightCols[0]).alignment = nameStyle.alignment

  // "Title" nempel langsung di bawah "Nama", gak pakai jarak
  const titleRow = nameRow + 1
  label(titleRow, leftCols, 'Title')
  label(titleRow, rightCols, 'Title')

  return titleRow
}

// ─── Sheet 1: Rekap settlement ────────────────────────────────────────────
// [BARU] Sekarang di-render per grup CSE: nomor restart tiap CSE, ada baris
// subtotal per CSE (mirip pola driver: "SUMANTO | TOTAL | 366.500"), lalu di
// akhir ada section "ALL" yang menjumlahkan per kategori dari SEMUA CSE.

function buildRekapSheet(wb: ExcelJS.Workbook, params: CSEBranchExcelParams) {
  const { branchName, brand, title, subtitle, proposalTitle, dateRange, rows, reportDate } = params
  const ws = wb.addWorksheet('Rekap settlement', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })

  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 6
  ws.getColumn(3).width = 13
  ws.getColumn(4).width = 13
  ws.getColumn(5).width = 14
  ws.getColumn(6).width = 34
  ws.getColumn(7).width = 25
  ws.getColumn(8).width = 14
  ws.getColumn(9).width = 22

  setCell(ws, 2, 2, title, { font: { bold: true, size: 13, name: FONT_NAME } })
  setCell(ws, 3, 2, proposalTitle ? `Proposal ${proposalTitle}` : 'Proposal ', { font: { size: 10, name: FONT_NAME } })
  setCell(ws, 4, 2, 'Periode', { font: { size: 10, name: FONT_NAME } })
  setCell(ws, 4, 4, `: ${fmtExcelDate(dateRange.from)} - ${fmtExcelDate(dateRange.to)}`, { font: { size: 10, name: FONT_NAME } })
  setCell(ws, 5, 2, 'Regional', { font: { size: 10, name: FONT_NAME } })
  setCell(ws, 5, 4, `: ${branchName}`, { font: { size: 10, name: FONT_NAME } })
  if (subtitle) setCell(ws, 5, 8, subtitle, { font: { size: 9, italic: true, name: FONT_NAME, color: { argb: 'FF888888' } } })

  const hdrRow = 6
  const headers = ['No', 'Tanggal', 'Branch', 'Brand', 'Nama Kegiatan', 'Item', 'Total', 'Nama CSE']
  headers.forEach((h, i) => setCell(ws, hdrRow, i + 2, h, {
    font: { bold: true, size: 9, color: { argb: COLOR.headerText }, name: FONT_NAME },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } },
    alignment: centerAlign(), border: border(),
  }))

  // [BARU] Rows sudah datang ter-sort per CSE (dari prepareCSEReportRows) dan
  // `no` sudah di-assign restart per CSE. Di sini kita cuma perlu deteksi
  // pergantian grup CSE untuk menyisipkan baris subtotal.
  let r = hdrRow + 1
  let rowCounter = 0 // untuk selang-seling warna baris antar seluruh tabel

  let grandTotal = 0
  const grandByCategory: Record<string, number> = {}

  let i = 0
  while (i < rows.length) {
    const cseName = rows[i].cseName
    let cseTotal = 0

    // render semua baris milik CSE ini
    while (i < rows.length && rows[i].cseName === cseName) {
      const row = rows[i]
      const bg = (rowCounter % 2 === 0) ? 'FFFFFFFF' : COLOR.altRow
      setCell(ws, r, 2, row.no, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
      setCell(ws, r, 3, fmtExcelDate(row.date), { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
      setCell(ws, r, 4, row.branchName, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(), border: border() })
      setCell(ws, r, 5, row.brand, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
      setCell(ws, r, 6, `BBM MC ${row.mcName}`, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(true), border: border() })
      setCell(ws, r, 7, itemLabel(row.category, row.description), { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(true), border: border() })
      setCell(ws, r, 8, row.amount, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: rightAlign(), border: border(), numFmt: '#,##0' })
      setCell(ws, r, 9, row.cseName, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(), border: border() })

      cseTotal += row.amount
      grandTotal += row.amount
      grandByCategory[row.category] = (grandByCategory[row.category] || 0) + row.amount

      rowCounter++
      r++
      i++
    }

    // [BARU] baris subtotal per CSE — mirip pola driver "SUMANTO | TOTAL | 366.500"
    const subStyle = {
      font: { bold: true, size: 9, name: FONT_NAME, color: { argb: COLOR.headerText } },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLOR.totalBg } },
      border: border(),
    }
    setCell(ws, r, 2, '', subStyle)
    setCell(ws, r, 3, cseName, { ...subStyle, alignment: leftAlign() })
    setCell(ws, r, 4, '', subStyle)
    setCell(ws, r, 5, '', subStyle)
    setCell(ws, r, 6, 'TOTAL', { ...subStyle, alignment: leftAlign() })
    setCell(ws, r, 7, '', subStyle)
    setCell(ws, r, 8, cseTotal, {
      ...subStyle, alignment: rightAlign(), numFmt: '#,##0',
      font: { ...subStyle.font, color: { argb: COLOR.accentYellow } },
    })
    setCell(ws, r, 9, '', subStyle)
    r++
  }

  // [BARU] Section "ALL" — jumlah per kategori dari SEMUA CSE, nomor restart dari 1
  let allNo = 1
  for (const [cat, amt] of Object.entries(grandByCategory)) {
    const bg = (rowCounter % 2 === 0) ? 'FFFFFFFF' : COLOR.altRow
    setCell(ws, r, 2, allNo, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
    setCell(ws, r, 3, '', { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, border: border() })
    setCell(ws, r, 4, branchName, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(), border: border() })
    setCell(ws, r, 5, brand, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
    setCell(ws, r, 6, '', { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, border: border() })
    setCell(ws, r, 7, itemLabel(cat), { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(true), border: border() })
    setCell(ws, r, 8, amt, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: rightAlign(), border: border(), numFmt: '#,##0' })
    setCell(ws, r, 9, 'ALL', { font: { size: 9, name: FONT_NAME, bold: true, color: { argb: COLOR.accentTeal } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(), border: border() })
    allNo++
    rowCounter++
    r++
  }

  // Total Pengeluaran (grand total keseluruhan)
  const totRow = r + 1
  const totStyle = {
    font: { bold: true, size: 10, name: FONT_NAME, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLOR.totalBg } },
    border: border('medium' as ExcelJS.BorderStyle),
  }
  setCell(ws, totRow, 2, 'Total Pengeluaran', { ...totStyle, alignment: leftAlign() })
  ws.mergeCells(totRow, 2, totRow, 7)
  setCell(ws, totRow, 8, grandTotal, { ...totStyle, alignment: rightAlign(), numFmt: '#,##0', font: { ...totStyle.font, color: { argb: COLOR.accentYellow } } })

  // [BARU] Signature — kotak border rapi, "Nama" & "Title" nempel
  const sigStartRow = totRow + 3
  buildSignatureBlock(ws, sigStartRow, [3, 4], [6, 7])

  if (reportDate) {
    setCell(ws, 2, 9, reportDate, { font: { size: 8, italic: true, name: FONT_NAME, color: { argb: 'FF999999' } }, alignment: rightAlign() })
  }
}

// ─── Sheet 2: Nota & dokumentasi ───────────────────────────────────────────
// (tidak berubah — urutan rows tetap sama seperti yang diterima)

const IMG_ROW_HEIGHT = 202.5
const IMG_ROW_HEIGHT_PX = Math.round(IMG_ROW_HEIGHT * 96 / 72)
const CELL_C_WIDTH_PX = 330
const CELL_D_WIDTH_PX = 220

function addImageStacked(
  wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet,
  rowIdx0: number, colIdx0: number,
  images: { data: Uint8Array; label: string }[],
  cellWidthPx: number,
) {
  if (images.length === 0) return
  const slotH = IMG_ROW_HEIGHT_PX / images.length
  images.forEach((img, i) => {
    try {
      const imageId = wb.addImage({ buffer: img.data as any, extension: detectExt(img.data) })
      const targetH = slotH - 6
      const targetW = cellWidthPx - 10
      ws.addImage(imageId, {
        tl: { col: colIdx0 + 0.05, row: rowIdx0 + (i * slotH) / IMG_ROW_HEIGHT_PX + 0.02 } as any,
        ext: { width: targetW, height: targetH },
      })
    } catch {
      // gambar gagal di-embed — biarkan sel kosong daripada bikin seluruh export gagal
    }
  })
}

function buildNotaDokumentasiSheet(wb: ExcelJS.Workbook, rows: CSEReportRow[]) {
  const ws = wb.addWorksheet('Nota & dokumentasi', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })

  ws.getColumn(2).width = 6
  ws.getColumn(3).width = 47.26
  ws.getColumn(4).width = 30

  setCell(ws, 2, 2, 'note: jika nota lebih dari 250k, wajib melampirkan bukti transfer/edc/qris', {
    font: { size: 9, italic: true, name: FONT_NAME, color: { argb: 'FFB45309' } },
  })
  setCell(ws, 3, 2, 'nota wajib urut sesuai nomor di tabel', {
    font: { size: 9, italic: true, name: FONT_NAME, color: { argb: 'FF888888' } },
  })

  const hdrRow = 4
  setCell(ws, hdrRow, 2, 'No', { font: { bold: true, size: 9, name: FONT_NAME, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } }, alignment: centerAlign(), border: border() })
  setCell(ws, hdrRow, 3, 'Nota dan bukti transfer/edc/qris', { font: { bold: true, size: 9, name: FONT_NAME, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } }, alignment: centerAlign(), border: border() })
  setCell(ws, hdrRow, 4, 'Dokumentasi', { font: { bold: true, size: 9, name: FONT_NAME, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } }, alignment: centerAlign(), border: border() })

  let r = hdrRow + 1
  for (const row of rows) {
    ws.getRow(r).height = IMG_ROW_HEIGHT
    setCell(ws, r, 2, row.no, { font: { size: 9, name: FONT_NAME }, alignment: centerAlign(), border: border() })
    setCell(ws, r, 3, '', { border: border() })
    setCell(ws, r, 4, '', { border: border() })

    const notaImages: { data: Uint8Array; label: string }[] = []
    if (row.imageData) notaImages.push({ data: row.imageData, label: 'Nota' })
    if ((row.amount || 0) > HIGH_VALUE_THRESHOLD && row.proofImageData) {
      notaImages.push({ data: row.proofImageData, label: 'Bukti Transfer' })
    }
    addImageStacked(wb, ws, r - 1, 2, notaImages, CELL_C_WIDTH_PX)

    if (row.markingImageData) {
      addImageStacked(wb, ws, r - 1, 3, [{ data: row.markingImageData, label: 'Dokumentasi' }], CELL_D_WIDTH_PX)
    }

    r++
  }
}

// ─── Sheet 3: Disposisi ────────────────────────────────────────────────────

function buildDisposisiSheet(wb: ExcelJS.Workbook, params: CSEBranchExcelParams) {
  const ws = wb.addWorksheet('Disposisi', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })

  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 6
  ws.getColumn(3).width = 13
  ws.getColumn(4).width = 14
  ws.getColumn(5).width = 30
  ws.getColumn(6).width = 60

  setCell(ws, 2, 2, 'Disposition Form', { font: { bold: true, size: 13, name: FONT_NAME } })
  ws.mergeCells(2, 2, 2, 6)
  setCell(ws, 3, 2, `Settlement CA/Reimbursement ${params.branchName}`, { font: { size: 10, name: FONT_NAME } })
  ws.mergeCells(3, 2, 3, 6)

  const hdrRow = 5
  const headers = ['No', 'Date', 'Amount', 'Activities', 'Justification']
  headers.forEach((h, i) => setCell(ws, hdrRow, i + 2, h, {
    font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: FONT_NAME },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } },
    alignment: centerAlign(), border: border(),
  }))

  for (let i = 0; i < 8; i++) {
    const r = hdrRow + 2 + i
    for (let c = 2; c <= 6; c++) setCell(ws, r, c, '', { border: border() })
  }

  // [BARU] Signature — pakai blok yang sama biar konsisten sama sheet Rekap
  const sigStartRow = hdrRow + 2 + 8 + 3
  buildSignatureBlock(ws, sigStartRow, [2, 3], [5, 6])
}

// ─── Main export ────────────────────────────────────────────────────────────

export async function generateCSEBranchExcel(params: CSEBranchExcelParams): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sistem Reimburse IOH'
  workbook.created = new Date()

  buildRekapSheet(workbook, params)
  buildNotaDokumentasiSheet(workbook, params.rows)
  buildDisposisiSheet(workbook, params)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * [BARU] Nomor urut sekarang RESTART per CSE (bukan lanjut 1..N terus),
 * supaya nomor #1 CSE X di Excel = nomor #1 CSE X di PDF.
 *
 * PENTING: kalau ada file PDF generator CSE terpisah (mis. lib/cse-pdf-generator.ts),
 * pastikan fungsi penomorannya di sana JUGA di-update pakai logika yang sama
 * (sort by cseName lalu date, nomor restart tiap ganti cseName) — supaya
 * benar-benar konsisten antara PDF dan Excel seperti yang diminta.
 */
export function prepareCSEReportRows(
  submissions: Array<{
    driver_name: string
    mc_name: string
    category: string
    description?: string | null
    amount?: number | null
    bill_date?: string | null
    submission_date: string
    imageData?: Uint8Array
    proofImageData?: Uint8Array
    markingImageData?: Uint8Array
  }>,
  branchName: string,
  brand: 'IM3' | '3ID',
): CSEReportRow[] {
  const getDate = (s: typeof submissions[0]) => s.bill_date || s.submission_date
  const sorted = [...submissions].sort((a, b) => {
    const byCse = a.driver_name.localeCompare(b.driver_name)
    if (byCse !== 0) return byCse
    return new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime()
  })


  let currentCse: string | null = null
  let counter = 0

  return sorted.map(s => {
    if (s.driver_name !== currentCse) {
      currentCse = s.driver_name
      counter = 1
    } else {
      counter++
    }
    return {
      no: counter,
      date: getDate(s),
      branchName,
      brand,
      cseName: s.driver_name,
      mcName: s.mc_name,
      category: s.category,
      description: s.description,
      amount: s.amount || 0,
      imageData: s.imageData,
      proofImageData: s.proofImageData,
      markingImageData: s.markingImageData,
    }
  })
}