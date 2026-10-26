import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowIcon, MinusIcon, PinIcon, PlusIcon, Reveal, Star, TrashIcon } from '../components/ui'
import { naira } from '../data'
import { useStore } from '../store'
import { api, ApiError } from '../api'
import { rememberOrder } from '../orderMemory'

function Empty() {
  return (
    <div className="px-5 pb-32 pt-44 text-center">
      <Star size={52} className="float mx-auto text-brand-dark" />
      <h1 className="mt-5 font-display text-5xl font-semibold md:text-7xl">Your cart is empty</h1>
      <Link to="/menu" className="btn btn-primary mt-8">Browse the menu</Link>
    </div>
  )
}

export function Cart() {
  const { lines, subtotal, setQty, remove, branch, openPicker } = useStore()
  if (lines.length === 0) return <Empty />
  return (
    <div className="mx-auto max-w-4xl px-5 pb-28 pt-32 md:px-8">
      <Reveal>
        <h1 className="font-display text-5xl font-semibold md:text-7xl">Your cart</h1>
        {branch && (
          <button type="button" onClick={openPicker} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark hover:underline">
            <PinIcon className="h-4 w-4" /> {branch.name} branch · change
          </button>
        )}
      </Reveal>
      <ul className="mt-10 space-y-4">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-cream p-5">
            <div className="min-w-[10rem] flex-1">
              <p className="text-lg font-semibold">{l.name}</p>
              <p className="text-sm text-moss/70">{naira(l.price)} each</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label={`Decrease ${l.name}`} onClick={() => setQty(l.id, l.qty - 1)} className="grid h-9 w-9 place-items-center rounded-full bg-ivory hover:bg-sand active:scale-90"><MinusIcon className="h-4 w-4" /></button>
              <span className="w-8 text-center font-semibold tabular-nums">{l.qty}</span>
              <button type="button" aria-label={`Increase ${l.name}`} onClick={() => setQty(l.id, l.qty + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-ivory hover:bg-sand active:scale-90"><PlusIcon className="h-4 w-4" /></button>
            </div>
            <p className="w-24 text-right font-semibold tabular-nums">{naira(l.price * l.qty)}</p>
            <button type="button" aria-label={`Remove ${l.name}`} onClick={() => remove(l.id)} className="text-moss/50 hover:text-brand-dark"><TrashIcon /></button>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-3xl bg-ink p-7 text-ivory">
        <div className="flex items-baseline justify-between">
          <span className="text-sand/85">Subtotal</span>
          <span className="font-display text-4xl font-semibold tabular-nums">{naira(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-sand/60">Delivery fee, if any, is confirmed at checkout.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/menu" className="btn btn-ghost-light">Continue shopping</Link>
          <Link to="/checkout" className="btn btn-primary pulse-ring">Checkout <ArrowIcon className="h-4 w-4" /></Link>
        </div>
      </div>
    </div>
  )
}

interface OrderResponse {
  code: string
  subtotal: number
  deliveryFee: number
  total: number
  payment: { reference: string; url: string }
}

export function Checkout() {
  const { lines, subtotal, branch, clear } = useStore()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'delivery' | 'pickup'>('pickup')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)
  const [updates, setUpdates] = useState({ whatsapp: false, simulated: false })
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [freeAbove, setFreeAbove] = useState<number | null>(null)
  const [payments, setPayments] = useState<{ provider: 'mock' | 'paystack'; testMode: boolean } | null>(null)

  // Same rule the server applies, so the price shown before paying matches the charge.
  // The payment mode decides whether an email is required and how checkout is labelled.
  useEffect(() => {
    let live = true
    api<{ delivery: { freeAbove: number | null }; payments?: { provider: 'mock' | 'paystack'; testMode: boolean }; notifications?: { whatsappUpdates: boolean; simulated: boolean } }>('/settings')
      .then((s) => {
        if (!live) return
        setFreeAbove(s.delivery.freeAbove)
        setPayments(s.payments ?? null)
        setUpdates({ whatsapp: s.notifications?.whatsappUpdates ?? false, simulated: s.notifications?.simulated ?? false })
      })
      .catch(() => { /* the server is still the authority on the fee */ })
    return () => { live = false }
  }, [])

  if (lines.length === 0) return <Empty />

  const paystack = payments?.provider === 'paystack'

  const deliveryFee =
    mode !== 'delivery' ? 0 : branch?.deliveryFee != null
      ? (freeAbove !== null && subtotal >= freeAbove ? 0 : branch.deliveryFee)
      : null
  const total = deliveryFee === null ? null : subtotal + deliveryFee

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity()
      setShake(true)
      window.setTimeout(() => setShake(false), 600)
      return
    }
    if (!branch) {
      setError('Please choose a branch before checking out.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const order = await api<OrderResponse>('/orders', {
        method: 'POST',
        body: {
          branch: branch.slug,
          type: mode,
          customer: { name, phone, email: email || undefined, whatsappOptIn: whatsappOptIn || undefined },
          address: mode === 'delivery' ? address : undefined,
          notes: notes || undefined,
          items: lines.map((l) => ({ slug: l.slug, qty: l.qty })),
        },
      })
      rememberOrder({ code: order.code, phone, reference: order.payment.reference, total: order.total })
      clear()
      window.location.href = order.payment.url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded-xl border border-ink/20 bg-ivory px-4 py-3 outline-none transition focus:border-brand'

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-28 pt-32 md:px-8 lg:grid-cols-[1.2fr_1fr]">
      <form onSubmit={onSubmit} noValidate className="space-y-8">
        <Reveal><h1 className="font-display text-5xl font-semibold md:text-7xl">Checkout</h1></Reveal>

        <fieldset>
          <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand-dark">1 · How would you like it?</legend>
          <div className="grid grid-cols-2 gap-3">
            {(['pickup', 'delivery'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-2xl border-2 p-4 text-left font-semibold capitalize transition ${mode === m ? 'border-brand bg-brand/10' : 'border-ink/15 hover:bg-cream'}`}
              >
                {m}
                <span className="mt-1 block text-xs font-normal normal-case text-moss/70">
                  {m === 'pickup' ? `Collect from ${branch?.name ?? 'the branch'}` : branch?.deliveryFee != null ? `${naira(branch.deliveryFee)} delivery` : 'Delivery fee confirmed at checkout'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand-dark">2 · Your details</legend>
          <label className="block text-sm font-semibold">Full name
            <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1.5 font-normal`} />
          </label>
          <label className="block text-sm font-semibold">Phone number
            <input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" className={`${field} mt-1.5 font-normal`} />
          </label>
          {updates.whatsapp && (
            <label className="flex items-start gap-3 rounded-2xl bg-cream p-4 text-sm">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              />
              <span>
                Send my order updates on WhatsApp
                <span className="mt-1 block text-xs font-normal leading-relaxed text-moss/65">
                  We'll message this number when your order is ready{updates.simulated
                    ? '. Demo: the message is logged on the server, not delivered.'
                    : ' and again when it moves on.'}
                </span>
              </span>
            </label>
          )}
          <label className="block text-sm font-semibold">Email {paystack ? '' : '(optional)'}
            <input
              type="email"
              autoComplete="email"
              required={paystack}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${field} mt-1.5 font-normal`}
            />
            {paystack && <span className="mt-1 block text-xs font-normal text-moss/60">Paystack sends your payment receipt here.</span>}
          </label>
          {mode === 'delivery' && (
            <>
              <label className="block text-sm font-semibold">Delivery address
                <textarea required rows={3} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className={`${field} mt-1.5 font-normal`} />
              </label>
              <label className="block text-sm font-semibold">Delivery instructions (optional)
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-1.5 font-normal`} />
              </label>
            </>
          )}
        </fieldset>

        <div>
          <button type="submit" disabled={busy} className={`btn btn-primary w-full !py-4 text-base disabled:opacity-60 ${shake ? 'shake' : 'pulse-ring'}`}>
            {busy ? 'Placing your order…' : `Pay ${naira(total ?? subtotal)}${total === null ? '+' : ''} ${paystack ? 'with Paystack' : 'online'}`}
          </button>
          {error && (
            <p role="alert" className="pop-in mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-700">{error}</p>
          )}
          <p className="mt-3 text-center text-xs text-moss/60">
            {paystack
              ? payments?.testMode
                ? 'Paystack test mode — use a test card. No real money moves.'
                : 'Secure card payment by Paystack.'
              : 'Demo mode — no card is charged.'}
          </p>
          <p className="mt-2 text-center text-xs text-moss/60">
            By placing this order you agree to our{' '}
            <Link to="/terms" className="font-semibold text-brand-dark hover:underline">terms</Link>
            {' '}and{' '}
            <Link to="/refunds" className="font-semibold text-brand-dark hover:underline">refund policy</Link>.
          </p>
          <p className="mt-4 text-center text-xs text-moss/60">
            Already placed an order?{' '}
            <button type="button" onClick={() => navigate('/order')} className="font-semibold text-brand-dark hover:underline">Track it here</button>
          </p>
        </div>
      </form>

      <aside className="h-fit rounded-3xl bg-cream p-7 lg:sticky lg:top-28">
        <h2 className="font-display text-3xl font-semibold">Order summary</h2>
        {branch && <p className="mt-1 text-sm text-brand-dark">{branch.name} branch</p>}
        <ul className="mt-5 space-y-3 text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>{l.qty} × {l.name}</span>
              <span className="font-semibold tabular-nums">{naira(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-2 border-t border-ink/15 pt-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{naira(subtotal)}</span></div>
          <div className="flex justify-between text-moss/70"><span>Delivery fee</span><span>{deliveryFee === null ? 'Confirmed at checkout' : naira(deliveryFee)}</span></div>
          <div className="flex items-baseline justify-between pt-2">
            <span className="font-semibold">Total due</span>
            <span className="font-display text-3xl font-semibold tabular-nums">{naira(total ?? subtotal)}{total === null ? '+' : ''}</span>
          </div>
        </div>
      </aside>
    </div>
  )
}
