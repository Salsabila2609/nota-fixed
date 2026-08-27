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

const FONT_NAME = 'Arial'

const COLOR = {
  headerBg: 'FF1A1A1C',
  headerText: 'FFFFFFFF',
  subheaderBg: 'FF2D2D30',
  totalBg: 'FF0F2D4A',
  altRow: 'FFF5F5F7',
  border: 'FFD0D0D4',
  accentYellow: 'FFFFCB05',
  accentTeal: 'FF32BCAD', // dipakai untuk baris "ALL" biar konsisten dgn driver
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

// ─── Signature block (dipakai di Rekap & Disposisi) ───────────────────────
// Ada KOTAK BORDER berisi ruang kosong buat tanda tangan asli (3 baris).
// "Nama" nempel tepat di bawah kotak itu (underline, jadi kelihatan
// seperti garis tanda tangan). "Title" nempel tepat di bawah "Nama".
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

// ─── Sheet Rekap settlement (dipakai untuk single branch & untuk tiap
// branch di dalam export "Semua Branch") ───────────────────────────────────
// Di-render per grup CSE: nomor restart tiap CSE, ada baris subtotal per
// CSE (mirip pola driver: "SUMANTO | TOTAL | 366.500"), lalu di akhir ada
// section "ALL" yang menjumlahkan per kategori dari SEMUA CSE di branch ini.
// `sheetName` bisa dikustom supaya function ini reusable untuk banyak sheet
// (1 sheet per branch) dalam 1 workbook yang sama.

function buildRekapSheet(
  wb: ExcelJS.Workbook,
  params: CSEBranchExcelParams,
  sheetName = 'Rekap settlement',
) {
  const { branchName, brand, title, subtitle, proposalTitle, dateRange, rows, reportDate } = params
  const ws = wb.addWorksheet(sheetName, {
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
  setCell(ws, 5, 2, 'Branch', { font: { size: 10, name: FONT_NAME } })
  setCell(ws, 5, 4, `: ${branchName}`, { font: { size: 10, name: FONT_NAME } })
  if (subtitle) setCell(ws, 5, 8, subtitle, { font: { size: 9, italic: true, name: FONT_NAME, color: { argb: 'FF888888' } } })

  const hdrRow = 6
  const headers = ['No', 'Tanggal', 'Branch', 'Brand', 'Nama Kegiatan', 'Item', 'Total', 'Nama CSE']
  headers.forEach((h, i) => setCell(ws, hdrRow, i + 2, h, {
    font: { bold: true, size: 9, color: { argb: COLOR.headerText }, name: FONT_NAME },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } },
    alignment: centerAlign(), border: border(),
  }))

  // Rows sudah datang ter-sort per CSE (dari prepareCSEReportRows) dan `no`
  // sudah di-assign restart per CSE. Di sini kita cuma perlu deteksi
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

    // baris subtotal per CSE — mirip pola driver "SUMANTO | TOTAL | 366.500"
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

  // Section "ALL" — jumlah per kategori dari SEMUA CSE, nomor restart dari 1
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

  // Signature — kotak border rapi, "Nama" & "Title" nempel
  const sigStartRow = totRow + 3
  buildSignatureBlock(ws, sigStartRow, [3, 4], [6, 7])

  if (reportDate) {
    setCell(ws, 2, 9, reportDate, { font: { size: 8, italic: true, name: FONT_NAME, color: { argb: 'FF999999' } }, alignment: rightAlign() })
  }
}

// ─── Sheet Disposisi ────────────────────────────────────────────────────────
// Form kosong (blank), gak perlu digandain per branch — 1 sheet cukup untuk
// seluruh workbook, baik export single branch maupun "Semua Branch".

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

  // Signature — pakai blok yang sama biar konsisten sama sheet Rekap
  const sigStartRow = hdrRow + 2 + 8 + 3
  buildSignatureBlock(ws, sigStartRow, [2, 3], [5, 6])
}

// ─── Sheet Summary (khusus export "Semua Branch") ─────────────────────────
// Halaman pertama di workbook multi-branch: 1 baris per branch berisi
// Branch | Brand | Jumlah Nota | Total Amount, ditutup baris grand total.

export type CSEAllBranchesExcelParams = {
  title: string
  subtitle: string
  proposalTitle?: string
  dateRange: { from: string; to: string }
  branchGroups: Array<{ branchName: string; brand: 'IM3' | '3ID'; rows: CSEReportRow[] }>
  reportDate?: string
}

function safeSheetName(base: string, used: Set<string>): string {
  let name = base.replace(/[\\/*?:[\]]/g, '').slice(0, 31)
  let i = 2
  while (used.has(name)) {
    name = `${base.slice(0, 27)} (${i})`
    i++
  }
  used.add(name)
  return name
}

function buildSummarySheet(wb: ExcelJS.Workbook, params: CSEAllBranchesExcelParams) {
  const ws = wb.addWorksheet('Summary', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 6
  ws.getColumn(3).width = 30
  ws.getColumn(4).width = 12
  ws.getColumn(5).width = 14
  ws.getColumn(6).width = 20

  setCell(ws, 2, 2, params.title, { font: { bold: true, size: 13, name: FONT_NAME } })
  setCell(ws, 3, 2, params.proposalTitle ? `Proposal ${params.proposalTitle}` : 'Proposal ', { font: { size: 10, name: FONT_NAME } })
  setCell(ws, 4, 2, 'Periode', { font: { size: 10, name: FONT_NAME } })
  setCell(ws, 4, 4, `: ${fmtExcelDate(params.dateRange.from)} - ${fmtExcelDate(params.dateRange.to)}`, { font: { size: 10, name: FONT_NAME } })
  if (params.subtitle) setCell(ws, 5, 2, params.subtitle, { font: { size: 9, italic: true, name: FONT_NAME, color: { argb: 'FF888888' } } })

  const hdrRow = 7
  ;['No', 'Branch', 'Brand', 'Jumlah Nota', 'Total Amount'].forEach((h, i) => setCell(ws, hdrRow, i + 2, h, {
    font: { bold: true, size: 9, color: { argb: COLOR.headerText }, name: FONT_NAME },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } },
    alignment: centerAlign(), border: border(),
  }))

  let r = hdrRow + 1
  let grandAmt = 0
  let grandNota = 0
  params.branchGroups.forEach((g, idx) => {
    const total = g.rows.reduce((s, row) => s + row.amount, 0)
    grandAmt += total
    grandNota += g.rows.length
    const bg = idx % 2 === 0 ? 'FFFFFFFF' : COLOR.altRow
    setCell(ws, r, 2, idx + 1, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
    setCell(ws, r, 3, g.branchName, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: leftAlign(), border: border() })
    setCell(ws, r, 4, g.brand, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
    setCell(ws, r, 5, g.rows.length, { font: { size: 9, name: FONT_NAME }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: centerAlign(), border: border() })
    setCell(ws, r, 6, total, { font: { size: 9, name: FONT_NAME, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: rightAlign(), border: border(), numFmt: '#,##0' })
    r++
  })

  const totStyle = {
    font: { bold: true, size: 10, name: FONT_NAME, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLOR.totalBg } },
    border: border('medium' as ExcelJS.BorderStyle),
  }
  setCell(ws, r + 1, 2, `Total (${grandNota} nota)`, { ...totStyle, alignment: leftAlign() })
  ws.mergeCells(r + 1, 2, r + 1, 5)
  setCell(ws, r + 1, 6, grandAmt, { ...totStyle, alignment: rightAlign(), numFmt: '#,##0', font: { ...totStyle.font, color: { argb: COLOR.accentYellow } } })

  if (params.reportDate) {
    setCell(ws, 2, 8, params.reportDate, { font: { size: 8, italic: true, name: FONT_NAME, color: { argb: 'FF999999' } }, alignment: rightAlign() })
  }
}

// ─── Main export: single branch ────────────────────────────────────────────

export async function generateCSEBranchExcel(params: CSEBranchExcelParams): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sistem Reimburse IOH'
  workbook.created = new Date()

  buildRekapSheet(workbook, params)
  buildDisposisiSheet(workbook, params)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// ─── Main export: semua branch sekaligus ───────────────────────────────────
// Sheet 1 = Summary (branch-brand-amount), lalu 1 sheet Rekap per branch
// yang punya data, ditutup 1 sheet Disposisi (form kosong, shared).

export async function generateCSEAllBranchesExcel(params: CSEAllBranchesExcelParams): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sistem Reimburse IOH'
  workbook.created = new Date()

  buildSummarySheet(workbook, params)

  const used = new Set<string>(['Summary'])
  for (const g of params.branchGroups) {
    const sheetName = safeSheetName(`${g.branchName} (${g.brand})`, used)   // ⬅️ tinggal ini yg diubah
    buildRekapSheet(workbook, {
      branchName: g.branchName,
      brand: g.brand,
      title: params.title,
      subtitle: params.subtitle,
      proposalTitle: params.proposalTitle,
      dateRange: params.dateRange,
      rows: g.rows,
      reportDate: params.reportDate,
    }, sheetName)
  }

  buildDisposisiSheet(workbook, {
    branchName: 'Semua Branch',
    brand: params.branchGroups[0]?.brand ?? 'IM3',
    title: params.title,
    subtitle: params.subtitle,
    dateRange: params.dateRange,
    rows: [],
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// ─── Helper: siapkan rows dari raw submissions (dipakai per-branch) ────────

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
