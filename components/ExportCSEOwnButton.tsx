'use client'
import { useState } from 'react'
import { Download, X, FileText, FileSpreadsheet } from 'lucide-react'

const IOH = {
  red: '#ED1C24',
  teal: '#32BCAD',
  magenta: '#C6168D',
  charcoal: '#4D4D4F',
  white: '#FFFFFF',
  border: '#E8E8EA',
  bg: '#F5F5F7',
}

type ExportCSEOwnButtonProps = {
  companyName?: string
}

export default function ExportCSEOwnButton({ companyName = 'PT. Indosat Tbk' }: ExportCSEOwnButtonProps) {
  const now = new Date()
  const defaultDateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultDateTo = (() => {
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const last = new Date(y, m, 0).getDate()
    return `${y}-${String(m).padStart(2, '0')}-${last}`
  })()

  const [open, setOpen] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [subtitle, setSubtitle] = useState('OPERASIONAL BBM COMMERCE CSE')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 13px', borderRadius: 10,
    border: `1.5px solid ${IOH.border}`, fontSize: 13, color: '#222',
    background: IOH.white, outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#999',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
  }

  const download = async (blob: Blob, filenameFallback: string, contentDisposition: string | null) => {
    const match = contentDisposition?.match(/filename="?([^"]+)"?/)
    const filename = match?.[1] || filenameFallback
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPdf = async () => {
    setError(null)
    if (!dateFrom || !dateTo) { setError('Tanggal dari dan sampai wajib diisi'); return }
    if (dateFrom > dateTo) { setError('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"'); return }
    setLoadingPdf(true)
    try {
      const res = await fetch('/api/export/cse-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_from: dateFrom, date_to: dateTo, company_name: companyName, subtitle }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal generate PDF') }
      const blob = await res.blob()
      await download(blob, `Reimburse_CSE_Branch_${dateFrom}_${dateTo}.pdf`, res.headers.get('Content-Disposition'))
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally { setLoadingPdf(false) }
  }

  const handleExportExcel = async () => {
    setError(null)
    if (!dateFrom || !dateTo) { setError('Tanggal dari dan sampai wajib diisi'); return }
    if (dateFrom > dateTo) { setError('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"'); return }
    setLoadingExcel(true)
    try {
      const res = await fetch('/api/export/cse-excel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_from: dateFrom, date_to: dateTo, subtitle }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal generate Excel') }
      const blob = await res.blob()
      await download(blob, `Rekap_CSE_Branch_${dateFrom}_${dateTo}.xlsx`, res.headers.get('Content-Disposition'))
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally { setLoadingExcel(false) }
  }

  const isLoading = loadingPdf || loadingExcel

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <button
        onClick={() => { setOpen(true); setError(null) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10,
          background: `linear-gradient(135deg, ${IOH.magenta} 0%, #a01274 100%)`,
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
          fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: '0 3px 10px rgba(198,22,141,0.35)',
        }}
      >
        <Download size={14} /> Export
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setError(null) } }}
        >
          <div style={{ background: IOH.white, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', padding: '8px 24px 32px', animation: 'slideUp 0.25s ease', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ width: 38, height: 4, background: IOH.border, borderRadius: 2, margin: '12px auto 22px' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>Export Laporan Branch</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>Gabungan semua CSE di branch kamu · PDF & Excel</div>
              </div>
              <button onClick={() => { setOpen(false); setError(null) }} style={{ width: 32, height: 32, borderRadius: '50%', background: IOH.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} color={IOH.charcoal} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Periode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#bbb', marginBottom: 4 }}>Dari</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#bbb', marginBottom: 4 }}>Sampai</label>
                  <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Subtitle perusahaan</label>
              <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} style={inputStyle} />
            </div>

            {error && (
              <div style={{ padding: '10px 13px', borderRadius: 10, marginBottom: 16, background: '#FEF2F2', color: '#991B1B', fontSize: 12, fontWeight: 500, border: '1px solid #FECACA' }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={handleExportPdf} disabled={isLoading} style={{ height: 46, borderRadius: 12, border: 'none', background: isLoading ? '#ddd' : `linear-gradient(135deg, ${IOH.red} 0%, #c8000a 100%)`, cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {loadingPdf ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> PDF...</> : <><FileText size={14} /> PDF</>}
              </button>
              <button onClick={handleExportExcel} disabled={isLoading} style={{ height: 46, borderRadius: 12, border: 'none', background: isLoading ? '#ddd' : `linear-gradient(135deg, ${IOH.teal} 0%, #2aa89a 100%)`, cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {loadingExcel ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Excel...</> : <><FileSpreadsheet size={14} /> Excel</>}
              </button>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: '#bbb', textAlign: 'center' }}>
              Laporan berisi semua CSE di branch kamu untuk periode yang dipilih. Nota tidak diarsipkan otomatis — hubungi admin kalau perlu diarsipkan.
            </div>
          </div>
        </div>
      )}
    </>
  )
}