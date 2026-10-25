import { z } from 'zod'
import { one, q, tx } from './db.ts'
import { HttpError, normalizePhone, orderCode } from './util.ts'
import { getSettings } from './settings.ts'
import { newReference, provider } from './payments.ts'
import { config } from './config.ts'
import { broadcast } from './events.ts'

export const createOrderSchema = z.object({
  branch: z.string().min(1),
  type: z.enum(['delivery', 'pickup']),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().min(7).max(20),
    email: z.string().email().max(120).optional().or(z.literal('')),
  }),
  address: z.string().trim().min(5).max(300).optional(),
  notes: z.string().trim().max(300).optional(),
  items: z.array(z.object({ slug: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1).max(40),
})

/**
 * Builds an order from slugs and quantities only. Prices, availability and the delivery fee are all
 * read from the database; nothing money-related is trusted from the browser.
 */
export async function createOrder(input: z.infer<typeof createOrderSchema>) {
  const phone = normalizePhone(input.customer.phone)
  const settings = await getSettings()

  const created = await tx(async (c) => {
    const b = await one<any>('select * from branches where slug = $1', [input.branch], c)
    if (!b || !b.active) throw new HttpError(404, 'That branch is not taking orders')
    if (input.type === 'pickup' && !b.pickup_enabled) throw new HttpError(400, 'This branch is not offering pickup right now')
    if (input.type === 'delivery') {
      if (!b.delivery_enabled) throw new HttpError(400, 'This branch is not offering delivery right now')
      if (!input.address) throw new HttpError(400, 'A delivery address is required')
    }

    const merged = new Map<string, number>()
    for (const it of input.items) merged.set(it.slug, (merged.get(it.slug) ?? 0) + it.qty)
    const rows = await q<any>(
      `select i.id, i.slug, i.name, i.active, bm.price, bm.available
         from menu_items i join branch_menu bm on bm.item_id = i.id and bm.branch_id = $1
        where i.slug = any($2)`, [b.id, [...merged.keys()]], c)
    const bySlug = new Map(rows.map((r) => [r.slug, r]))

    const lines = [...merged].map(([slug, qty]) => {
      const r = bySlug.get(slug)
      if (!r) throw new HttpError(400, `"${slug}" is not on this branch's menu`)
      if (!r.active || !r.available) throw new HttpError(409, `${r.name} is not available right now`)
      if (r.price === null) throw new HttpError(409, `${r.name} cannot be ordered yet`)
      if (qty > 50) throw new HttpError(400, `Too many of ${r.name}`)
      return { itemId: r.id as number, name: r.name as string, unit: r.price as number, qty, total: (r.price as number) * qty }
    })
    const subtotal = lines.reduce((s, l) => s + l.total, 0)
    if (subtotal < b.min_order) throw new HttpError(400, `Minimum order at this branch is ₦${b.min_order.toLocaleString('en-NG')}`)

    let fee = 0
    if (input.type === 'delivery') {
      const f = b.delivery_fee ?? settings.delivery.defaultFee
      if (f === null || f === undefined) throw new HttpError(400, 'Delivery is not available at this branch yet')
      const free = settings.delivery.freeAbove
      fee = free !== null && subtotal >= free ? 0 : f
    }
    const total = subtotal + fee

    const email = input.customer.email || null
    const cust = await one<any>(
      `insert into customers(name, phone, email) values ($1,$2,$3)
       on conflict (phone) do update set name = excluded.name, email = coalesce(excluded.email, customers.email)
       returning id`, [input.customer.name, phone, email], c)

    let code = orderCode()
    for (let i = 0; i < 5 && (await one('select 1 from orders where code = $1', [code], c)); i++) code = orderCode()

    const o = await one<any>(
      `insert into orders(code, branch_id, customer_id, type, customer_name, customer_phone, delivery_address, notes, subtotal, delivery_fee, total)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id, code, total`,
      [code, b.id, cust.id, input.type, input.customer.name, phone,
        input.type === 'delivery' ? input.address : null, input.notes || null, subtotal, fee, total], c)
    for (const l of lines) {
      await c.query('insert into order_items(order_id, item_id, name, unit_price, qty, line_total) values ($1,$2,$3,$4,$5,$6)',
        [o.id, l.itemId, l.name, l.unit, l.qty, l.total])
    }
    await c.query(`insert into order_events(order_id, status, note) values ($1,'pending_payment','Order placed')`, [o.id])
    return { id: o.id as number, code: o.code as string, total: o.total as number, subtotal, fee }
  })

  const reference = newReference()
  await q(`insert into payments(order_id, provider, reference, amount) values ($1,$2,$3,$4)`,
    [created.id, provider.name, reference, created.total])
  try {
    const { authorizationUrl } = await provider.init({
      reference, amount: created.total, orderCode: created.code,
      email: input.customer.email || config.paymentFallbackEmail,
    })
    return { ...created, payment: { reference, authorizationUrl } }
  } catch (e) {
    console.error(e)
    await q(`update payments set status = 'failed' where reference = $1`, [reference])
    throw new HttpError(502, 'Could not start the payment. Please try again.')
  }
}

const FLOW: Record<string, string[]> = {
  pending_payment: ['cancelled'],
  received: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export async function changeStatus(orderId: number, to: string, staffId: number, note?: string) {
  const r = await tx(async (c) => {
    const o = await one<any>('select * from orders where id = $1 for update', [orderId], c)
    if (!o) throw new HttpError(404, 'Order not found')
    if (!(FLOW[o.status] ?? []).includes(to)) throw new HttpError(409, `Cannot move an order from ${o.status} to ${to}`)
    if (to === 'out_for_delivery' && o.type !== 'delivery') throw new HttpError(409, 'Pickup orders are not sent out for delivery')
    if (to === 'completed' && o.type === 'delivery' && o.status === 'ready')
      throw new HttpError(409, 'Mark a delivery order as out for delivery first')
    const refund = to === 'cancelled' && o.payment_status === 'paid'
    await c.query(`update orders set status = $2, payment_status = case when $3 then 'refund_due' else payment_status end,
                   updated_at = now() where id = $1`, [orderId, to, refund])
    await c.query('insert into order_events(order_id, status, note, admin_id) values ($1,$2,$3,$4)', [orderId, to, note ?? null, staffId])
    return { branchId: o.branch_id as number, code: o.code as string, refund }
  })
  broadcast('order.updated', r.branchId, { id: orderId, code: r.code, status: to })
  return r
}
