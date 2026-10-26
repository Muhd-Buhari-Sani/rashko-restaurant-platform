import { useState, type FormEvent } from 'react'
import { api, fmtDate, imageSrc, money, label, numOrNull, uploadImage, type Staff } from './api'
import { Badge, Btn, Field, Input, Loading, Notice, PageHead, Select, Stat, Table, card, useFetch } from './ui'

const isAdmin = (u: Staff) => u.role === 'administrator'
const errText = (e: unknown) => (e as Error).message

// ---------------------------------------------------------------- Overview
export function Overview({ user }: { user: Staff }) {
  const [days, setDays] = useState(30)
  const [branch, setBranch] = useState('')
  const branches = useFetch<any[]>(isAdmin(user) ? '/branches' : null)
  const { data: o, error } = useFetch<any>(`/overview?days=${days}${branch ? `&branch=${branch}` : ''}`)
  if (error) return <Notice tone="error">{error}</Notice>
  if (!o) return <Loading />

  const live = o.live.reduce((s: number, x: any) => s + x.n, 0)
  const maxRev = Math.max(1, ...o.daily.map((d: any) => d.revenue))
  const attempts = o.payments.success + o.payments.failed
  const rate = attempts ? Math.round((o.payments.success / attempts) * 100) + '%' : '–'
  const pickup = o.byType.find((t: any) => t.type === 'pickup')?.n ?? 0
  const delivery = o.byType.find((t: any) => t.type === 'delivery')?.n ?? 0

  return (
    <>
      <PageHead title="Overview">
        {isAdmin(user) && (
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-auto">
            <option value="">All branches</option>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </Select>
      </PageHead>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Revenue" value={money(o.totals.revenue)} sub="Paid orders, not cancelled" />
        <Stat title="Orders" value={o.totals.orders} sub={`${pickup} pickup · ${delivery} delivery`} />
        <Stat title="Average order" value={money(o.totals.avgOrder)} />
        <Stat title="Live now" value={live} sub="Received, preparing, ready or out" />
        <Stat title="Cancelled" value={o.totals.cancelled} />
        <Stat title="Payment success" value={rate} sub={`${o.payments.failed} failed or abandoned`} />
      </div>

      <div className={`${card} mt-6`}>
        <h2 className="mb-4 text-2xl">Revenue by day</h2>
        {o.daily.length === 0 ? (
          <p className="text-sm text-moss/70">No paid orders in this period yet.</p>
        ) : (
          <div className="flex h-56 items-end gap-1.5 overflow-x-auto pb-6">
            {o.daily.map((d: any) => (
              <div key={d.day} className="group flex min-w-[28px] flex-1 flex-col items-center justify-end" title={`${d.day}: ${money(d.revenue)} from ${d.orders} orders`}>
                <span className="mb-1 text-[10px] text-moss/70 opacity-0 transition group-hover:opacity-100">{money(d.revenue)}</span>
                <div className="w-full rounded-t-md bg-brand/70 transition-all duration-500 group-hover:bg-brand" style={{ height: `${Math.max(3, (d.revenue / maxRev) * 100)}%` }} />
                <span className="mt-1 text-[10px] text-moss/70">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className={card}>
          <h2 className="mb-3 text-2xl">Best sellers</h2>
          {o.topItems.length === 0 ? <p className="text-sm text-moss/70">Nothing sold yet.</p> : (
            <ol className="space-y-2 text-sm">
              {o.topItems.map((t: any, i: number) => (
                <li key={t.name} className="flex justify-between gap-3 border-b border-ink/5 pb-2">
                  <span>{i + 1}. {t.name}</span>
                  <span className="text-moss/80">{t.qty} sold · {money(t.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {isAdmin(user) && (
          <div className={card}>
            <h2 className="mb-3 text-2xl">Branches</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-moss/70"><tr><th className="pb-2">Branch</th><th className="pb-2">Orders</th><th className="pb-2">Revenue</th></tr></thead>
              <tbody>
                {o.byBranch.map((b: any) => (
                  <tr key={b.name} className="border-t border-ink/5"><td className="py-2">{b.name}</td><td>{b.orders}</td><td>{money(b.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Orders
const STEP: Record<string, string> = { preparing: 'Start preparing', ready: 'Mark ready', out_for_delivery: 'Out for delivery', completed: 'Complete', cancelled: 'Cancel order' }
const NEXT: Record<string, string[]> = {
  received: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'], pending_payment: [], completed: [], cancelled: [],
}
// Mirrors the server rules so the buttons never offer an action the server would refuse.
const nextFor = (o: any) =>
  (NEXT[o.status] ?? []).filter((s) => !(s === 'out_for_delivery' && o.type !== 'delivery') && !(s === 'completed' && o.type === 'delivery' && o.status === 'ready'))

export function Orders({ user }: { user: Staff }) {
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [branch, setBranch] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const branches = useFetch<any[]>(isAdmin(user) ? '/branches' : null)
  const params = new URLSearchParams({ limit: '50' })
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  if (q.trim()) params.set('q', q.trim())
  if (branch) params.set('branch', branch)
  const list = useFetch<any>(`/orders?${params}`)

  return (
    <>
      <PageHead title="Orders">
        <Input placeholder="Search code, name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {['received', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
          <option value="">Pickup and delivery</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
        </Select>
        {isAdmin(user) && (
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-auto">
            <option value="">All branches</option>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
      </PageHead>
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data ? <Loading /> : (
        <>
          <p className="mb-3 text-sm text-moss/70">{list.data.total} orders</p>
          <Table head={['Code', 'Customer', 'Type', 'Total', 'Status', 'Payment', 'Placed']}>
            {list.data.rows.map((r: any) => (
              <tr key={r.id} onClick={() => setOpen(r.id)} className="cursor-pointer transition hover:bg-cream/60">
                <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-3">{r.customerName}<div className="text-xs text-moss/70">{r.customerPhone}</div></td>
                <td className="px-4 py-3">{label(r.type)}{isAdmin(user) && <div className="text-xs text-moss/70">{r.branch}</div>}</td>
                <td className="px-4 py-3">{money(r.total)}</td>
                <td className="px-4 py-3"><Badge value={r.status} /></td>
                <td className="px-4 py-3"><Badge value={r.paymentStatus} /></td>
                <td className="px-4 py-3 text-xs text-moss/80">{fmtDate(r.createdAt)}</td>
              </tr>
            ))}
            {list.data.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-moss/70">No orders match these filters.</td></tr>}
          </Table>
        </>
      )}
      {open !== null && <OrderDrawer id={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  )
}

function OrderDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { data: o, error, reload } = useFetch<any>(`/orders/${id}`)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const act = async (to: string) => {
    if (to === 'cancelled' && !window.confirm('Cancel this order? If it is paid, it will be flagged for refund.')) return
    setBusy(true); setErr(null)
    try {
      await api(`/orders/${id}/status`, { method: 'POST', body: { status: to, note: note.trim() || undefined } })
      setNote('')
      reload(); onChanged()
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-ivory p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-sm">{o?.code ?? '…'}</p>
            {o && <p className="text-xs text-moss/70">{fmtDate(o.created_at)} · {o.branch_name}</p>}
          </div>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm hover:bg-sand">Close</button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {!o ? !error && <Loading /> : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2"><Badge value={o.status} /><Badge value={o.payment_status} /><Badge value={o.type} /></div>
            <div className={`${card} text-sm`}>
              <p className="font-semibold">{o.customer_name}</p>
              <p>{o.customer_phone}</p>
              {o.type === 'delivery' && <p className="mt-2 text-moss/90">{o.delivery_address}</p>}
              {o.notes && <p className="mt-2 italic text-moss/80">“{o.notes}”</p>}
            </div>
            <div className={`${card} text-sm`}>
              {o.items.map((i: any) => (
                <div key={i.name} className="flex justify-between py-1"><span>{i.qty} × {i.name}</span><span>{money(i.line_total)}</span></div>
              ))}
              <div className="mt-2 space-y-1 border-t border-ink/10 pt-2 text-moss/80">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
                <div className="flex justify-between"><span>Delivery</span><span>{money(o.delivery_fee)}</span></div>
              </div>
              <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span>{money(o.total)}</span></div>
            </div>

            {o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'pending_payment' && (
              <div className={`${card} space-y-3`}>
                <Field label="Note for the record (optional)">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. out of stock, customer called" />
                </Field>
                {err && <Notice tone="error">{err}</Notice>}
                <div className="flex flex-wrap gap-2">
                  {nextFor(o).map((s) => (
                    <Btn key={s} variant={s === 'cancelled' ? 'danger' : s === 'completed' ? 'solid' : 'ghost'} disabled={busy} onClick={() => act(s)}>{STEP[s]}</Btn>
                  ))}
                </div>
              </div>
            )}
            {o.payment_status === 'refund_due' && <Notice>This order was paid and then cancelled. Refund the customer, then record it under Payments.</Notice>}

            <div className={`${card} text-sm`}>
              <p className="mb-2 font-semibold">History</p>
              <ol className="space-y-2 border-l-2 border-brand/30 pl-4">
                {o.events.map((e: any, i: number) => (
                  <li key={i}>
                    <p className="font-medium">{label(e.status)}</p>
                    <p className="text-xs text-moss/70">{fmtDate(e.at)}{e.by ? ` · ${e.by}` : ''}</p>
                    {e.note && <p className="text-xs text-moss/90">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------- Menu
export function Menu({ user }: { user: Staff }) {
  const [tab, setTab] = useState<'branch' | 'dishes'>('branch')
  return (
    <>
      <PageHead title="Menu">
        <div className="flex rounded-full bg-sand/60 p-1 text-sm">
          {(['branch', 'dishes'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 transition ${tab === t ? 'bg-ink text-white' : 'text-ink'}`}>
              {t === 'branch' ? 'Branch prices' : 'All dishes'}
            </button>
          ))}
        </div>
      </PageHead>
      {tab === 'branch' ? <BranchPrices user={user} /> : <Dishes user={user} />}
    </>
  )
}

function CategoryPicker({ value, onChange, categories, onCreated, admin, className }:
  { value: string; onChange: (v: string) => void; categories: any[]; onCreated: () => void; admin: boolean; className?: string }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const create = async () => {
    if (name.trim().length < 2) return
    setBusy(true); setErr(null)
    try {
      const cat = await api<any>('/categories', { method: 'POST', body: { name: name.trim() } })
      onChange(String(cat.id)); setName(''); setAdding(false); onCreated()
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  if (adding) {
    return (
      <div className={`flex items-end gap-2 ${className ?? ''}`}>
        <Field label="New category name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Appetizers & Snacks" className="w-48" />
        </Field>
        <Btn type="button" disabled={busy || name.trim().length < 2} onClick={create} className="!py-2">{busy ? 'Adding…' : 'Save'}</Btn>
        <Btn type="button" variant="ghost" onClick={() => { setAdding(false); setErr(null) }} className="!py-2">Cancel</Btn>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    )
  }
  return (
    <div className={`flex items-end gap-2 ${className ?? ''}`}>
      <Field label="Category">
        <Select required value={value} onChange={(e) => onChange(e.target.value)} className="w-48">
          <option value="">Choose a category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      {admin && <button type="button" onClick={() => setAdding(true)} className="pb-2 text-xs font-semibold text-brand underline-offset-2 hover:underline">+ New category</button>}
    </div>
  )
}

function BranchPrices({ user }: { user: Staff }) {
  const branches = useFetch<any[]>('/branches')
  const [bid, setBid] = useState<number | null>(null)
  const current = bid ?? user.branchId ?? branches.data?.[0]?.id ?? null
  const menu = useFetch<any[]>(current ? `/branches/${current}/menu` : null)
  const all = useFetch<any[]>(isAdmin(user) ? '/menu/items' : null)
  const categories = useFetch<any[]>('/categories')
  const admin = isAdmin(user)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState('')
  const [addCat, setAddCat] = useState('')
  const [addPrice, setAddPrice] = useState('')
  if (branches.error) return <Notice tone="error">{branches.error}</Notice>
  if (!branches.data || !current) return <Loading />
  const inMenu = new Set(menu.data?.map((r) => r.itemId))
  const addable = (all.data ?? []).filter((i) => !inMenu.has(i.id))
  const cats = categories.data ?? []

  const add = async (e: FormEvent) => {
    e.preventDefault(); setErr(null)
    try {
      await api(`/branches/${current}/menu/${adding}`, {
        method: 'PUT', body: { price: numOrNull(addPrice), available: true, categoryId: addCat ? Number(addCat) : null },
      })
      setAdding(''); setAddCat(''); setAddPrice(''); menu.reload()
    } catch (x) { setErr(errText(x)) }
  }

  return (
    <div className="space-y-6">
      {branches.data.length > 1 && (
        <Select value={current} onChange={(e) => setBid(Number(e.target.value))} className="w-auto">
          {branches.data.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      )}
      <p className="text-sm text-moss/80">Prices and categories are per branch — the same dish can sell for a different price, or sit in a different category, at each branch. Leave a price empty to show “To be confirmed”: the dish stays on the menu but cannot be ordered.</p>
      {err && <Notice tone="error">{err}</Notice>}
      {!menu.data ? <Loading /> : menu.data.length === 0 ? (
        <Notice>No dishes on this branch's menu yet. Use the forms below to add one.</Notice>
      ) : (
        <Table head={['Dish', 'Category', 'Price (₦)', 'On sale', '']}>
          {menu.data.map((r) => (
            <PriceRow key={`${current}-${r.itemId}`} bid={current} row={r} categories={cats} onChanged={menu.reload} onError={setErr} />
          ))}
        </Table>
      )}

      {addable.length > 0 && (
        <form onSubmit={add} className={`${card} flex flex-wrap items-end gap-3`}>
          <Field label="Add an existing dish to this branch">
            <Select required value={adding} onChange={(e) => setAdding(e.target.value)} className="w-56">
              <option value="">Choose a dish</option>
              {addable.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </Field>
          <CategoryPicker value={addCat} onChange={setAddCat} categories={cats} onCreated={categories.reload} admin={admin} />
          <Field label="Price (₦)">
            <Input type="number" min={0} value={addPrice} onChange={(e) => setAddPrice(e.target.value)} className="w-32" />
          </Field>
          <Btn type="submit" disabled={!adding || !addCat}>Add to menu</Btn>
        </form>
      )}

      <NewDishForm bid={current} categories={cats} onCategoryCreated={categories.reload} admin={admin} onAdded={() => { menu.reload(); all.reload() }} />
    </div>
  )
}

function NewDishForm({ bid, categories, onCategoryCreated, admin, onAdded }:
  { bid: number; categories: any[]; onCategoryCreated: () => void; admin: boolean; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [catId, setCatId] = useState('')
  const [price, setPrice] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pickImage = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview)
    if (!f) { setImage(null); setPreview(null); return }
    const bad = badImage(f)
    if (bad) { setErr(bad); return }
    setErr(null); setImage(f); setPreview(URL.createObjectURL(f))
  }

  const add = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      const imageUrl = image ? await uploadImage(image) : null
      await api(`/branches/${bid}/menu/new`, {
        method: 'POST',
        body: { name, note: note || null, imageUrl, categoryId: catId ? Number(catId) : null, price: numOrNull(price), available: true },
      })
      setName(''); setNote(''); setCatId(''); setPrice(''); pickImage(null); onAdded()
    } catch (x) { setErr(errText(x)) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={add} className={`${card} space-y-3`}>
      <h3 className="text-sm font-semibold text-ink">Add a brand-new dish to this branch</h3>
      <p className="text-xs text-moss/70">This adds it straight to this branch's menu with a category and price — no separate step needed to make it findable.</p>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Dish name"><Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="w-56" /></Field>
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} className="w-56" /></Field>
        <CategoryPicker value={catId} onChange={setCatId} categories={categories} onCreated={onCategoryCreated} admin={admin} />
        <Field label="Price (₦)"><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" /></Field>
        {admin && (
          <Field label="Photo (optional, JPEG/PNG/WEBP, up to 3MB)">
            <div className="flex items-center gap-3">
              {preview && <img src={preview} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-ink/10" />}
              <input type="file" accept={IMAGE_TYPES} onChange={(e) => pickImage(e.target.files?.[0] ?? null)} className="text-xs" />
            </div>
          </Field>
        )}
        <Btn type="submit" disabled={busy || !catId}>{busy ? 'Adding…' : 'Add dish'}</Btn>
      </div>
    </form>
  )
}

function PriceRow({ bid, row, categories, onChanged, onError }:
  { bid: number; row: any; categories: any[]; onChanged: () => void; onError: (s: string) => void }) {
  const [price, setPrice] = useState(row.price == null ? '' : String(row.price))
  const [avail, setAvail] = useState<boolean>(row.available)
  const [catId, setCatId] = useState(row.categoryId == null ? '' : String(row.categoryId))
  const dirty = numOrNull(price) !== row.price || avail !== row.available || (catId ? Number(catId) : null) !== row.categoryId
  const save = async () => {
    try {
      await api(`/branches/${bid}/menu/${row.itemId}`, { method: 'PUT', body: { price: numOrNull(price), available: avail, categoryId: catId ? Number(catId) : null } })
      onChanged()
    } catch (e) { onError(errText(e)) }
  }
  const remove = async () => {
    if (!window.confirm(`Remove ${row.name} from this branch's menu?`)) return
    try { await api(`/branches/${bid}/menu/${row.itemId}`, { method: 'DELETE' }); onChanged() } catch (e) { onError(errText(e)) }
  }
  return (
    <tr className="transition hover:bg-cream/50">
      <td className="px-4 py-3 font-medium">{row.name}</td>
      <td className="px-4 py-3">
        <Select value={catId} onChange={(e) => setCatId(e.target.value)} className="w-40">
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </td>
      <td className="px-4 py-3">
        <Input type="number" min={0} value={price} placeholder="TBC" onChange={(e) => setPrice(e.target.value)} className="w-28" />
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={avail} onChange={(e) => setAvail(e.target.checked)} className="h-4 w-4 accent-brand" />
          {avail ? 'Yes' : 'Sold out'}
        </label>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Btn variant="ghost" disabled={!dirty} onClick={save} className="mr-2 !py-1.5">Save</Btn>
        <Btn variant="danger" onClick={remove} className="!py-1.5">Remove</Btn>
      </td>
    </tr>
  )
}

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp'
const badImage = (f: File) => (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ? 'Please choose a JPEG, PNG or WEBP image'
  : f.size > 3 * 1024 * 1024 ? 'Image must be 3MB or smaller' : null)

function Dishes({ user }: { user: Staff }) {
  const items = useFetch<any[]>('/menu/items')
  const [err, setErr] = useState<string | null>(null)
  const admin = isAdmin(user)

  if (items.error) return <Notice tone="error">{items.error}</Notice>
  if (!items.data) return <Loading />
  return (
    <div className="space-y-6">
      <Notice>To add a brand-new dish, go to the <strong>Branch prices</strong> tab, pick the branch, and use “Add a brand-new dish to this branch” — that puts it straight onto that branch's menu with a category and price, so it's never hidden or unfindable. This tab is for editing the name, note or photo of a dish that's already in the catalog.</Notice>
      {err && <Notice tone="error">{err}</Notice>}
      <Table head={['Photo', 'Dish', 'Note', 'Used at', '']}>
        {items.data.map((i) => (
          <DishRow key={`${i.id}-${i.name}-${i.note}-${i.imageUrl}`} item={i} admin={admin} onChanged={items.reload} onError={setErr} />
        ))}
      </Table>
    </div>
  )
}

function DishRow({ item, admin, onChanged, onError }: { item: any; admin: boolean; onChanged: () => void; onError: (s: string) => void }) {
  const [name, setName] = useState(item.name)
  const [note, setNote] = useState(item.note ?? '')
  const [uploading, setUploading] = useState(false)
  const dirty = name !== item.name || note !== (item.note ?? '')
  const src = imageSrc(item.imageUrl)
  const save = async () => {
    try { await api(`/menu/items/${item.id}`, { method: 'PATCH', body: { name, note: note || null } }); onChanged() } catch (e) { onError(errText(e)) }
  }
  const remove = async () => {
    if (!window.confirm(`Delete ${item.name} from every branch? Past orders keep their record.`)) return
    try { await api(`/menu/items/${item.id}`, { method: 'DELETE' }); onChanged() } catch (e) { onError(errText(e)) }
  }
  const changeImage = async (f: File | null) => {
    if (!f) return
    const bad = badImage(f)
    if (bad) return onError(bad)
    setUploading(true)
    try {
      const imageUrl = await uploadImage(f)
      await api(`/menu/items/${item.id}`, { method: 'PATCH', body: { imageUrl } })
      onChanged()
    } catch (e) { onError(errText(e)) } finally { setUploading(false) }
  }
  return (
    <tr className="transition hover:bg-cream/50">
      <td className="px-4 py-3">
        <label className={`block ${admin ? 'cursor-pointer' : ''}`}>
          {src ? <img src={src} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-ink/10" />
            : <span className="grid h-12 w-12 place-items-center rounded-lg bg-sand/60 text-[10px] text-moss/60">{uploading ? '…' : 'No photo'}</span>}
          {admin && <input type="file" accept={IMAGE_TYPES} className="hidden" disabled={uploading} onChange={(e) => changeImage(e.target.files?.[0] ?? null)} />}
        </label>
      </td>
      <td className="px-4 py-3">{admin ? <Input value={name} onChange={(e) => setName(e.target.value)} /> : item.name}</td>
      <td className="px-4 py-3">{admin ? <Input value={note} onChange={(e) => setNote(e.target.value)} /> : item.note}</td>
      <td className="px-4 py-3 text-moss/80">{item.branches.length} branch{item.branches.length === 1 ? '' : 'es'}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {admin && <>
          <Btn variant="ghost" disabled={!dirty} onClick={save} className="mr-2 !py-1.5">Save</Btn>
          <Btn variant="danger" onClick={remove} className="!py-1.5">Delete</Btn>
        </>}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------- Branches
export function Branches({ user }: { user: Staff }) {
  const { data, error, reload } = useFetch<any[]>('/branches')
  const [newName, setNewName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  if (error) return <Notice tone="error">{error}</Notice>
  if (!data) return <Loading />
  const create = async (e: FormEvent) => {
    e.preventDefault(); setErr(null)
    try { const b = await api('/branches', { method: 'POST', body: { name: newName } }); setNewName(''); reload(); setEditing(b.id) } catch (x) { setErr(errText(x)) }
  }
  const b = data.find((x) => x.id === editing)
  return (
    <>
      <PageHead title="Branches" />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((x) => (
          <button key={x.id} onClick={() => setEditing(x.id)} className={`${card} text-left transition hover:-translate-y-0.5 hover:shadow-md ${editing === x.id ? 'ring-2 ring-brand' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-2xl">{x.name}</p>
              {!x.active && <Badge value="cancelled" />}
            </div>
            <p className="mt-2 text-sm text-moss/80">{x.address ?? 'Address to be confirmed'}</p>
            <p className="mt-1 text-xs text-moss/70">{x.menuItems} dishes on menu · {x.pickupEnabled ? 'Pickup' : 'No pickup'} · {x.deliveryEnabled ? 'Delivery' : 'No delivery'}</p>
          </button>
        ))}
      </div>
      {b && <BranchEditor key={b.id} branch={b} admin={isAdmin(user)} onSaved={reload} />}
      {isAdmin(user) && (
        <form onSubmit={create} className={`${card} mt-6 flex flex-wrap items-end gap-3`}>
          <Field label="New branch name"><Input required minLength={2} value={newName} onChange={(e) => setNewName(e.target.value)} className="w-64" /></Field>
          <Btn type="submit">Add branch</Btn>
        </form>
      )}
    </>
  )
}

function BranchEditor({ branch: b, admin, onSaved }: { branch: any; admin: boolean; onSaved: () => void }) {
  const [f, setF] = useState({
    name: b.name, address: b.address ?? '', phone: b.phone ?? '', hours: b.hours ?? '',
    services: (b.services ?? []).join(', '), servicesNote: b.servicesNote ?? '', active: b.active,
    pickupEnabled: b.pickupEnabled, deliveryEnabled: b.deliveryEnabled,
    deliveryFee: b.deliveryFee == null ? '' : String(b.deliveryFee), minOrder: String(b.minOrder ?? 0),
  })
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const flag = (k: 'active' | 'pickupEnabled' | 'deliveryEnabled') => (e: { target: { checked: boolean } }) => setF({ ...f, [k]: e.target.checked })
  const save = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    const body = {
      ...(admin ? { name: f.name, active: f.active } : {}),
      address: f.address.trim() || null, phone: f.phone.trim() || null, hours: f.hours.trim() || null,
      services: f.services.split(",").map((s: string) => s.trim()).filter(Boolean), servicesNote: f.servicesNote.trim() || null,
      pickupEnabled: f.pickupEnabled, deliveryEnabled: f.deliveryEnabled,
      deliveryFee: numOrNull(f.deliveryFee), minOrder: Number(f.minOrder) || 0,
    }
    try { await api(`/branches/${b.id}`, { method: 'PATCH', body }); setMsg({ tone: 'info', text: 'Saved.' }); onSaved() } catch (x) { setMsg({ tone: 'error', text: errText(x) }) }
  }
  return (
    <form onSubmit={save} className={`${card} mt-6 grid gap-4 md:grid-cols-2`}>
      <h2 className="text-2xl md:col-span-2">Edit {b.name}</h2>
      <Field label="Branch name"><Input value={f.name} disabled={!admin} onChange={set('name')} /></Field>
      <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Address"><Input value={f.address} onChange={set('address')} /></Field>
      <Field label="Opening hours"><Input value={f.hours} onChange={set('hours')} placeholder="Daily, 9:00 AM – 11:00 PM" /></Field>
      <Field label="Services (comma separated)"><Input value={f.services} onChange={set('services')} placeholder="Dine-in, Delivery" /></Field>
      <Field label="Services note shown to customers"><Input value={f.servicesNote} onChange={set('servicesNote')} /></Field>
      <Field label="Delivery fee (₦), empty = use default"><Input type="number" min={0} value={f.deliveryFee} onChange={set('deliveryFee')} /></Field>
      <Field label="Minimum order (₦)"><Input type="number" min={0} value={f.minOrder} onChange={set('minOrder')} /></Field>
      <div className="flex flex-wrap gap-5 text-sm md:col-span-2">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={f.pickupEnabled} onChange={flag('pickupEnabled')} /> Accepts pickup orders</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={f.deliveryEnabled} onChange={flag('deliveryEnabled')} /> Accepts delivery orders</label>
        {admin && <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={f.active} onChange={flag('active')} /> Taking orders</label>}
      </div>
      {msg && <div className="md:col-span-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div className="md:col-span-2"><Btn type="submit">Save branch</Btn></div>
    </form>
  )
}

// ---------------------------------------------------------------- Payments
export function Payments({ user }: { user: Staff }) {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [branch, setBranch] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const branches = useFetch<any[]>(isAdmin(user) ? '/branches' : null)
  const params = new URLSearchParams({ limit: '50' })
  if (status) params.set('status', status)
  if (q.trim()) params.set('q', q.trim())
  if (branch) params.set('branch', branch)
  const { data, error, reload } = useFetch<any>(`/payments?${params}`)
  const refund = async (id: number) => {
    if (!window.confirm('Confirm you have sent this refund from the payment provider?')) return
    setErr(null)
    try { await api(`/payments/${id}/mark-refunded`, { method: 'POST', body: {} }); reload() } catch (e) { setErr(errText(e)) }
  }
  return (
    <>
      <PageHead title="Payments">
        <Input placeholder="Search reference" value={q} onChange={(e) => setQ(e.target.value)} className="w-52" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {['success', 'pending', 'failed', 'abandoned', 'refunded'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
        {isAdmin(user) && (
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-auto">
            <option value="">All branches</option>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
      </PageHead>
      {error && <Notice tone="error">{error}</Notice>}
      {err && <Notice tone="error">{err}</Notice>}
      {data && <p className="mb-3 text-sm text-moss/80">{data.total} transactions · {money(data.successfulTotal)} collected in total</p>}
      {!data ? <Loading /> : (
        <Table head={['Reference', 'Order', 'Customer', 'Amount', 'Status', 'Channel', 'Date', '']}>
          {data.rows.map((r: any) => (
            <tr key={r.id} className="transition hover:bg-cream/50">
              <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
              <td className="px-4 py-3">{r.orderCode}<div className="text-xs text-moss/70">{r.branch}</div></td>
              <td className="px-4 py-3">{r.customerName}</td>
              <td className="px-4 py-3">{money(r.amount)}</td>
              <td className="px-4 py-3"><Badge value={r.status} /></td>
              <td className="px-4 py-3 text-xs text-moss/80">{r.channel ?? '–'}</td>
              <td className="px-4 py-3 text-xs text-moss/80">{fmtDate(r.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                {isAdmin(user) && r.status === 'success' && r.orderPaymentStatus === 'refund_due' && (
                  <Btn variant="ghost" className="!py-1.5" onClick={() => refund(r.id)}>Mark refunded</Btn>
                )}
              </td>
            </tr>
          ))}
          {data.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-moss/70">No transactions match these filters.</td></tr>}
        </Table>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Customers
export function Customers({ user }: { user: Staff }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const params = new URLSearchParams({ limit: '50' })
  if (q.trim()) params.set('q', q.trim())
  const { data, error } = useFetch<any>(`/customers?${params}`)
  const detail = useFetch<any>(open ? `/customers/${open}` : null)
  return (
    <>
      <PageHead title="Customers">
        <Input placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </PageHead>
      {error && <Notice tone="error">{error}</Notice>}
      {!data ? <Loading /> : (
        <>
          <p className="mb-3 text-sm text-moss/80">{data.total} customers who have ordered{isAdmin(user) ? '' : ' at your branch'}</p>
          <Table head={['Name', 'Phone', 'Orders', 'Spent', 'Last order']}>
            {data.rows.map((c: any) => (
              <tr key={c.id} onClick={() => setOpen(open === c.id ? null : c.id)} className="cursor-pointer transition hover:bg-cream/60">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{c.orders}</td>
                <td className="px-4 py-3">{money(c.spent)}</td>
                <td className="px-4 py-3 text-xs text-moss/80">{c.lastOrderAt ? fmtDate(c.lastOrderAt) : '–'}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {open && detail.data && (
        <div className={`${card} mt-6`}>
          <h2 className="text-2xl">{detail.data.name}</h2>
          <p className="mb-4 text-sm text-moss/80">{detail.data.phone}{detail.data.email ? ` · ${detail.data.email}` : ''}</p>
          <div className="space-y-2 text-sm">
            {detail.data.orders.map((o: any) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 pb-2">
                <div><span className="font-mono text-xs">{o.code}</span> · {o.items}<div className="text-xs text-moss/70">{fmtDate(o.createdAt)} · {o.branch}</div></div>
                <div className="flex items-center gap-2"><Badge value={o.status} /><span>{money(o.total)}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Settings (administrator)
export function Settings() {
  const { data, error, reload } = useFetch<any>('/settings')
  if (error) return <Notice tone="error">{error}</Notice>
  if (!data) return <Loading />
  return (
    <>
      <PageHead title="Settings" />
      <SettingsForm key={JSON.stringify(data)} initial={data} onSaved={reload} />
      <StaffAccounts />
    </>
  )
}

function SettingsForm({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const [r, setR] = useState({ name: initial.restaurant.name, phone: initial.restaurant.phone ?? '', email: initial.restaurant.email ?? '', address: initial.restaurant.address ?? '' })
  const [d, setD] = useState({ defaultFee: initial.delivery.defaultFee == null ? '' : String(initial.delivery.defaultFee), freeAbove: initial.delivery.freeAbove == null ? '' : String(initial.delivery.freeAbove) })
  const [n, setN] = useState({ whatsappEnabled: initial.notifications.whatsappEnabled, recipients: initial.notifications.recipients.join(', '), customerUpdates: initial.notifications.customerUpdates ?? true })
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    try {
      await api('/settings', { method: 'PUT', body: {
        restaurant: { name: r.name, phone: r.phone || null, email: r.email || null, address: r.address || null },
        delivery: { defaultFee: numOrNull(d.defaultFee), freeAbove: numOrNull(d.freeAbove) },
        notifications: { whatsappEnabled: n.whatsappEnabled, recipients: n.recipients.split(",").map((s: string) => s.trim()).filter(Boolean), customerUpdates: n.customerUpdates },
      } })
      setMsg({ tone: 'info', text: 'Settings saved.' }); onSaved()
    } catch (x) { setMsg({ tone: 'error', text: errText(x) }) }
  }
  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
      <section className={`${card} space-y-3`}>
        <h2 className="text-2xl">Restaurant</h2>
        <Field label="Name"><Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        <Field label="Phone"><Input value={r.phone} onChange={(e) => setR({ ...r, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={r.email} onChange={(e) => setR({ ...r, email: e.target.value })} /></Field>
        <Field label="Address"><Input value={r.address} onChange={(e) => setR({ ...r, address: e.target.value })} /></Field>
      </section>
      <section className={`${card} space-y-3`}>
        <h2 className="text-2xl">Delivery charges</h2>
        <p className="text-xs text-moss/80">Used by any branch without its own fee. Delivery stays unavailable until a fee is set.</p>
        <Field label="Default delivery fee (₦)"><Input type="number" min={0} value={d.defaultFee} onChange={(e) => setD({ ...d, defaultFee: e.target.value })} /></Field>
        <Field label="Free delivery above (₦), empty = never"><Input type="number" min={0} value={d.freeAbove} onChange={(e) => setD({ ...d, freeAbove: e.target.value })} /></Field>
      </section>
      <section className={`${card} space-y-3`}>
        <h2 className="text-2xl">Notifications</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={n.whatsappEnabled} onChange={(e) => setN({ ...n, whatsappEnabled: e.target.checked })} /> Send WhatsApp alert for each paid order</label>
        <Field label="WhatsApp numbers (international format, comma separated)">
          <Input value={n.recipients} onChange={(e) => setN({ ...n, recipients: e.target.value })} placeholder="+2348012345678" />
        </Field>
        <label className="flex items-start gap-2 border-t border-ink/10 pt-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={n.customerUpdates} onChange={(e) => setN({ ...n, customerUpdates: e.target.checked })} />
          <span>
            Send customers WhatsApp updates when their order is ready, out for delivery, completed or cancelled
            <span className="mt-1 block text-xs text-moss/70">Only customers who tick the box at checkout are messaged. Needs Cloud API credentials and approved templates.</span>
          </span>
        </label>
      </section>
      {msg && <div className="lg:col-span-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div className="lg:col-span-3"><Btn type="submit">Save settings</Btn></div>
    </form>
  )
}

function StaffAccounts() {
  const { data, error, reload } = useFetch<any[]>('/users')
  const branches = useFetch<any[]>('/branches')
  const [f, setF] = useState({ email: '', name: '', password: '', role: 'branch_manager', branchId: '' })
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const create = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    try {
      await api('/users', { method: 'POST', body: { ...f, branchId: f.role === 'administrator' || !f.branchId ? null : Number(f.branchId) } })
      setF({ email: '', name: '', password: '', role: 'branch_manager', branchId: '' }); reload()
      setMsg({ tone: 'info', text: 'Account created.' })
    } catch (x) { setMsg({ tone: 'error', text: errText(x) }) }
  }
  const toggle = async (u: any) => {
    try { await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); reload() } catch (x) { setMsg({ tone: 'error', text: errText(x) }) }
  }
  return (
    <section className="mt-10 space-y-4">
      <h2 className="text-3xl">Staff accounts</h2>
      {error && <Notice tone="error">{error}</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {data && (
        <Table head={['Name', 'Email', 'Role', 'Branch', 'Access', '']}>
          {data.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">{u.name}</td>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3">{label(u.role)}</td>
              <td className="px-4 py-3">{u.branch ?? 'All'}</td>
              <td className="px-4 py-3"><Badge value={u.active ? 'success' : 'cancelled'} /> <span className="ml-1 text-xs">{u.active ? 'Active' : 'Locked'}</span></td>
              <td className="px-4 py-3 text-right"><Btn variant="ghost" className="!py-1.5" onClick={() => toggle(u)}>{u.active ? 'Lock' : 'Unlock'}</Btn></td>
            </tr>
          ))}
        </Table>
      )}
      <form onSubmit={create} className={`${card} grid gap-3 md:grid-cols-3`}>
        <h3 className="text-xl md:col-span-3">Add a staff member</h3>
        <Field label="Full name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Temporary password (10+ characters)"><Input required minLength={10} type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="branch_manager">Branch manager</option>
            <option value="order_manager">Order manager</option>
            <option value="administrator">Administrator</option>
          </Select>
        </Field>
        {f.role !== 'administrator' && (
          <Field label="Branch">
            <Select required value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
              <option value="">Choose a branch</option>
              {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="md:col-span-3"><Btn type="submit">Create account</Btn></div>
      </form>
    </section>
  )
}
