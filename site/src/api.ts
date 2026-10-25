// Talks to the Rashko backend from the public site (ordering, payment, tracking).
export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000'

export class ApiError extends Error {}

// Photo URLs from the API (e.g. "/uploads/dishes/xyz.jpg") are relative to the API's own address,
// not the site's, since they're on different hosts in production. This makes them absolute.
export const imageSrc = (url: string | null | undefined) => (!url ? null : url.startsWith('http') ? url : API + url)

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${API}/api${path}`, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.')
  }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new ApiError(j.error ?? 'Something went wrong. Please try again.')
  return j as T
}
