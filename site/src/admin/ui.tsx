import { createContext, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { api, label } from './api'

// Bumped whenever the server reports a change, so open screens reload their data.
export const LiveCtx = createContext(0)

export function useFetch<T>(path: string | null) {
  const tick = useContext(LiveCtx)
  const [n, setN] = useState(0)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    let live = true
    api<T>(path)
      .then((d) => { if (live) { setData(d); setError(null) } })
      .catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [path, tick, n])
  return { data, error, reload: () => setN((x) => x + 1) }
}

export const card = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5'
const inputCls = 'w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand'

export function Btn({ variant = 'solid', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'ghost' | 'danger' }) {
  const v = { solid: 'bg-brand text-white hover:bg-brand-dark', ghost: 'bg-sand/60 text-ink hover:bg-sand', danger: 'bg-red-600 text-white hover:bg-red-700' }[variant]
  return <button {...p} className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${v} ${className}`} />
}
export function Input(p: InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={`${inputCls} ${p.className ?? ''}`} /> }
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} className={`${inputCls} ${p.className ?? ''}`} /> }
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-moss"><span className="mb-1 block">{label}</span>{children}</label>
}

const TONE: Record<string, string> = {
  received: 'bg-sky-100 text-sky-800', preparing: 'bg-amber-100 text-amber-800', ready: 'bg-violet-100 text-violet-800',
  out_for_delivery: 'bg-indigo-100 text-indigo-800', completed: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-red-100 text-red-700',
  pending_payment: 'bg-zinc-100 text-zinc-700', paid: 'bg-emerald-100 text-emerald-800', success: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-700', abandoned: 'bg-zinc-100 text-zinc-700', unpaid: 'bg-zinc-100 text-zinc-700',
  refund_due: 'bg-amber-100 text-amber-800', refunded: 'bg-zinc-200 text-zinc-800', pending: 'bg-zinc-100 text-zinc-700',
}
export function Badge({ value }: { value: string }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[value] ?? 'bg-sand text-ink'}`}>{label(value)}</span>
}
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-4xl">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
export function Stat({ title, value, sub }: { title: string; value: ReactNode; sub?: string }) {
  return (
    <div className={`${card} transition hover:-translate-y-0.5 hover:shadow-md`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-moss/70">{title}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-moss/70">{sub}</p>}
    </div>
  )
}
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' }) {
  return <div className={`rounded-xl px-4 py-3 text-sm ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-sand/60 text-ink'}`}>{children}</div>
}
export function Loading() { return <p className="py-10 text-center text-sm text-moss/70">Loading…</p> }
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
      <table className="w-full text-left text-sm">
        <thead className="bg-cream/70 text-xs uppercase tracking-wider text-moss/80">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ink/5">{children}</tbody>
      </table>
    </div>
  )
}
