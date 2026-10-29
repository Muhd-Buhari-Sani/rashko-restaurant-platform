import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { API, api, clearSession, getSession, setSession, type Role, type Staff } from './api'
import { LiveCtx, Btn, Field, Input, Notice, card } from './ui'
import { Overview, Orders, Menu, Branches, Payments, Customers, Settings } from './pages'
import { enqueueOrderSound, isMuted, markAutoplayUnlocked, unlockAudio } from './sounds'

const ALL: Role[] = ['administrator', 'branch_manager', 'order_manager']
const MGMT: Role[] = ['administrator', 'branch_manager']
const NAV = [
  { to: '', label: 'Overview', roles: ALL },
  { to: 'orders', label: 'Orders', roles: ALL },
  { to: 'menu', label: 'Menu', roles: MGMT },
  { to: 'branches', label: 'Branches', roles: MGMT },
  { to: 'payments', label: 'Payments', roles: MGMT },
  { to: 'customers', label: 'Customers', roles: MGMT },
  { to: 'settings', label: 'Settings', roles: ['administrator'] as Role[] },
]

export default function AdminRoot() {
  const [user, setUser] = useState<Staff | null>(() => getSession()?.user ?? null)
  useEffect(() => {
    const off = () => setUser(null)
    window.addEventListener('rashko-admin-logout', off)
    return () => window.removeEventListener('rashko-admin-logout', off)
  }, [])
  if (!user) return <Login onLogin={setUser} />
  return <Shell user={user} onLogout={() => { clearSession(); setUser(null) }} />
}

function Login({ onLogin }: { onLogin: (u: Staff) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await api<{ token: string; user: Staff }>('/auth/login', { method: 'POST', body: { email, password } })
      setSession({ token: r.token, user: r.user })
      onLogin(r.user)
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm space-y-4 p-8`}>
        <img src="/logo.png" alt="Rashko" className="mx-auto h-16 w-16 rounded-full bg-white object-contain" />
        <h1 className="text-center text-3xl">Staff sign in</h1>
        {err && <Notice tone="error">{err}</Notice>}
        <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Btn type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </form>
    </div>
  )
}

function Shell({ user, onLogout }: { user: Staff; onLogout: () => void }) {
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [soundBlocked, setSoundBlocked] = useState(false)

  // Live feed: new paid orders and status changes reach every open screen without a refresh.
  useEffect(() => {
    const s = getSession()
    if (!s) return
    const es = new EventSource(`${API}/api/admin/events?token=${encodeURIComponent(s.token)}`)
    const bump = () => setTick((t) => t + 1)
    es.addEventListener('order.new', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      setToast(`New paid order ${d.code}`)
      bump()
      window.setTimeout(() => setToast(null), 6000)
      try {
        const willPlay = enqueueOrderSound(d.id)
        if (!willPlay && !isMuted()) {
          setSoundBlocked(true)
          window.setTimeout(() => setSoundBlocked(false), 8000)
        }
      } catch {
        setSoundBlocked(true)
        window.setTimeout(() => setSoundBlocked(false), 8000)
      }
    })
    es.addEventListener('order.updated', bump)
    return () => es.close()
  }, [])

  useEffect(() => {
    const unlock = () => {
      markAutoplayUnlocked()
      unlockAudio()
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('mousedown', unlock)
    }
    window.addEventListener('click', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    window.addEventListener('touchstart', unlock, { once: true })
    window.addEventListener('mousedown', unlock, { once: true })
    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('mousedown', unlock)
    }
  }, [])

  const can = (roles: Role[]) => roles.includes(user.role)
  const guard = (roles: Role[], el: ReactNode) => (can(roles) ? el : <Notice tone="error">You do not have access to this page.</Notice>)
  const roleName = { administrator: 'Administrator', branch_manager: 'Branch manager', order_manager: 'Order manager' }[user.role]

  return (
    <LiveCtx.Provider value={tick}>
      <div className="min-h-screen bg-cream text-ink md:flex">
        <aside className="border-b border-ink/10 bg-ink text-ivory md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0">
          <div className="flex items-center justify-between gap-3 px-5 py-4 md:flex-col md:items-start md:gap-1 md:py-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />
              <div>
                <p className="font-display text-xl leading-none">Rashko</p>
                <p className="text-xs text-mint">Admin</p>
              </div>
            </div>
            <button onClick={onLogout} className="text-xs text-ivory/70 underline-offset-4 hover:text-mint hover:underline md:mt-2">Sign out</button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-0">
            {NAV.filter((n) => can(n.roles)).map((n) => (
              <NavLink
                key={n.to}
                to={`/admin/${n.to}`}
                end={n.to === ''}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-brand text-white' : 'text-ivory/80 hover:bg-white/10 hover:text-white'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <p className="hidden px-6 pt-6 text-xs text-ivory/50 md:block">{user.name}<br />{roleName}</p>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-8">
          {toast && (
            <div className="fixed right-4 top-4 z-50 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>
          )}
          {soundBlocked && !isMuted() && (
            <div className="fixed right-4 top-16 z-50 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg">New order received — sound blocked by browser. Click anywhere to enable.</div>
          )}
          <Routes>
            <Route index element={guard(ALL, <Overview user={user} />)} />
            <Route path="orders" element={guard(ALL, <Orders user={user} />)} />
            <Route path="menu" element={guard(MGMT, <Menu user={user} />)} />
            <Route path="branches" element={guard(MGMT, <Branches user={user} />)} />
            <Route path="payments" element={guard(MGMT, <Payments user={user} />)} />
            <Route path="customers" element={guard(MGMT, <Customers user={user} />)} />
            <Route path="settings" element={guard(['administrator'], <Settings />)} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </LiveCtx.Provider>
  )
}
