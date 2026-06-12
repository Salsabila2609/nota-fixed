'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPw, setShowPw]     = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) return r.json()
    }).then(data => {
      if (data?.user) {
        router.replace(data.user.role === 'admin' ? '/admin' : '/driver')
      }
    }).finally(() => setChecking(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push(data.user.role === 'admin' ? '/admin' : '/driver')
    } catch {
      setError('Tidak dapat terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: IOH.bg }}>
      <div style={{ width: 38, height: 38, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif !important; background: ${IOH.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .login-card { animation: fadeUp 0.3s ease both; }
        .login-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .login-input:focus { border-color: ${IOH.teal} !important; box-shadow: 0 0 0 3px ${IOH.teal}22 !important; outline: none; }
        .login-btn { transition: all 0.15s; }
        .login-btn:not(:disabled):hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(237,28,36,0.38) !important; }
        .pw-toggle { transition: color 0.15s; }
        .pw-toggle:hover { color: ${IOH.teal} !important; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: IOH.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <div style={{ width: '100%', maxWidth: 400 }} className="login-card">

          {/* ── Card ── */}
          <div style={{
            background: IOH.white,
            borderRadius: 24,
            boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
            border: `1px solid ${IOH.border}`,
            overflow: 'hidden',
          }}>

            {/* ── Header ── */}
            <div style={{
              background: IOH.white,
              borderBottom: `1px solid ${IOH.border}`,
              padding: '18px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <img
                src="/logo-ioh.png"
                alt="Indosat Ooredoo Hutchison"
                style={{ height: 34, width: 'auto', objectFit: 'contain', display: 'block' }}
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  const fb = e.currentTarget.nextElementSibling as HTMLElement
                  if (fb) fb.style.display = 'flex'
                }}
              />
              <div style={{
                display: 'none', alignItems: 'center', gap: 8,
                background: `linear-gradient(135deg, ${IOH.red} 0%, ${IOH.magenta} 100%)`,
                borderRadius: 10, padding: '6px 14px',
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>IOH</span>
              </div>

              <div style={{ width: 1, height: 28, background: IOH.border, flexShrink: 0 }} />

              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', lineHeight: 1 }}>Reimburse</div>
                <div style={{ fontSize: 10, color: IOH.red, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                  Driver Portal
                </div>
              </div>
            </div>

            {/* ── Form body ── */}
            <div style={{ padding: '28px 28px 24px' }}>

              <div style={{ marginBottom: 26 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 5 }}>Selamat datang!</div>
                <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
                  Masuk untuk mengelola reimbursement nota Anda. <br />
                </div>
              </div>

              <form onSubmit={handleSubmit}>

                {/* Username */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700, color: '#999',
                    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Username
                  </label>
                  <input
                    className="login-input"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="username"
                    required
                    autoComplete="username"
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: 12,
                      border: `1.5px solid ${IOH.border}`, fontSize: 13,
                      color: '#222', background: IOH.white,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 22 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700, color: '#999',
                    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="login-input"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      style={{
                        width: '100%', padding: '11px 42px 11px 14px', borderRadius: 12,
                        border: `1.5px solid ${IOH.border}`, fontSize: 13,
                        color: '#222', background: IOH.white,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPw(v => !v)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 15, color: '#bbb', padding: 2,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      {showPw
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                    background: '#FEF2F2', color: '#991B1B', fontSize: 12,
                    fontWeight: 600, border: '1px solid #FECACA',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="login-btn"
                  disabled={loading}
                  style={{
                    width: '100%', height: 48, borderRadius: 14, border: 'none',
                    background: loading
                      ? IOH.border
                      : `linear-gradient(135deg, ${IOH.red} 0%, #c8000a 100%)`,
                    color: loading ? '#aaa' : '#fff',
                    fontSize: 14, fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: loading ? 'none' : '0 4px 14px rgba(237,28,36,0.28)',
                  }}
                >
                  {loading
                    ? <>
                        <div style={{ width: 16, height: 16, border: '2px solid #ccc', borderTopColor: '#888', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Masuk...
                      </>
                    : 'Masuk'
                  }
                </button>

              </form>
            </div>

            <div style={{
              borderTop: `1px solid ${IOH.border}`,
              padding: '13px 28px',
              background: IOH.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: IOH.teal }} />
              <span style={{ fontSize: 11, color: '#bbb', fontWeight: 500 }}>
                © Indosat Ooredoo Hutchison · Sistem Reimburse Internal
              </span>
            </div>

          </div>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: '#ccc', fontWeight: 500 }}>
            Hubungi admin jika lupa password
          </div>

        </div>
      </div>
    </>
  )
}