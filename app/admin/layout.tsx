'use client'
// Letakkan di: app/admin/layout.tsx
// Layout ini cuma pegang topbar (logo + toggle Driver/CSE + logout).
// Konten nota/filter/arsip/user sepenuhnya ada di masing-masing page
// (app/admin/driver/page.tsx dan app/admin/cse/page.tsx) — TIDAK dishare.

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Truck, Users2, LogOut, Menu, X } from 'lucide-react'

const IOH = {
  red: '#ED1C24',
  charcoal: '#4D4D4F',
  border: '#E8E8EA',
  white: '#FFFFFF',
  bg: '#F5F5F7',
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const mode = pathname?.startsWith('/admin/cse') ? 'cse' : 'driver'

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const ModeToggle = ({ compact = false }: { compact?: boolean }) => (
    <div style={{ display: 'flex', borderRadius: 8, border: `1.5px solid ${IOH.border}`, overflow: 'hidden', width: compact ? '100%' : undefined }}>
      <button
        onClick={() => { router.push('/admin/driver'); setMenuOpen(false) }}
        style={{
          flex: compact ? 1 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: compact ? '9px 0' : '8px 14px', border: 'none',
          background: mode === 'driver' ? IOH.charcoal : IOH.white,
          color: mode === 'driver' ? '#fff' : IOH.charcoal,
          cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <Truck size={13} /> Driver
      </button>
      <button
        onClick={() => { router.push('/admin/cse'); setMenuOpen(false) }}
        style={{
          flex: compact ? 1 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: compact ? '9px 0' : '8px 14px', border: 'none', borderLeft: `1px solid ${IOH.border}`,
          background: mode === 'cse' ? IOH.charcoal : IOH.white,
          color: mode === 'cse' ? '#fff' : IOH.charcoal,
          cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <Users2 size={13} /> CSE
      </button>
    </div>
  )

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: IOH.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'Plus Jakarta Sans', sans-serif !important; background: ${IOH.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        input:focus, select:focus { border-color: #32BCAD !important; box-shadow: 0 0 0 3px #32BCAD22; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 99px; }
      `}</style>

      <div style={{ background: IOH.white, borderBottom: `1px solid ${IOH.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 14px' : '0 24px', height: isMobile ? 54 : 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
            <img
              src="/logo-ioh.png" alt="IOH" style={{ height: isMobile ? 32 : 40, display: 'block' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            {!isMobile && <div style={{ width: 1, height: 28, background: IOH.border }} />}
            <div>
              <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#111', lineHeight: 1 }}>Reimburse</div>
              <div style={{ fontSize: 9, color: IOH.red, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                Admin Panel · {mode === 'driver' ? 'Driver' : 'CSE'}
              </div>
            </div>
          </div>

          {!isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ModeToggle />
              <button
                onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#666', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                <LogOut size={14} /> Keluar
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${IOH.border}`, background: menuOpen ? IOH.red : IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {menuOpen ? <X size={16} color="#fff" /> : <Menu size={16} color={IOH.charcoal} />}
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', top: 46, right: 0, width: 220, background: IOH.white, borderRadius: 14, border: `1px solid ${IOH.border}`, boxShadow: '0 12px 32px rgba(0,0,0,0.16)', padding: 10, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ModeToggle compact />
                  <div style={{ height: 1, background: IOH.border }} />
                  <button
                    onClick={handleLogout}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#666', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    <LogOut size={14} /> Keluar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {children}
    </div>
  )
}