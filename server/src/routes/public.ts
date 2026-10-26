import { Router, raw } from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { one, q } from '../db.ts'
import { config } from '../config.ts'
import { HttpError, normalizePhone } from '../util.ts'
import { createOrder, createOrderSchema } from '../orders.ts'
import { settle } from '../payments.ts'
import { getSettings } from '../settings.ts'

export const pub = Router()

const orderLimit = rateLimit({ windowMs: 10 * 60_000, limit: Number(process.env.ORDER_RATE_LIMIT ?? 20), standardHeaders: true, legacyHeaders: false })
const trackLimit = rateLimit({ windowMs: 10 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false })

pub.get('/health', (_req, res) => res.json({ ok: true }))

pub.get('/branches', async (_req, res) => {
  const rows = await q(`select slug, name, address, phone, hours, services, services_note "servicesNote",
      pickup_enabled "pickupEnabled", delivery_enabled "deliveryEnabled", delivery_fee "deliveryFee", min_order "minOrder",
      exists(select 1 from branch_menu bm where bm.branch_id = b.id) "hasMenu"
    from branches b where active order by id`)
  res.json(rows)
})

pub.get('/branches/:slug/menu', async (req, res) => {
  const b = await one<any>('select id, name from branches where slug = $1 and active', [req.params.slug])
  if (!b) throw new HttpError(404, 'Branch not found')
  const rows = await q(
    `select i.slug, i.name, i.note, nullif(trim(i.image_url), '') "imageUrl", bm.price, bm.available and i.active as available, bm.featured,
            c.slug "categorySlug", c.name "categoryName", c.blurb "categoryBlurb", c.sort "categorySort", bm.sort
       from branch_menu bm join menu_items i on i.id = bm.item_id left join categories c on c.id = bm.category_id
      where bm.branch_id = $1 and i.active order by c.sort nulls last, bm.sort, i.name`, [b.id])
  const cats = new Map<string, any>()
  for (const r of rows) {
    const key = r.categorySlug ?? 'other'
    if (!cats.has(key)) cats.set(key, { slug: key, name: r.categoryName ?? 'Other', blurb: r.categoryBlurb, items: [] })
    cats.get(key).items.push({ slug: r.slug, name: r.name, note: r.note, imageUrl: r.imageUrl, price: r.price, available: r.available && r.price !== null, featured: r.featured })
  }
  res.json({ branch: { slug: req.params.slug, name: b.name }, categories: [...cats.values()] })
})

pub.get('/settings', async (_req, res) => {
  const s = await getSettings()
  // Only public facts about payments — never the key. The site uses this to ask for an
  // email when Paystack needs one and to label the checkout honestly.
  res.json({
    restaurant: s.restaurant,
    delivery: { freeAbove: s.delivery.freeAbove },
    payments: { provider: config.paymentProvider, testMode: config.paymentTestMode },
    // Whether checkout should offer WhatsApp updates. With the console provider the
    // messages are only logged, so the site can say so instead of promising delivery.
    notifications: {
      whatsappUpdates: s.notifications.customerUpdates && (config.whatsappProvider === 'cloud' || !config.prod),
      simulated: config.whatsappProvider !== 'cloud',
    },
  })
})

pub.post('/orders', orderLimit, async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Please check your order details', parsed.error.flatten())
  const o = await createOrder(parsed.data)
  res.status(201).json({
    code: o.code, subtotal: o.subtotal, deliveryFee: o.fee, total: o.total,
    payment: { reference: o.payment.reference, url: o.payment.authorizationUrl },
  })
})

async function trackable(code: string, phone: string) {
  const o = await one<any>(
    `select o.id, o.code, o.type, o.status, o.payment_status "paymentStatus", o.subtotal, o.delivery_fee "deliveryFee", o.total,
            o.created_at "createdAt", o.delivery_address "deliveryAddress", o.whatsapp_opt_in "whatsappOptIn", o.customer_phone, b.name branch
       from orders o join branches b on b.id = o.branch_id where o.code = $1`, [code.toUpperCase()])
  let p: string | null = null
  try { p = normalizePhone(phone) } catch { /* treated as a miss below */ }
  // Same message for "no such order" and "wrong phone" so codes cannot be probed.
  if (!o || !p || o.customer_phone !== p) throw new HttpError(404, 'We could not find that order. Check the code and phone number.')
  const items = await q('select name, unit_price "unitPrice", qty, line_total "lineTotal" from order_items where order_id = $1 order by id', [o.id])
  const events = await q('select status, at from order_events where order_id = $1 order by id', [o.id])
  const { customer_phone: _drop, id: _id, ...safe } = o
  return { ...safe, items, events }
}

pub.get('/orders/track/:code', trackLimit, async (req, res) => {
  res.json(await trackable(String(req.params.code), String(req.query.phone ?? '')))
})

// Customer comes back from the payment page; the server asks the provider, it does not trust the browser.
pub.get('/payments/verify/:reference', trackLimit, async (req, res) => {
  const r = await settle(String(req.params.reference))
  if (!r) throw new HttpError(404, 'Unknown payment')
  res.json({ code: r.order.code, paymentStatus: r.payment.status, orderStatus: r.order.status })
})

// Development helper so the whole flow can be tried without a payment provider.
// Never mounted in production, even if the provider is misconfigured back to "mock":
// it would let anyone mark an unpaid order as paid.
if (config.paymentProvider === 'mock' && !config.prod) {
  pub.post('/payments/mock/:reference', async (req, res) => {
    const result = req.body?.result === 'failed' ? 'failed' : 'success'
    const rows = await q(`update payments set raw = jsonb_build_object('mock', $2::text) where reference = $1 and status = 'pending' returning id`,
      [req.params.reference, result])
    if (!rows.length) throw new HttpError(404, 'No pending payment with that reference')
    const r = await settle(String(req.params.reference))
    res.json({ code: r!.order.code, paymentStatus: r!.payment.status, orderStatus: r!.order.status })
  })
}

export const webhooks = Router()
webhooks.post('/paystack', raw({ type: '*/*', limit: '200kb' }), async (req, res) => {
  const body = req.body as Buffer
  const sig = String(req.headers['x-paystack-signature'] ?? '')
  const expected = createHmac('sha512', config.paystackSecret).update(body).digest('hex')
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (!config.paystackSecret || a.length !== b.length || !timingSafeEqual(a, b)) return res.sendStatus(401)
  const evt = JSON.parse(body.toString('utf8'))
  if (evt.event === 'charge.success' && evt.data?.reference) await settle(String(evt.data.reference))
  res.sendStatus(200)
})
