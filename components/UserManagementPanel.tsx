'use client'
import { useState, useEffect } from 'react'
import {
  UserPlus, Pencil, Trash2, X, AlertTriangle, Shield, Truck, Headset,
  LogIn, LogOut, Clock, RefreshCw, Building2, Plus
} from 'lucide-react'

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

type Branch = { id: string; name: string; brand: 'IM3' | '3ID' }

type UserRow = {
  id: string; name: string; username: string; role: string
  last_login_at?: string | null; last_logout_at?: string | null
  created_at?: string
  branch_id?: string | null
  mc_name?: string | null
}

type AuditLog = {
  id: string; user_id: string; event: 'login' | 'logout'
  ip_address?: string | null; user_agent?: string | null; created_at: string
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  admin:  { label: 'Admin',  color: IOH.red,  bg: '#FFF0F0', Icon: Shield },
  driver: { label: 'Driver', color: IOH.teal, bg: '#EEFBFA', Icon: Truck },
  cse:    { label: 'CSE',    color: IOH.magenta, bg: '#FDF0F9', Icon: Headset },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${IOH.border}`,
  fontSize: 13, color: '#222', background: '#fff', outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
}

function formatDateTime(d?: string | null) {
  if (!d) return '–'
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] || { label: role, color: IOH.charcoal, bg: '#F3F3F4', Icon: Shield }
  const Icon = cfg.Icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      <Icon size={11} strokeWidth={2.5} /> {cfg.label}
    </span>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: IOH.white, borderRadius: 20, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 32px 64px rgba(0,0,0,0.2)', fontFamily: "'Plus Jakarta Sans', sans-serif", maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{title}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color={IOH.charcoal} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function BranchManagerModal({ branches, onClose, onChanged }: {
  branches: Branch[]; onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState<'IM3' | '3ID'>('IM3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    setError('')
    if (!name.trim()) { setError('Nama branch wajib diisi'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/branches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), brand }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Gagal menambah branch'); return }
      setName('')
      onChanged()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/admin/branches', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    onChanged()
  }

  return (
    <Modal title="Kelola Branch" onClose={onClose}>
      {error && (
        <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12, fontWeight: 600 }}>
          <AlertTriangle size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama branch, cth: Surabaya Kayoon" style={{ ...inputStyle, flex: 1 }} />
        <select value={brand} onChange={e => setBrand(e.target.value as 'IM3' | '3ID')} style={{ ...inputStyle, width: 90 }}>
          <option value="IM3">IM3</option>
          <option value="3ID">3ID</option>
        </select>
        <button onClick={handleAdd} disabled={saving} style={{
          padding: '0 14px', borderRadius: 10, border: 'none', background: IOH.teal, color: '#fff',
          fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <Plus size={14} /> Tambah
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {branches.length === 0 && <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: 16 }}>Belum ada branch</div>}
        {branches.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 10, background: '#F8F8FA', border: `1px solid ${IOH.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={13} color={IOH.charcoal} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{b.name}</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: b.brand === 'IM3' ? '#FFF0F0' : '#EEFBFA', color: b.brand === 'IM3' ? IOH.red : IOH.teal, fontWeight: 700 }}>{b.brand}</span>
            </div>
            <button onClick={() => handleDelete(b.id)} style={{ width: 26, height: 26, borderRadius: 7, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={11} color={IOH.red} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// [BARU] terima allowedRoles supaya dropdown Role bisa dibatasi sesuai halaman (driver/cse)
function UserFormModal({
  mode, initial, branches, onClose, onSaved, isSelf, allowedRoles,
}: {
  mode: 'create' | 'edit'
  initial?: UserRow
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
  isSelf?: boolean
  allowedRoles: string[]
}) {
  const [name, setName] = useState(initial?.name || '')
  const [username, setUsername] = useState(initial?.username || '')
  const [email, setEmail] = useState((initial as any)?.email || '')
  const [password, setPassword] = useState('')
  // [BARU] default role: pakai initial kalau edit, kalau create pakai role pertama yang diizinkan
  const [role, setRole] = useState(initial?.role || allowedRoles[0] || 'driver')
  const [branchId, setBranchId] = useState(initial?.branch_id || '')
  const [mcName, setMcName] = useState(initial?.mc_name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) return setError('Nama wajib diisi')
    if (mode === 'create' && !username.trim()) return setError('Username wajib diisi')
    if (!email.trim()) return setError('Email wajib diisi')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Format email tidak valid')
    if (mode === 'create' && password.length < 6) return setError('Password minimal 6 karakter')
    if (password && password.length < 6) return setError('Password minimal 6 karakter')
    if (role === 'cse' && !branchId) return setError('CSE wajib punya branch')
    if (role === 'cse' && !mcName.trim()) return setError('Nama MC wajib diisi untuk CSE')

    setSaving(true)
    try {
      const url = mode === 'create' ? '/api/admin/users' : `/api/admin/users/${initial!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body: Record<string, any> = mode === 'create'
        ? { name, username, email, password, role, branch_id: role === 'cse' ? branchId : null, mc_name: role === 'cse' ? mcName.trim() : null }
        : { name, email, role, branch_id: role === 'cse' ? branchId : null, mc_name: role === 'cse' ? mcName.trim() : null, ...(password ? { password } : {}) }

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); return }
      onSaved()
      onClose()
    } catch {
      setError('Tidak dapat terhubung ke server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Tambah User Baru' : `Edit User – ${initial?.name}`} onClose={onClose}>
      {error && (
        <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nama</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama lengkap" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Username</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="username"
          disabled={mode === 'edit'}
          style={{ ...inputStyle, background: mode === 'edit' ? '#F5F5F7' : '#fff', color: mode === 'edit' ? '#aaa' : '#222' }}
        />
        {mode === 'edit' && <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>Username tidak bisa diubah</div>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Password {mode === 'edit' && <span style={{ fontWeight: 500, textTransform: 'none' }}>(kosongkan jika tidak diganti)</span>}
        </label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'create' ? 'Minimal 6 karakter' : '••••••'} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          disabled={mode === 'edit' && isSelf}
          style={{ ...inputStyle, appearance: 'none' }}
        >
          {/* [BARU] hanya tampilkan role yang diizinkan di halaman ini */}
          {allowedRoles.includes('driver') && <option value="driver">Driver</option>}
          {allowedRoles.includes('cse') && <option value="cse">CSE</option>}
          {allowedRoles.includes('admin') && <option value="admin">Admin</option>}
        </select>
        {mode === 'edit' && isSelf && <div style={{ fontSize: 10, color: '#D97706', marginTop: 4 }}>Tidak bisa mengubah role akun sendiri</div>}
      </div>

      {role === 'cse' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Branch</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">— Pilih branch —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.brand})</option>)}
            </select>
            {branches.length === 0 && <div style={{ fontSize: 10, color: '#D97706', marginTop: 4 }}>Belum ada branch — tambah dulu lewat "Kelola Branch"</div>}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nama MC</label>
            <input value={mcName} onChange={e => setMcName(e.target.value)} placeholder="cth: B 1960 RZP" style={inputStyle} />
            <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>1 CSE memegang 1 MC — akan muncul di kolom "Nama Kegiatan" pada laporan</div>
          </div>
        </>
      )}

      <button onClick={handleSubmit} disabled={saving} style={{
        width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
        background: saving ? IOH.border : `linear-gradient(135deg, ${IOH.red}, ${IOH.magenta})`,
        color: saving ? '#aaa' : '#fff', fontSize: 14, fontWeight: 700,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}>
        {saving
          ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Menyimpan...</>
          : mode === 'create' ? 'Tambah User' : 'Simpan Perubahan'
        }
      </button>
    </Modal>
  )
}

function DeleteUserModal({ target, onCancel, onConfirm }: { target: UserRow; onCancel: () => void; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <Modal title="Hapus User?" onClose={onCancel}>
      <p style={{ fontSize: 13, color: IOH.charcoal, lineHeight: 1.7, marginBottom: 20 }}>
        Akun <strong style={{ color: '#111' }}>{target.name}</strong> ({target.username}) akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `1.5px solid ${IOH.border}`, background: IOH.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: IOH.charcoal, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Batal</button>
        <button onClick={async () => { setDeleting(true); await onConfirm() }} disabled={deleting} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: IOH.red, fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {deleting ? 'Menghapus...' : 'Ya, Hapus'}
        </button>
      </div>
    </Modal>
  )
}

export default function UserManagementPanel({ currentUserId, roleFilter }: { currentUserId: string; roleFilter?: 'driver' | 'cse' }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showBranches, setShowBranches] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [logFilter, setLogFilter] = useState<string>('all')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const url = roleFilter ? `/api/admin/users?role=${roleFilter}` : '/api/admin/users'
      const res = await fetch(url)
      const data = await res.json()
      const all: UserRow[] = data.users || []
      setUsers(roleFilter ? all.filter(u => u.role === roleFilter) : all)
    } finally { setLoading(false) }
  }

  const fetchBranches = async () => {
    const res = await fetch('/api/admin/branches')
    const data = await res.json()
    setBranches(data.branches || [])
  }

  const fetchLogs = async (userId?: string) => {
    setLogsLoading(true)
    try {
      const url = userId && userId !== 'all' ? `/api/admin/audit-log?user_id=${userId}&limit=100` : '/api/admin/audit-log?limit=100'
      const res = await fetch(url)
      const data = await res.json()
      let allLogs: AuditLog[] = data.logs || []
      if (roleFilter) {
        const allowedIds = new Set(users.map(u => u.id))
        allLogs = allLogs.filter(l => allowedIds.has(l.user_id))
      }
      setLogs(allLogs)
    } finally { setLogsLoading(false) }
  }

  useEffect(() => { fetchUsers(); fetchBranches() }, [roleFilter])
  useEffect(() => { fetchLogs(logFilter) }, [logFilter, users])

  const handleDelete = async () => {
    if (!deleteTarget) return
    await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    fetchUsers()
  }

  const userNameById = (id: string) => users.find(u => u.id === id)?.name || id.slice(0, 8)
  const branchNameById = (id?: string | null) => branches.find(b => b.id === id)?.name || '–'

  const allowedRoles = roleFilter ? [roleFilter] : ['driver', 'cse', 'admin']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
          Daftar User <span style={{ color: '#bbb', fontWeight: 400 }}>({users.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {roleFilter !== 'driver' && (
            <button onClick={() => setShowBranches(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11, border: `1.5px solid ${IOH.border}`,
              background: IOH.white, color: IOH.charcoal, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              <Building2 size={14} /> Kelola Branch
            </button>
          )}
          <button onClick={() => setShowAdd(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, border: 'none',
            background: `linear-gradient(135deg, ${IOH.yellow}, ${IOH.yellow})`, color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            <UserPlus size={15} /> Tambah User
          </button>
        </div>
      </div>

      <div style={{ background: IOH.white, borderRadius: 16, border: `1px solid ${IOH.border}`, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#ccc', fontSize: 13 }}>Belum ada user</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <thead>
                <tr style={{ background: '#F8F8FA', borderBottom: `1px solid ${IOH.border}` }}>
                  {['Nama', 'Username', 'Role', 'Branch / MC', 'Login Terakhir', 'Logout Terakhir', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${IOH.border}` }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#111' }}>
                      {u.name} {u.id === currentUserId && <span style={{ fontSize: 10, color: IOH.teal, fontWeight: 700 }}>(kamu)</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#888' }}>{u.username}</td>
                    <td style={{ padding: '12px 14px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#999' }}>
                      {u.role === 'cse' ? <>{branchNameById(u.branch_id)}{u.mc_name ? <span style={{ color: '#bbb' }}> · MC {u.mc_name}</span> : ''}</> : '–'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#999' }}>{formatDateTime(u.last_login_at)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#999' }}>{formatDateTime(u.last_logout_at)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditTarget(u)} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Pencil size={12} color={IOH.charcoal} />
                        </button>
                        {u.id !== currentUserId && (
                          <button onClick={() => setDeleteTarget(u)} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={12} color={IOH.red} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: IOH.white, borderRadius: 16, border: `1px solid ${IOH.border}`, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color={IOH.charcoal} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Histori Login / Logout</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={logFilter} onChange={e => setLogFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', fontSize: 12, padding: '7px 10px' }}>
              <option value="all">Semua User</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={() => fetchLogs(logFilter)} style={{ width: 30, height: 30, borderRadius: 9, border: `1.5px solid ${IOH.border}`, background: IOH.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={13} color={IOH.charcoal} />
            </button>
          </div>
        </div>

        {logsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: 24, height: 24, border: `2.5px solid ${IOH.yellow}`, borderTopColor: IOH.red, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#ccc', fontSize: 12 }}>Belum ada histori</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {logs.map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: '#F8F8FA', border: `1px solid ${IOH.border}` }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: log.event === 'login' ? '#EEFBFA' : '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {log.event === 'login' ? <LogIn size={12} color={IOH.teal} /> : <LogOut size={12} color={IOH.red} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>
                    {userNameById(log.user_id)} <span style={{ fontWeight: 600, color: log.event === 'login' ? IOH.teal : IOH.red }}>{log.event === 'login' ? 'login' : 'logout'}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.ip_address || 'IP tidak diketahui'} {log.user_agent ? `· ${log.user_agent}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#bbb', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <UserFormModal mode="create" branches={branches} onClose={() => setShowAdd(false)} onSaved={fetchUsers} allowedRoles={allowedRoles} />
      )}
      {editTarget && (
        <UserFormModal mode="edit" initial={editTarget} branches={branches} isSelf={editTarget.id === currentUserId} onClose={() => setEditTarget(null)} onSaved={fetchUsers} allowedRoles={allowedRoles} />
      )}
      {deleteTarget && (
        <DeleteUserModal target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
      {showBranches && (
        <BranchManagerModal branches={branches} onClose={() => setShowBranches(false)} onChanged={fetchBranches} />
      )}
    </div>
  )
}
