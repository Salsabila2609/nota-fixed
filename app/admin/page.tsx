'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import EditModal from '@/components/EditModal'
import Pagination from '@/components/Pagination'
import AdminUploadSection from '@/components/AdminUploadSection'
import ExportExcelButton from '@/components/ExportExcelButton'
import {
  Trash2, Pencil, Download, LogOut, ChevronDown,
  ReceiptText, Car, Fuel, ParkingCircle, AlertTriangle, X,
  SlidersHorizontal, Search, Eye, EyeOff, LayoutGrid, List,
  Camera, ChevronLeft, ChevronRight, CheckCircle2, ImagePlus
} from 'lucide-react'

// ── IOH Brand Palette ──────────────────────────────────────────────────────
const IOH = {
  red:     '#ED1C24',
  yellow:  '#FFCB05',
  teal:    '#32BCAD',
  magenta: '#C6168D',
  pink:    '#EC008C',
  charcoal:'#4D4D4F',
  bg:      '#F5F5F7',
  white:   '#FFFFFF',
  border:  '#E8E8EA',
}

const HIGH_VALUE_THRESHOLD = 250000

// ── Page sizes — adjust these to test pagination ───────────────────────────
const PAGE_SIZE_LIST = 10
const PAGE_SIZE_GRID = 24

type Driver = { id: string; name: string; email: string }
type Submission = {
  id: string; driver_id: string; driver_name: string; category: string
  description?: string; amount?: number; submission_date: string; bill_date?: string
  image_url?: string; proof_image_path?: string; proof_image_url?: string
  status: string; created_at: string; ocr_raw_text?: string
}

const CATEGORY_CONFIG: Record<string, { label: string; Icon: any; color: string; bg: string }> = {
  parkir:  { label: 'Parkir',  Icon: ParkingCircle, color: '#ED1C24', bg: '#FFF0F0' },
  tol:     { label: 'Tol',     Icon: Car,           color: '#C6168D', bg: '#FDF0F9' },
  bensin:  { label: 'Bensin',  Icon: Fuel,          color: '#B8960A', bg: '#FFFBEB' },
  lainnya: { label: 'Lainnya', Icon: ReceiptText,   color: '#4D4D4F', bg: '#F3F3F4' },
}

function getMissingFields(sub: Submission): string[] {
  const missing: string[] = []
  if (!sub.amount || sub.amount === 0)      missing.push('Nominal')
  if (!sub.bill_date)                       missing.push('Tgl Struk')
  if (!sub.category || sub.category === '') missing.push('Kategori')
  if ((sub.amount ?? 0) > HIGH_VALUE_THRESHOLD && !sub.proof_image_path)
                                            missing.push('Bukti Transfer')
  return missing
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────
function DeleteConfirmModal({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: IOH.white, borderRadius: 20, padding: 32, maxWidth: 400, width: '100%', boxShadow: '0 32px 64px rgba(0,0,0,0.18)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={22} color={IOH.red} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Hapus Nota?</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Tindakan ini tidak bisa dibatalkan</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: IOH.charcoal, lineHeight: 1.7, marginBottom: 24 }}>
          Nota <strong style={{ color: '#111' }}>{name}</strong> akan dihapus permanen dari sistem termasuk foto struk-nya.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: IOH.white, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', color: IOH.charcoal }}>Batal</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: IOH.red, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, sub }: { label: string; value: any; accent: string; sub?: string }) {
  return (
    <div style={{ background: IOH.white, borderRadius: 16, padding: '18px 22px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -16, right: -16, width: 72, height: 72, borderRadius: '50%', background: accent + '12' }} />
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Action Button ──────────────────────────────────────────────────────────
function ActionBtn({ icon, label, color, onClick, danger }: { icon: any; label: string; color: string; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
      borderRadius: 9, border: `1.5px solid ${hov ? color : IOH.border}`,
      background: hov && danger ? IOH.red : hov ? '#F8F8FA' : IOH.white,
      cursor: 'pointer', fontSize: 12, fontWeight: 600, color: hov && danger ? '#fff' : color,
      fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap'
    }}>
      {icon} {label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid #E8E8EA`,
  fontSize: 13, color: '#222', background: '#fff', outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif", appearance: 'none',
  transition: 'border-color 0.15s'
}

// ── Photo Replace Button ───────────────────────────────────────────────────
function PhotoReplaceBtn({ submissionId, onReplaced }: { submissionId: string; onReplaced: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('submission_id', submissionId)
      const res = await fetch(`/api/submissions/${submissionId}/replace-photo`, { method: 'POST', body: formData })
      if (res.ok) onReplaced()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <button
        onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
        disabled={uploading}
        title="Ganti Foto"
        style={{
          width: 28, height: 28, borderRadius: 7, border: 'none',
          background: uploading ? 'rgba(50,188,173,0.85)' : 'rgba(255,255,255,0.92)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'all 0.15s'
        }}
      >
        {uploading
          ? <div style={{ width: 10, height: 10, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : <Camera size={12} color={IOH.teal} />
        }
      </button>
    </>
  )
}

// ── Bill Reviewer Modal ────────────────────────────────────────────────────
const inlineInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 10,
  border: `1.5px solid ${IOH.border}`,
  background: IOH.white, color: '#111',
  fontSize: 13, fontWeight: 600, outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: 'border-color 0.15s',
}

const THUMB_PAGE_SIZE = 10

function BillReviewerModal({
  submissions, startIndex, onClose, onSave, onPhotoReplaced
}: {
  submissions: Submission[]
  startIndex: number
  onClose: () => void
  onSave: (id: string, updates: any) => Promise<void>
  onPhotoReplaced: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const [thumbPage, setThumbPage] = useState(Math.floor(startIndex / THUMB_PAGE_SIZE))
  const [showOcr, setShowOcr] = useState(false)
  const [showProof, setShowProof] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null)
  const [proofLightbox, setProofLightbox] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, any>>(() => ({
    category:    submissions[startIndex]?.category    || '',
    amount:      submissions[startIndex]?.amount      ?? '',
    bill_date:   submissions[startIndex]?.bill_date   || '',
    description: submissions[startIndex]?.description || '',
  }))
  const fileRef = useRef<HTMLInputElement>(null)

  const sub = submissions[idx]

  useEffect(() => {
    setThumbPage(Math.floor(idx / THUMB_PAGE_SIZE))
  }, [idx])

  useEffect(() => {
    if (!sub) return
    setDraft({
      category:    sub.category    || '',
      amount:      sub.amount      ?? '',
      bill_date:   sub.bill_date   || '',
      description: sub.description || '',
    })
    setLocalImageUrl(null)
    setShowProof(false)
    setSavedFlash(false)
  }, [idx, sub?.id])

  const displayImageUrl = localImageUrl ?? sub?.image_url
  const catCfg = CATEGORY_CONFIG[draft.category] || CATEGORY_CONFIG.lainnya

  const isDirty =
    draft.category    !== (sub?.category    || '') ||
    String(draft.amount ?? '') !== String(sub?.amount ?? '') ||
    draft.bill_date   !== (sub?.bill_date   || '') ||
    draft.description !== (sub?.description || '')

  const missingInDraft: string[] = []
  if (!draft.amount || draft.amount === '' || Number(draft.amount) === 0) missingInDraft.push('Nominal')
  if (!draft.bill_date)  missingInDraft.push('Tgl Struk')
  if (!draft.category)   missingInDraft.push('Kategori')

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx(i => Math.min(submissions.length - 1, i + 1)), [submissions.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose])

  const handleSave = async () => {
    if (!sub || !isDirty) return
    setSaving(true)
    try {
      await onSave(sub.id, {
        category:    draft.category,
        amount:      draft.amount !== '' ? Number(draft.amount) : null,
        bill_date:   draft.bill_date || null,
        description: draft.description || null,
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/submissions/${sub.id}/replace-photo`, { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        if (data.image_url) setLocalImageUrl(data.image_url)
        onPhotoReplaced()
      }
    } finally {
      setPhotoUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!sub) return null

  const totalThumbPages = Math.ceil(submissions.length / THUMB_PAGE_SIZE)
  const thumbStart = thumbPage * THUMB_PAGE_SIZE
  const thumbEnd   = Math.min(thumbStart + THUMB_PAGE_SIZE, submissions.length)
  const thumbSlice = submissions.slice(thumbStart, thumbEnd)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(77,77,79,0.45)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ position: 'absolute', inset: 20, background: IOH.bg, borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}>

        {/* Header */}
        <div style={{ background: IOH.white, borderBottom: `1px solid ${IOH.border}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: catCfg.bg, border: `1px solid ${catCfg.color}22` }}>
              <catCfg.Icon size={12} color={catCfg.color} strokeWidth={2.5} />
              <span style={{ fontSize: 11, fontWeight: 700, color: catCfg.color }}>{catCfg.label}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{sub.driver_name}</span>
            {missingInDraft.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, background: '#FFFBEB', border: '1px solid #FFD166' }}>
                <AlertTriangle size={11} color="#D97706" />
                <span style={{ fontSize: 11, color: '#92400E', fontWeight: 700 }}>Kosong: {missingInDraft.join(', ')}</span>
              </div>
            )}
            {savedFlash && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 7, background: '#F0FDF4', border: `1px solid ${IOH.teal}55` }}>
                <CheckCircle2 size={12} color={IOH.teal} />
                <span style={{ fontSize: 11, color: IOH.teal, fontWeight: 700 }}>Tersimpan</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#aaa', fontWeight: 600 }}>{idx + 1} / {submissions.length}</span>
            <button onClick={prev} disabled={idx === 0} style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: idx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1 }}>
              <ChevronLeft size={16} color={IOH.charcoal} />
            </button>
            <button onClick={next} disabled={idx === submissions.length - 1} style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: idx === submissions.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === submissions.length - 1 ? 0.3 : 1 }}>
              <ChevronRight size={16} color={IOH.charcoal} />
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color={IOH.charcoal} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Photo panel */}
          <div style={{ flex: '0 0 52%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '16px 28px', gap: 10, borderRight: `1px solid ${IOH.border}`, background: '#FAFAFA', overflowY: 'auto', minHeight: 0 }}>

            <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', background: IOH.white, border: `1px solid ${IOH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: 'calc(100vh - 300px)' }}>
              {displayImageUrl
                ? <img src={displayImageUrl} alt="nota" style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 320px)', objectFit: 'contain', display: 'block' }} />
                : <div style={{ width: 200, height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <ReceiptText size={36} color="#ddd" />
                    <span style={{ fontSize: 12, color: '#ccc' }}>Tidak ada foto</span>
                  </div>
              }
            </div>

            <div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoReplace} />
              <button onClick={() => fileRef.current?.click()} disabled={photoUploading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 10, border: `1.5px solid ${IOH.teal}66`, background: IOH.teal + '12', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: IOH.teal, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {photoUploading
                  ? <><div style={{ width: 12, height: 12, border: `2px solid ${IOH.teal}44`, borderTopColor: IOH.teal, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Mengunggah...</>
                  : <><Camera size={13} /> Ganti Foto</>
                }
              </button>
            </div>

            {/* Thumbnail strip */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'nowrap' }}>
                {thumbSlice.map((s, relI) => {
                  const absI = thumbStart + relI
                  const isCurrent = absI === idx
                  const hasMissing = getMissingFields(s).length > 0
                  const thumbUrl = absI === idx ? (localImageUrl ?? s.image_url) : s.image_url
                  return (
                    <div key={s.id} onClick={() => setIdx(absI)} style={{ flexShrink: 0, width: 40, height: 52, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: isCurrent ? `2.5px solid ${IOH.red}` : hasMissing ? `1.5px solid #FFD166` : `1.5px solid ${IOH.border}`, opacity: isCurrent ? 1 : 0.65, transition: 'all 0.15s', position: 'relative', background: '#f3f3f4' }}>
                      {thumbUrl
                        ? <img src={thumbUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ReceiptText size={13} color="#ccc" /></div>
                      }
                      {hasMissing && !isCurrent && (
                        <div style={{ position: 'absolute', top: 2, right: 2, width: 9, height: 9, borderRadius: '50%', background: '#FFD166', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertTriangle size={5} color="#92400E" />
                        </div>
                      )}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', textAlign: 'center', fontSize: 8, color: '#fff', padding: '1px 0', fontWeight: 700 }}>{absI + 1}</div>
                    </div>
                  )
                })}
              </div>

              {totalThumbPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <button onClick={() => setThumbPage(p => Math.max(0, p - 1))} disabled={thumbPage === 0} style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: thumbPage === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: thumbPage === 0 ? 0.3 : 1 }}>
                    <ChevronLeft size={12} color={IOH.charcoal} />
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: totalThumbPages }).map((_, pi) => (
                      <div key={pi} onClick={() => setThumbPage(pi)} style={{ width: pi === thumbPage ? 18 : 6, height: 6, borderRadius: 3, background: pi === thumbPage ? IOH.red : IOH.border, cursor: 'pointer', transition: 'all 0.2s' }} />
                    ))}
                  </div>
                  <button onClick={() => setThumbPage(p => Math.min(totalThumbPages - 1, p + 1))} disabled={thumbPage === totalThumbPages - 1} style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: thumbPage === totalThumbPages - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: thumbPage === totalThumbPages - 1 ? 0.3 : 1 }}>
                    <ChevronRight size={12} color={IOH.charcoal} />
                  </button>
                  <span style={{ fontSize: 10, color: '#bbb', fontWeight: 600 }}>{thumbStart + 1}–{thumbEnd} / {submissions.length}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center' }}>← → navigasi · Esc tutup</div>
          </div>

          {/* Data / Edit panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 80px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>
            <div style={{ background: IOH.white, borderRadius: 16, border: `1px solid ${IOH.border}`, overflow: 'visible', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>

              <div style={{ padding: '16px 18px 4px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Data Nota #{idx + 1}</div>

                <div style={{ marginBottom: 13 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nama Driver</label>
                  <div style={{ fontSize: 13, fontWeight: 700, color: IOH.charcoal, padding: '6px 0' }}>{sub.driver_name}</div>
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Kategori</label>
                  <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={{ ...inlineInputStyle, appearance: 'none' }}>
                    <option value="">— Pilih kategori —</option>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nominal (Rp)</label>
                  <input type="number" min={0} value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} placeholder="0" style={inlineInputStyle} />
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tanggal Struk</label>
                  <input type="date" value={draft.bill_date} onChange={e => setDraft(d => ({ ...d, bill_date: e.target.value }))} style={inlineInputStyle} />
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tanggal Submit</label>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#bbb', padding: '6px 0' }}>
                    {new Date(sub.submission_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {draft.category === 'lainnya' && (
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Keterangan</label>
                    <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Opsional" rows={2} style={{ ...inlineInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                  </div>
                )}
              </div>

              {/* OCR */}
              <div style={{ borderTop: `1px solid ${IOH.border}` }}>
                <button onClick={() => setShowOcr(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {showOcr ? <EyeOff size={13} color={IOH.teal} /> : <Eye size={13} color={IOH.teal} />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: IOH.teal }}>Teks OCR dari Struk</span>
                    {sub.ocr_raw_text && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: IOH.teal + '18', color: IOH.teal, fontWeight: 700 }}>Ada</span>}
                  </div>
                  <ChevronDown size={14} color="#ccc" style={{ transform: showOcr ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {showOcr && (
                  <div style={{ padding: '0 18px 16px' }}>
                    {sub.ocr_raw_text
                      ? <div style={{ background: '#F8F8FA', borderRadius: 10, padding: '11px 13px', fontSize: 11, color: '#888', whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', lineHeight: 1.7, border: `1px solid ${IOH.border}`, fontFamily: 'monospace' }}>{sub.ocr_raw_text}</div>
                      : <div style={{ fontSize: 12, color: '#ccc', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>Tidak ada data OCR.</div>
                    }
                  </div>
                )}
              </div>

              {/* Bukti Transfer */}
              {(sub.amount ?? 0) > HIGH_VALUE_THRESHOLD && (
                <div style={{ borderTop: `1px solid ${IOH.border}` }}>
                  <button onClick={() => setShowProof(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {sub.proof_image_url ? <CheckCircle2 size={13} color={IOH.teal} /> : <AlertTriangle size={13} color="#D97706" />}
                      <span style={{ fontSize: 12, fontWeight: 700, color: sub.proof_image_url ? IOH.teal : '#D97706' }}>Bukti Transfer Bank</span>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: sub.proof_image_url ? IOH.teal + '18' : '#FFFBEB', color: sub.proof_image_url ? IOH.teal : '#D97706' }}>
                        {sub.proof_image_url ? 'Ada' : 'Belum'}
                      </span>
                    </div>
                    <ChevronDown size={14} color="#ccc" style={{ transform: showProof ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {showProof && (
                    <div style={{ padding: '0 18px 16px' }}>
                      {sub.proof_image_url ? (
                        <>
                          <div onClick={() => setProofLightbox(sub.proof_image_url!)} style={{ borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${IOH.teal}55`, cursor: 'zoom-in', marginBottom: 8, background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={sub.proof_image_url} alt="bukti transfer" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center' }}>Klik untuk perbesar</div>
                        </>
                      ) : (
                        <div style={{ padding: '10px 0', textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#D97706', fontWeight: 600, marginBottom: 3 }}>Bukti transfer belum diupload driver</div>
                          <div style={{ fontSize: 11, color: '#bbb' }}>Driver perlu upload via halaman mereka</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Save button */}
              <div style={{ padding: '14px 18px', borderTop: `1px solid ${IOH.border}` }}>
                <button onClick={handleSave} disabled={!isDirty || saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 12, border: 'none', cursor: isDirty && !saving ? 'pointer' : 'not-allowed', background: savedFlash ? IOH.teal : isDirty && !saving ? IOH.yellow : IOH.border, fontSize: 13, fontWeight: 800, color: savedFlash ? '#fff' : isDirty && !saving ? '#111' : '#bbb', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.2s' }}>
                  {saving
                    ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,0.15)', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Menyimpan...</>
                    : savedFlash
                    ? <><CheckCircle2 size={14} /> Tersimpan</>
                    : <><Pencil size={14} /> Simpan Perubahan</>
                  }
                </button>
                {!isDirty && !savedFlash && <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 6 }}>Tidak ada perubahan</div>}
              </div>
            </div>

            {/* Dot nav */}
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {submissions.slice(Math.max(0, idx - 2), Math.min(submissions.length, idx + 3)).map((_, relI) => {
                const absI = Math.max(0, idx - 2) + relI
                return <div key={absI} onClick={() => setIdx(absI)} style={{ width: absI === idx ? 24 : 6, height: 6, borderRadius: 3, background: absI === idx ? IOH.red : IOH.border, cursor: 'pointer', transition: 'all 0.2s' }} />
              })}
            </div>
          </div>
        </div>
      </div>

      {proofLightbox && (
        <div onClick={() => setProofLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20 }}>
          <img src={proofLightbox} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10 }} alt="bukti transfer" />
          <button onClick={() => setProofLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color="#fff" />
          </button>
          <div style={{ position: 'absolute', bottom: 16, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Klik di mana saja untuk tutup</div>
        </div>
      )}
    </div>
  )
}

// ── Grid View ──────────────────────────────────────────────────────────────
function GridView({ submissions, onEdit, onDelete, onReviewOpen, onPhotoReplaced, pageOffset }: {
  submissions: Submission[]
  onEdit: (sub: Submission) => void
  onDelete: (sub: Submission) => void
  onReviewOpen: (index: number) => void
  onPhotoReplaced: () => void
  pageOffset?: number
}) {
  const formatAmount = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
      {submissions.map((sub, i) => {
        const missing = getMissingFields(sub)
        const catCfg  = CATEGORY_CONFIG[sub.category] || CATEGORY_CONFIG.lainnya
        const displayDate = sub.bill_date || sub.submission_date

        return (
          <div key={sub.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: IOH.white, border: missing.length > 0 ? '2px solid #FFD166' : `1px solid ${IOH.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.11)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <div style={{ position: 'relative', aspectRatio: '3/4', background: '#f3f3f4', cursor: 'zoom-in' }} onClick={() => onReviewOpen(i)}>
              {sub.image_url
                ? <img src={sub.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="nota" />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><ReceiptText size={28} color="#ccc" /></div>
              }
              <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {(pageOffset || 0) + i + 1}
              </div>
              {missing.length > 0 && (
                <div title={`Data kosong: ${missing.join(', ')}`} style={{ position: 'absolute', top: 6, right: 60, width: 20, height: 20, borderRadius: '50%', background: '#FFD166', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={11} color="#92400E" />
                </div>
              )}
              <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <button onClick={e => { e.stopPropagation(); onEdit(sub) }} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.92)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                  <Pencil size={12} color={IOH.charcoal} />
                </button>
                <PhotoReplaceBtn submissionId={sub.id} onReplaced={onPhotoReplaced} />
                <button onClick={e => { e.stopPropagation(); onDelete(sub) }} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.92)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                  <Trash2 size={12} color={IOH.red} />
                </button>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.80)', padding: '6px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <catCfg.Icon size={9} color={catCfg.color} strokeWidth={2.5} />
                  <span style={{ fontSize: 9, color: '#ddd', fontWeight: 600 }}>{catCfg.label}</span>
                </div>
                <div style={{ fontSize: 9, color: '#aaa', marginBottom: 1 }}>{sub.driver_name}</div>
                {sub.amount
                  ? <div style={{ fontSize: 10, color: '#FFCB05', fontWeight: 700 }}>Rp {formatAmount(sub.amount)}</div>
                  : <div style={{ fontSize: 9, color: '#FF8A8A' }}>⚠ Nominal kosong</div>
                }
                {displayDate && (
                  <div style={{ fontSize: 9, color: '#888' }}>
                    {new Date(displayDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </div>
                )}
                {sub.category === 'lainnya' && sub.description && (
                  <div style={{ fontSize: 9, color: '#bbb', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.description}</div>
                )}
              </div>
            </div>
            {missing.length > 0 && (
              <div style={{ padding: '5px 8px', background: '#FFFBEB', borderTop: '1px solid #FFD166', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={10} color="#D97706" />
                <span style={{ fontSize: 10, color: '#92400E', fontWeight: 600 }}>Kosong: {missing.join(', ')}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Admin Page ────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('all')
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

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user) { router.replace('/'); return }
      if (data.user.role !== 'admin') { router.replace('/driver'); return }
      setUser(data.user)
      fetchDrivers()
    })
  }, [])

  useEffect(() => { if (user) fetchSubmissions() }, [user, selectedDriver, dateFrom, dateTo])
  useEffect(() => { setCurrentPage(1) }, [selectedDriver, dateFrom, dateTo, searchQuery, viewMode])

  const fetchDrivers = async () => {
    const res = await fetch('/api/drivers')
    const data = await res.json()
    setDrivers(data.drivers || [])
  }

  const fetchSubmissions = async () => {
    setLoading(true)
    let url = `/api/submissions?from=${dateFrom}&to=${dateTo}`
    if (selectedDriver !== 'all') url += `&driver_id=${selectedDriver}`
    try {
      const res = await fetch(url)
      const data = await res.json()
      setSubmissions(data.submissions || [])
      setSelectedIds(new Set())
    } finally { setLoading(false) }
  }

  const handleEdit = async (id: string, updates: any) => {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const formatDate  = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatAmount = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  const filtered = submissions.filter(s =>
    !searchQuery ||
    s.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const driverGroups = filtered.reduce<Record<string, { driver: string; subs: Submission[] }>>((acc, sub) => {
    if (!acc[sub.driver_id]) acc[sub.driver_id] = { driver: sub.driver_name, subs: [] }
    acc[sub.driver_id].subs.push(sub)
    return acc
  }, {})

  const totalAmount  = filtered.reduce((sum, s) => sum + (s.amount || 0), 0)
  const flaggedCount = filtered.filter(s => getMissingFields(s).length > 0).length

  // ── Pagination calculations ────────────────────────────────────────────
  const pageSize  = viewMode === 'grid' ? PAGE_SIZE_GRID : PAGE_SIZE_LIST
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage  = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const paginated = filtered.slice(pageStart, pageStart + pageSize)

  // ── reviewerIndex points into `filtered` (not `paginated`) ────────────
  // Grid: pageStart + i  (i is index within paginated slice)
  // List: pageStart + idx (idx is index within paginated slice)
  // Both give absolute index in `filtered`, which is what BillReviewerModal expects.

  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: IOH.bg }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#888' }}>Memuat...</div>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif !important; background: ${IOH.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .nota-card { animation: fadeUp 0.22s ease both; transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .nota-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.1) !important; }
        input:focus, select:focus { border-color: ${IOH.teal} !important; box-shadow: 0 0 0 3px ${IOH.teal}22; }
        input[type=date]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 99px; }
        .topbar-logo { height: 50px; width: auto; object-fit: contain; display: block; }
        .view-btn-active { background: ${IOH.red} !important; color: #fff !important; border-color: ${IOH.red} !important; }
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: IOH.bg }}>

        {/* Topbar */}
        <div style={{ background: IOH.white, borderBottom: `1px solid ${IOH.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img src="/logo-ioh.png" alt="Indosat Ooredoo Hutchison" className="topbar-logo"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; const el = e.currentTarget.nextElementSibling as HTMLElement; if (el) el.style.display = 'flex' }} />
              <div style={{ display: 'none', alignItems: 'center', gap: 10, background: `linear-gradient(135deg, ${IOH.red} 0%, ${IOH.magenta} 100%)`, borderRadius: 10, padding: '6px 14px' }}>
                <ReceiptText size={16} color="#fff" /><span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>IOH</span>
              </div>
              <div style={{ width: 1, height: 28, background: IOH.border }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', lineHeight: 1 }}>Reimburse</div>
                <div style={{ fontSize: 10, color: IOH.red, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>Admin Panel</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', borderRadius: 10, border: `1.5px solid ${IOH.border}`, overflow: 'hidden' }}>
                <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'view-btn-active' : ''} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: 'none', background: IOH.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s' }}>
                  <List size={13} /> List
                </button>
                <button onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'view-btn-active' : ''} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: 'none', borderLeft: `1px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s' }}>
                  <LayoutGrid size={13} /> Grid
                </button>
              </div>
              <ExportExcelButton allDrivers={drivers} defaultMonth={dateFrom.slice(0, 7)} companyName={companyName} />
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#666', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.red; (e.currentTarget as HTMLElement).style.color = IOH.red }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.border; (e.currentTarget as HTMLElement).style.color = '#666' }}>
                <LogOut size={14} /> Keluar
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px' }}>

          {/* Filter */}
          <div style={{ background: IOH.white, borderRadius: 18, padding: 22, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: IOH.red + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SlidersHorizontal size={14} color={IOH.red} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#333', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Filter & Pencarian</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Driver</label>
                <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} style={inputStyle}>
                  <option value="all">Semua Driver</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dari</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sampai</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nama Perusahaan</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="PT. Indosat Tbk" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cari</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} color="#bbb" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nama, kategori..." style={{ ...inputStyle, paddingLeft: 30 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Admin Upload */}
          <AdminUploadSection drivers={drivers} onUploadDone={fetchSubmissions} />

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: flaggedCount > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <StatCard label="Total Nota" value={filtered.length} accent={IOH.yellow} />
            <StatCard label="Total Nilai" value={`Rp ${formatAmount(totalAmount)}`} accent={IOH.red} />
            <StatCard label="Driver Aktif" value={Object.keys(driverGroups).length} accent={IOH.teal} />
            {flaggedCount > 0 && <StatCard label="Perlu Dilengkapi" value={flaggedCount} accent={IOH.magenta} sub="Data tidak lengkap" />}
          </div>

          {/* Alert banner */}
          {flaggedCount > 0 && (
            <div style={{ background: '#FFFBEB', border: '1.5px solid #FFD166', borderRadius: 14, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{flaggedCount} nota memiliki data tidak lengkap</div>
                <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>Field yang wajib diisi: Nominal, Tanggal Struk, Kategori, Bukti Transfer. Klik Edit pada nota tersebut untuk melengkapi.</div>
              </div>
            </div>
          )}

          {/* Submissions */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
              <div style={{ width: 38, height: 38, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13, color: '#aaa' }}>Memuat data...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: IOH.white, borderRadius: 18, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}` }}>
              <ReceiptText size={38} color="#ddd" style={{ marginBottom: 14 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ccc' }}>Tidak ada nota</div>
              <div style={{ fontSize: 13, color: '#ddd', marginTop: 4 }}>Coba ubah filter atau rentang tanggal</div>
            </div>
          ) : viewMode === 'grid' ? (

            /* ── GRID VIEW ── */
            <div style={{ background: IOH.white, borderRadius: 18, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 16 }}>
                {filtered.length} Nota
                {flaggedCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#D97706', fontWeight: 600 }}>⚠ {flaggedCount} perlu dilengkapi</span>}
                <span style={{ marginLeft: 8, fontSize: 11, color: '#bbb', fontWeight: 500 }}>· klik foto untuk review detail</span>
              </div>
              <GridView
                submissions={paginated}
                onEdit={sub => setEditingSubmission(sub)}
                onDelete={sub => setDeleteTarget(sub)}
                onReviewOpen={i => setReviewerIndex(pageStart + i)}
                onPhotoReplaced={fetchSubmissions}
                pageOffset={pageStart}
              />
              {/* ── FIX: Pagination selalu di-render di luar GridView, bukan di dalamnya ── */}
              <Pagination
                currentPage={safePage}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={p => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              />
            </div>

          ) : (

            /* ── LIST VIEW ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paginated.map((sub, idx) => {
                const catCfg    = CATEGORY_CONFIG[sub.category] || CATEGORY_CONFIG.lainnya
                const CatIcon   = catCfg.Icon
                const isSelected = selectedIds.has(sub.id)
                const missing   = getMissingFields(sub)

                return (
                  <div key={sub.id} className="nota-card" style={{
                    background: IOH.white, borderRadius: 16, padding: '14px 16px',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                    boxShadow: isSelected
                      ? `0 0 0 2px ${IOH.yellow}, 0 4px 16px rgba(0,0,0,0.07)`
                      : missing.length > 0 ? '0 0 0 1.5px #FFD166, 0 2px 10px rgba(0,0,0,0.05)'
                      : '0 2px 10px rgba(0,0,0,0.05)',
                    border: `1.5px solid ${isSelected ? IOH.yellow : missing.length > 0 ? '#FFD166' : 'transparent'}`,
                    cursor: selectedDriver !== 'all' ? 'pointer' : 'default',
                    animationDelay: `${idx * 0.025}s`
                  }} onClick={() => selectedDriver !== 'all' && toggleSelect(sub.id)}>

                    {selectedDriver !== 'all' && (
                      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 3, border: `2px solid ${isSelected ? IOH.yellow : '#ddd'}`, background: isSelected ? IOH.yellow : IOH.white, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {isSelected && <div style={{ width: 8, height: 8, background: '#111', borderRadius: 2 }} />}
                      </div>
                    )}

                    {sub.image_url && (
                      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => { e.stopPropagation(); setReviewerIndex(pageStart + idx) }}>
                        <img src={sub.image_url} alt="nota" style={{ width: 54, height: 68, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', display: 'block', border: `1px solid ${IOH.border}` }} />
                        <div style={{ position: 'absolute', bottom: -4, right: -4 }}>
                          <PhotoReplaceBtn submissionId={sub.id} onReplaced={fetchSubmissions} />
                        </div>
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
                      {missing.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 7, marginBottom: 6, background: '#FFFBEB', border: '1px solid #FFD166', fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                          <AlertTriangle size={11} color="#D97706" />
                          Data kosong: {missing.join(', ')}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{sub.driver_name}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: catCfg.bg, color: catCfg.color }}>
                          <CatIcon size={10} strokeWidth={2.5} /> {catCfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#aaa', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                        {sub.bill_date
                          ? <span style={{ color: IOH.charcoal, fontWeight: 600 }}>Struk: {formatDate(sub.bill_date)}</span>
                          : <span style={{ color: '#FF8A8A', fontWeight: 600 }}>⚠ Tgl struk kosong</span>
                        }
                        <span style={{ color: '#ccc' }}>Submit: {formatDate(sub.submission_date)}</span>
                      </div>
                      {sub.amount
                        ? <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 2 }}>Rp {formatAmount(sub.amount)}</div>
                        : <div style={{ fontSize: 13, color: '#FF8A8A', fontWeight: 600, marginBottom: 2 }}>⚠ Nominal belum diisi</div>
                      }
                      {sub.category === 'lainnya' && sub.description && (
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{sub.description}</div>
                      )}
                      {sub.ocr_raw_text && (
                        <button onClick={() => setExpandOcr(expandOcr === sub.id ? null : sub.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#bbb', fontSize: 11, cursor: 'pointer', padding: '2px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          {expandOcr === sub.id ? <EyeOff size={11} /> : <Eye size={11} />}
                          {expandOcr === sub.id ? 'Sembunyikan teks OCR' : 'Lihat teks OCR'}
                        </button>
                      )}
                      {expandOcr === sub.id && sub.ocr_raw_text && (
                        <div style={{ marginTop: 6, padding: '8px 10px', background: '#F8F8FA', borderRadius: 8, fontSize: 11, color: '#999', whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto', border: `1px solid ${IOH.border}`, lineHeight: 1.6 }}>{sub.ocr_raw_text}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {(sub.amount ?? 0) > HIGH_VALUE_THRESHOLD && (
                        <div title={sub.proof_image_url ? 'Lihat bukti transfer' : 'Belum ada bukti transfer'} onClick={() => sub.proof_image_url && setLightbox(sub.proof_image_url)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${sub.proof_image_url ? IOH.teal + '60' : '#FFE082'}`, background: sub.proof_image_url ? IOH.teal + '10' : '#FFFBEB', fontSize: 11, fontWeight: 700, color: sub.proof_image_url ? IOH.teal : '#D97706', cursor: sub.proof_image_url ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                          {sub.proof_image_url ? <><CheckCircle2 size={11} /> Bukti ✓</> : <>⚠ Bukti</>}
                        </div>
                      )}
                      <ActionBtn icon={<Pencil size={13} />} label="Edit" color={IOH.charcoal} onClick={() => setEditingSubmission(sub)} />
                      <ActionBtn icon={<Trash2 size={13} />} label="Hapus" color={IOH.red} onClick={() => setDeleteTarget(sub)} danger />
                    </div>
                  </div>
                )
              })}

              {/* ── FIX: Pagination ── */}
              <div style={{ marginTop: 4 }}>
                <Pagination
                  currentPage={safePage}
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  onPageChange={p => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                />
              </div>
            </div>

          )}
        </div>
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
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24 }}>
          <img src={lightbox} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <X size={20} color="#fff" />
          </button>
        </div>
      )}
    </>
  )
}