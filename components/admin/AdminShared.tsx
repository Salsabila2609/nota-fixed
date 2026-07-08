'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ImageEditorModal from '@/components/ImageEditorModal'
import {
  Trash2, Pencil, ChevronDown, ReceiptText, Car, Fuel, ParkingCircle,
  AlertTriangle, X, Eye, EyeOff, Camera, ChevronLeft, ChevronRight,
  CheckCircle2, ImagePlus,
} from 'lucide-react'

export const IOH = {
  red: '#ED1C24',
  yellow: '#FFCB05',
  teal: '#32BCAD',
  magenta: '#C6168D',
  pink: '#EC008C',
  charcoal: '#4D4D4F',
  bg: '#F5F5F7',
  white: '#FFFFFF',
  border: '#E8E8EA',
}

export const HIGH_VALUE_THRESHOLD = 250000
export const PAGE_SIZE_LIST = 10
export const PAGE_SIZE_GRID = 24

export type Submission = {
  id: string; driver_id: string; driver_name: string; category: string
  description?: string; amount?: number; submission_date: string; bill_date?: string
  image_url?: string; proof_image_path?: string; proof_image_url?: string
  status: string; created_at: string; ocr_raw_text?: string
  was_restored?: boolean
}

export const CATEGORY_CONFIG: Record<string, { label: string; Icon: any; color: string; bg: string }> = {
  parkir: { label: 'Parkir', Icon: ParkingCircle, color: '#ED1C24', bg: '#FFF0F0' },
  tol: { label: 'Tol', Icon: Car, color: '#C6168D', bg: '#FDF0F9' },
  bensin: { label: 'Bensin', Icon: Fuel, color: '#B8960A', bg: '#FFFBEB' },
  lainnya: { label: 'Lainnya', Icon: ReceiptText, color: '#4D4D4F', bg: '#F3F3F4' },
}

export function getMissingFields(sub: Submission): string[] {
  const missing: string[] = []
  if (!sub.amount || sub.amount === 0) missing.push('Nominal')
  if (!sub.bill_date) missing.push('Tgl Struk')
  if (!sub.category || sub.category === '') missing.push('Kategori')
  if ((sub.amount ?? 0) > HIGH_VALUE_THRESHOLD && !sub.proof_image_path) missing.push('Bukti Transfer')
  return missing
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid #E8E8EA`,
  fontSize: 13, color: '#222', background: '#fff', outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif", appearance: 'none',
  transition: 'border-color 0.15s',
}

const inlineInputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 10,
  border: `1.5px solid ${IOH.border}`,
  background: IOH.white, color: '#111',
  fontSize: 13, fontWeight: 600, outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: 'border-color 0.15s',
}

export function StatCard({ label, value, accent, sub }: { label: string; value: any; accent: string; sub?: string }) {
  return (
    <div style={{ background: IOH.white, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -14, right: -14, width: 60, height: 60, borderRadius: '50%', background: accent + '12' }} />
      <div style={{ fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1.1, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function ActionBtn({ icon, label, color, onClick, danger, compact }: { icon: any; label: string; color: string; onClick: () => void; danger?: boolean; compact?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      display: 'flex', alignItems: 'center', gap: compact ? 0 : 5,
      padding: compact ? '7px' : '6px 11px',
      borderRadius: 9, border: `1.5px solid ${hov ? color : IOH.border}`,
      background: hov && danger ? IOH.red : hov ? '#F8F8FA' : IOH.white,
      cursor: 'pointer', fontSize: 12, fontWeight: 600, color: hov && danger ? '#fff' : color,
      fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {icon} {!compact && label}
    </button>
  )
}

export function DeleteConfirmModal({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: IOH.white, borderRadius: 20, padding: '24px 20px', maxWidth: 380, width: '100%', boxShadow: '0 32px 64px rgba(0,0,0,0.18)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={20} color={IOH.red} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Hapus Nota?</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Tindakan ini tidak bisa dibatalkan</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: IOH.charcoal, lineHeight: 1.7, marginBottom: 20 }}>
          Nota <strong style={{ color: '#111' }}>{name}</strong> akan dihapus permanen dari sistem termasuk foto struk-nya.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: IOH.white, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', color: IOH.charcoal }}>Batal</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: IOH.red, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  )
}

export function PhotoReplaceBtn({ submissionId, onReplaced }: { submissionId: string; onReplaced: () => void }) {
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
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'all 0.15s',
        }}
      >
        {uploading
          ? <div style={{ width: 10, height: 10, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : <Camera size={12} color={IOH.teal} />}
      </button>
    </>
  )
}

const THUMB_PAGE_SIZE = 10

export function GridView({ submissions, onEdit, onDelete, onReviewOpen, onPhotoReplaced, pageOffset }: {
  submissions: Submission[]
  onEdit: (sub: Submission) => void
  onDelete: (sub: Submission) => void
  onReviewOpen: (index: number) => void
  onPhotoReplaced: () => void
  pageOffset?: number
}) {
  const formatAmount = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {submissions.map((sub, i) => {
        const missing = getMissingFields(sub)
        const catCfg = CATEGORY_CONFIG[sub.category] || CATEGORY_CONFIG.lainnya
        const displayDate = sub.bill_date || sub.submission_date

        return (
          <div key={sub.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: IOH.white, border: missing.length > 0 ? '2px solid #FFD166' : `1px solid ${IOH.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.11)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <div style={{ position: 'relative', aspectRatio: '3/4', background: '#f3f3f4', cursor: 'zoom-in' }} onClick={() => onReviewOpen(i)}>
              {sub.image_url
                ? <img src={sub.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="nota" />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><ReceiptText size={28} color="#ccc" /></div>}
              <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {(pageOffset || 0) + i + 1}
              </div>
              {sub.was_restored && (
                <div title="Pernah dipulihkan dari arsip" style={{ position: 'absolute', top: 6, left: 38, width: 20, height: 20, borderRadius: '50%', background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>↺</div>
              )}
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
                  : <div style={{ fontSize: 9, color: '#FF8A8A' }}>⚠ Nominal kosong</div>}
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

export function BillReviewerModal({
  submissions, startIndex, onClose, onSave, onPhotoReplaced,
}: {
  submissions: Submission[]
  startIndex: number
  onClose: () => void
  onSave: (id: string, updates: any) => Promise<void>
  onPhotoReplaced: () => void
}) {
  const isMobile = useIsMobile()
  const [idx, setIdx] = useState(startIndex)
  const [thumbPage, setThumbPage] = useState(Math.floor(startIndex / THUMB_PAGE_SIZE))
  const [showOcr, setShowOcr] = useState(false)
  const [showProof, setShowProof] = useState(false)
  const [mobileTab, setMobileTab] = useState<'photo' | 'data'>('photo')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [proofUploading, setProofUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null)
  const [localProofUrl, setLocalProofUrl] = useState<string | null>(null)
  const [proofLightbox, setProofLightbox] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<'nota' | 'proof' | null>(null)
  const [draft, setDraft] = useState<Record<string, any>>(() => ({
    category: submissions[startIndex]?.category || '',
    amount: submissions[startIndex]?.amount ?? '',
    bill_date: submissions[startIndex]?.bill_date || '',
    description: submissions[startIndex]?.description || '',
  }))
  const fileRef = useRef<HTMLInputElement>(null)
  const proofRef = useRef<HTMLInputElement>(null)
  const proofReplaceRef = useRef<HTMLInputElement>(null)

  const sub = submissions[idx]

  useEffect(() => { setThumbPage(Math.floor(idx / THUMB_PAGE_SIZE)) }, [idx])

  useEffect(() => {
    if (!sub) return
    setDraft({
      category: sub.category || '',
      amount: sub.amount ?? '',
      bill_date: sub.bill_date || '',
      description: sub.description || '',
    })
    setLocalImageUrl(null)
    setLocalProofUrl(null)
    setShowProof(false)
    setSavedFlash(false)
    setEditorMode(null)
  }, [idx, sub?.id])

  const displayImageUrl = localImageUrl ?? sub?.image_url
  const displayProofUrl = localProofUrl ?? sub?.proof_image_url
  const catCfg = CATEGORY_CONFIG[draft.category] || CATEGORY_CONFIG.lainnya

  const isDirty =
    draft.category !== (sub?.category || '') ||
    String(draft.amount ?? '') !== String(sub?.amount ?? '') ||
    draft.bill_date !== (sub?.bill_date || '') ||
    draft.description !== (sub?.description || '')

  const missingInDraft: string[] = []
  if (!draft.amount || draft.amount === '' || Number(draft.amount) === 0) missingInDraft.push('Nominal')
  if (!draft.bill_date) missingInDraft.push('Tgl Struk')
  if (!draft.category) missingInDraft.push('Kategori')

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx(i => Math.min(submissions.length - 1, i + 1)), [submissions.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editorMode) return
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose, editorMode])

  const handleSave = async () => {
    if (!sub || !isDirty) return
    setSaving(true)
    try {
      await onSave(sub.id, {
        category: draft.category,
        amount: draft.amount !== '' ? Number(draft.amount) : null,
        bill_date: draft.bill_date || null,
        description: draft.description || null,
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } finally { setSaving(false) }
  }

  const handlePhotoReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/api/submissions/${sub.id}/replace-photo`, { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); if (d.image_url) setLocalImageUrl(d.image_url); onPhotoReplaced() }
    } finally { setPhotoUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const handleNotaEditorSave = async (editedFile: File) => {
    setPhotoUploading(true)
    try {
      const fd = new FormData(); fd.append('file', editedFile)
      const res = await fetch(`/api/submissions/${sub.id}/replace-photo`, { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); if (d.image_url) setLocalImageUrl(d.image_url); onPhotoReplaced() }
    } finally { setPhotoUploading(false); setEditorMode(null) }
  }

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setProofUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/api/submissions/${sub.id}/upload-proof`, { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); if (d.proof_image_url) setLocalProofUrl(d.proof_image_url); onPhotoReplaced() }
    } finally { setProofUploading(false); if (proofRef.current) proofRef.current.value = '' }
  }

  const handleProofReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setProofUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/api/submissions/${sub.id}/upload-proof`, { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); if (d.proof_image_url) setLocalProofUrl(d.proof_image_url); onPhotoReplaced() }
    } finally { setProofUploading(false); if (proofReplaceRef.current) proofReplaceRef.current.value = '' }
  }

  const handleProofEditorSave = async (editedFile: File) => {
    setProofUploading(true)
    try {
      const fd = new FormData(); fd.append('file', editedFile)
      const res = await fetch(`/api/submissions/${sub.id}/upload-proof`, { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); if (d.proof_image_url) setLocalProofUrl(d.proof_image_url); onPhotoReplaced() }
    } finally { setProofUploading(false); setEditorMode(null) }
  }

  if (!sub) return null

  const totalThumbPages = Math.ceil(submissions.length / THUMB_PAGE_SIZE)
  const thumbStart = thumbPage * THUMB_PAGE_SIZE
  const thumbEnd = Math.min(thumbStart + THUMB_PAGE_SIZE, submissions.length)
  const thumbSlice = submissions.slice(thumbStart, thumbEnd)

  const PhotoPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: isMobile ? '12px 16px' : '16px 28px' }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', background: '#FFFFFF', border: `1px solid #E8E8EA`, display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: isMobile ? 260 : 'calc(100vh - 300px)', width: '100%' }}>
        {displayImageUrl
          ? <img src={displayImageUrl} alt="nota" style={{ maxWidth: '100%', maxHeight: isMobile ? 260 : 'calc(100vh - 320px)', objectFit: 'contain', display: 'block' }} />
          : <div style={{ width: 200, height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ReceiptText size={36} color="#ddd" />
              <span style={{ fontSize: 12, color: '#ccc' }}>Tidak ada foto</span>
            </div>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoReplace} />
        <button onClick={() => fileRef.current?.click()} disabled={photoUploading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${'#32BCAD'}66`, background: '#32BCAD' + '12', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#32BCAD', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {photoUploading
            ? <><div style={{ width: 12, height: 12, border: `2px solid ${'#32BCAD'}44`, borderTopColor: '#32BCAD', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Mengunggah...</>
            : <><Camera size={13} /> Ganti Foto</>}
        </button>

        {displayImageUrl && (
          <button onClick={() => setEditorMode('nota')} disabled={photoUploading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #FFCB0588', background: '#FFCB0518', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#B8960A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Pencil size={13} /> Edit Foto
          </button>
        )}
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
          {thumbSlice.map((s, relI) => {
            const absI = thumbStart + relI
            const isCurrent = absI === idx
            const hasMissing = getMissingFields(s).length > 0
            const thumbUrl = absI === idx ? (localImageUrl ?? s.image_url) : s.image_url
            return (
              <div key={s.id} onClick={() => setIdx(absI)} style={{ flexShrink: 0, width: 38, height: 50, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: isCurrent ? `2.5px solid #ED1C24` : hasMissing ? `1.5px solid #FFD166` : `1.5px solid #E8E8EA`, opacity: isCurrent ? 1 : 0.65, transition: 'all 0.15s', position: 'relative', background: '#f3f3f4' }}>
                {thumbUrl
                  ? <img src={thumbUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ReceiptText size={13} color="#ccc" /></div>}
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
            <button onClick={() => setThumbPage(p => Math.max(0, p - 1))} disabled={thumbPage === 0} style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid #E8E8EA`, background: '#FFFFFF', cursor: thumbPage === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: thumbPage === 0 ? 0.3 : 1 }}>
              <ChevronLeft size={12} color="#4D4D4F" />
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalThumbPages }).map((_, pi) => (
                <div key={pi} onClick={() => setThumbPage(pi)} style={{ width: pi === thumbPage ? 18 : 6, height: 6, borderRadius: 3, background: pi === thumbPage ? '#ED1C24' : '#E8E8EA', cursor: 'pointer', transition: 'all 0.2s' }} />
              ))}
            </div>
            <button onClick={() => setThumbPage(p => Math.min(totalThumbPages - 1, p + 1))} disabled={thumbPage === totalThumbPages - 1} style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid #E8E8EA`, background: '#FFFFFF', cursor: thumbPage === totalThumbPages - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: thumbPage === totalThumbPages - 1 ? 0.3 : 1 }}>
              <ChevronRight size={12} color="#4D4D4F" />
            </button>
            <span style={{ fontSize: 10, color: '#bbb', fontWeight: 600 }}>{thumbStart + 1}–{thumbEnd}/{submissions.length}</span>
          </div>
        )}
      </div>

      {!isMobile && <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center' }}>← → navigasi · Esc tutup</div>}
    </div>
  )

  const DataPanel = () => (
    <div style={{ overflowY: 'auto', height: '100%', padding: isMobile ? '16px 16px 80px' : '20px 24px 80px', display: 'flex', flexDirection: 'column', gap: 0, boxSizing: 'border-box' }}>
      <div style={{ background: '#FFFFFF', borderRadius: 16, border: `1px solid #E8E8EA`, overflow: 'visible', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: isMobile ? '14px 14px 4px' : '16px 18px 4px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Data Nota #{idx + 1}</div>

          <div style={{ marginBottom: 13 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nama</label>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4D4D4F', padding: '6px 0' }}>{sub.driver_name}</div>
          </div>

          <div style={{ marginBottom: 13 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Kategori</label>
            <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={{ ...inlineInputStyle, appearance: 'none', fontSize: 14, padding: '10px 12px' }}>
              <option value="">— Pilih kategori —</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 13 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nominal (Rp)</label>
            <input type="number" min={0} inputMode="numeric" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} placeholder="0" style={{ ...inlineInputStyle, fontSize: 14, padding: '10px 12px' }} />
          </div>

          <div style={{ marginBottom: 13 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tanggal Struk</label>
            <input type="date" value={draft.bill_date} onChange={e => setDraft(d => ({ ...d, bill_date: e.target.value }))} style={{ ...inlineInputStyle, fontSize: 14, padding: '10px 12px' }} />
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
              <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Opsional" rows={2} style={{ ...inlineInputStyle, resize: 'vertical', lineHeight: 1.5, fontSize: 14 }} />
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid #E8E8EA` }}>
          <button onClick={() => setShowOcr(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {showOcr ? <EyeOff size={13} color="#32BCAD" /> : <Eye size={13} color="#32BCAD" />}
              <span style={{ fontSize: 12, fontWeight: 700, color: '#32BCAD' }}>Teks OCR dari Struk</span>
              {sub.ocr_raw_text && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: '#32BCAD18', color: '#32BCAD', fontWeight: 700 }}>Ada</span>}
            </div>
            <ChevronDown size={14} color="#ccc" style={{ transform: showOcr ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showOcr && (
            <div style={{ padding: '0 16px 16px' }}>
              {sub.ocr_raw_text
                ? <div style={{ background: '#F8F8FA', borderRadius: 10, padding: '11px 13px', fontSize: 11, color: '#888', whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', lineHeight: 1.7, border: `1px solid #E8E8EA`, fontFamily: 'monospace' }}>{sub.ocr_raw_text}</div>
                : <div style={{ fontSize: 12, color: '#ccc', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>Tidak ada data OCR.</div>}
            </div>
          )}
        </div>

        {(sub.amount ?? 0) > HIGH_VALUE_THRESHOLD && (
          <div style={{ borderTop: `1px solid #E8E8EA` }}>
            <button onClick={() => setShowProof(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {displayProofUrl ? <CheckCircle2 size={13} color="#32BCAD" /> : <AlertTriangle size={13} color="#D97706" />}
                <span style={{ fontSize: 12, fontWeight: 700, color: displayProofUrl ? '#32BCAD' : '#D97706' }}>Bukti Transfer Bank</span>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, fontWeight: 700, background: displayProofUrl ? '#32BCAD18' : '#FFFBEB', color: displayProofUrl ? '#32BCAD' : '#D97706' }}>
                  {displayProofUrl ? 'Ada' : 'Belum'}
                </span>
              </div>
              <ChevronDown size={14} color="#ccc" style={{ transform: showProof ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showProof && (
              <div style={{ padding: '0 16px 16px' }}>
                {displayProofUrl ? (
                  <>
                    <div onClick={() => setProofLightbox(displayProofUrl)} style={{ borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${'#32BCAD'}55`, cursor: 'zoom-in', marginBottom: 10, background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={displayProofUrl} alt="bukti transfer" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => setEditorMode('proof')} disabled={proofUploading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #FFCB0588', background: '#FFCB0518', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#B8960A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <Pencil size={12} /> Edit Bukti
                      </button>
                      <input ref={proofReplaceRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProofReplace} />
                      <button onClick={() => proofReplaceRef.current?.click()} disabled={proofUploading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${'#32BCAD'}66`, background: '#32BCAD12', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#32BCAD', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {proofUploading
                          ? <><div style={{ width: 10, height: 10, border: `2px solid ${'#32BCAD'}44`, borderTopColor: '#32BCAD', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Mengunggah...</>
                          : <><ImagePlus size={12} /> Ganti File</>}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 6, textAlign: 'center' }}>Klik foto untuk perbesar</div>
                  </>
                ) : (
                  <div style={{ padding: '4px 0' }}>
                    <div style={{ fontSize: 12, color: '#D97706', fontWeight: 600, marginBottom: 10 }}>
                      Bukti transfer belum diupload. Admin bisa upload di sini.
                    </div>
                    <input ref={proofRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProofUpload} />
                    <button onClick={() => proofRef.current?.click()} disabled={proofUploading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 11, border: `1.5px dashed #FFD166`, background: '#FFFBEB', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#D97706', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {proofUploading
                        ? <><div style={{ width: 12, height: 12, border: '2px solid #F59E0B44', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Mengunggah...</>
                        : <><ImagePlus size={14} /> Upload Bukti Transfer</>}
                    </button>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 6, textAlign: 'center' }}>Screenshot m-banking atau struk ATM</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '14px 16px', borderTop: `1px solid #E8E8EA` }}>
          <button onClick={handleSave} disabled={!isDirty || saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 0', borderRadius: 12, border: 'none', cursor: isDirty && !saving ? 'pointer' : 'not-allowed', background: savedFlash ? '#32BCAD' : isDirty && !saving ? '#FFCB05' : '#E8E8EA', fontSize: 14, fontWeight: 800, color: savedFlash ? '#fff' : isDirty && !saving ? '#111' : '#bbb', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.2s' }}>
            {saving
              ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,0.15)', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Menyimpan...</>
              : savedFlash ? <><CheckCircle2 size={14} /> Tersimpan</>
              : <><Pencil size={14} /> Simpan Perubahan</>}
          </button>
          {!isDirty && !savedFlash && <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 6 }}>Tidak ada perubahan</div>}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {submissions.slice(Math.max(0, idx - 2), Math.min(submissions.length, idx + 3)).map((_, relI) => {
          const absI = Math.max(0, idx - 2) + relI
          return <div key={absI} onClick={() => setIdx(absI)} style={{ width: absI === idx ? 24 : 6, height: 6, borderRadius: 3, background: absI === idx ? '#ED1C24' : '#E8E8EA', cursor: 'pointer', transition: 'all 0.2s' }} />
        })}
      </div>
    </div>
  )

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(77,77,79,0.45)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{ position: 'absolute', inset: isMobile ? 0 : 20, background: '#F5F5F7', borderRadius: isMobile ? 0 : 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}>

          <div style={{ background: '#FFFFFF', borderBottom: `1px solid #E8E8EA`, padding: isMobile ? '12px 14px' : '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: catCfg.bg, border: `1px solid ${catCfg.color}22`, flexShrink: 0 }}>
                <catCfg.Icon size={11} color={catCfg.color} strokeWidth={2.5} />
                <span style={{ fontSize: 11, fontWeight: 700, color: catCfg.color }}>{catCfg.label}</span>
              </div>
              <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.driver_name}</span>
              {sub.was_restored && !isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <span style={{ fontSize: 11, color: '#C2410C', fontWeight: 700 }}>↺ Pernah dipulihkan</span>
                </div>
              )}
              {missingInDraft.length > 0 && !isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, background: '#FFFBEB', border: '1px solid #FFD166' }}>
                  <AlertTriangle size={11} color="#D97706" />
                  <span style={{ fontSize: 11, color: '#92400E', fontWeight: 700 }}>Kosong: {missingInDraft.join(', ')}</span>
                </div>
              )}
              {savedFlash && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 7, background: '#F0FDF4', border: `1px solid ${'#32BCAD'}55` }}>
                  <CheckCircle2 size={12} color="#32BCAD" />
                  <span style={{ fontSize: 11, color: '#32BCAD', fontWeight: 700 }}>Tersimpan</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>{idx + 1}/{submissions.length}</span>
              <button onClick={prev} disabled={idx === 0} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid #E8E8EA`, background: '#FFFFFF', cursor: idx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1 }}>
                <ChevronLeft size={15} color="#4D4D4F" />
              </button>
              <button onClick={next} disabled={idx === submissions.length - 1} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid #E8E8EA`, background: '#FFFFFF', cursor: idx === submissions.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === submissions.length - 1 ? 0.3 : 1 }}>
                <ChevronRight size={15} color="#4D4D4F" />
              </button>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid #E8E8EA`, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color="#4D4D4F" />
              </button>
            </div>
          </div>

          {isMobile && (sub.was_restored || missingInDraft.length > 0) && (
            <div style={{ padding: '7px 14px', background: sub.was_restored ? '#FFF7ED' : '#FFFBEB', borderBottom: `1px solid ${sub.was_restored ? '#FED7AA' : '#FFD166'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              {sub.was_restored
                ? <span style={{ fontSize: 11, color: '#C2410C', fontWeight: 700 }}>↺ Pernah dipulihkan dari arsip</span>
                : <><AlertTriangle size={11} color="#D97706" /><span style={{ fontSize: 11, color: '#92400E', fontWeight: 700 }}>Kosong: {missingInDraft.join(', ')}</span></>}
            </div>
          )}

          {isMobile && (
            <div style={{ display: 'flex', borderBottom: `1px solid #E8E8EA`, background: '#FFFFFF', flexShrink: 0 }}>
              {(['photo', 'data'] as const).map(tab => (
                <button key={tab} onClick={() => setMobileTab(tab)} style={{ flex: 1, padding: '11px 0', border: 'none', borderBottom: mobileTab === tab ? `2.5px solid #ED1C24` : '2.5px solid transparent', background: 'none', fontSize: 12, fontWeight: 700, color: mobileTab === tab ? '#ED1C24' : '#aaa', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s' }}>
                  {tab === 'photo' ? '📷 Foto Struk' : '✏️ Data & Edit'}
                </button>
              ))}
            </div>
          )}

          {isMobile ? (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {mobileTab === 'photo' ? <PhotoPanel /> : <DataPanel />}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ flex: '0 0 52%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', borderRight: `1px solid #E8E8EA`, background: '#FAFAFA', overflowY: 'auto', minHeight: 0 }}>
                <PhotoPanel />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <DataPanel />
              </div>
            </div>
          )}
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

      {editorMode === 'nota' && (
        <ImageEditorModal
          imageUrl={`/api/submissions/${sub.id}/image-proxy?type=nota`}
          onClose={() => setEditorMode(null)}
          onSave={handleNotaEditorSave}
          title="Edit Foto Nota"
        />
      )}

      {editorMode === 'proof' && (
        <ImageEditorModal
          imageUrl={`/api/submissions/${sub.id}/image-proxy?type=proof`}
          onClose={() => setEditorMode(null)}
          onSave={handleProofEditorSave}
          title="Edit Bukti Transfer"
        />
      )}
    </>
  )
}