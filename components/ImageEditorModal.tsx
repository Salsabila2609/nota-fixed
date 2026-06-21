'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { X, RotateCcw, RotateCw, Check, RefreshCw } from 'lucide-react'

const IOH = {
  red: '#ED1C24',
  teal: '#32BCAD',
  charcoal: '#4D4D4F',
  white: '#FFFFFF',
  border: '#E8E8EA',
}

const MAX_DISPLAY = 460
const HANDLE_SIZE = 14

type CropBox = { x: number; y: number; w: number; h: number }
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null

export default function ImageEditorModal({
  imageUrl,
  onClose,
  onSave,
  title = 'Edit Foto Nota',
}: {
  imageUrl: string
  onClose: () => void
  onSave: (file: File) => Promise<void> | void
  title?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 })
  const [saving, setSaving] = useState(false)
  const dragState = useRef<{ mode: DragMode; startX: number; startY: number; startCrop: CropBox } | null>(null)

  const naturalSize = useRef({ w: 0, h: 0 })
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const displayScale = useRef(1)

  // ── Load image via fetch blob to bypass CORS on canvas ──────────────────
  // R2 signed URLs block canvas.toBlob() if loaded with crossOrigin directly.
  // Fetching as blob first creates an object URL that is same-origin for canvas.
  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const load = async () => {
      setLoaded(false)
      setLoadError(false)

      try {
        const res = await fetch(imageUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)

        const img = new Image()
        img.onload = () => {
          if (cancelled) { URL.revokeObjectURL(objectUrl!); return }
          imgRef.current = img
          naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight }
          setLoaded(true)
        }
        img.onerror = () => {
          if (cancelled) return
          URL.revokeObjectURL(objectUrl!)
          setLoadError(true)
        }
        img.src = objectUrl
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageUrl])

  // ── Recompute canvas size + reset crop on rotation/load ─────────────────
  useEffect(() => {
    if (!loaded) return
    const { w: nw, h: nh } = naturalSize.current
    const rotW = rotation % 180 === 0 ? nw : nh
    const rotH = rotation % 180 === 0 ? nh : nw
    const scale = Math.min(MAX_DISPLAY / rotW, MAX_DISPLAY / rotH, 1)
    const cw = Math.round(rotW * scale)
    const ch = Math.round(rotH * scale)
    displayScale.current = scale
    setCanvasSize({ w: cw, h: ch })
    setCrop({ x: 0, y: 0, w: cw, h: ch })
  }, [loaded, rotation])

  // ── Draw canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !canvasRef.current || canvasSize.w === 0) return
    const canvas = canvasRef.current
    canvas.width = canvasSize.w
    canvas.height = canvasSize.h
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const img = imgRef.current!
    const { w: nw, h: nh } = naturalSize.current
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(displayScale.current, displayScale.current)
    ctx.drawImage(img, -nw / 2, -nh / 2)
    ctx.restore()
  }, [loaded, canvasSize, rotation])

  const rotateBy = (deg: number) => setRotation(r => ((r + deg) % 360 + 360) % 360)
  const resetCrop = () => setCrop({ x: 0, y: 0, w: canvasSize.w, h: canvasSize.h })

  // ── Drag handlers ────────────────────────────────────────────────────────
  const clampCrop = useCallback((box: CropBox): CropBox => {
    let { x, y, w, h } = box
    const minSize = 24
    w = Math.max(minSize, Math.min(w, canvasSize.w))
    h = Math.max(minSize, Math.min(h, canvasSize.h))
    x = Math.max(0, Math.min(x, canvasSize.w - w))
    y = Math.max(0, Math.min(y, canvasSize.h - h))
    return { x, y, w, h }
  }, [canvasSize])

  const startDrag = (mode: DragMode) => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    const point = 'touches' in e ? e.touches[0] : e
    dragState.current = { mode, startX: point.clientX, startY: point.clientY, startCrop: crop }
    window.addEventListener('mousemove', onDrag as any)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('touchmove', onDrag as any, { passive: false })
    window.addEventListener('touchend', endDrag)
  }

  const onDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragState.current) return
    if ('preventDefault' in e) e.preventDefault()
    const point = 'touches' in e ? e.touches[0] : e
    const dx = point.clientX - dragState.current.startX
    const dy = point.clientY - dragState.current.startY
    const start = dragState.current.startCrop
    let next: CropBox = { ...start }
    switch (dragState.current.mode) {
      case 'move': next = { ...start, x: start.x + dx, y: start.y + dy }; break
      case 'se':   next = { ...start, w: start.w + dx, h: start.h + dy }; break
      case 'sw':   next = { x: start.x + dx, y: start.y, w: start.w - dx, h: start.h + dy }; break
      case 'ne':   next = { x: start.x, y: start.y + dy, w: start.w + dx, h: start.h - dy }; break
      case 'nw':   next = { x: start.x + dx, y: start.y + dy, w: start.w - dx, h: start.h - dy }; break
    }
    setCrop(() => clampCrop(next))
  }, [clampCrop])

  const endDrag = useCallback(() => {
    dragState.current = null
    window.removeEventListener('mousemove', onDrag as any)
    window.removeEventListener('mouseup', endDrag)
    window.removeEventListener('touchmove', onDrag as any)
    window.removeEventListener('touchend', endDrag)
  }, [onDrag])

  useEffect(() => () => endDrag(), [endDrag])

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!imgRef.current) return
    setSaving(true)
    try {
      const scale = displayScale.current
      const { w: nw, h: nh } = naturalSize.current
      const rotW = rotation % 180 === 0 ? nw : nh
      const rotH = rotation % 180 === 0 ? nh : nw
      const cropXFull = crop.x / scale
      const cropYFull = crop.y / scale
      const cropWFull = crop.w / scale
      const cropHFull = crop.h / scale

      const outCanvas = document.createElement('canvas')
      outCanvas.width = Math.round(cropWFull)
      outCanvas.height = Math.round(cropHFull)
      const ctx = outCanvas.getContext('2d')!
      ctx.save()
      ctx.translate(rotW / 2 - cropXFull, rotH / 2 - cropYFull)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(imgRef.current, -nw / 2, -nh / 2)
      ctx.restore()

      const blob: Blob = await new Promise((resolve, reject) =>
        outCanvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob gagal'))), 'image/jpeg', 0.9)
      )
      const file = new File([blob], 'edited.jpg', { type: 'image/jpeg' })
      await onSave(file)
    } catch (err) {
      console.error('Edit gambar gagal:', err)
    } finally {
      setSaving(false)
    }
  }

  const isFullCrop = crop.x === 0 && crop.y === 0 && crop.w === canvasSize.w && crop.h === canvasSize.h

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: IOH.white, borderRadius: 22, width: '100%', maxWidth: 520, boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '94vh' }}>

        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${IOH.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{title}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color={IOH.charcoal} />
          </button>
        </div>

        {/* Canvas area */}
        <div style={{ padding: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#FAFAFA', overflow: 'auto', flex: 1 }}>
          {loadError ? (
            <div style={{ width: 200, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 32 }}>⚠️</div>
              <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center' }}>Gagal memuat gambar</div>
              <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Tutup</button>
            </div>
          ) : !loaded ? (
            <div style={{ width: 200, height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: IOH.teal, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 12, color: '#bbb' }}>Memuat gambar...</div>
            </div>
          ) : (
            <div style={{ position: 'relative', width: canvasSize.w, height: canvasSize.h }}>
              <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }} />

              {/* Dim mask outside crop box */}
              {!isFullCrop && (
                <>
                  <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: crop.y, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: 0, top: crop.y + crop.h, width: '100%', height: canvasSize.h - crop.y - crop.h, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: 0, top: crop.y, width: crop.x, height: crop.h, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: crop.x + crop.w, top: crop.y, width: canvasSize.w - crop.x - crop.w, height: crop.h, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                </>
              )}

              {/* Crop box */}
              <div
                onMouseDown={startDrag('move')}
                onTouchStart={startDrag('move')}
                style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h, border: `2px solid ${IOH.red}`, cursor: 'move', boxSizing: 'border-box' }}
              >
                {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
                  <div
                    key={corner}
                    onMouseDown={startDrag(corner)}
                    onTouchStart={startDrag(corner)}
                    style={{
                      position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: '50%',
                      background: IOH.red, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                      top: corner.includes('n') ? -HANDLE_SIZE / 2 : undefined,
                      bottom: corner.includes('s') ? -HANDLE_SIZE / 2 : undefined,
                      left: corner.includes('w') ? -HANDLE_SIZE / 2 : undefined,
                      right: corner.includes('e') ? -HANDLE_SIZE / 2 : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: '14px 18px 18px', borderTop: `1px solid ${IOH.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => rotateBy(-90)} style={controlBtnStyle}>
              <RotateCcw size={14} /> Putar Kiri
            </button>
            <button onClick={() => rotateBy(90)} style={controlBtnStyle}>
              <RotateCw size={14} /> Putar Kanan
            </button>
            <button onClick={resetCrop} disabled={isFullCrop} style={{ ...controlBtnStyle, opacity: isFullCrop ? 0.4 : 1, cursor: isFullCrop ? 'not-allowed' : 'pointer' }}>
              <RefreshCw size={14} /> Reset Crop
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12, lineHeight: 1.5 }}>
            Geser kotak merah untuk crop, tarik sudut untuk resize. Foto asli tidak diganti sampai kamu klik Simpan.
          </div>
          <button onClick={handleSave} disabled={saving || !loaded} style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: saving || !loaded ? IOH.border : `linear-gradient(135deg, ${IOH.teal} 0%, #26a89b 100%)`,
            color: saving || !loaded ? '#aaa' : '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving || !loaded ? 'not-allowed' : 'pointer',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {saving
              ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Menyimpan...</>
              : <><Check size={15} /> Simpan Perubahan</>
            }
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const controlBtnStyle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '9px 0', borderRadius: 10, border: `1.5px solid #E8E8EA`,
  background: '#FFFFFF', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
  color: '#4D4D4F', fontFamily: "'Plus Jakarta Sans', sans-serif",
}