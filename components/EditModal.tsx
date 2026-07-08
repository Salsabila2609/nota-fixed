'use client'
import { useState } from 'react'
import { X } from 'lucide-react'

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

const CATEGORY_OPTIONS = [
  { value: 'parkir',  label: '🅿️  Parkir' },
  { value: 'tol',     label: '🛣️  Tol' },
  { value: 'bensin',  label: '⛽  Bensin' },
  { value: 'lainnya', label: '📋  Lainnya' },
]

const HIGH_VALUE_THRESHOLD = 250000

type EditData = {
  category: string
  amount: string
  description: string
  submission_date: string
  bill_date: string
}

type Props = {
  submission: any
  onClose: (savedAmount?: number) => void
  onSave: (id: string, data: any) => Promise<void>
  isAdmin?: boolean
  lockedCategory?: string   
}

export default function EditModal({ submission, onClose, onSave, isAdmin = false, lockedCategory }: Props) {
  const [form, setForm] = useState<EditData>({
    category: lockedCategory || submission.category || 'lainnya',  // [BARU] paksa locked value
    amount: submission.amount ? String(submission.amount) : '',
    description: submission.description || '',
    submission_date: submission.submission_date || '',
    bill_date: submission.bill_date || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isLainnya = form.category === 'lainnya'
  const prevAmount = submission.amount || 0

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const newAmount = form.amount ? parseFloat(form.amount) : null
      const updates: any = {
        category: lockedCategory || form.category,
        amount: newAmount,
        bill_date: form.bill_date || null,
        description: isLainnya ? (form.description || null) : null,
      }
      if (isAdmin) {
        updates.submission_date = form.submission_date
      }
      await onSave(submission.id, updates)

      // Cek apakah amount baru melebihi threshold
      // Trigger hanya kalau: bukan admin, amount baru >250rb, DAN sebelumnya belum >250rb
      // (kalau sebelumnya sudah >250rb, anggap bukti sudah pernah diupload)
      const isNewlyHighValue =
        !isAdmin &&
        newAmount !== null &&
        newAmount > HIGH_VALUE_THRESHOLD &&
        prevAmount <= HIGH_VALUE_THRESHOLD

      onClose(isNewlyHighValue ? newAmount : undefined)
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  // ── Style helpers ──
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: isAdmin ? 11 : 12,
    fontWeight: 700, color: '#999', marginBottom: isAdmin ? 7 : 8,
    textTransform: 'uppercase', letterSpacing: '0.07em'
  }

  const inputBase: React.CSSProperties = {
    width: '100%', borderRadius: isAdmin ? 10 : 14,
    border: `1.5px solid ${IOH.border}`, color: '#222',
    background: IOH.white, outline: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    appearance: 'none', transition: 'border-color 0.15s',
    fontSize: isAdmin ? 13 : 16,
    padding: isAdmin ? '10px 13px' : '14px 16px',
  }

  // Hint di bawah input nominal — tampil live
  const amountNum = parseFloat(form.amount) || 0
  const willTriggerHighValue =
    !isAdmin &&
    amountNum > HIGH_VALUE_THRESHOLD &&
    prevAmount <= HIGH_VALUE_THRESHOLD

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUpBottom { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        .edit-modal-input:focus { border-color: ${IOH.teal} !important; box-shadow: 0 0 0 3px ${IOH.teal}22; }
      `}</style>

      <div
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: isAdmin ? 'center' : 'flex-end',
          justifyContent: 'center',
          zIndex: 1000, padding: isAdmin ? 20 : 0,
        }}
      >
        <div style={{
          background: IOH.white,
          borderRadius: isAdmin ? 20 : '24px 24px 0 0',
          padding: isAdmin ? 28 : '0 0 40px',
          width: '100%', maxWidth: isAdmin ? 440 : 520,
          boxShadow: '0 32px 64px rgba(0,0,0,0.18)',
          animation: isAdmin ? 'slideUp 0.22s ease' : 'slideUpBottom 0.28s ease',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          maxHeight: isAdmin ? 'auto' : '92vh',
          overflowY: isAdmin ? 'visible' : 'auto',
        }}>
          {/* Handle bar — hanya driver */}
          {!isAdmin && (
            <div style={{ padding: '14px 0 4px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2 }} />
            </div>
          )}

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: isAdmin ? 22 : 20,
            padding: isAdmin ? 0 : '8px 20px 0',
          }}>
            <div>
              <div style={{ fontSize: isAdmin ? 16 : 20, fontWeight: 800, color: '#111' }}>Edit Nota</div>
              {isAdmin
                ? <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Mode Admin — semua field bisa diubah</div>
                : <div style={{ fontSize: 13, color: '#aaa', marginTop: 3 }}>Ubah kategori, nominal, atau tanggal struk</div>
              }
            </div>
            <button onClick={() => onClose()} style={{
              width: isAdmin ? 34 : 40, height: isAdmin ? 34 : 40,
              borderRadius: '50%', background: IOH.bg, border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: IOH.charcoal,
            }}>
              <X size={isAdmin ? 15 : 18} />
            </button>
          </div>

          {/* Form fields */}
          <div style={{
            display: 'grid', gap: isAdmin ? 16 : 18,
            padding: isAdmin ? 0 : '0 20px',
          }}>

            {/* Kategori */}
            <div>
              <label style={labelStyle}>Kategori</label>
              {lockedCategory ? (
                <div style={{
                  ...inputBase, display: 'flex', alignItems: 'center',
                  background: '#F8F8FA', color: IOH.charcoal, cursor: 'not-allowed',
                }}>
                  {CATEGORY_OPTIONS.find(c => c.value === lockedCategory)?.label || lockedCategory}
                </div>
              ) : (
                <select
                  className="edit-modal-input"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  style={inputBase}
                >
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              )}
            </div>

            {/* Nominal */}
            <div>
              <label style={labelStyle}>Nominal (Rp)</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: isAdmin ? 13 : 16,
                  top: '50%', transform: 'translateY(-50%)',
                  fontSize: isAdmin ? 12 : 15, fontWeight: 600, color: '#aaa', pointerEvents: 'none'
                }}>Rp</span>
                <input
                  className="edit-modal-input"
                  type="number"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  style={{ ...inputBase, paddingLeft: isAdmin ? 36 : 44 }}
                />
              </div>

              {/* Live hint: akan minta bukti transfer */}
              {willTriggerHighValue && (
                <div style={{
                  marginTop: 8, padding: '7px 11px', borderRadius: 9,
                  background: '#FFFBEB', border: '1.5px solid #FFE082',
                  fontSize: 12, color: '#D97706', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  ⚠️ Nominal &gt;Rp 250.000 — kamu akan diminta upload bukti transfer setelah simpan
                </div>
              )}
            </div>

            {/* Tanggal Struk */}
            <div>
              <label style={labelStyle}>Tanggal Struk</label>
              <input
                className="edit-modal-input"
                type="date"
                value={form.bill_date}
                onChange={e => setForm({ ...form, bill_date: e.target.value })}
                style={inputBase}
              />
            </div>

            {/* Tanggal Submit — hanya admin */}
            {isAdmin && (
              <div>
                <label style={labelStyle}>Tgl Submit</label>
                <input
                  className="edit-modal-input"
                  type="date"
                  value={form.submission_date}
                  onChange={e => setForm({ ...form, submission_date: e.target.value })}
                  style={inputBase}
                />
              </div>
            )}

            {/* Keterangan — hanya untuk kategori lainnya */}
            {isLainnya && (
              <div>
                <label style={labelStyle}>
                  Keterangan{!isAdmin && <span style={{ color: IOH.magenta }}> *</span>}
                </label>
                <input
                  className="edit-modal-input"
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={isAdmin ? 'Opsional...' : 'Contoh: tambal ban, cuci mobil...'}
                  style={inputBase}
                />
                {!isAdmin && (
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 6, lineHeight: 1.5 }}>
                    Tulis keterangan singkat agar mudah dikenali admin.
                  </div>
                )}
              </div>
            )}

            {/* Tanggal submit read-only untuk driver */}
            {!isAdmin && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: '#F8F8FA', border: `1.5px solid ${IOH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#aaa' }}>Tanggal Submit</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: IOH.charcoal }}>
                  {new Date(form.submission_date || Date.now()).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              margin: isAdmin ? '14px 0 0' : '14px 20px 0',
              padding: '10px 13px', background: '#FEF2F2',
              border: `1px solid #FECACA`, borderRadius: 10,
              color: '#991B1B', fontSize: 13, fontWeight: 500
            }}>⚠️ {error}</div>
          )}

          {/* Buttons */}
          <div style={{
            display: 'flex', gap: isAdmin ? 10 : 12,
            marginTop: isAdmin ? 24 : 20,
            padding: isAdmin ? 0 : '0 20px',
          }}>
            <button onClick={() => onClose()} style={{
              flex: 1, padding: isAdmin ? '11px 0' : '16px 0',
              borderRadius: isAdmin ? 11 : 16,
              border: `1.5px solid ${IOH.border}`,
              background: IOH.white, fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: isAdmin ? 13 : 16, fontWeight: 700, cursor: 'pointer', color: IOH.charcoal,
            }}>Batal</button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: isAdmin ? '11px 0' : '16px 0',
              borderRadius: isAdmin ? 11 : 16,
              border: 'none',
              background: saving ? '#ddd' : `linear-gradient(135deg, ${IOH.red} 0%, ${IOH.magenta} 100%)`,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: isAdmin ? 13 : 16, fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer', color: '#fff',
              boxShadow: saving ? 'none' : '0 4px 14px rgba(237,28,36,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {saving
                ? <><div style={{ width: isAdmin ? 13 : 16, height: isAdmin ? 13 : 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Menyimpan...</>
                : willTriggerHighValue ? '💾 Simpan & Upload Bukti →' : '💾 Simpan'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}