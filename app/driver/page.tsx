'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import EditModal from '@/components/EditModal'
import {
  LogOut, LayoutGrid, List, Camera, ImagePlus, Eye, EyeOff, X,
  ReceiptText, Car, Fuel, ParkingCircle, AlertTriangle, Pencil, Trash2,
  CheckCircle2, ChevronDown, Upload, AlertCircle, ZoomIn
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

type Submission = {
  id: string; category: string; description?: string; amount?: number
  submission_date: string; bill_date?: string; image_url?: string; proof_image_path?: string
  status: string; created_at: string; ocr_raw_text?: string
}
type User = { id: string; name: string; email: string; role: string }
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

const CATEGORY_CONFIG: Record<string, { label: string; Icon: any; color: string; bg: string }> = {
  parkir:  { label: 'Parkir',  Icon: ParkingCircle, color: '#ED1C24', bg: '#FFF0F0' },
  tol:     { label: 'Tol',     Icon: Car,           color: '#C6168D', bg: '#FDF0F9' },
  bensin:  { label: 'Bensin',  Icon: Fuel,          color: '#B8960A', bg: '#FFFBEB' },
  lainnya: { label: 'Lainnya', Icon: ReceiptText,   color: '#4D4D4F', bg: '#F3F3F4' },
}

const HIGH_VALUE_THRESHOLD = 250000

// ── Delete Confirm Modal ───────────────────────────────────────────────────
function DeleteConfirmModal({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24
    }}>
      <div style={{
        background: IOH.white, borderRadius: 20, padding: 28, maxWidth: 360, width: '100%',
        boxShadow: '0 32px 64px rgba(0,0,0,0.18)', fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
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
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${IOH.border}`,
            background: IOH.white, fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 14, fontWeight: 600, cursor: 'pointer', color: IOH.charcoal
          }}>Batal</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
            background: IOH.red, fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff'
          }}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  )
}

// ── Shared: Modal Shell ────────────────────────────────────────────────────
// Foto nota ditampilkan sebagai thumbnail kecil yang bisa diklik → lightbox
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
          {/* ── Coloured header ── */}
          <div style={{ background: accentBg, borderBottom: `1px solid ${accentBorder}`, padding: '16px 18px 14px', flexShrink: 0 }}>
            {/* Progress bar */}
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

            {/* Icon + judul + thumbnail nota (side by side) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: accentBorder + '60', border: `2px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', lineHeight: 1.3 }}>{title}</div>
                <div style={{ fontSize: 11, color: accentColor, marginTop: 2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
              </div>

              {/* Thumbnail nota — tap untuk fullscreen */}
              {receiptImageUrl && (
                <div
                  onClick={() => setLightbox(true)}
                  title="Tap untuk lihat penuh"
                  style={{
                    width: 46, height: 58, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                    border: `2px solid ${accentBorder}`, cursor: 'zoom-in', position: 'relative',
                    background: '#f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}>
                  <img src={receiptImageUrl} alt="nota" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* zoom hint overlay */}
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                  >
                    <ZoomIn size={14} color="#fff" style={{ opacity: 0, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => ((e.currentTarget as SVGElement).style.opacity = '1')}
                    />
                  </div>
                  <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', fontSize: 7, color: 'rgba(255,255,255,0.9)', fontWeight: 700, background: 'rgba(0,0,0,0.4)', padding: '1px 0' }}>TAP</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ padding: '18px 18px 20px', overflowY: 'auto', flex: 1 }}>
            {children}
          </div>
        </div>
      </div>

      {/* ── Lightbox fullscreen ── */}
      {lightbox && receiptImageUrl && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1200, padding: 16,
          }}>
          <img src={receiptImageUrl} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10 }} alt="nota full" />
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'absolute', top: 16, right: 16, width: 38, height: 38,
              borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <X size={18} color="#fff" />
          </button>
          <div style={{ position: 'absolute', bottom: 16, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            Tap di mana saja untuk tutup
          </div>
        </div>
      )}
    </>
  )
}

// ── High Value Confirmation Modal ──────────────────────────────────────────
function HighValueModal({ items, onDone }: {
  items: HighValueItem[]
  onDone: (results: HighValueItem[]) => void
}) {
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

  // Di HighValueModal, handleSubmitProof
  const handleSubmitProof = async () => {
    if (!item.proofFile) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', item.proofFile)
      const res = await fetch(
        `/api/submissions/${item.submissionId}/upload-proof`,
        { method: 'POST', body: fd }
      )
      if (!res.ok) throw new Error('Upload gagal')
      setSavedFlash(true)
      setTimeout(() => {
        setSavedFlash(false)
        goNext()
      }, 900)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
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
      // ── KEY LOGIC: apakah amount baru masih > threshold? ──
      setTimeout(() => {
        setSavedFlash(false)
        if (val > HIGH_VALUE_THRESHOLD) {
          // Masih >250rb → update amount di localItem, minta bukti transfer
          updateItem({ amount: val, confirmed: true })
          setEditAmount('')
        } else {
          // Sudah <250rb → tidak perlu bukti, lanjut
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
      {/* Nominal pill */}
      <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '11px 14px', border: '1.5px solid #FFE082', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
          {item.confirmed ? 'Nominal dikonfirmasi' : 'Nominal terbaca OCR'}
        </span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#D97706' }}>{formatAmount(item.amount)}</span>
      </div>

      {!item.confirmed ? (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>Apakah nominal ini benar?</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
            Cek foto nota (tap thumbnail di atas), lalu pilih salah satu.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => updateItem({ confirmed: true })} style={{
              padding: '13px 14px', borderRadius: 14, border: `2px solid ${IOH.teal}`,
              background: IOH.teal + '10', cursor: 'pointer', textAlign: 'left',
              fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: IOH.teal + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={17} color={IOH.teal} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Ya, nominal sudah benar</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Saya akan upload bukti transfer bank</div>
              </div>
            </button>
            <button onClick={() => { setEditAmount(String(item.amount)); setTimeout(() => document.getElementById('hv-edit-field')?.focus(), 80) }} style={{
              padding: '13px 14px', borderRadius: 14, border: `2px solid ${IOH.border}`,
              background: '#FAFAFA', cursor: 'pointer', textAlign: 'left',
              fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: IOH.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Pencil size={15} color={IOH.charcoal} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Tidak, nominal salah</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Saya akan perbaiki nominalnya</div>
              </div>
            </button>
          </div>

          {editAmount !== '' && (
            <div style={{ marginTop: 14, padding: 14, background: '#F8F8FA', borderRadius: 14, border: `1.5px solid ${IOH.border}` }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Nominal yang benar (Rp)
              </label>
              <input id="hv-edit-field" type="number" min={0} value={editAmount} onChange={e => setEditAmount(e.target.value)}
                placeholder="Contoh: 50000"
                style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, fontSize: 16, fontWeight: 700, color: '#111', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}
                onFocus={e => (e.currentTarget.style.borderColor = IOH.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = IOH.border)}
              />

              {/* Hint: apakah akan tetap minta bukti */}
              {editAmount && Number(editAmount) > HIGH_VALUE_THRESHOLD && (
                <div style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', borderRadius: 8, padding: '6px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={11} color="#D97706" />
                  Masih &gt;Rp 250.000 — bukti transfer tetap diperlukan
                </div>
              )}
              {editAmount && Number(editAmount) > 0 && Number(editAmount) <= HIGH_VALUE_THRESHOLD && (
                <div style={{ fontSize: 11, color: IOH.teal, background: IOH.teal + '12', borderRadius: 8, padding: '6px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={11} color={IOH.teal} />
                  Di bawah Rp 250.000 — tidak perlu upload bukti
                </div>
              )}

              <button onClick={handleEditAmount} disabled={!editAmount || saving} style={{
                width: '100%', padding: '11px 0', borderRadius: 11, border: 'none',
                background: !editAmount || saving ? IOH.border : IOH.yellow,
                color: !editAmount || saving ? '#aaa' : '#111',
                fontSize: 14, fontWeight: 700, cursor: !editAmount || saving ? 'not-allowed' : 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                {saving
                  ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Menyimpan...</>
                  : savedFlash ? <><CheckCircle2 size={14} /> Tersimpan!</>
                  : <>Simpan Nominal Baru</>
                }
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── Step 2: Upload bukti transfer ── */
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>Upload bukti transfer bank</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
            Foto screenshot m-banking atau struk ATM untuk transaksi <strong style={{ color: '#111' }}>{formatAmount(item.amount)}</strong>.
          </div>
          <input ref={proofRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProofFile} />

          {!item.proofFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => proofRef.current?.click()} style={{
                padding: '15px', borderRadius: 14, border: `2px dashed ${IOH.teal}`,
                background: IOH.teal + '08', cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: IOH.teal + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={19} color={IOH.teal} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: IOH.teal }}>Foto Bukti Transfer</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Screenshot m-banking atau foto struk ATM</div>
                </div>
              </button>
              <button onClick={goNext} style={{
                padding: '10px', borderRadius: 12, border: `1.5px solid ${IOH.border}`,
                background: IOH.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#aaa',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>Lewati (upload bukti nanti)</button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12, border: `1.5px solid ${IOH.teal}`, aspectRatio: '16/9' }}>
                <img src={item.proofPreview} alt="bukti" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => updateItem({ proofFile: undefined, proofPreview: undefined })} style={{
                  position: 'absolute', top: 8, right: 8, width: 27, height: 27,
                  borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><X size={12} color="#fff" /></button>
                <div style={{ position: 'absolute', bottom: 8, left: 8, background: IOH.teal, borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={10} /> Bukti terpilih
                </div>
              </div>
              <button onClick={handleSubmitProof} disabled={saving} style={{
                width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                background: saving ? IOH.border : `linear-gradient(135deg, ${IOH.teal} 0%, #26a89b 100%)`,
                color: saving ? '#aaa' : '#fff', fontSize: 14, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: saving ? 'none' : `0 4px 16px ${IOH.teal}55`,
              }}>
                {saving
                  ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Mengirim...</>
                  : savedFlash ? <><CheckCircle2 size={14} /> Terkirim!</>
                  : <><Upload size={14} /> Kirim Bukti {current < localItems.length - 1 ? '& Lanjut →' : ''}</>
                }
              </button>
            </>
          )}
        </>
      )}
    </ModalShell>
  )
}

// ── Konteks Modal ──────────────────────────────────────────────────────────
function KonteksModal({ queue, total, onSave, onSkip }: {
  queue: any[]
  total: number
  onSave: (description: string) => Promise<void>
  onSkip: () => void
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
      <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
        Contoh: <strong>tambal ban</strong>, <strong>cuci mobil</strong>, <strong>derek</strong>, dll.
      </div>
      <input
        type="text"
        placeholder="Ketik di sini..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && input.trim()) handleSave() }}
        autoFocus
        style={{
          width: '100%', padding: '13px 14px', borderRadius: 12,
          border: `1.5px solid ${IOH.border}`, fontSize: 15, fontWeight: 600,
          color: '#111', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginBottom: 14, transition: 'border-color 0.15s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = IOH.magenta)}
        onBlur={e => (e.currentTarget.style.borderColor = IOH.border)}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSkip} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${IOH.border}`,
          background: IOH.white, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#aaa',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>Lewati</button>
        <button onClick={handleSave} disabled={!input.trim() || saving} style={{
          flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
          background: !input.trim() || saving ? IOH.border : `linear-gradient(135deg, ${IOH.magenta}, ${IOH.red})`,
          color: !input.trim() || saving ? '#aaa' : '#fff',
          fontSize: 13, fontWeight: 700, cursor: !input.trim() || saving ? 'not-allowed' : 'pointer',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {saving
            ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Menyimpan...</>
            : queue.length > 1 ? 'Simpan & Lanjut →' : 'Simpan'
          }
        </button>
      </div>
    </ModalShell>
  )
}

// ── Main Driver Page ───────────────────────────────────────────────────────
export default function DriverPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<any[] | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [expandOcr, setExpandOcr] = useState<string | null>(null)
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'week' | 'today'>('month')
  const [needsProofFilter, setNeedsProofFilter] = useState(false)
  const [dateFilterBy, setDateFilterBy] = useState<'submission' | 'bill'>('submission')

  const [konteksQueue, setKonteksQueue] = useState<any[]>([])
  const [totalKonteks, setTotalKonteks] = useState(0)
  const [highValueItems, setHighValueItems] = useState<HighValueItem[] | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user) { router.replace('/'); return }
      if (data.user.role === 'admin') { router.replace('/admin'); return }
      setUser(data.user)
    })
  }, [])

  useEffect(() => { if (user) fetchSubmissions() }, [user])
  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/submissions')
      const data = await res.json()
      console.log('after upload-proof, submissions:', 
        data.submissions?.map((s: any) => ({
          id: s.id,
          amount: s.amount,
          proof_image_path: s.proof_image_path,
        }))
      )
      setSubmissions(data.submissions || [])
    } finally { setLoading(false) }
  }

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
    if (!files.length) return
    setUploading(true)
    setUploadResults(null)
    const today = new Date().toISOString().slice(0, 10)

    try {
      // OCR semua file di browser dulu
      const { runOCRClient } = await import('@/lib/ocr-client')
      
      const ocrResults: any[] = []
      for (const item of files) {
        const result = await runOCRClient(item.file)
        ocrResults.push(result)
      }

      const fd = new FormData()
      fd.append('submission_date', today)
      files.forEach((item, i) => {
        fd.append(`image_${i}`, item.file)
        // Kirim hasil OCR bareng gambar
        fd.append(`ocr_${i}`, JSON.stringify(ocrResults[i]))
      })

      const res = await fetch('/api/submissions', { method: 'POST', body: fd })
      const data = await res.json()
      setUploadResults(data.results || [])

      if (data.summary?.succeeded > 0) {
        const failedNames = (data.results || []).filter((r: any) => !r.ok).map((r: any) => r.filename)
        setFiles(prev => prev.filter(f => failedNames.includes(f.file.name)))

        const needKonteks = (data.results || []).filter((r: any) => r.ok && r.submission?.category === 'lainnya').map((r: any) => r.submission)
        if (needKonteks.length > 0) { setKonteksQueue(needKonteks); setTotalKonteks(needKonteks.length) }

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

        fetchSubmissions()
      }
    } catch {
      setUploadResults([{ ok: false, error: 'Tidak dapat terhubung ke server' }])
    } finally { setUploading(false) }
  }

  const handleEdit = async (id: string, updates: any) => {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    fetchSubmissions()
  }
 
  // Handler onClose EditModal — kalau savedAmount ada, berarti baru jadi >250rb
  const handleEditClose = (savedAmount?: number) => {
    const sub = editingSubmission          // simpan ref sebelum di-null
    setEditingSubmission(null)
 
    if (savedAmount !== undefined && sub) {
      setHighValueItems([{
        submissionId: sub.id,
        filename: `${CATEGORY_CONFIG[sub.category]?.label || sub.category} – ${formatDate(sub.submission_date)}`,
        amount: savedAmount,
        imageUrl: sub.image_url,
        confirmed: true,                   // amount sudah pasti benar (baru saja diketik manual)
      }])
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    await fetch(`/api/submissions/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    fetchSubmissions()
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const needsProof = (sub: Submission) =>
    (sub.amount ?? 0) > HIGH_VALUE_THRESHOLD && !sub.proof_image_path

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatAmount = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n)

  const getFiltered = (period: 'all' | 'month' | 'week' | 'today') => {
    const now = new Date()
    return submissions.filter(s => {
      const rawDate = dateFilterBy === 'bill' && s.bill_date ? s.bill_date : s.submission_date
      const d = new Date(rawDate)
      if (period === 'today') return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      if (period === 'week') { const wa = new Date(now); wa.setDate(now.getDate() - 7); return d >= wa }
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      return true
    })
  }

  const filteredForView = needsProofFilter
    ? submissions.filter(s => (s.amount ?? 0) > HIGH_VALUE_THRESHOLD && !s.proof_image_path)
    : getFiltered(periodFilter)
  const countAll   = getFiltered('all').length
  const needsProofCount = submissions.filter(s =>
    (s.amount ?? 0) > HIGH_VALUE_THRESHOLD && !s.proof_image_path
  ).length
  const countMonth = getFiltered('month').length
  const countWeek  = getFiltered('week').length
  const countToday = getFiltered('today').length

  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: IOH.bg }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const PERIODS: { key: 'all' | 'month' | 'week' | 'today'; label: string; count: number; accent: string }[] = [
    { key: 'all',   label: 'Semua',      count: countAll,   accent: IOH.charcoal },
    { key: 'month', label: 'Bulan ini',  count: countMonth, accent: IOH.red      },
    { key: 'week',  label: 'Minggu ini', count: countWeek,  accent: IOH.yellow   },
    { key: 'today', label: 'Hari ini',   count: countToday, accent: IOH.teal     },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif !important; background: ${IOH.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeUp 0.22s ease both; }
        .nota-card { transition: transform 0.16s ease, box-shadow 0.16s ease; }
        .nota-card:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; }
        input:focus, select:focus { border-color: ${IOH.teal} !important; box-shadow: 0 0 0 3px ${IOH.teal}22; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 99px; }
        .upload-zone { transition: border-color 0.15s, background 0.15s; }
        .upload-zone:hover { border-color: ${IOH.teal} !important; background: ${IOH.teal}08 !important; }
        .driver-logo { height: 40px; width: auto; object-fit: contain; }
        .period-tab { transition: all 0.18s; }
        .period-tab:hover { opacity: 0.85; }
        .date-toggle-btn { transition: all 0.15s; }
      `}</style>

      <div style={{ minHeight: '100vh', background: IOH.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── TOPBAR ── */}
        <div style={{ background: IOH.white, borderBottom: `1px solid ${IOH.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/logo-ioh.png" alt="IOH" className="driver-logo"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; const el = e.currentTarget.nextElementSibling as HTMLElement; if (el) el.style.display = 'block' }} />
              <div style={{ display: 'none', fontSize: 16, fontWeight: 800, color: IOH.red }}>IOH</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {viewMode === 'list' ? <><LayoutGrid size={13} /> Grid</> : <><List size={13} /> List</>}
              </button>
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#888', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.red; (e.currentTarget as HTMLElement).style.color = IOH.red }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = IOH.border; (e.currentTarget as HTMLElement).style.color = '#888' }}>
                <LogOut size={13} /> Keluar
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 80px' }}>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#aaa', fontWeight: 500 }}>Halo,</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>{user.name}</div>
          </div>

          {/* ── DATE FILTER TOGGLE ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#aaa', fontWeight: 600 }}>Filter berdasarkan:</span>
            <div style={{ display: 'flex', borderRadius: 10, border: `1.5px solid ${IOH.border}`, overflow: 'hidden', background: IOH.white }}>
              {(['submission', 'bill'] as const).map(key => (
                <button key={key} className="date-toggle-btn" onClick={() => setDateFilterBy(key)} style={{
                  padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: dateFilterBy === key ? IOH.charcoal : 'transparent',
                  color: dateFilterBy === key ? '#fff' : '#aaa',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  borderRight: key === 'submission' ? `1px solid ${IOH.border}` : 'none',
                }}>
                  {key === 'submission' ? 'Tanggal Upload' : 'Tanggal Struk'}
                </button>
              ))}
            </div>
          </div>

          {/* ── STATS: 4 period cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 22 }}>
            {PERIODS.map(p => (
              <button key={p.key} className="period-tab" onClick={() => { setPeriodFilter(p.key); setNeedsProofFilter(false) }} style={{
                background: periodFilter === p.key ? p.accent : IOH.white,
                borderRadius: 14, padding: '14px 10px',
                boxShadow: periodFilter === p.key ? `0 4px 16px ${p.accent}40` : '0 1px 6px rgba(0,0,0,0.06)',
                border: periodFilter === p.key ? `1.5px solid ${p.accent}` : `1px solid ${IOH.border}`,
                cursor: 'pointer', textAlign: 'left', position: 'relative', overflow: 'hidden',
                transition: 'all 0.18s', fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                <div style={{ position: 'absolute', top: -10, right: -10, width: 44, height: 44, borderRadius: '50%', background: periodFilter === p.key ? 'rgba(255,255,255,0.15)' : p.accent + '15' }} />
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, marginBottom: 4, color: periodFilter === p.key ? '#fff' : p.accent }}>{p.count}</div>
                <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.3, color: periodFilter === p.key ? 'rgba(255,255,255,0.8)' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.label}</div>
              </button>
            ))}
          </div>

          {/* ── UPLOAD SECTION ── */}
          <div style={{ background: IOH.white, borderRadius: 18, padding: 20, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${IOH.border}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>Upload Nota</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 18 }}>OCR otomatis baca nominal, kategori & tanggal struk.</div>
            {needsProofCount > 0 && (
              <div style={{
                marginBottom: 14, padding: '11px 14px', borderRadius: 12,
                background: '#FFFBEB', border: '1.5px solid #FFE082',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E', lineHeight: 1.4 }}>
                    <strong>{needsProofCount} nota</strong> butuh bukti transfer bank
                  </span>
                </div>
                <button
                  onClick={() => { setPeriodFilter('all'); setNeedsProofFilter(true) }}
                  style={{
                    flexShrink: 0, padding: '7px 12px', borderRadius: 9,
                    border: '1.5px solid #F59E0B', background: '#F59E0B',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                >
                  Cek Nota →
                </button>
              </div>
            )}

            <div style={{ marginBottom: 16, padding: '10px 13px', borderRadius: 10, background: '#F8F8FA', border: `1.5px solid ${IOH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>Tanggal Submit</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: IOH.charcoal }}>
                {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: files.length ? 14 : 0 }}>
              <label className="upload-zone" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 12px', border: `2px dashed ${IOH.border}`, borderRadius: 12, cursor: 'pointer', background: '#FAFAFA' }}>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
                <ImagePlus size={22} color={IOH.teal} />
                <span style={{ fontSize: 12, fontWeight: 600, color: IOH.charcoal, textAlign: 'center' }}>Pilih dari Galeri</span>
              </label>
              <label className="upload-zone" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 12px', border: `2px dashed ${IOH.border}`, borderRadius: 12, cursor: 'pointer', background: '#FAFAFA' }}>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
                <Camera size={22} color={IOH.magenta} />
                <span style={{ fontSize: 12, fontWeight: 600, color: IOH.charcoal, textAlign: 'center' }}>Buka Kamera</span>
              </label>
            </div>

            {files.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {files.map(item => (
                  <div key={item.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4', background: IOH.border }}>
                    <img src={item.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                    <button onClick={() => removeFile(item.id)} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}

            {uploadResults && (
              <div style={{ marginBottom: 14 }}>
                {uploadResults.map((r, i) => (
                  <div key={i} style={{ padding: '9px 12px', borderRadius: 10, marginBottom: 6, fontSize: 12, background: r.ok ? '#ECFDF5' : '#FEF2F2', color: r.ok ? '#065F46' : '#991B1B', border: `1px solid ${r.ok ? '#A7F3D0' : '#FECACA'}`, fontWeight: 500 }}>
                    {r.ok
                      ? `✓ ${r.filename || 'Nota'} — ${CATEGORY_CONFIG[r.submission?.category]?.label || 'Lainnya'}${r.submission?.amount ? ` • Rp ${new Intl.NumberFormat('id-ID').format(r.submission.amount)}` : ''}${r.submission?.bill_date ? ` • ${formatDate(r.submission.bill_date)}` : ''}`
                      : `✕ ${r.filename || 'Nota'}: ${r.error}`
                    }
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <button style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: uploading ? '#aaa' : `linear-gradient(135deg, ${IOH.red} 0%, ${IOH.magenta} 100%)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: uploading ? 'none' : '0 4px 16px rgba(237,28,36,0.35)' }} onClick={handleSubmit} disabled={uploading}>
                {uploading ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Memproses {files.length} foto...</> : <>Upload {files.length} Nota ↑</>}
              </button>
            )}
          </div>

          {/* ── GRID VIEW ── */}
          {viewMode === 'grid' && (
            <div className="fade-in" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                  {needsProofFilter ? '⚠️ Butuh Bukti Transfer' : 'Riwayat Nota'}
                  {' '}<span style={{ color: '#bbb', fontSize: 13, fontWeight: 400 }}>({filteredForView.length})</span>
                </div>
                {needsProofFilter && (
                  <button
                    onClick={() => setNeedsProofFilter(false)}
                    style={{
                      padding: '5px 10px', borderRadius: 8,
                      border: `1.5px solid ${IOH.border}`, background: IOH.white,
                      fontSize: 11, fontWeight: 700, color: '#aaa', cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <X size={10} /> Hapus filter
                  </button>
                )}
              </div>
              {filteredForView.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#ccc', fontSize: 13 }}>Tidak ada nota untuk periode ini</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {filteredForView.map((sub, i) => {
                    const catCfg = CATEGORY_CONFIG[sub.category] || CATEGORY_CONFIG.lainnya
                    const CatIcon = catCfg.Icon
                    return (
                      <div key={sub.id} style={{ borderRadius: 12, overflow: 'hidden', background: IOH.white, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${IOH.border}`, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ position: 'relative', aspectRatio: '3/4', background: '#f0f0f0', cursor: 'zoom-in' }}
                          onClick={() => sub.image_url && setLightbox(sub.image_url)}>
                          {sub.image_url
                            ? <img src={sub.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="nota" />
                            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><ReceiptText size={28} color="#ccc" /></div>
                          }
                          <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{i + 1}</div>
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.72)', padding: '5px 7px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <CatIcon size={9} color={catCfg.color} strokeWidth={2.5} />
                              <span style={{ fontSize: 9, color: '#ddd' }}>{catCfg.label}</span>
                            </div>
                            {sub.amount ? <div style={{ fontSize: 10, color: IOH.yellow, fontWeight: 700 }}>Rp {new Intl.NumberFormat('id-ID').format(sub.amount)}</div> : <div style={{ fontSize: 9, color: '#FF8A8A' }}>⚠ Kosong</div>}
                            {needsProof(sub) && (
                              <div
                                onClick={e => {
                                  e.stopPropagation()   
                                  setHighValueItems([{
                                    submissionId: sub.id,
                                    filename: `${CATEGORY_CONFIG[sub.category]?.label || sub.category} – ${formatDate(sub.submission_date)}`,
                                    amount: sub.amount!,
                                    imageUrl: sub.image_url,
                                    confirmed: true,
                                  }])
                                }}
                                style={{
                                  marginTop: 4, padding: '4px 7px', borderRadius: 6,
                                  background: '#F59E0B', border: 'none',
                                  fontSize: 9, fontWeight: 700, color: '#fff',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                                  width: 'fit-content',
                                }}
                              >
                                ⚠ Upload Bukti
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', borderTop: `1px solid ${IOH.border}` }}>
                          <button onClick={() => setEditingSubmission(sub)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRight: `1px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDeleteTarget(sub)} style={{ flex: 1, padding: '10px 0', border: 'none', background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: IOH.red, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            <Trash2 size={12} /> 
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <div className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                  {needsProofFilter ? '⚠️ Butuh Bukti Transfer' : 'Riwayat Nota'}
                  {' '}<span style={{ color: '#bbb', fontSize: 13, fontWeight: 400 }}>({filteredForView.length})</span>
                </div>
                {needsProofFilter && (
                  <button
                    onClick={() => setNeedsProofFilter(false)}
                    style={{
                      padding: '5px 10px', borderRadius: 8,
                      border: `1.5px solid ${IOH.border}`, background: IOH.white,
                      fontSize: 11, fontWeight: 700, color: '#aaa', cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <X size={10} /> Hapus filter
                  </button>
                )}
              </div>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div style={{ width: 32, height: 32, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : filteredForView.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#ccc', fontSize: 14 }}>Belum ada nota</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {filteredForView.map(sub => {
                    const catCfg = CATEGORY_CONFIG[sub.category] || CATEGORY_CONFIG.lainnya
                    const CatIcon = catCfg.Icon
                    return (
                      <div key={sub.id} className="nota-card" style={{ background: IOH.white, borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: `1px solid ${IOH.border}` }}>
                        {sub.image_url && (
                          <img src={sub.image_url} style={{ width: 50, height: 62, objectFit: 'cover', borderRadius: 9, cursor: 'zoom-in', flexShrink: 0, border: `1px solid ${IOH.border}` }} alt="nota" onClick={() => setLightbox(sub.image_url!)} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: catCfg.bg, color: catCfg.color }}>
                              <CatIcon size={10} strokeWidth={2.5} /> {catCfg.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#bbb', marginBottom: 3 }}>
                            Submit: {formatDate(sub.submission_date)}
                            {sub.bill_date && sub.bill_date !== sub.submission_date && (
                              <span style={{ marginLeft: 6, color: IOH.red, fontWeight: 600 }}>• Struk: {formatDate(sub.bill_date)}</span>
                            )}
                          </div>
                          {sub.amount ? <div style={{ fontSize: 14, color: '#111', fontWeight: 800 }}>{formatAmount(sub.amount)}</div> : <div style={{ fontSize: 12, color: '#FF8A8A', fontWeight: 600 }}>⚠ Nominal kosong</div>}
                          {sub.category === 'lainnya' && sub.description && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{sub.description}</div>}
                          {needsProof(sub) && (
                            <div
                              onClick={() => {
                                setHighValueItems([{
                                  submissionId: sub.id,
                                  filename: `${CATEGORY_CONFIG[sub.category]?.label || sub.category} – ${formatDate(sub.submission_date)}`,
                                  amount: sub.amount!,
                                  imageUrl: sub.image_url,
                                  confirmed: true,
                                }])
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                marginTop: 5, padding: '4px 9px', borderRadius: 8,
                                background: '#FFFBEB', border: '1.5px solid #FFE082',
                                fontSize: 11, fontWeight: 700, color: '#D97706',
                                cursor: 'pointer',
                              }}
                            >
                              ⚠️ Upload bukti transfer
                            </div>
                          )}
                          {sub.ocr_raw_text && (
                            <button onClick={() => setExpandOcr(expandOcr === sub.id ? null : sub.id)} style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 10, cursor: 'pointer', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                              {expandOcr === sub.id ? <EyeOff size={10} /> : <Eye size={10} />}
                              {expandOcr === sub.id ? 'Sembunyikan OCR' : 'Lihat teks OCR'}
                            </button>
                          )}
                          {expandOcr === sub.id && sub.ocr_raw_text && (
                            <div style={{ marginTop: 5, padding: '7px 9px', background: '#F8F8FA', borderRadius: 7, fontSize: 10, color: '#aaa', whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto', border: `1px solid ${IOH.border}`, lineHeight: 1.6 }}>{sub.ocr_raw_text}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                          <button onClick={() => setEditingSubmission(sub)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: IOH.white, border: `1.5px solid ${IOH.border}`, borderRadius: 9, color: IOH.charcoal, cursor: 'pointer', fontSize: 11, padding: '9px 13px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => setDeleteTarget(sub)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: IOH.white, border: `1.5px solid ${IOH.border}`, borderRadius: 9, color: IOH.red, cursor: 'pointer', fontSize: 11, padding: '9px 13px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {highValueItems && highValueItems.length > 0 && (
        <HighValueModal
          items={highValueItems}
          onDone={async () => {
            await fetchSubmissions()   // tunggu fetch selesai dulu
            setHighValueItems(null)    // baru tutup modal
          }}
        />
      )}

      {konteksQueue.length > 0 && (
        <KonteksModal
          queue={konteksQueue} total={totalKonteks}
          onSave={async (desc) => {
            const cur = konteksQueue[0]
            try {
              await fetch(`/api/submissions/${cur.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc }) })
            } catch {}
            const remaining = konteksQueue.slice(1)
            setKonteksQueue(remaining)
            if (remaining.length === 0) fetchSubmissions()
          }}
          onSkip={() => {
            const remaining = konteksQueue.slice(1)
            setKonteksQueue(remaining)
            if (remaining.length === 0) fetchSubmissions()
          }}
        />
      )}

      {editingSubmission && (
        <EditModal
          submission={editingSubmission}
          onClose={handleEditClose}
          onSave={handleEdit}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          name={`${CATEGORY_CONFIG[deleteTarget.category]?.label || deleteTarget.category} – ${formatDate(deleteTarget.submission_date)}`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <img src={lightbox} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10 }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} color="#fff" /></button>
        </div>
      )}
    </>
  )
}