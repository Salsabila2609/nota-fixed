'use client'
import { useState, useEffect, useRef } from 'react'
import { Download, X, ChevronDown, FileText, FileSpreadsheet, Building2, Users2 } from 'lucide-react'

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

type Branch = { id: string; name: string; brand: 'IM3' | '3ID' }
type CSEUser = { id: string; name: string; mc_name?: string; branch_id?: string }

type ExportCSEButtonProps = {
  allBranches: Branch[]
  allCseUsers?: CSEUser[]
  defaultBranchId?: string
  defaultCseId?: string
  defaultMonth?: string
  companyName?: string
  onArchiveDone?: () => void 
}

export default function ExportCSEButton({
  allBranches = [],
  allCseUsers = [],
  defaultBranchId,
  defaultCseId,
  defaultMonth,
  companyName = 'PT. Indosat Tbk',
  onArchiveDone, // [BARU]
}: ExportCSEButtonProps) {
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
  const [branchId, setBranchId] = useState<string>('')
  const [cseId, setCseId] = useState<string>('')
  const [subtitle, setSubtitle] = useState('OPERASIONAL BBM COMMERCE CSE')
  // Setiap modal dibuka, sinkronkan dengan filter branch/CSE yang lagi aktif
  // di halaman admin (kalau ada), biar gak perlu pilih ulang manual.
  useEffect(() => {
    if (open) {
      if (defaultBranchId) setBranchId(defaultBranchId)
      if (defaultCseId) setCseId(defaultCseId)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const selectedBranch = allBranches.find(b => b.id === branchId)
  const cseInBranch = allCseUsers.filter(u => u.branch_id === branchId)
  const selectedCseUser = cseInBranch.find(u => u.id === cseId)

  const handleExportPdf = async () => {
    setError(null)
    if (!branchId) { setError('Pilih branch dulu'); return }
    if (!dateFrom || !dateTo) { setError('Tanggal dari dan sampai wajib diisi'); return }
    if (dateFrom > dateTo) { setError('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"'); return }
    setLoadingPdf(true)
    try {
      const res = await fetch('/api/export/cse-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId, cse_id: cseId || undefined, date_from: dateFrom, date_to: dateTo, company_name: companyName, subtitle }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal generate PDF') }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const namePart = [selectedBranch?.name, selectedCseUser ? (selectedCseUser.mc_name || selectedCseUser.name) : null]
        .filter(Boolean).join('_').replace(/\s+/g, '_') || 'branch'
      a.download = `Reimburse_CSE_${namePart}_${dateFrom}_${dateTo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally { setLoadingPdf(false) }
  }

  const handleExportExcel = async () => {
    setError(null)
    if (!branchId) { setError('Pilih branch dulu'); return }
    if (!dateFrom || !dateTo) { setError('Tanggal dari dan sampai wajib diisi'); return }
    if (dateFrom > dateTo) { setError('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"'); return }
    setLoadingExcel(true)
    try {
      const res = await fetch('/api/export/cse-excel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId, cse_id: cseId || undefined, date_from: dateFrom, date_to: dateTo, subtitle }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal generate Excel') }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const namePart = [selectedBranch?.name, selectedCseUser ? (selectedCseUser.mc_name || selectedCseUser.name) : null]
        .filter(Boolean).join('_').replace(/\s+/g, '_') || 'branch'
      a.download = `Rekap_CSE_${namePart}_${dateFrom}_${dateTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally { setLoadingExcel(false) }
  }

  const isLoading = loadingExcel || loadingPdf

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .cse-export-input:focus { border-color: ${IOH.teal} !important; box-shadow: 0 0 0 3px ${IOH.magenta}22; }
        .branch-chip { transition: all 0.15s; }
        .branch-chip:hover { opacity: 0.85; }
      `}</style>

      <button
        onClick={() => { setOpen(true); setError(null) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 16px', borderRadius: 10,
          background: `linear-gradient(135deg, ${IOH.teal} 0%, #32BCAD 100%)`,
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif",
          boxShadow: '0 3px 10px rgba(198,22,141,0.35)', transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
      >
        <Download size={14} /> Export CSE
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setError(null) } }}
        >
          <div style={{ background: IOH.white, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', padding: '8px 24px 36px', animation: 'slideUp 0.25s ease', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ width: 38, height: 4, background: IOH.border, borderRadius: 2, margin: '12px auto 22px' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>Export Laporan CSE</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>
                  {selectedCseUser ? 'Khusus 1 CSE' : 'Digrup per branch'} · PDF (3 halaman) & Excel
                </div>
              </div>
              <button onClick={() => { setOpen(false); setError(null) }} style={{ width: 32, height: 32, borderRadius: '50%', background: IOH.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} color={IOH.charcoal} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Branch</label>
              {allBranches.length === 0 ? (
                <div style={{ fontSize: 12, color: '#D97706', padding: '10px 13px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FFE082' }}>
                  Belum ada branch. Tambah dulu lewat tab User → "Kelola Branch".
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {allBranches.map(b => (
                    <button key={b.id} onClick={() => { setBranchId(b.id); setCseId('') }} className="branch-chip" style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${branchId === b.id ? IOH.magenta : IOH.border}`,
                      background: branchId === b.id ? IOH.magenta : IOH.white,
                      color: branchId === b.id ? '#fff' : IOH.charcoal,
                      cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}>
                      <Building2 size={11} /> {b.name} <span style={{ opacity: 0.7 }}>({b.brand})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {branchId && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>CSE (opsional)</label>
                {cseInBranch.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#D97706', padding: '10px 13px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FFE082' }}>
                    Belum ada CSE terdaftar di branch ini.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      <button onClick={() => setCseId('')} className="branch-chip" style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: `1.5px solid ${cseId === '' ? IOH.teal : IOH.border}`,
                        background: cseId === '' ? IOH.teal : IOH.white,
                        color: cseId === '' ? '#fff' : IOH.charcoal,
                        cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}>
                        <Users2 size={11} /> Semua CSE
                      </button>
                      {cseInBranch.map(u => (
                        <button key={u.id} onClick={() => setCseId(u.id)} className="branch-chip" style={{
                          padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          border: `1.5px solid ${cseId === u.id ? IOH.teal : IOH.border}`,
                          background: cseId === u.id ? IOH.teal : IOH.white,
                          color: cseId === u.id ? '#fff' : IOH.charcoal,
                          cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}>
                          {u.mc_name || u.name}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>Kosongkan ("Semua CSE") untuk laporan gabungan 1 branch.</div>
                  </>
                )}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Periode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={subLabelStyle}>Dari</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="cse-export-input" style={inputStyle} />
                </div>
                <div>
                  <label style={subLabelStyle}>Sampai</label>
                  <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} className="cse-export-input" style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Subtitle perusahaan</label>
              <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} className="cse-export-input" style={inputStyle} />
            </div>

            {error && (
              <div style={{ padding: '10px 13px', borderRadius: 10, marginBottom: 16, background: '#FEF2F2', color: '#991B1B', fontSize: 12, fontWeight: 500, border: '1px solid #FECACA' }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <button onClick={() => { setOpen(false); setError(null) }} disabled={isLoading} style={{ height: 46, borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Batal
              </button>
              <button onClick={handleExportPdf} disabled={isLoading || !branchId} style={{ height: 46, borderRadius: 12, border: 'none', background: isLoading || !branchId ? '#ddd' : `linear-gradient(135deg, ${IOH.red} 0%, #c8000a 100%)`, cursor: isLoading || !branchId ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {loadingPdf ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> PDF...</> : <><FileText size={14} /> PDF</>}
              </button>
              <button onClick={handleExportExcel} disabled={isLoading || !branchId} style={{ height: 46, borderRadius: 12, border: 'none', background: isLoading || !branchId ? '#ddd' : `linear-gradient(135deg, ${IOH.teal} 0%, #2aa89a 100%)`, cursor: isLoading || !branchId ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {loadingExcel ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Excel...</> : <><FileSpreadsheet size={14} /> Excel</>}
              </button>
            </div>

            {!isLoading && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#bbb', textAlign: 'center' }}>
                PDF: rekap + lampiran foto + lembar tanda tangan (3 halaman) · Excel: 1 sheet per branch, digrup per CSE
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}