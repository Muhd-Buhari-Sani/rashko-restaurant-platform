import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowIcon, ClockIcon, PinIcon, Reveal, Star } from '../components/ui'
import { naira } from '../data'
import { api, ApiError } from '../api'
import { latestOrder, recallOrder, recallPayment, rememberPhone } from '../orderMemory'

interface VerifyResult {
  code: string
  paymentStatus: string
  orderStatus: string
}

interface Track {
  code: string
  type: 'pickup' | 'delivery'
  status: string
  paymentStatus: string
  subtotal: number
  deliveryFee: number
  total: number
  createdAt: string
  branch: string
  deliveryAddress?: string | null
  items: { name: string; unitPrice: number; qty: number; lineTotal: number }[]
  events: { status: string; at: string }[]
}

const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
const fmt = (s: string) =>
  new Date(s).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })

const TONE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  success: 'bg-emerald-100 text-emerald-800',
  unpaid: 'bg-zinc-100 text-zinc-700',
  pending: 'bg-zinc-100 text-zinc-700',
  failed: 'bg-red-100 text-red-700',
  abandoned: 'bg-zinc-100 text-zinc-700',
  refund_due: 'bg-amber-100 text-amber-800',
  refunded: 'bg-zinc-200 text-zinc-800',
  received: 'bg-sky-100 text-sky-800',
  preparing: 'bg-amber-100 text-amber-800',
  ready: 'bg-violet-100 text-violet-800',
  out_for_delivery: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-700',
  pending_payment: 'bg-zinc-100 text-zinc-700',
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[value] ?? 'bg-sand text-ink'}`}>
      {label(value)}
    </span>
  )
}

function paidBody(o: Track) {
  switch (o.status) {
    case 'completed':
      return 'This order is complete. Thank you for ordering from Rashko.'
    case 'out_for_delivery':
      return 'Your order is on its way.'
    case 'ready':
      return o.type === 'pickup' ? `Your order is ready to collect at ${o.branch}.` : 'Your order is ready and waiting for a rider.'
    case 'preparing':
      return `${o.branch} is preparing your order.`
    case 'received':
      return `${o.branch} has your order and will start preparing it shortly.`
    default:
      return 'Your payment is confirmed.'
  }
}

/** Asks the server to check the provider. Returns null when the reference is unknown. */
async function verifyPayment(reference: string): Promise<VerifyResult | null> {
  try {
    return await api<VerifyResult>(`/payments/verify/${encodeURIComponent(reference)}`)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- test payment

export function MockPayment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reference = params.get('reference')?.trim() ?? ''
  const remembered = reference ? recallPayment(reference) : null
  const [busy, setBusy] = useState<'success' | 'failed' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const finish = (code: string) => navigate(`/order/${code}?ref=${encodeURIComponent(reference)}`, { replace: true })

  const pay = async (result: 'success' | 'failed') => {
    if (!reference || busy) return
    setBusy(result)
    setError(null)
    try {
      const r = await api<VerifyResult>(`/payments/mock/${encodeURIComponent(reference)}`, {
        method: 'POST',
        body: { result },
      })
      finish(r.code)
    } catch (err) {
      // Already processed (a double click, or the page was reloaded after paying):
      // send the customer to the order instead of showing a dead end.
      const v = await verifyPayment(reference)
      if (v && v.paymentStatus !== 'pending') {
        finish(v.code)
        return
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-32 md:px-8">
      <Reveal>
        <section className="pattern-light rounded-3xl bg-ink p-7 text-ivory md:p-9">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-mint">
            <Star size={14} /> Test mode
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Complete your payment</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-sand/80">
            This is a demo payment page. No card is charged and no money moves — it lets the whole ordering flow
            run without a live payment provider.
          </p>

          {remembered?.total != null && (
            <p className="mt-7 font-display text-6xl font-semibold tabular-nums">{naira(remembered.total)}</p>
          )}
          <p className="mt-3 font-mono text-xs text-sand/60">Reference {reference || '—'}</p>
        </section>
      </Reveal>

      <div className="mt-6 rounded-3xl bg-cream p-6 md:p-7">
        {!reference ? (
          <div className="space-y-4">
            <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-700">
              This page needs a payment reference. Start again from your cart.
            </p>
            <Link to="/menu" className="btn btn-primary">Browse the menu <ArrowIcon className="h-4 w-4" /></Link>
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-moss/80">
              Choose what the test payment should do. Either way you will land back on your order.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => pay('success')}
                disabled={busy !== null}
                className="btn btn-primary w-full !py-4 text-base disabled:opacity-60"
              >
                {busy === 'success' ? 'Confirming…' : `Pay ${remembered?.total != null ? naira(remembered.total) : 'now'}`}
              </button>
              <button
                type="button"
                onClick={() => pay('failed')}
                disabled={busy !== null}
                className="btn btn-ghost w-full disabled:opacity-60"
              >
                {busy === 'failed' ? 'Finishing…' : 'Simulate a failed payment'}
              </button>
            </div>
            {error && (
              <p role="alert" className="pop-in mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-700">
                {error}
              </p>
            )}
            <p className="mt-5 text-center text-xs text-moss/60">
              Add a Paystack secret key to the server's <span className="font-mono">.env</span> to take real card payments.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- order / tracking

function TrackStart() {
  const navigate = useNavigate()
  const latest = latestOrder()
  const [code, setCode] = useState(latest?.code ?? '')
  const [phone, setPhone] = useState(latest?.phone ?? '')
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c || !phone.trim()) return
    rememberPhone(c, phone.trim())
    navigate(`/order/${encodeURIComponent(c)}`)
  }

  const field = 'w-full rounded-xl border border-ink/20 bg-ivory px-4 py-3 outline-none transition focus:border-brand'

  return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-32 md:px-8">
      <Reveal>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-dark">
          <Star size={14} /> Order tracking
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold md:text-6xl">Track your order</h1>
        <p className="mt-4 text-base leading-relaxed text-moss/80">
          Enter the order code from your receipt and the phone number you used at checkout.
        </p>
      </Reveal>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl bg-cream p-6 md:p-7">
        <label className="block text-sm font-semibold">Order code
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RSK-XXXXXX"
            autoCapitalize="characters"
            className={`${field} mt-1.5 font-mono font-normal tracking-wide`}
          />
        </label>
        <label className="block text-sm font-semibold">Phone number
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08012345678"
            className={`${field} mt-1.5 font-normal`}
          />
        </label>
        <button type="submit" className="btn btn-primary w-full !py-4 text-base">Track my order</button>
        {latest && (
          <p className="text-center text-xs text-moss/60">
            Placed an order just now?{' '}
            <Link to={`/order/${latest.code}`} className="font-semibold text-brand-dark hover:underline">
              Continue to {latest.code}
            </Link>
          </p>
        )}
      </form>
    </div>
  )
}

export function OrderPage() {
  const { code: routeCode } = useParams()
  const [params] = useSearchParams()
  const code = routeCode?.trim().toUpperCase() ?? ''
  const reference = params.get('ref')?.trim() ?? ''
  const [tick, setTick] = useState(0)

  const [order, setOrder] = useState<Track | null>(null)
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [busy, setBusy] = useState(Boolean(code))
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState(() => recallOrder(code)?.phone ?? '')
  // Only a phone the server accepted starts the auto-refresh, so a typo cannot cause
  // a failing request every few seconds.
  const [activePhone, setActivePhone] = useState('')

  useEffect(() => {
    if (!code) return
    let live = true
    const known = recallOrder(code)?.phone?.trim() ?? ''

    void (async () => {
      if (reference) {
        const v = await verifyPayment(reference)
        if (!live) return
        if (v) setVerify(v)
      }
      if (!known) {
        if (live) {
          setChecked(true)
          setBusy(false)
        }
        return
      }
      try {
        const data = await api<Track>(`/orders/track/${encodeURIComponent(code)}?phone=${encodeURIComponent(known)}`)
        if (live) {
          setOrder(data)
          setActivePhone(known)
        }
      } catch (e) {
        if (live) setError(e instanceof ApiError ? e.message : 'Could not load that order. Please try again.')
      } finally {
        if (live) {
          setChecked(true)
          setBusy(false)
        }
      }
    })()

    return () => {
      live = false
    }
  }, [code, reference, tick])

  // The kitchen moves the order along while the customer is still on this page. Poll
  // quietly (15s, paused in background tabs) instead of asking them to press Refresh.
  useEffect(() => {
    if (!code || !activePhone) return
    let live = true
    let timer = 0
    let done = false

    const poll = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const data = await api<Track>(`/orders/track/${encodeURIComponent(code)}?phone=${encodeURIComponent(activePhone)}`)
        if (!live) return
        setOrder((prev) =>
          prev && prev.status === data.status && prev.paymentStatus === data.paymentStatus && prev.events.length === data.events.length
            ? prev
            : data)
        if (data.status === 'completed' || data.status === 'cancelled') done = true
      } catch {
        // Transient network problem: keep showing the last known state and try again.
      }
      if (live && !done) timer = window.setTimeout(poll, 15_000)
    }

    timer = window.setTimeout(poll, 15_000)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [code, activePhone])

  if (!code) return <TrackStart />

  const reload = () => {
    setError(null)
    setBusy(true)
    setChecked(false)
    setTick((t) => t + 1)
  }

  const submitPhone = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!phone.trim()) return
    rememberPhone(code, phone.trim())
    reload()
  }

  const checking = busy && !order && !verify
  const cancelled = order?.status === 'cancelled'
  const paid = order ? order.paymentStatus === 'paid' : verify?.paymentStatus === 'success'
  const failed = order
    ? order.paymentStatus === 'unpaid' && order.status === 'pending_payment' &&
      (verify?.paymentStatus === 'failed' || verify?.paymentStatus === 'abandoned')
    : verify?.paymentStatus === 'failed' || verify?.paymentStatus === 'abandoned'
  const showPhoneForm = !order && checked && !busy

  const view = checking
    ? { eyebrow: 'One moment', title: 'Checking your order…', body: 'We are confirming the payment with the provider.' }
    : cancelled
      ? { eyebrow: 'Order closed', title: 'This order was cancelled', body: 'If money left your account, the restaurant will be in touch about a refund.' }
      : paid
        ? {
            eyebrow: 'Payment received',
            title: order ? 'Order confirmed' : 'Payment received',
            body: order ? paidBody(order) : 'Enter the phone number used at checkout to see the full order.',
          }
        : failed
          ? { eyebrow: 'Payment failed', title: 'Your payment did not go through', body: 'You were not charged. You can place the order again from the menu.' }
          : {
              eyebrow: 'Almost there',
              title: 'Awaiting payment',
              body: order
                ? 'We have not received payment for this order yet. If you just paid, refresh in a moment.'
                : 'Enter the phone number used at checkout to see this order.',
            }

  const steps = order
    ? order.type === 'delivery'
      ? ['received', 'preparing', 'ready', 'out_for_delivery', 'completed']
      : ['received', 'preparing', 'ready', 'completed']
    : []
  const stepIndex = order ? steps.indexOf(order.status) : -1
  const eventAt = (s: string) => order?.events.find((e) => e.status === s)?.at
  const paymentBadge = order?.paymentStatus ?? verify?.paymentStatus
  const field = 'w-full rounded-xl border border-ink/20 bg-ivory px-4 py-3 outline-none transition focus:border-brand'

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-32 md:px-8">
      <Reveal>
        <section className={`rounded-3xl p-7 md:p-9 ${paid ? 'bg-ink text-ivory' : 'bg-cream'}`}>
          <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] ${paid ? 'text-mint' : 'text-brand-dark'}`}>
            <Star size={14} /> {view.eyebrow}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">{view.title}</h1>
          <p className={`mt-3 max-w-xl text-sm leading-relaxed ${paid ? 'text-sand/80' : 'text-moss/80'}`}>{view.body}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
            <span className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${paid ? 'bg-ivory/15 text-ivory' : 'bg-ink/10 text-ink'}`}>
              {code}
            </span>
            {order && <Badge value={order.status} />}
            {paymentBadge && <Badge value={paymentBadge} />}
            {order && (
              <span className={`inline-flex items-center gap-1.5 text-xs ${paid ? 'text-sand/70' : 'text-moss/70'}`}>
                <PinIcon className="h-3.5 w-3.5" /> {order.type === 'delivery' ? 'Delivery' : 'Pickup'} · {order.branch}
              </span>
            )}
          </div>
        </section>
      </Reveal>

      {showPhoneForm && (
        <form onSubmit={submitPhone} className="mt-6 rounded-3xl bg-cream p-6 md:p-7">
          <h2 className="font-display text-2xl font-semibold">
            {verify?.paymentStatus === 'success' ? 'One more step' : 'Confirm your phone number'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-moss/75">
            Enter the phone number used at checkout to see the items and status of {code}.
          </p>
          {error && (
            <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-700">{error}</p>
          )}
          <label className="mt-4 block text-sm font-semibold">Phone number
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08012345678"
              className={`${field} mt-1.5 font-normal`}
            />
          </label>
          <button type="submit" className="btn btn-primary mt-4 w-full !py-4 text-base">View my order</button>
          <p className="mt-3 text-center text-xs text-moss/60">
            We ask for the phone number so order codes cannot be guessed.
          </p>
        </form>
      )}

      {error && !showPhoneForm && (
        <div className="mt-6 rounded-3xl bg-red-50 p-6">
          <p role="alert" className="text-sm leading-relaxed text-red-700">{error}</p>
          <button type="button" onClick={reload} className="mt-3 text-sm font-semibold text-brand-dark hover:underline">
            Try again
          </button>
        </div>
      )}

      {order && stepIndex >= 0 && (
        <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-ink/5 md:p-7">
          <p role="status" aria-live="polite" className="sr-only">
            Order status: {label(order.status)}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold">Order status</h2>
            <div className="text-right text-xs text-moss/60">
              <p className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" /> Placed {fmt(order.createdAt)}
              </p>
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <p className="mt-1 inline-flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                  </span>
                  Updates automatically
                </p>
              )}
            </div>
          </div>
          <ol className="mt-5">
            {steps.map((s, i) => {
              const done = stepIndex >= i
              const active = stepIndex === i
              const at = eventAt(s)
              return (
                <li key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        done ? 'bg-brand text-white' : 'bg-ink/10 text-moss/50'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    {i < steps.length - 1 && (
                      <span className={`my-1 w-0.5 flex-1 ${stepIndex > i ? 'bg-brand' : 'bg-ink/10'}`} />
                    )}
                  </div>
                  <div className={`pb-5 ${i === steps.length - 1 ? 'pb-0' : ''}`}>
                    <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-moss/50'}`}>{label(s)}</p>
                    <p className="text-xs text-moss/60">
                      {active && order.status !== 'completed' ? 'Current status' : at ? fmt(at) : 'Pending'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {order && (
        <section className="mt-6 rounded-3xl bg-cream p-6 md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold">Your order</h2>
            <span className="text-xs text-moss/60">{order.items.reduce((n, i) => n + i.qty, 0)} items</span>
          </div>
          {order.type === 'delivery' && order.deliveryAddress && (
            <p className="mt-2 text-sm text-moss/75"><span className="font-semibold text-ink">Deliver to:</span> {order.deliveryAddress}</p>
          )}
          <ul className="mt-4 space-y-2 text-sm">
            {order.items.map((i) => (
              <li key={i.name} className="flex justify-between gap-3">
                <span>{i.qty} × {i.name}</span>
                <span className="font-semibold tabular-nums">{naira(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-2 border-t border-ink/15 pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{naira(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span className="tabular-nums">{order.deliveryFee > 0 ? naira(order.deliveryFee) : 'None'}</span></div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-semibold">Total</span>
              <span className="font-display text-3xl font-semibold tabular-nums">{naira(order.total)}</span>
            </div>
          </div>
        </section>
      )}

      {!checking && !showPhoneForm && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={reload} disabled={busy} className="btn btn-ghost disabled:opacity-60">
            {busy ? 'Refreshing…' : 'Refresh status'}
          </button>
          <Link to="/menu" className="btn btn-primary">Order something else <ArrowIcon className="h-4 w-4" /></Link>
        </div>
      )}
    </div>
  )
}
