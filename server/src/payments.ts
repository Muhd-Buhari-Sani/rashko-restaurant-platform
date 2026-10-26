import { randomUUID } from 'node:crypto'
import { config } from './config.ts'
import { one, tx } from './db.ts'
import { broadcast } from './events.ts'
import { notifyNewOrder } from './notify.ts'

export type Verdict = { status: 'success' | 'failed' | 'abandoned' | 'pending'; amount: number; channel?: string; raw: unknown }

interface Provider {
  name: string
  init(p: { reference: string; amount: number; email: string; orderCode: string }): Promise<{ authorizationUrl: string }>
  verify(reference: string): Promise<Verdict>
}

const mock: Provider = {
  name: 'mock',
  async init({ reference }) {
    return { authorizationUrl: `${config.appUrl}/pay/mock?reference=${reference}` }
  },
  // Development only: the result is whatever /api/payments/mock/:reference set on the row.
  async verify(reference) {
    const p = await one<{ amount: number; raw: any }>('select amount, raw from payments where reference = $1', [reference])
    const r = p?.raw?.mock
    return { status: r === 'success' ? 'success' : r === 'failed' ? 'failed' : 'pending', amount: p?.amount ?? 0, channel: 'mock', raw: p?.raw }
  },
}

/** Exported so the HTTP contract can be tested against a stub server. */
export const paystackProvider = (secret: string, base = 'https://api.paystack.co'): Provider => {
  const api = base.replace(/\/+$/, '')
  return {
    name: 'paystack',
    async init({ reference, amount, email, orderCode }) {
      const r = await fetch(`${api}/transaction/initialize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, amount: amount * 100, reference, currency: 'NGN',
          callback_url: `${config.appUrl}/order/${orderCode}?ref=${encodeURIComponent(reference)}`, metadata: { orderCode },
        }),
      })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok || !j.status) throw new Error(`Paystack initialize failed (${r.status}): ${j.message ?? 'no message'}`)
      return { authorizationUrl: j.data.authorization_url }
    },
    async verify(reference) {
      let r: Response
      try {
        r = await fetch(`${api}/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${secret}` },
        })
      } catch {
        // Paystack being unreachable must not 500 the page a customer returns to: the
        // payment stays pending, and the webhook (or a later refresh) can settle it.
        return { status: 'pending', amount: 0, raw: { error: 'Paystack unreachable' } }
      }
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok || !j.status) return { status: 'pending', amount: 0, raw: j }
      const s = j.data.status
      return {
        status: s === 'success' ? 'success'
          : s === 'failed' || s === 'reversed' ? 'failed'
            : s === 'abandoned' ? 'abandoned'
              : 'pending',
        amount: Math.round(Number(j.data.amount) / 100) || 0,
        channel: j.data.channel,
        raw: j.data,
      }
    },
  }
}

export const provider: Provider = config.paymentProvider === 'paystack'
  ? paystackProvider(config.paystackSecret, config.paystackApiBase)
  : mock

export const newReference = () => 'RSK' + randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()

/**
 * Asks the provider what really happened and updates the order. Safe to call any number of times
 * (customer redirect, webhook, manual re-check): a payment is only ever settled once.
 * The amount is checked against what the server charged, never against anything the browser sent.
 */
export async function settle(reference: string) {
  const known = await one('select 1 from payments where reference = $1', [reference])
  if (!known) return null
  const verdict = await provider.verify(reference)

  const result = await tx(async (c) => {
    const p = await one<any>('select * from payments where reference = $1 for update', [reference], c)
    if (!p) return null
    const o = await one<any>('select * from orders where id = $1 for update', [p.order_id], c)
    if (p.status === 'success' || p.status === 'refunded') return { order: o, payment: p, newlyPaid: false }
    if (verdict.status === 'pending') return { order: o, payment: p, newlyPaid: false }

    if (verdict.status !== 'success') {
      await c.query(`update payments set status = $2, raw = coalesce($3::jsonb, raw) where id = $1`,
        [p.id, verdict.status, JSON.stringify(verdict.raw ?? null)])
      return { order: o, payment: { ...p, status: verdict.status }, newlyPaid: false }
    }
    if (verdict.amount !== p.amount) {
      await c.query(`update payments set status = 'failed', raw = $2::jsonb where id = $1`,
        [p.id, JSON.stringify({ error: 'amount mismatch', expected: p.amount, got: verdict.amount })])
      console.error(`Payment ${reference}: amount mismatch, expected ${p.amount} got ${verdict.amount}`)
      return { order: o, payment: { ...p, status: 'failed' }, newlyPaid: false }
    }

    await c.query(`update payments set status = 'success', channel = $2, raw = $3::jsonb, paid_at = now() where id = $1`,
      [p.id, verdict.channel ?? null, JSON.stringify(verdict.raw ?? null)])
    if (o.status === 'cancelled') {
      // Paid after the restaurant cancelled: do not resurrect the order, flag it for a refund.
      await c.query(`update orders set payment_status = 'refund_due', updated_at = now() where id = $1`, [o.id])
      return { order: { ...o, payment_status: 'refund_due' }, payment: { ...p, status: 'success' }, newlyPaid: false }
    }
    await c.query(`update orders set payment_status = 'paid', status = 'received', updated_at = now() where id = $1`, [o.id])
    await c.query(`insert into order_events(order_id, status, note) values ($1, 'received', 'Payment confirmed')`, [o.id])
    return { order: { ...o, payment_status: 'paid', status: 'received' }, payment: { ...p, status: 'success' }, newlyPaid: true }
  })

  if (result?.newlyPaid) {
    broadcast('order.new', result.order.branch_id, { id: result.order.id, code: result.order.code })
    void notifyNewOrder(result.order.id)
  }
  return result
}
