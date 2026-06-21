
'use client'
import { useState, useRef } from 'react'
import {
  Camera, ImagePlus, X, Upload, CheckCircle2, AlertCircle,
  ReceiptText, Car, Fuel, ParkingCircle, ChevronDown, ZoomIn, Pencil
} from 'lucide-react'

// ── IOH Brand Palette ──────────────────────────────────────────────────────
const IOH = {
  red:     '#ED1C24',
  yellow:  '#FFCB05',
  teal:    '#32BCAD',
  magenta: '#C6168D',
  charcoal:'#4D4D4F',
  bg:      '#F5F5F7',
  white:   '#FFFFFF',
  border:  '#E8E8EA',
}

const HIGH_VALUE_THRESHOLD = 250000

const CATEGORY_CONFIG: Record<string, { label: string; Icon: any; color: string; bg: string }> = {
  parkir:  { label: 'Parkir',  Icon: ParkingCircle, color: '#ED1C24', bg: '#FFF0F0' },
  tol:     { label: 'Tol',     Icon: Car,           color: '#C6168D', bg: '#FDF0F9' },
  bensin:  { label: 'Bensin',  Icon: Fuel,          color: '#B8960A', bg: '#FFFBEB' },
  lainnya: { label: 'Lainnya', Icon: ReceiptText,   color: '#4D4D4F', bg: '#F3F3F4' },
}

type Driver = { id: string; name: string; email: string }
type FileItem = { file: File; preview: string; id: string }
type HighValueItem = {
  submissionId: string
  filename: string
  amount: number
  imageUrl?: string
  proofFile?: File
  proofPreview?: string
  confirmed: boolean
}

// tambah ini di atas function ModalShell
function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Shared Modal Shell (sama persis dengan driver page) ───────────────────
function ModalShell({ children, total, current, accentColor, accentBg, accentBorder, icon, title, subtitle, receiptImageUrl }: {
  children: React.ReactNode
  total: number
  current: number
  accentColor: string
  accentBg: string
  accentBorder: string
  icon: React.ReactNode
  title: string
  subtitle: string
  receiptImageUrl?: string
}) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16,
      }}>
        <div style={{
          background: IOH.white, borderRadius: 24, width: '100%', maxWidth: 400,
          boxShadow: '0 32px 80px rgba(0,0,0,0.28)', fontFamily: "'Plus Jakarta Sans', sans-serif",
          overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Coloured header */}
          <div style={{ background: accentBg, borderBottom: `1px solid ${accentBorder}`, padding: '16px 18px 14px', flexShrink: 0 }}>
            {total > 1 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {Array.from({ length: total }).map((_, i) => (
                  <div key={i} style={{
                    height: 4, flex: 1, borderRadius: 2,
                    background: i < current ? IOH.teal : i === current ? accentColor : IOH.border,
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: accentBorder + '60', border: `2px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', lineHeight: 1.3 }}>{title}</div>
                <div style={{ fontSize: 11, color: accentColor, marginTop: 2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
              </div>
              {receiptImageUrl && (
                <div onClick={() => setLightbox(true)} title="Tap untuk lihat penuh"
                  style={{ width: 46, height: 58, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: `2px solid ${accentBorder}`, cursor: 'zoom-in', position: 'relative', background: '#f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <img src={receiptImageUrl} alt="nota" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', fontSize: 7, color: 'rgba(255,255,255,0.9)', fontWeight: 700, background: 'rgba(0,0,0,0.4)', padding: '1px 0' }}>TAP</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ padding: '18px 18px 20px', overflowY: 'auto', flex: 1 }}>
            {children}
          </div>
        </div>
      </div>
      {lightbox && receiptImageUrl && (
        <div onClick={() => setLightbox(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
          <img src={receiptImageUrl} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10 }} alt="nota full" />
          <button onClick={() => setLightbox(false)} style={{ position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color="#fff" />
          </button>
        </div>
      )}
    </>
  )
}

// ── High Value Confirmation Modal (identik dgn driver page) ───────────────
function HighValueModal({ items, onDone }: { items: HighValueItem[]; onDone: (results: HighValueItem[]) => void }) {
  const [current, setCurrent] = useState(0)
  const [localItems, setLocalItems] = useState<HighValueItem[]>(items)
  const [editAmount, setEditAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const proofRef = useRef<HTMLInputElement>(null)

  const item = localItems[current]
  const formatAmount = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
  const updateItem = (patch: Partial<HighValueItem>) =>
    setLocalItems(prev => prev.map((it, i) => i === current ? { ...it, ...patch } : it))

  const handleProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    updateItem({ proofFile: file, proofPreview: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const handleSubmitProof = async () => {
    if (!item.proofFile) return
    setSaving(true)
    try {
      const compressed = await compressImage(item.proofFile)  
      const fd = new FormData()
      fd.append('file', compressed)  
      await fetch(`/api/submissions/${item.submissionId}/upload-proof`, { method: 'POST', body: fd })
      setSavedFlash(true)
      setTimeout(() => { setSavedFlash(false); goNext() }, 900)
    } finally { setSaving(false) }
  }

  const handleEditAmount = async () => {
    const val = Number(editAmount)
    if (!val || isNaN(val)) return
    setSaving(true)
    try {
      await fetch(`/api/submissions/${item.submissionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: val }),
      })
      setSavedFlash(true)
      setTimeout(() => {
        setSavedFlash(false)
        if (val > HIGH_VALUE_THRESHOLD) {
          updateItem({ amount: val, confirmed: true })
          setEditAmount('')
        } else {
          goNext()
        }
      }, 900)
    } finally { setSaving(false) }
  }

  const goNext = () => {
    if (current < localItems.length - 1) { setCurrent(c => c + 1); setEditAmount('') }
    else onDone(localItems)
  }

  if (!item) return null

  return (
    <ModalShell
      total={localItems.length} current={current}
      accentColor="#D97706" accentBg="#FFFBEB" accentBorder="#FFE082"
      icon={<AlertCircle size={20} color="#D97706" />}
      title="Nominal Besar Terdeteksi"
      subtitle={`${localItems.length > 1 ? `Nota ${current + 1} dari ${localItems.length} · ` : ''}${item.filename}`}
      receiptImageUrl={item.imageUrl}
    >
      <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '11px 14px', border: '1.5px solid #FFE082', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
          {item.confirmed ? 'Nominal dikonfirmasi' : 'Nominal terbaca OCR'}
        </span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#D97706' }}>{formatAmount(item.amount)}</span>
      </div>

      {!item.confirmed ? (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>Apakah nominal ini benar?</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>Cek foto nota (tap thumbnail di atas), lalu pilih salah satu.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => updateItem({ confirmed: true })} style={{ padding: '13px 14px', borderRadius: 14, border: `2px solid ${IOH.teal}`, background: IOH.teal + '10', cursor: 'pointer', textAlign: 'left', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: IOH.teal + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircle2 size={17} color={IOH.teal} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Ya, nominal sudah benar</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Akan upload bukti transfer bank</div>
              </div>
            </button>
            <button onClick={() => { setEditAmount(String(item.amount)); setTimeout(() => document.getElementById('hv-edit-field-admin')?.focus(), 80) }} style={{ padding: '13px 14px', borderRadius: 14, border: `2px solid ${IOH.border}`, background: '#FAFAFA', cursor: 'pointer', textAlign: 'left', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: IOH.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Pencil size={15} color={IOH.charcoal} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Tidak, nominal salah</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Perbaiki nominalnya</div>
              </div>
            </button>
          </div>
          {editAmount !== '' && (
            <div style={{ marginTop: 14, padding: 14, background: '#F8F8FA', borderRadius: 14, border: `1.5px solid ${IOH.border}` }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nominal yang benar (Rp)</label>
              <input id="hv-edit-field-admin" type="number" min={0} value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="Contoh: 50000"
                style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, fontSize: 16, fontWeight: 700, color: '#111', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}
                onFocus={e => (e.currentTarget.style.borderColor = IOH.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = IOH.border)}
              />
              {editAmount && Number(editAmount) > HIGH_VALUE_THRESHOLD && (
                <div style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', borderRadius: 8, padding: '6px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={11} color="#D97706" />Masih &gt;Rp 250.000 — bukti transfer tetap diperlukan
                </div>
              )}
              {editAmount && Number(editAmount) > 0 && Number(editAmount) <= HIGH_VALUE_THRESHOLD && (
                <div style={{ fontSize: 11, color: IOH.teal, background: IOH.teal + '12', borderRadius: 8, padding: '6px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={11} color={IOH.teal} />Di bawah Rp 250.000 — tidak perlu upload bukti
                </div>
              )}
              <button onClick={handleEditAmount} disabled={!editAmount || saving} style={{ width: '100%', padding: '11px 0', borderRadius: 11, border: 'none', background: !editAmount || saving ? IOH.border : IOH.yellow, color: !editAmount || saving ? '#aaa' : '#111', fontSize: 14, fontWeight: 700, cursor: !editAmount || saving ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {saving
                  ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Menyimpan...</>
                  : savedFlash ? <><CheckCircle2 size={14} /> Tersimpan!</>
                  : <>Simpan Nominal Baru</>}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>Upload bukti transfer bank</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
            Foto screenshot m-banking atau struk ATM untuk transaksi <strong style={{ color: '#111' }}>{formatAmount(item.amount)}</strong>.
          </div>
          <input ref={proofRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProofFile} />
          {!item.proofFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => proofRef.current?.click()} style={{ padding: '15px', borderRadius: 14, border: `2px dashed ${IOH.teal}`, background: IOH.teal + '08', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: IOH.teal + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={19} color={IOH.teal} /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: IOH.teal }}>Foto Bukti Transfer</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Screenshot m-banking atau foto struk ATM</div>
                </div>
              </button>
              <button onClick={goNext} style={{ padding: '10px', borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#aaa', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Lewati (upload bukti nanti)</button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12, border: `1.5px solid ${IOH.teal}`, aspectRatio: '16/9' }}>
                <img src={item.proofPreview} alt="bukti" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => updateItem({ proofFile: undefined, proofPreview: undefined })} style={{ position: 'absolute', top: 8, right: 8, width: 27, height: 27, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} color="#fff" /></button>
                <div style={{ position: 'absolute', bottom: 8, left: 8, background: IOH.teal, borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> Bukti terpilih</div>
              </div>
              <button onClick={handleSubmitProof} disabled={saving} style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: saving ? IOH.border : `linear-gradient(135deg, ${IOH.teal} 0%, #26a89b 100%)`, color: saving ? '#aaa' : '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: saving ? 'none' : `0 4px 16px ${IOH.teal}55` }}>
                {saving
                  ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Mengirim...</>
                  : savedFlash ? <><CheckCircle2 size={14} /> Terkirim!</>
                  : <><Upload size={14} /> Kirim Bukti {current < localItems.length - 1 ? '& Lanjut →' : ''}</>}
              </button>
            </>
          )}
        </>
      )}
    </ModalShell>
  )
}

// ── Konteks Modal (identik dgn driver page) ───────────────────────────────
function KonteksModal({ queue, total, onSave, onSkip }: {
  queue: any[]; total: number; onSave: (description: string) => Promise<void>; onSkip: () => void
}) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const current = queue[0]
  const progress = total - queue.length

  const handleSave = async () => {
    if (!input.trim()) return
    setSaving(true)
    try { await onSave(input.trim()) } finally { setSaving(false); setInput('') }
  }

  if (!current) return null

  return (
    <ModalShell
      total={total} current={progress}
      accentColor={IOH.magenta} accentBg="#FDF0F9" accentBorder="#F0ABDE"
      icon={<ReceiptText size={20} color={IOH.magenta} />}
      title="Nota ini untuk apa?"
      subtitle={`${total > 1 ? `Nota ${progress + 1} dari ${total} · ` : ''}OCR tidak mengenali kategori`}
      receiptImageUrl={current.image_url}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>Tulis keterangan singkat</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>Contoh: <strong>tambal ban</strong>, <strong>cuci mobil</strong>, <strong>derek</strong>, dll.</div>
      <input type="text" placeholder="Ketik di sini..." value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && input.trim()) handleSave() }}
        autoFocus
        style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: `1.5px solid ${IOH.border}`, fontSize: 15, fontWeight: 600, color: '#111', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 14, transition: 'border-color 0.15s' }}
        onFocus={e => (e.currentTarget.style.borderColor = IOH.magenta)}
        onBlur={e => (e.currentTarget.style.borderColor = IOH.border)}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSkip} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#aaa', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Lewati</button>
        <button onClick={handleSave} disabled={!input.trim() || saving} style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: !input.trim() || saving ? IOH.border : `linear-gradient(135deg, ${IOH.magenta}, ${IOH.red})`, color: !input.trim() || saving ? '#aaa' : '#fff', fontSize: 13, fontWeight: 700, cursor: !input.trim() || saving ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving
            ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Menyimpan...</>
            : queue.length > 1 ? 'Simpan & Lanjut →' : 'Simpan'}
        </button>
      </div>
    </ModalShell>
  )
}

// ── Main: Admin Upload Section ─────────────────────────────────────────────
// Props:
//   drivers         — daftar driver dari AdminPage
//   onUploadDone    — callback setelah upload selesai (untuk trigger fetchSubmissions)
// ─────────────────────────────────────────────────────────────────────────
export default function AdminUploadSection({
  drivers,
  onUploadDone,
}: {
  drivers: Driver[]
  onUploadDone: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<any[] | null>(null)

  const [konteksQueue, setKonteksQueue] = useState<any[]>([])
  const [totalKonteks, setTotalKonteks] = useState(0)
  const [highValueItems, setHighValueItems] = useState<HighValueItem[] | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const selectedDriver = drivers.find(d => d.id === selectedDriverId)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const newItems: FileItem[] = selected.map(file => ({
      file, preview: URL.createObjectURL(file), id: Math.random().toString(36).slice(2)
    }))
    setFiles(prev => [...prev, ...newItems])
    setUploadResults(null)
    e.target.value = ''
  }

  const removeFile = (id: string) => {
    setFiles(prev => {
      const item = prev.find(f => f.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter(f => f.id !== id)
    })
  }

  const handleSubmit = async () => {
    if (!files.length || !selectedDriverId) return
    setUploading(true)
    setUploadResults(null)
    const today = new Date().toISOString().slice(0, 10)
    const fd = new FormData()
    fd.append('submission_date', today)
    // Kirim driver_id agar API tahu upload ini atas nama siapa
    fd.append('driver_id', selectedDriverId)
    const compressed = await Promise.all(files.map(item => compressImage(item.file)))  
    compressed.forEach((file, i) => fd.append(`image_${i}`, file))  
    try {
      const res = await fetch('/api/submissions', { method: 'POST', body: fd })
      const data = await res.json()
      setUploadResults(data.results || [])

      if (data.summary?.succeeded > 0) {
        const failedNames = (data.results || []).filter((r: any) => !r.ok).map((r: any) => r.filename)
        setFiles(prev => prev.filter(f => failedNames.includes(f.file.name)))

        // Konteks modal untuk kategori 'lainnya'
        const needKonteks = (data.results || [])
          .filter((r: any) => r.ok && r.submission?.category === 'lainnya')
          .map((r: any) => r.submission)
        if (needKonteks.length > 0) { setKonteksQueue(needKonteks); setTotalKonteks(needKonteks.length) }

        // High value modal untuk nominal > 250rb
        const highValue: HighValueItem[] = (data.results || [])
          .filter((r: any) => r.ok && r.submission?.amount && r.submission.amount > HIGH_VALUE_THRESHOLD)
          .map((r: any) => ({
            submissionId: r.submission.id,
            filename: r.filename || 'Nota',
            amount: r.submission.amount,
            imageUrl: r.submission.image_url,
            confirmed: false,
          }))
        if (highValue.length > 0) setHighValueItems(highValue)

        onUploadDone()
      }
    } catch {
      setUploadResults([{ ok: false, error: 'Tidak dapat terhubung ke server' }])
    } finally { setUploading(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 10,
    border: `1.5px solid ${IOH.border}`, fontSize: 13, color: '#222',
    background: '#fff', outline: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    appearance: 'none' as any, transition: 'border-color 0.15s',
  }

  return (
    <>
      {/* ── Collapsible card ── */}
      <div style={{
        background: IOH.white, borderRadius: 18,
        border: `1.5px solid ${isOpen ? IOH.red + '55' : IOH.border}`,
        boxShadow: isOpen ? `0 4px 24px rgba(237,28,36,0.10)` : '0 1px 6px rgba(0,0,0,0.06)',
        marginBottom: 20, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        {/* Header toggle */}
        <button
          onClick={() => setIsOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 22px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${IOH.red}18 0%, ${IOH.magenta}18 100%)`,
              border: `1.5px solid ${IOH.red}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={16} color={IOH.red} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Upload Nota Atas Nama Driver</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>Admin dapat upload nota untuk driver tertentu</div>
            </div>
          </div>
          <ChevronDown
            size={18} color={IOH.charcoal}
            style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s', flexShrink: 0 }}
          />
        </button>

        {/* Expandable body */}
        {isOpen && (
          <div style={{ padding: '0 22px 22px', borderTop: `1px solid ${IOH.border}` }}>
            <div style={{ paddingTop: 18 }}>

              {/* Pilih driver */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Nama Driver <span style={{ color: IOH.red }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedDriverId}
                    onChange={e => { setSelectedDriverId(e.target.value); setFiles([]); setUploadResults(null) }}
                    style={{ ...inputStyle, paddingRight: 36 }}
                  >
                    <option value="">— Pilih driver —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown size={13} color="#bbb" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Tanggal submit (read-only info) */}
              {selectedDriverId && (
                <div style={{ marginBottom: 16, padding: '10px 13px', borderRadius: 10, background: '#F8F8FA', border: `1.5px solid ${IOH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>Tanggal Submit</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: IOH.charcoal }}>
                    {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}

              {/* Upload buttons — hanya tampil setelah driver dipilih */}
              {selectedDriverId && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: files.length ? 14 : 0 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 12px', border: `2px dashed ${IOH.border}`, borderRadius: 12, cursor: 'pointer', background: '#FAFAFA', transition: 'border-color 0.15s, background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.teal; (e.currentTarget as HTMLElement).style.background = IOH.teal + '08' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.border; (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}>
                      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
                      <ImagePlus size={22} color={IOH.teal} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: IOH.charcoal, textAlign: 'center' }}>Pilih dari Galeri</span>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 12px', border: `2px dashed ${IOH.border}`, borderRadius: 12, cursor: 'pointer', background: '#FAFAFA', transition: 'border-color 0.15s, background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.magenta; (e.currentTarget as HTMLElement).style.background = IOH.magenta + '08' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.border; (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}>
                      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
                      <Camera size={22} color={IOH.magenta} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: IOH.charcoal, textAlign: 'center' }}>Buka Kamera</span>
                    </label>
                  </div>

                  {/* Preview files yang dipilih */}
                  {files.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                      {files.map(item => (
                        <div key={item.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4', background: IOH.border }}>
                          <img src={item.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                          <button onClick={() => removeFile(item.id)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload results */}
                  {uploadResults && (
                    <div style={{ marginBottom: 14 }}>
                      {uploadResults.map((r, i) => (
                        <div key={i} style={{ padding: '9px 12px', borderRadius: 10, marginBottom: 6, fontSize: 12, background: r.ok ? '#ECFDF5' : '#FEF2F2', color: r.ok ? '#065F46' : '#991B1B', border: `1px solid ${r.ok ? '#A7F3D0' : '#FECACA'}`, fontWeight: 500 }}>
                          {r.ok
                            ? `✓ ${r.filename || 'Nota'} — ${CATEGORY_CONFIG[r.submission?.category]?.label || 'Lainnya'}${r.submission?.amount ? ` • Rp ${new Intl.NumberFormat('id-ID').format(r.submission.amount)}` : ''}${r.submission?.bill_date ? ` • ${formatDate(r.submission.bill_date)}` : ''}`
                            : `✕ ${r.filename || 'Nota'}: ${r.error}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submit button */}
                  {files.length > 0 && (
                    <button
                      style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: uploading ? '#aaa' : `linear-gradient(135deg, ${IOH.red} 0%, ${IOH.magenta} 100%)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: uploading ? 'none' : '0 4px 16px rgba(237,28,36,0.35)' }}
                      onClick={handleSubmit}
                      disabled={uploading}
                    >
                      {uploading
                        ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Memproses {files.length} foto...</>
                        : <>Upload {files.length} Nota untuk {selectedDriver?.name} ↑</>}
                    </button>
                  )}
                </>
              )}

              {/* State kosong — belum pilih driver */}
              {!selectedDriverId && (
                <div style={{ textAlign: 'center', padding: '16px 0 4px', color: '#ccc', fontSize: 13 }}>
                  Pilih driver terlebih dahulu untuk memulai upload
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals (sama persis logikanya dgn driver page) ── */}
      {highValueItems && highValueItems.length > 0 && (
        <HighValueModal items={highValueItems} onDone={() => { setHighValueItems(null); onUploadDone() }} />
      )}

      {konteksQueue.length > 0 && (
        <KonteksModal
          queue={konteksQueue} total={totalKonteks}
          onSave={async (desc) => {
            const cur = konteksQueue[0]
            try {
              await fetch(`/api/submissions/${cur.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: desc }),
              })
            } catch {}
            const remaining = konteksQueue.slice(1)
            setKonteksQueue(remaining)
            if (remaining.length === 0) onUploadDone()
          }}
          onSkip={() => {
            const remaining = konteksQueue.slice(1)
            setKonteksQueue(remaining)
            if (remaining.length === 0) onUploadDone()
          }}
        />
      )}
    </>
  )
}
