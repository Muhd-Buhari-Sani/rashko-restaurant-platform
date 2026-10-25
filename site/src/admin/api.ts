// Talks to the Rashko API. The base URL comes from VITE_API_URL (set in .env for production).
export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000'

export type Role = 'administrator' | 'branch_manager' | 'order_manager'
export interface Staff { id: number; name: string; role: Role; branchId: number | null; email?: string }
interface Session { token: string; user: Staff }

const KEY = 'rashko-admin-session'

// The admin token lives in sessionStorage: it clears when the tab closes and never reaches other tabs.
export function getSession(): Session | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export function setSession(s: Session) { try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ } }
export function clearSession() { try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = getSession()
  const r = await fetch(`${API}/api/admin${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(s ? { Authorization: `Bearer ${s.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401 && !path.startsWith('/auth/')) {
    clearSession()
    window.dispatchEvent(new Event('rashko-admin-logout'))
  }
  if (!r.ok) throw new Error(j.error ?? 'Something went wrong. Please try again.')
  return j as T
}

// Dish photos are saved on the server and referenced by a relative path like /uploads/dishes/xyz.jpg;
// this turns that into a full URL the browser can load. An already-absolute URL is left alone.
export const imageSrc = (url: string | null | undefined) => (!url ? null : url.startsWith('http') ? url : API + url)

// Uploads a dish photo (admin only) and returns the relative URL to store on the dish.
export async function uploadImage(file: File): Promise<string> {
  const s = getSession()
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${API}/api/admin/uploads/image`, {
    method: 'POST',
    headers: s ? { Authorization: `Bearer ${s.token}` } : {},
    body: form,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Could not upload that image')
  return j.url as string
}

export const money = (n: number | null | undefined) => (n == null ? 'TBC' : '₦' + n.toLocaleString('en-NG'))
export const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
export const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })
// Empty input means "no value" (null), so admins can clear a price or fee.
export const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))
