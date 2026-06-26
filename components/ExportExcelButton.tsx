'use client'
import { useState, useRef } from 'react'
import { Download, X, ChevronDown, FileText, FileSpreadsheet, Archive, RotateCcw } from 'lucide-react'

const IOH = {
  red:     '#ED1C24',
  yellow:  '#FFCB05',
  teal:    '#32BCAD',
  magenta: '#C6168D',
  charcoal:'#4D4D4F',
  white:   '#FFFFFF',
  border:  '#E8E8EA',
  bg:      '#F5F5F7',
}

type Driver = { id: string; name: string }
type ExportButtonProps = {
  driverIds?: string[]
  defaultMonth?: string
  allDrivers?: Driver[]
  companyName?: string
  onArchiveDone?: () => void
}

export default function ExportButton({
  driverIds,
  defaultMonth,
  allDrivers = [],
  companyName = 'PT. Indosat Tbk',
  onArchiveDone,
}: ExportButtonProps) {
  const now = new Date()

  const defaultDateFrom = (() => {
    if (defaultMonth) {
      const [y, m] = defaultMonth.split('-').map(Number)
      return `${y}-${String(m).padStart(2, '0')}-01`
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })()

  const defaultDateTo = (() => {
    if (defaultMonth) {
      const [y, m] = defaultMonth.split('-').map(Number)
      const last = new Date(y, m, 0).getDate()
      return `${y}-${String(m).padStart(2, '0')}-${last}`
    }
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const last = new Date(y, m, 0).getDate()
    return `${y}-${String(m).padStart(2, '0')}-${last}`
  })()

  const [open, setOpen] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(driverIds || [])
  const [cashAdvance, setCashAdvance] = useState('')
  const [subtitle, setSubtitle] = useState('OPERASIONAL BBM COMMERCE  PT.INDOSAT Tbk.ISAT KAYOON')
  const [createdBy, setCreatedBy] = useState('')
  const [createdByTitle, setCreatedByTitle] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [approvedByTitle, setApprovedByTitle] = useState('')
  const [signatureOpen, setSignatureOpen] = useState(false)

  // ── Archive/Restore state ──────────────────────────────────────────────
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archivedList, setArchivedList] = useState<any[]>([])
  const [loadingArchiveList, setLoadingArchiveList] = useState(false)
  const [selectedRestoreIds, setSelectedRestoreIds] = useState<Set<string>>(new Set())
  const [restoring, setRestoring] = useState(false)
  const downloadedRef = useRef({ pdf: false, excel: false })
  const [downloadedPdf, setDownloadedPdf] = useState(false)
  const [downloadedExcel, setDownloadedExcel] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 13px', borderRadius: 10,
    border: `1.5px solid ${IOH.border}`, fontSize: 13, color: '#222',
    background: IOH.white, outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
    appearance: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#999',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
  }

  const subLabelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, color: '#bbb', marginBottom: 4,
  }

  const archiveAfterExport = async () => {
    const targets = selectedDrivers.length > 0
      ? allDrivers.filter(d => selectedDrivers.includes(d.id))
      : allDrivers

    await fetch('/api/submissions/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: dateFrom,
        to: dateTo,
        driver_ids: targets.map(d => d.id),
      }),
    })
    onArchiveDone?.()
  }

  const archiveIfBothDone = async () => {
    if (!downloadedRef.current.pdf || !downloadedRef.current.excel) return
    console.log('Both done, archiving...')
    
    const targets = selectedDrivers.length > 0
      ? allDrivers.filter(d => selectedDrivers.includes(d.id))
      : allDrivers

    await fetch('/api/submissions/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: dateFrom,
        to: dateTo,
        driver_ids: targets.map(d => d.id),
      }),
    })
    onArchiveDone?.()
    downloadedRef.current = { pdf: false, excel: false }
    setDownloadedPdf(false)
    setDownloadedExcel(false)
    setOpen(false)  
  }

  const handleExportExcel = async () => {
    setError(null)
    if (!dateFrom || !dateTo) { setError('Tanggal dari dan sampai wajib diisi'); return }
    if (dateFrom > dateTo) { setError('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"'); return }
    setLoadingExcel(true)
    try {
      const payload: any = {
        date_from: dateFrom,
        date_to: dateTo,
        cash_advance: cashAdvance ? parseInt(cashAdvance.replace(/\D/g, ''), 10) : 0,
        company_info: {
          subtitle,
          created_by: createdBy || undefined,
          created_by_title: createdByTitle || undefined,
          approved_by: approvedBy || undefined,
          approved_by_title: approvedByTitle || undefined,
        },
      }
      if (selectedDrivers.length > 0) payload.driver_ids = selectedDrivers

      const res = await fetch('/api/export/excel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal generate Excel') }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `REKAP_BBM_DRIVER_${dateFrom}_${dateTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      downloadedRef.current.excel = true
      setDownloadedExcel(true)
      console.log('Excel done, ref:', downloadedRef.current)
      await archiveIfBothDone()
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally { setLoadingExcel(false) }
  }

  const handleExportPdf = async () => {
    setError(null)
    if (!dateFrom || !dateTo) { setError('Tanggal dari dan sampai wajib diisi'); return }
    if (dateFrom > dateTo) { setError('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"'); return }
    setLoadingPdf(true)
    try {
      const targets = selectedDrivers.length > 0
        ? allDrivers.filter(d => selectedDrivers.includes(d.id))
        : allDrivers

      if (targets.length === 0) throw new Error('Tidak ada driver untuk di-export')

      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_from: dateFrom,
          date_to: dateTo,
          company_name: companyName,
          subtitle,
          created_by: createdBy || undefined,
          created_by_title: createdByTitle || undefined,
          approved_by: approvedBy || undefined,
          approved_by_title: approvedByTitle || undefined,
          driver_ids: targets.map(d => d.id),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal generate PDF') }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = targets.length === 1
        ? `Reimburse_${targets[0].name.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.pdf`
        : `Reimburse_Semua_Driver_${dateFrom}_${dateTo}.pdf`
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      downloadedRef.current.pdf = true  
      setDownloadedPdf(true)  
      console.log('PDF done, ref:', downloadedRef.current)         
      await archiveIfBothDone()     
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally { setLoadingPdf(false) }
  }

  const openArchiveModal = async () => {
    setShowArchiveModal(true)
    setLoadingArchiveList(true)
    setSelectedRestoreIds(new Set())
    try {
      const res = await fetch(`/api/submissions/archive?from=${dateFrom}&to=${dateTo}`)
      const data = await res.json()
      setArchivedList(data.submissions || [])
    } finally {
      setLoadingArchiveList(false)
    }
  }

  const handleRestore = async () => {
    if (selectedRestoreIds.size === 0) return
    setRestoring(true)
    try {
      await fetch('/api/submissions/archive', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedRestoreIds) }),
      })
      onArchiveDone?.()
      setShowArchiveModal(false)
      setOpen(false)
    } catch {
      setError('Gagal memulihkan arsip')
    } finally { setRestoring(false) }
  }

  const toggleDriver = (id: string) => {
    setSelectedDrivers(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const toggleRestoreId = (id: string) => {
    setSelectedRestoreIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const isLoading = loadingExcel || loadingPdf || restoring

  const targets = selectedDrivers.length > 0
    ? allDrivers.filter(d => selectedDrivers.includes(d.id))
    : allDrivers

  const catLabels: Record<string, string> = {
    parkir: 'Parkir', tol: 'Tol', bensin: 'Bensin', lainnya: 'Lainnya',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .export-input:focus { border-color: ${IOH.teal} !important; box-shadow: 0 0 0 3px ${IOH.teal}22; }
        .driver-chip { transition: all 0.15s; }
        .driver-chip:hover { opacity: 0.85; }
        .archive-row:hover { background: #F0FBF9 !important; }
      `}</style>

      {/* Trigger button */}
      <button
        onClick={() => { setOpen(true); downloadedRef.current = { pdf: false, excel: false };setDownloadedPdf(false); setDownloadedExcel(false) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 16px', borderRadius: 10,
          background: `linear-gradient(135deg, ${IOH.teal} 0%, #2aa89a 100%)`,
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif",
          boxShadow: '0 3px 10px rgba(50,188,173,0.35)', transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
      >
        <Download size={14} /> Export
      </button>

      {/* ── Main export modal ── */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setError(null) } }}
        >
          <div style={{ background: IOH.white, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', padding: '8px 24px 36px', animation: 'slideUp 0.25s ease', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ width: 38, height: 4, background: IOH.border, borderRadius: 2, margin: '12px auto 22px' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>Export Laporan</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>
                  {selectedDrivers.length > 0 ? `${selectedDrivers.length} driver dipilih` : 'Semua driver'}{' · '}PDF & Excel
                </div>
              </div>
              <button onClick={() => { setOpen(false); setError(null) }} style={{ width: 32, height: 32, borderRadius: '50%', background: IOH.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} color={IOH.charcoal} />
              </button>
            </div>

            {/* Info archive */}
            <div style={{ padding: '11px 14px', borderRadius: 12, marginBottom: 18, background: '#EFF9F8', border: `1.5px solid ${IOH.teal}44`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Archive size={15} color={IOH.teal} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: IOH.teal }}>Nota otomatis diarsipkan setelah export</div>
                <div style={{ fontSize: 11, color: '#5a9e98', marginTop: 2 }}>Nota tidak akan muncul lagi di tampilan admin. Bisa dipilih dan dikembalikan lewat tombol "Lihat & Pulihkan Arsip".</div>
              </div>
            </div>

            {/* Periode */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Periode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={subLabelStyle}>Dari</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="export-input" style={inputStyle} />
                </div>
                <div>
                  <label style={subLabelStyle}>Sampai</label>
                  <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} className="export-input" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Cash advance */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Cash Advance <span style={{ color: '#ccc', textTransform: 'none', fontWeight: 400 }}>— opsional, hanya untuk Excel</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#aaa', pointerEvents: 'none', fontWeight: 600 }}>Rp</span>
                <input
                  type="text" placeholder="cth: 22.500.000" value={cashAdvance}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '')
                    setCashAdvance(v ? parseInt(v).toLocaleString('id-ID') : '')
                  }}
                  className="export-input" style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>
              {cashAdvance && <div style={{ fontSize: 11, color: IOH.teal, marginTop: 4, fontWeight: 600 }}>Rp {cashAdvance}</div>}
            </div>

            {/* Filter driver */}
            {allDrivers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Filter Driver <span style={{ color: '#ccc', textTransform: 'none', fontWeight: 400 }}>— kosong = semua</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {allDrivers.map(d => (
                    <button key={d.id} onClick={() => toggleDriver(d.id)} className="driver-chip" style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${selectedDrivers.includes(d.id) ? IOH.red : IOH.border}`,
                      background: selectedDrivers.includes(d.id) ? IOH.red : IOH.white,
                      color: selectedDrivers.includes(d.id) ? '#fff' : IOH.charcoal,
                      cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}>{d.name}</button>
                  ))}
                </div>
                {selectedDrivers.length > 0 && (
                  <button onClick={() => setSelectedDrivers([])} style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 11, cursor: 'pointer', marginTop: 6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    ↺ Reset (semua driver)
                  </button>
                )}
              </div>
            )}

            {/* Subtitle */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Subtitle perusahaan</label>
              <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} className="export-input" style={inputStyle} />
            </div>

            {/* Tanda tangan */}
            <div style={{ marginBottom: 16, border: `1.5px solid ${IOH.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setSignatureOpen(!signatureOpen)}
                style={{ width: '100%', padding: '12px 14px', background: IOH.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: IOH.charcoal }}
              >
                <span>✍️ Konfigurasi Tanda Tangan</span>
                <ChevronDown size={14} style={{ transform: signatureOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>
              {signatureOpen && (
                <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Dibuat oleh', val: createdBy, set: setCreatedBy, ph: 'Nama' },
                    { label: 'Jabatan', val: createdByTitle, set: setCreatedByTitle, ph: 'cth: Admin East Java' },
                    { label: 'Approved by', val: approvedBy, set: setApprovedBy, ph: 'Nama' },
                    { label: 'Jabatan', val: approvedByTitle, set: setApprovedByTitle, ph: 'cth: AVP-Urban Distribution' },
                  ].map(({ label, val, set, ph }) => (
                    <div key={label}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#bbb', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                      <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph} className="export-input" style={{ ...inputStyle, fontSize: 12, padding: '8px 10px' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 13px', borderRadius: 10, marginBottom: 16, background: '#FEF2F2', color: '#991B1B', fontSize: 12, fontWeight: 500, border: '1px solid #FECACA' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Export buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <button onClick={() => { setOpen(false); setError(null) }} disabled={isLoading} style={{ height: 46, borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Batal
              </button>
              <button onClick={handleExportPdf} disabled={isLoading} style={{ height: 46, borderRadius: 12, border: 'none', background: isLoading ? '#ddd' : `linear-gradient(135deg, ${IOH.red} 0%, #c8000a 100%)`, cursor: isLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: isLoading ? 'none' : '0 4px 14px rgba(237,28,36,0.35)' }}>
                {loadingPdf ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> PDF...</> : <><FileText size={14} /> PDF</>}
              </button>
              <button onClick={handleExportExcel} disabled={isLoading} style={{ height: 46, borderRadius: 12, border: 'none', background: isLoading ? '#ddd' : `linear-gradient(135deg, ${IOH.teal} 0%, #2aa89a 100%)`, cursor: isLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: isLoading ? 'none' : '0 4px 14px rgba(50,188,173,0.35)' }}>
                {loadingExcel ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Excel...</> : <><FileSpreadsheet size={14} /> Excel</>}
              </button>
            </div>

            {/* Status download — muncul kalau salah satu sudah didownload */}
            {(downloadedPdf || downloadedExcel) && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: downloadedPdf ? IOH.teal : '#ccc', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {downloadedPdf ? '✓' : '○'} PDF
                </span>
                <span style={{ fontSize: 11, color: '#ddd' }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: downloadedExcel ? IOH.teal : '#ccc', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {downloadedExcel ? '✓' : '○'} Excel
                </span>
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>
                  {downloadedPdf && downloadedExcel ? '— mengarsipkan...' : '— download satunya lagi untuk arsipkan'}
                </span>
              </div>
            )}

            {/* Tombol lihat arsip */}
            <button
              onClick={openArchiveModal}
              disabled={isLoading}
              style={{ width: '100%', height: 42, borderRadius: 12, border: `1.5px solid ${IOH.teal}55`, background: '#EFF9F8', cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: IOH.teal, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <RotateCcw size={13} /> Lihat & Pulihkan Arsip
            </button>

            {!isLoading && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#bbb', textAlign: 'center' }}>
                {targets.length === 1 ? `PDF: 1 file untuk ${targets[0]?.name}` : `PDF: 1 file gabungan (${targets.length} driver) · Excel: 1 file rekap`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal arsip: pilih nota yang mau dipulihkan ── */}
      {showArchiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.22)', fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${IOH.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>Arsip Nota</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{dateFrom} – {dateTo} · centang yang ingin dipulihkan</div>
                </div>
                <button onClick={() => setShowArchiveModal(false)} style={{ width: 30, height: 30, borderRadius: '50%', background: IOH.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13} color={IOH.charcoal} />
                </button>
              </div>

              {/* Select all / deselect all */}
              {archivedList.length > 0 && !loadingArchiveList && (
                <button
                  onClick={() => setSelectedRestoreIds(
                    selectedRestoreIds.size === archivedList.length
                      ? new Set()
                      : new Set(archivedList.map(s => s.id))
                  )}
                  style={{ fontSize: 11, fontWeight: 700, color: IOH.teal, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {selectedRestoreIds.size === archivedList.length ? '☑ Batal Pilih Semua' : '☐ Pilih Semua'}
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              {loadingArchiveList ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '44px 0', gap: 10 }}>
                  <div style={{ width: 20, height: 20, border: `2px solid ${IOH.border}`, borderTopColor: IOH.teal, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#aaa' }}>Memuat arsip...</span>
                </div>
              ) : archivedList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '44px 0', color: '#ccc', fontSize: 13 }}>
                  Tidak ada nota yang diarsipkan pada periode ini
                </div>
              ) : (
                archivedList.map(sub => {
                  const checked = selectedRestoreIds.has(sub.id)
                  const archivedDate = sub.archived_at
                    ? new Date(sub.archived_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                    : ''
                  const billDate = sub.bill_date
                    ? new Date(sub.bill_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Tgl kosong'

                  return (
                    <div
                      key={sub.id}
                      className="archive-row"
                      onClick={() => toggleRestoreId(sub.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, marginBottom: 7, border: `1.5px solid ${checked ? IOH.teal : IOH.border}`, background: checked ? '#EFF9F8' : '#FAFAFA', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      {/* Checkbox */}
                      <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${checked ? IOH.teal : '#ddd'}`, background: checked ? IOH.teal : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {checked && <div style={{ width: 8, height: 8, background: '#fff', borderRadius: 2 }} />}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{sub.driver_name}</span>
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#F0F0F0', color: '#666', fontWeight: 600 }}>
                            {catLabels[sub.category] || sub.category}
                            {sub.category === 'lainnya' && sub.description ? `: ${sub.description}` : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>
                          Struk: {billDate} · Diarsipkan: {archivedDate}
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{ fontSize: 13, fontWeight: 800, color: sub.amount ? '#111' : '#ddd', flexShrink: 0 }}>
                        {sub.amount ? `Rp ${new Intl.NumberFormat('id-ID').format(sub.amount)}` : '–'}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 16px', borderTop: `1px solid ${IOH.border}`, flexShrink: 0, display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowArchiveModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Batal
              </button>
              <button
                onClick={handleRestore}
                disabled={selectedRestoreIds.size === 0 || restoring}
                style={{ flex: 2, height: 44, borderRadius: 12, border: 'none', background: selectedRestoreIds.size === 0 || restoring ? '#ddd' : IOH.teal, cursor: selectedRestoreIds.size === 0 || restoring ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: selectedRestoreIds.size === 0 || restoring ? '#aaa' : '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                {restoring
                  ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Memulihkan...</>
                  : <><RotateCcw size={13} /> Pulihkan{selectedRestoreIds.size > 0 ? ` (${selectedRestoreIds.size})` : ''}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}