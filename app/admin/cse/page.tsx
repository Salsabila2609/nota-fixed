'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EditModal from '@/components/EditModal'
import Pagination from '@/components/Pagination'
import ExportCSEButton from '@/components/ExportCSEButton'
import UserManagementPanel from '@/components/UserManagementPanel'
import ArchivePanel from '@/components/ArchivePanel'
import {
  Trash2, Pencil, ChevronDown, ReceiptText, AlertTriangle,
  SlidersHorizontal, Search, Eye, EyeOff, LayoutGrid, List, Filter, X,
} from 'lucide-react'
import {
  IOH, HIGH_VALUE_THRESHOLD, PAGE_SIZE_LIST, PAGE_SIZE_GRID,
  Submission, CATEGORY_CONFIG, getMissingFields, useIsMobile, inputStyle,
  StatCard, ActionBtn, DeleteConfirmModal, PhotoReplaceBtn, GridView, BillReviewerModal,
} from '@/components/admin/AdminShared'

type Branch = { id: string; name: string; brand: 'IM3' | '3ID' }
type CSEUser = { id: string; name: string; mc_name?: string; branch_id?: string }

export default function AdminCsePage() {
  const [activeTab, setActiveTab] = useState<'submissions' | 'archive' | 'users'>('submissions')
  const router = useRouter()
  const isMobile = useIsMobile()
  const [user, setUser] = useState<any>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [cseUsers, setCseUsers] = useState<CSEUser[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedCse, setSelectedCse] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [expandOcr, setExpandOcr] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('PT. Indosat Tbk')
  const [editingSubmission, setEditingSubmission] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [reviewerIndex, setReviewerIndex] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user) { router.replace('/'); return }
      if (data.user.role !== 'admin') { router.replace('/driver'); return }
      setUser(data.user)
      fetchBranches()
      fetchCseUsers()
    })
  }, [])

  useEffect(() => { if (user) fetchSubmissions() }, [user, selectedBranch, selectedCse, dateFrom, dateTo])
  useEffect(() => { setCurrentPage(1) }, [selectedBranch, selectedCse, dateFrom, dateTo, searchQuery, viewMode])

  const fetchBranches = async () => {
    const res = await fetch('/api/admin/branches')
    const data = await res.json()
    setBranches(data.branches || [])
  }

  const fetchCseUsers = async () => {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    const cse = (data.users || []).filter((u: any) => u.role === 'cse')
    setCseUsers(cse)
  }

  const fetchSubmissions = async () => {
    setLoading(true)
    let url = `/api/submissions?from=${dateFrom}&to=${dateTo}`
    if (selectedCse !== 'all') url += `&driver_id=${selectedCse}`
    else if (selectedBranch !== 'all') url += `&branch_id=${selectedBranch}`
    else url += `&role=cse`
    try {
      const res = await fetch(url)
      const data = await res.json()
      setSubmissions(data.submissions || [])
      setSelectedIds(new Set())
    } finally { setLoading(false) }
  }

  const handleEdit = async (id: string, updates: any) => {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    fetchSubmissions()
  }

  const handleDelete = async (sub: Submission) => {
    await fetch(`/api/submissions/${sub.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    fetchSubmissions()
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatAmount = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  const filtered = submissions.filter(s =>
    !searchQuery ||
    s.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const cseGroups = filtered.reduce<Record<string, { name: string; subs: Submission[] }>>((acc, sub) => {
    if (!acc[sub.driver_id]) acc[sub.driver_id] = { name: sub.driver_name, subs: [] }
    acc[sub.driver_id].subs.push(sub)
    return acc
  }, {})

  const totalAmount = filtered.reduce((sum, s) => sum + (s.amount || 0), 0)
  const flaggedCount = filtered.filter(s => getMissingFields(s).length > 0).length
  const restoredCount = filtered.filter(s => s.was_restored).length

  const pageSize = viewMode === 'grid' ? PAGE_SIZE_GRID : PAGE_SIZE_LIST
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const paginated = filtered.slice(pageStart, pageStart + pageSize)

  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#888' }}>Memuat...</div>
      </div>
    </div>
  )

  return (
    <>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 12px 80px' : '28px 24px 80px' }}>

        {/* ── FILTER CARD (khusus CSE: Branch + CSE) ── */}
        <div style={{ background: IOH.white, borderRadius: 16, padding: isMobile ? '14px 14px' : 22, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: isMobile && !filterOpen ? 0 : 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: IOH.magenta + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SlidersHorizontal size={13} color={IOH.magenta} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#333', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Filter CSE</span>
            </div>
            {isMobile && (
              <button onClick={() => setFilterOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#666', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <Filter size={11} color="#666" />
                {filterOpen ? 'Tutup' : 'Filter'}
                <ChevronDown size={11} color="#999" style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            )}
          </div>

          {isMobile && (
            <div style={{ position: 'relative', marginBottom: filterOpen ? 12 : 0 }}>
              <Search size={13} color="#bbb" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama, kategori..." style={{ ...inputStyle, paddingLeft: 32, fontSize: 14 }} />
            </div>
          )}

          {(!isMobile || filterOpen) && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: isMobile ? 10 : 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Branch</label>
                <select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedCse('all') }} style={{ ...inputStyle, fontSize: 14 }}>
                  <option value="all">Semua Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.brand})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CSE</label>
                <select value={selectedCse} onChange={e => setSelectedCse(e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                  <option value="all">Semua CSE</option>
                  {cseUsers
                    .filter(u => selectedBranch === 'all' || u.branch_id === selectedBranch)
                    .map(u => <option key={u.id} value={u.id}>{u.mc_name || u.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dari</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sampai</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, fontSize: 14 }} />
              </div>
              <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nama Perusahaan</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="PT. Indosat Tbk" style={{ ...inputStyle, fontSize: 14 }} />
              </div>
              {!isMobile && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cari</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} color="#bbb" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nama, kategori..." style={{ ...inputStyle, paddingLeft: 30 }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TOOLBAR: tab + view mode + export (khusus CSE) ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 4, background: IOH.white, borderRadius: 12, padding: 4, border: `1px solid ${IOH.border}`, width: 'fit-content', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            {([
              { key: 'submissions', label: '📋 Nota Aktif' },
              { key: 'archive', label: '🗄️ Arsip' },
              { key: 'users', label: '👥 User' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700,
                background: activeTab === tab.key ? IOH.red : 'transparent',
                color: activeTab === tab.key ? '#fff' : '#aaa', transition: 'all 0.15s',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'submissions' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', borderRadius: 8, border: `1.5px solid ${IOH.border}`, overflow: 'hidden' }}>
              
                <button onClick={() => setViewMode('list')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', border: 'none', background: viewMode === 'list' ? IOH.red : IOH.white, color: viewMode === 'list' ? '#fff' : IOH.charcoal, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <List size={13} /> List
                </button>
                <button onClick={() => setViewMode('grid')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', border: 'none', borderLeft: `1px solid ${IOH.border}`, background: viewMode === 'grid' ? IOH.red : IOH.white, color: viewMode === 'grid' ? '#fff' : IOH.charcoal, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <LayoutGrid size={13} /> Grid
                </button>
              </div>
                <ExportCSEButton
                allBranches={branches}
                allCseUsers={cseUsers}
                defaultBranchId={selectedBranch !== 'all' ? selectedBranch : undefined}
                defaultCseId={selectedCse !== 'all' ? selectedCse : undefined}
                defaultMonth={dateFrom.slice(0, 7)}
                companyName={companyName}
                onArchiveDone={fetchSubmissions}
                />
            </div>
          )}
        </div>

        {/* ── KONTEN ── */}
        {activeTab === 'archive' ? (
          // NB: ArchivePanel di source asli menerima prop `drivers`. Untuk CSE,
          // sesuaikan ArchivePanel supaya bisa menerima `branches`/`cseUsers`
          // atau tambahkan mode prop, mis. <ArchivePanel mode="cse" branches={branches} cseUsers={cseUsers} />
          <ArchivePanel branches={branches} cseUsers={cseUsers} />
        ) : activeTab === 'users' ? (
          // NB: tambahkan roleFilter="cse" di UserManagementPanel supaya cuma tampilkan user CSE
          <UserManagementPanel currentUserId={user.id} roleFilter="cse" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: flaggedCount > 0 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 14, marginBottom: isMobile ? 14 : 20 }}>
              <StatCard label="Total Nota" value={filtered.length} accent={IOH.yellow} />
              <StatCard label="Total Nilai" value={`Rp ${formatAmount(totalAmount)}`} accent={IOH.magenta} />
              {!isMobile && <StatCard label="CSE Aktif" value={Object.keys(cseGroups).length} accent={IOH.teal} />}
              {flaggedCount > 0 && <StatCard label="Perlu Dilengkapi" value={flaggedCount} accent={IOH.red} sub="Data tidak lengkap" />}
              {isMobile && <StatCard label="CSE Aktif" value={Object.keys(cseGroups).length} accent={IOH.teal} />}
            </div>

            {restoredCount > 0 && (
              <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 12, padding: isMobile ? '10px 12px' : '12px 18px', marginBottom: isMobile ? 14 : 20, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>↺</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{restoredCount} nota pernah dipulihkan dari arsip</div>
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>Nota ini sudah pernah diexport sebelumnya. Pastikan tidak double-counting saat export berikutnya.</div>
                </div>
              </div>
            )}

            {flaggedCount > 0 && (
              <div style={{ background: '#FFFBEB', border: '1.5px solid #FFD166', borderRadius: 12, padding: isMobile ? '10px 12px' : '12px 18px', marginBottom: isMobile ? 14 : 20, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertTriangle size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{flaggedCount} nota perlu dilengkapi</div>
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>Field wajib: Nominal, Tgl Struk, Kategori, Bukti Transfer. Klik Edit untuk melengkapi.</div>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
                <div style={{ width: 38, height: 38, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.magenta, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: 13, color: '#aaa' }}>Memuat data...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ background: IOH.white, borderRadius: 16, padding: '50px 20px', textAlign: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}` }}>
                <ReceiptText size={36} color="#ddd" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#ccc' }}>Tidak ada nota</div>
                <div style={{ fontSize: 13, color: '#ddd', marginTop: 4 }}>Coba ubah filter atau rentang tanggal</div>
              </div>
            ) : viewMode === 'grid' ? (
              <div style={{ background: IOH.white, borderRadius: 16, padding: isMobile ? 12 : 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 12 }}>
                  {filtered.length} Nota
                  {flaggedCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#D97706', fontWeight: 600 }}>⚠ {flaggedCount} perlu dilengkapi</span>}
                  {restoredCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#C2410C', fontWeight: 600 }}>↺ {restoredCount} dipulihkan</span>}
                  {!isMobile && <span style={{ marginLeft: 8, fontSize: 11, color: '#bbb', fontWeight: 500 }}>· klik foto untuk review</span>}
                </div>
                <GridView
                  submissions={paginated}
                  onEdit={sub => setEditingSubmission(sub)}
                  onDelete={sub => setDeleteTarget(sub)}
                  onReviewOpen={i => setReviewerIndex(pageStart + i)}
                  onPhotoReplaced={fetchSubmissions}
                  pageOffset={pageStart}
                />
                <Pagination currentPage={safePage} totalItems={filtered.length} pageSize={pageSize} onPageChange={p => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
                {paginated.map((sub, idx) => {
                  const catCfg = CATEGORY_CONFIG[sub.category] || CATEGORY_CONFIG.lainnya
                  const CatIcon = catCfg.Icon
                  const missing = getMissingFields(sub)

                  return (
                    <div key={sub.id} style={{
                      background: IOH.white, borderRadius: 14, padding: isMobile ? '12px 12px' : '14px 16px',
                      display: 'flex', gap: isMobile ? 10 : 14, alignItems: 'flex-start',
                      boxShadow: missing.length > 0 ? '0 0 0 1.5px #FFD166, 0 2px 10px rgba(0,0,0,0.05)' : '0 2px 10px rgba(0,0,0,0.05)',
                      border: `1.5px solid ${missing.length > 0 ? '#FFD166' : sub.was_restored ? '#FED7AA' : 'transparent'}`,
                    }}>
                      {sub.image_url && (
                        <div style={{ position: 'relative', flexShrink: 0 }} onClick={() => setReviewerIndex(pageStart + idx)}>
                          <img src={sub.image_url} alt="nota" style={{ width: isMobile ? 48 : 54, height: isMobile ? 60 : 68, objectFit: 'cover', borderRadius: 9, cursor: 'zoom-in', display: 'block', border: `1px solid ${IOH.border}` }} />
                          <div style={{ position: 'absolute', bottom: -4, right: -4 }}>
                            <PhotoReplaceBtn submissionId={sub.id} onReplaced={fetchSubmissions} />
                          </div>
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {sub.was_restored && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, marginBottom: 5, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 11, color: '#C2410C', fontWeight: 700, width: 'fit-content' }}>
                            ↺ Pernah dipulihkan dari arsip
                          </div>
                        )}
                        {missing.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, marginBottom: 5, background: '#FFFBEB', border: '1px solid #FFD166', fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                            <AlertTriangle size={10} color="#D97706" />
                            Data kosong: {missing.join(', ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#111' }}>{sub.driver_name}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: catCfg.bg, color: catCfg.color }}>
                            <CatIcon size={9} strokeWidth={2.5} /> {catCfg.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#aaa', display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                          {sub.bill_date
                            ? <span style={{ color: IOH.charcoal, fontWeight: 600 }}>{isMobile ? '' : 'Struk: '}{formatDate(sub.bill_date)}</span>
                            : <span style={{ color: '#FF8A8A', fontWeight: 600 }}>⚠ Tgl kosong</span>}
                          {!isMobile && <span style={{ color: '#ccc' }}>Submit: {formatDate(sub.submission_date)}</span>}
                        </div>
                        {sub.amount
                          ? <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#111', marginBottom: 2 }}>Rp {formatAmount(sub.amount)}</div>
                          : <div style={{ fontSize: 12, color: '#FF8A8A', fontWeight: 600, marginBottom: 2 }}>⚠ Nominal belum diisi</div>}
                        {sub.category === 'lainnya' && sub.description && (
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.description}</div>
                        )}
                        {!isMobile && sub.ocr_raw_text && (
                          <button onClick={() => setExpandOcr(expandOcr === sub.id ? null : sub.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#bbb', fontSize: 11, cursor: 'pointer', padding: '2px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {expandOcr === sub.id ? <EyeOff size={11} /> : <Eye size={11} />}
                            {expandOcr === sub.id ? 'Sembunyikan OCR' : 'Lihat OCR'}
                          </button>
                        )}
                        {expandOcr === sub.id && sub.ocr_raw_text && (
                          <div style={{ marginTop: 6, padding: '8px 10px', background: '#F8F8FA', borderRadius: 8, fontSize: 11, color: '#999', whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto', border: `1px solid ${IOH.border}`, lineHeight: 1.6 }}>{sub.ocr_raw_text}</div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 5 : 6, flexShrink: 0 }}>
                        {(sub.amount ?? 0) > HIGH_VALUE_THRESHOLD && (
                          <div title={sub.proof_image_url ? 'Lihat bukti transfer' : 'Belum ada bukti transfer'} onClick={() => sub.proof_image_url && setLightbox(sub.proof_image_url)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: isMobile ? '5px 7px' : '5px 10px', borderRadius: 8, border: `1.5px solid ${sub.proof_image_url ? IOH.teal + '60' : '#FFE082'}`, background: sub.proof_image_url ? IOH.teal + '10' : '#FFFBEB', fontSize: 10, fontWeight: 700, color: sub.proof_image_url ? IOH.teal : '#D97706', cursor: sub.proof_image_url ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                            {sub.proof_image_url ? <>✓ {!isMobile && 'Bukti ✓'}</> : <>⚠ {!isMobile && 'Bukti'}</>}
                          </div>
                        )}
                        <ActionBtn icon={<Pencil size={13} />} label="Edit" color={IOH.charcoal} onClick={() => setEditingSubmission(sub)} compact={isMobile} />
                        <ActionBtn icon={<Trash2 size={13} />} label="Hapus" color={IOH.red} onClick={() => setDeleteTarget(sub)} danger compact={isMobile} />
                      </div>
                    </div>
                  )
                })}

                <div style={{ marginTop: 4 }}>
                  <Pagination currentPage={safePage} totalItems={filtered.length} pageSize={pageSize} onPageChange={p => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {reviewerIndex !== null && (
        <BillReviewerModal
          submissions={filtered}
          startIndex={reviewerIndex}
          onClose={() => setReviewerIndex(null)}
          onSave={handleEdit}
          onPhotoReplaced={fetchSubmissions}
        />
      )}

      {editingSubmission && (
        <EditModal submission={editingSubmission} onClose={() => setEditingSubmission(null)} onSave={handleEdit} isAdmin={true} />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          name={`${deleteTarget.driver_name} – ${CATEGORY_CONFIG[deleteTarget.category]?.label || deleteTarget.category} – ${formatDate(deleteTarget.submission_date)}`}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <img src={lightbox} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color="#fff" />
          </button>
        </div>
      )}
    </>
  )
}