'use client'
import { useState, useEffect } from 'react'
import { Archive, RotateCcw, CheckCircle2 } from 'lucide-react'

const IOH = {
  red: '#ED1C24', yellow: '#FFCB05', teal: '#32BCAD', magenta: '#C6168D',
  charcoal: '#4D4D4F', white: '#FFFFFF', border: '#E8E8EA', bg: '#F5F5F7',
}

type Branch = { id: string; name: string; brand: 'IM3' | '3ID' }
type CSEUser = { id: string; name: string; mc_name?: string; branch_id?: string }
type Submission = {
  id: string; driver_name: string; category: string; description?: string
  amount?: number; bill_date?: string; submission_date: string; was_restored?: boolean
}

const catLabels: Record<string, string> = { parkir: 'Parkir', tol: 'Tol', bensin: 'Bensin', lainnya: 'Lainnya' }

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatAmount(n?: number) {
  return n ? 'Rp ' + new Intl.NumberFormat('id-ID').format(n) : '–'
}
function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${month}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export default function ArchivePanel({ branches, cseUsers }: { branches: Branch[]; cseUsers: CSEUser[] }) {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [selectedBranch, setSelectedBranch] = useState('all')
  const [selectedCse, setSelectedCse] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [view, setView] = useState<'active' | 'archived'>('active')

  const [activeSubs, setActiveSubs] = useState<Submission[]>([])
  const [archivedSubs, setArchivedSubs] = useState<Submission[]>([])
  const [loadingActive, setLoadingActive] = useState(true)
  const [loadingArchived, setLoadingArchived] = useState(true)
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [selectedRestoreIds, setSelectedRestoreIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)

  const { from, to } = monthRange(selectedMonth)

  const scopeParams = () => {
    if (selectedCse !== 'all') return `cse_id=${selectedCse}`
    if (selectedBranch !== 'all') return `branch_id=${selectedBranch}`
    return `role=cse`
  }

  const fetchActive = async () => {
    setLoadingActive(true)
    try {
      // NB: /api/submissions filter tanggal-nya pakai bill_from/bill_to (bukan bill_date langsung)
      const res = await fetch(`/api/submissions?bill_from=${from}&bill_to=${to}&${scopeParams()}`)
      const data = await res.json()
      setActiveSubs(data.submissions || [])
    } finally { setLoadingActive(false) }
  }

  const fetchArchived = async () => {
    setLoadingArchived(true)
    try {
      const res = await fetch(`/api/submissions/archive?from=${from}&to=${to}&${scopeParams()}`)
      const data = await res.json()
      setArchivedSubs(data.submissions || [])
    } finally { setLoadingArchived(false) }
  }

  useEffect(() => {
    setSelectedRestoreIds(new Set())
    fetchActive()
    fetchArchived()
  }, [selectedBranch, selectedCse, selectedMonth])

  const handleArchivePeriod = async () => {
    if (!activeSubs.length) return
    setArchiving(true)
    try {
      const body: any = { from, to, role: 'cse' }
      if (selectedCse !== 'all') body.cse_id = selectedCse
      else if (selectedBranch !== 'all') body.branch_id = selectedBranch

      const res = await fetch('/api/submissions/archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) {
        setMessage(`${activeSubs.length} nota periode ${selectedMonth} berhasil diarsipkan`)
        await fetchActive()
        await fetchArchived()
        setTimeout(() => setMessage(null), 3500)
      }
    } finally { setArchiving(false) }
  }

  const toggleRestoreId = (id: string) => {
    setSelectedRestoreIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleRestore = async () => {
    if (!selectedRestoreIds.size) return
    setRestoring(true)
    try {
      const res = await fetch('/api/submissions/archive', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedRestoreIds) }),
      })
      if (res.ok) {
        setMessage(`${selectedRestoreIds.size} nota berhasil dipulihkan`)
        setSelectedRestoreIds(new Set())
        await fetchActive()
        await fetchArchived()
        setTimeout(() => setMessage(null), 3500)
      }
    } finally { setRestoring(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {message && (
        <div style={{ padding: '11px 16px', borderRadius: 12, background: '#ECFDF5', border: '1.5px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#065F46' }}>
          <CheckCircle2 size={15} color="#10B981" /> {message}
        </div>
      )}

      {/* Filter periode */}
      <div style={{ background: IOH.white, borderRadius: 16, padding: 18, border: `1px solid ${IOH.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#000000', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bulan (tgl struk)</label>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111', background: IOH.white }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#000000', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Branch</label>
            <select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedCse('all') }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111', background: IOH.white }} >
              <option value="all">Semua Branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.brand})</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#000000', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CSE</label>
            <select value={selectedCse} onChange={e => setSelectedCse(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111', background: IOH.white }}>
              <option value="all">Semua CSE</option>
              {cseUsers.filter(u => selectedBranch === 'all' || u.branch_id === selectedBranch).map(u => (
                <option key={u.id} value={u.id}>{u.mc_name || u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Toggle Aktif / Sudah Diarsip */}
      <div style={{ display: 'flex', gap: 4, background: IOH.white, borderRadius: 12, padding: 4, border: `1px solid ${IOH.border}`, width: 'fit-content' }}>
        <button onClick={() => setView('active')} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, background: view === 'active' ? IOH.teal : 'transparent', color: view === 'active' ? '#fff' : '#aaa' }}>
          Belum Diarsip ({activeSubs.length})
        </button>
        <button onClick={() => setView('archived')} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, background: view === 'archived' ? IOH.teal : 'transparent', color: view === 'archived' ? '#fff' : '#aaa' }}>
          Sudah Diarsip ({archivedSubs.length})
        </button>
      </div>

      {view === 'active' ? (
        <div style={{ background: IOH.white, borderRadius: 16, border: `1px solid ${IOH.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${IOH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#666' }}>
              <strong>{activeSubs.length}</strong> nota periode <strong>{selectedMonth}</strong> belum diarsipkan
            </div>
            <button
              onClick={handleArchivePeriod}
              disabled={archiving || loadingActive || activeSubs.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: archiving || activeSubs.length === 0 ? '#ddd' : IOH.magenta, color: '#fff', fontSize: 12, fontWeight: 700, cursor: archiving || activeSubs.length === 0 ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {archiving
                ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Mengarsipkan...</>
                : <><Archive size={13} /> Arsipkan Periode Ini</>
              }
            </button>
          </div>

          {loadingActive ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Memuat...</div>
          ) : activeSubs.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#ccc', fontSize: 13 }}>Tidak ada nota aktif di periode ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
              {activeSubs.map(sub => (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, border: `1.5px solid ${IOH.border}`, background: '#FAFAFA' }}>
                  <SubRowContent sub={sub} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: IOH.white, borderRadius: 16, border: `1px solid ${IOH.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${IOH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#666' }}>
              <strong>{archivedSubs.length}</strong> nota periode <strong>{selectedMonth}</strong> sudah diarsipkan
            </div>
            {selectedRestoreIds.size > 0 && (
              <button
                onClick={handleRestore}
                disabled={restoring}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: IOH.teal, color: '#fff', fontSize: 12, fontWeight: 700, cursor: restoring ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {restoring
                  ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Memulihkan...</>
                  : <><RotateCcw size={13} /> Pulihkan ({selectedRestoreIds.size})</>
                }
              </button>
            )}
          </div>

          {loadingArchived ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Memuat...</div>
          ) : archivedSubs.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#ccc', fontSize: 13 }}>Belum ada nota yang diarsipkan di periode ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
              {archivedSubs.map(sub => {
                const checked = selectedRestoreIds.has(sub.id)
                return (
                  <div key={sub.id} onClick={() => toggleRestoreId(sub.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, border: `1.5px solid ${checked ? IOH.teal : IOH.border}`, background: checked ? IOH.teal + '08' : '#FAFAFA', cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${checked ? IOH.teal : '#ddd'}`, background: checked ? IOH.teal : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {checked && <div style={{ width: 8, height: 8, background: '#fff', borderRadius: 2 }} />}
                    </div>
                    <SubRowContent sub={sub} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SubRowContent({ sub }: { sub: Submission }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{sub.driver_name}</span>
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#F0F0F0', color: '#666', fontWeight: 600 }}>
            {catLabels[sub.category] || sub.category}
          </span>
          {sub.was_restored && (
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', fontWeight: 700 }}>↺ Pernah dipulihkan</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#bbb' }}>Struk: {formatDate(sub.bill_date)}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: sub.amount ? '#111' : '#ddd', flexShrink: 0 }}>{formatAmount(sub.amount)}</div>
    </div>
  )
}
