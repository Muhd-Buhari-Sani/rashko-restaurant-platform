import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'

process.env.DATABASE_URL = 'postgres://rashko:rashko@localhost:5432/rashko_test'
process.env.PAYMENT_PROVIDER = 'mock'
process.env.ORDER_RATE_LIMIT = '1000'
process.env.WHATSAPP_PROVIDER = 'console'
process.env.SEED_ADMIN_EMAIL = 'admin@test.local'
process.env.SEED_ADMIN_PASSWORD = 'AdminPass123!'

const { pool, q } = await import('../src/db.ts')
const { seed } = await import('../src/seed.ts')
const { buildApp } = await import('../src/app.ts')

let server: Server
let base = ''
let admin = ''

async function call(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: r.status, body: json }
}
const login = async (email: string, password: string) => (await call('POST', '/api/admin/auth/login', { email, password })).body.token as string

const cust = { name: 'Aisha Bello', phone: '0803 123 4567' }
async function place(over: any = {}) {
  return call('POST', '/api/orders', {
    branch: 'zoo-road', type: 'pickup', customer: cust,
    items: [{ slug: 'mandi-chicken', qty: 2 }, { slug: 'samosa', qty: 4 }], ...over,
  })
}
const pay = (ref: string, result = 'success') => call('POST', `/api/payments/mock/${ref}`, { result })

before(async () => {
  await pool.query('drop schema public cascade; create schema public')
  await seed()
  server = buildApp().listen(0)
  base = `http://127.0.0.1:${(server.address() as any).port}`
  admin = await login('admin@test.local', 'AdminPass123!')
})
after(async () => { server.close(); await pool.end() })

test('seed: every branch has a menu, Kaintchkee is 6500, nothing invented', async () => {
  const b = await call('GET', '/api/branches')
  assert.equal(b.body.length, 3)
  assert.ok(b.body.every((x: any) => x.hasMenu))
  assert.ok(b.body.every((x: any) => x.deliveryEnabled === false), 'delivery stays off until the admin sets a fee')
  const m = await call('GET', '/api/branches/kano-club/menu')
  const k = m.body.categories.flatMap((c: any) => c.items).find((i: any) => i.slug === 'kaintchkee-with-rice')
  assert.equal(k.price, 6500)
  const rz = await call('GET', '/api/branches/rijiya-zaki/menu')
  const slugs = rz.body.categories.flatMap((c: any) => c.items.map((i: any) => i.slug))
  assert.ok(slugs.includes('banana-juice') && slugs.includes('masoub-with-milk'))
  assert.equal(new Set(slugs).size, slugs.length, 'no duplicate dishes')
})

test('order total is computed from database prices, client price is ignored', async () => {
  const r = await call('POST', '/api/orders', {
    branch: 'zoo-road', type: 'pickup', customer: cust,
    items: [{ slug: 'mandi-chicken', qty: 2, price: 1 }, { slug: 'samosa', qty: 4 }], total: 1, deliveryFee: 0,
  })
  assert.equal(r.status, 201)
  assert.equal(r.body.total, 2 * 5500 + 4 * 500)
  assert.ok(r.body.payment.url.includes(r.body.payment.reference))
  assert.match(r.body.code, /^RSK-[A-Z2-9]{6}$/)
})

test('validation and menu rules', async () => {
  assert.equal((await place({ items: [{ slug: 'nope', qty: 1 }] })).status, 400)
  assert.equal((await place({ items: [] })).status, 400)
  assert.equal((await place({ items: [{ slug: 'mandi-chicken', qty: 0 }] })).status, 400)
  assert.equal((await place({ customer: { name: 'A', phone: '123' } })).status, 400)
  assert.equal((await place({ branch: 'nowhere' })).status, 404)
  // juice is on the Zoo Road menu but not Kano Club's
  assert.equal((await place({ branch: 'kano-club', items: [{ slug: 'banana-juice', qty: 1 }] })).status, 400)
})

test('delivery is refused until enabled with a fee, then fee is added server-side', async () => {
  const d = { type: 'delivery', address: '12 Bello Road, Nasarawa, Kano' }
  assert.equal((await place(d)).status, 400)
  const bs = (await call('GET', '/api/admin/branches', undefined, admin)).body
  const zoo = bs.find((b: any) => b.slug === 'zoo-road')
  assert.equal((await call('PATCH', `/api/admin/branches/${zoo.id}`, { deliveryEnabled: true }, admin)).status, 200)
  assert.equal((await place(d)).status, 400, 'enabled but no fee configured anywhere')
  await call('PUT', '/api/admin/settings', { delivery: { defaultFee: 1500 } }, admin)
  const r = await place(d)
  assert.equal(r.status, 201)
  assert.equal(r.body.deliveryFee, 1500)
  assert.equal(r.body.total, 13000 + 1500)
  assert.equal((await place({ type: 'delivery' })).status, 400, 'address required')
  await call('PUT', '/api/admin/settings', { delivery: { freeAbove: 10000 } }, admin)
  assert.equal((await place(d)).body.deliveryFee, 0)
  await call('PUT', '/api/admin/settings', { delivery: { freeAbove: null } }, admin)
})

test('payment: unpaid order is hidden, paying once settles once', async () => {
  const o = (await place()).body
  const before = await call('GET', '/api/admin/orders', undefined, admin)
  assert.ok(!before.body.rows.some((r: any) => r.code === o.code))
  const p1 = await pay(o.payment.reference)
  assert.equal(p1.body.orderStatus, 'received')
  const p2 = await call('GET', `/api/payments/verify/${o.payment.reference}`)
  assert.equal(p2.body.paymentStatus, 'success')
  const ev = await q(`select count(*)::int n from order_events e join orders o on o.id = e.order_id where o.code = $1 and e.status = 'received'`, [o.code])
  assert.equal(ev[0].n, 1)
  const after = await call('GET', '/api/admin/orders', undefined, admin)
  assert.ok(after.body.rows.some((r: any) => r.code === o.code))
  const failed = (await place()).body
  const f = await pay(failed.payment.reference, 'failed')
  assert.equal(f.body.paymentStatus, 'failed')
  assert.equal(f.body.orderStatus, 'pending_payment')
})

test('status flow enforces order and type rules', async () => {
  const o = (await place()).body
  await pay(o.payment.reference)
  const list = (await call('GET', `/api/admin/orders?q=${o.code}`, undefined, admin)).body.rows
  const id = list[0].id
  const set = (status: string) => call('POST', `/api/admin/orders/${id}/status`, { status }, admin)
  assert.equal((await set('completed')).status, 409, 'cannot skip steps')
  assert.equal((await set('preparing')).status, 200)
  assert.equal((await set('ready')).status, 200)
  assert.equal((await set('out_for_delivery')).status, 409, 'pickup is not delivered')
  assert.equal((await set('completed')).status, 200)
  assert.equal((await set('cancelled')).status, 409, 'finished orders are final')
  const detail = (await call('GET', `/api/admin/orders/${id}`, undefined, admin)).body
  assert.deepEqual(detail.events.map((e: any) => e.status), ['pending_payment', 'received', 'preparing', 'ready', 'completed'])
})

test('delivery order must go out for delivery before completing', async () => {
  const o = (await place({ type: 'delivery', address: '5 Gidan Murtala, Kano' })).body
  await pay(o.payment.reference)
  const id = (await call('GET', `/api/admin/orders?q=${o.code}`, undefined, admin)).body.rows[0].id
  const set = (status: string) => call('POST', `/api/admin/orders/${id}/status`, { status }, admin)
  await set('preparing'); await set('ready')
  assert.equal((await set('completed')).status, 409)
  assert.equal((await set('out_for_delivery')).status, 200)
  assert.equal((await set('completed')).status, 200)
})

test('cancelling a paid order flags a refund, which an admin can record', async () => {
  const o = (await place()).body
  await pay(o.payment.reference)
  const id = (await call('GET', `/api/admin/orders?q=${o.code}`, undefined, admin)).body.rows[0].id
  const c = await call('POST', `/api/admin/orders/${id}/status`, { status: 'cancelled', note: 'Out of stock' }, admin)
  assert.equal(c.body.refundDue, true)
  const pays = (await call('GET', `/api/admin/payments?q=${o.payment.reference}`, undefined, admin)).body
  assert.equal(pays.rows[0].orderPaymentStatus, 'refund_due')
  assert.equal((await call('POST', `/api/admin/payments/${pays.rows[0].id}/mark-refunded`, {}, admin)).status, 200)
  const d = (await call('GET', `/api/admin/orders/${id}`, undefined, admin)).body
  assert.equal(d.payment_status, 'refunded')
})

test('price changes affect new orders, never past ones', async () => {
  const o = (await place({ items: [{ slug: 'samosa', qty: 10 }] })).body
  await pay(o.payment.reference)
  const zoo = (await call('GET', '/api/admin/branches', undefined, admin)).body.find((b: any) => b.slug === 'zoo-road')
  const item = (await call('GET', '/api/admin/menu/items', undefined, admin)).body.find((i: any) => i.slug === 'samosa')
  const put = await call('PUT', `/api/admin/branches/${zoo.id}/menu/${item.id}`, { price: 700 }, admin)
  assert.equal(put.body.price, 700)
  const o2 = (await place({ items: [{ slug: 'samosa', qty: 10 }] })).body
  assert.equal(o2.total, 7000)
  const old = (await call('GET', `/api/admin/orders?q=${o.code}`, undefined, admin)).body.rows[0]
  assert.equal(old.total, 5000)
  // availability off blocks ordering
  await call('PUT', `/api/admin/branches/${zoo.id}/menu/${item.id}`, { available: false }, admin)
  assert.equal((await place({ items: [{ slug: 'samosa', qty: 1 }] })).status, 409)
  const m = (await call('GET', '/api/branches/zoo-road/menu')).body.categories.flatMap((c: any) => c.items).find((i: any) => i.slug === 'samosa')
  assert.equal(m.available, false)
  await call('PUT', `/api/admin/branches/${zoo.id}/menu/${item.id}`, { available: true, price: 500 }, admin)
})

test('a null price cannot be ordered, and setting price null is explicit', async () => {
  const zoo = (await call('GET', '/api/admin/branches', undefined, admin)).body.find((b: any) => b.slug === 'zoo-road')
  const item = (await call('GET', '/api/admin/menu/items', undefined, admin)).body.find((i: any) => i.slug === 'chips')
  await call('PUT', `/api/admin/branches/${zoo.id}/menu/${item.id}`, { price: null }, admin)
  assert.equal((await place({ items: [{ slug: 'chips', qty: 1 }] })).status, 409)
  await call('PUT', `/api/admin/branches/${zoo.id}/menu/${item.id}`, { price: 3500 }, admin)
})

test('customers: same person in two phone formats is one customer', async () => {
  const o = (await place({ customer: { name: 'Aisha Bello', phone: '+2348031234567' } })).body
  await pay(o.payment.reference)
  const c = (await call('GET', '/api/admin/customers?q=Aisha', undefined, admin)).body
  assert.equal(c.total, 1)
  assert.ok(c.rows[0].orders >= 2 && c.rows[0].spent > 0)
  assert.equal(c.rows[0].phone, '+2348031234567')
  const d = await call('GET', `/api/admin/customers/${c.rows[0].id}`, undefined, admin)
  assert.ok(d.body.orders.length >= 2)
})

test('tracking needs the right phone number', async () => {
  const o = (await place()).body
  assert.equal((await call('GET', `/api/orders/track/${o.code}?phone=08031234567`)).status, 200)
  assert.equal((await call('GET', `/api/orders/track/${o.code}?phone=08099999999`)).status, 404)
  assert.equal((await call('GET', `/api/orders/track/RSK-ZZZZZZ?phone=08031234567`)).status, 404)
  const t = (await call('GET', `/api/orders/track/${o.code}?phone=08031234567`)).body
  assert.equal(t.customer_phone, undefined)
})

test('overview adds up', async () => {
  const ov = (await call('GET', '/api/admin/overview?days=30', undefined, admin)).body
  const paid = await q(`select coalesce(sum(total),0)::int s, count(*)::int n from orders where payment_status = 'paid' and status <> 'cancelled'`)
  assert.equal(ov.totals.revenue, paid[0].s)
  assert.equal(ov.daily.reduce((s: number, d: any) => s + d.revenue, 0), paid[0].s)
  assert.ok(ov.topItems.length > 0 && ov.byBranch.length === 3)
})

test('access control: auth required, roles and branches enforced', async () => {
  assert.equal((await call('GET', '/api/admin/orders')).status, 401)
  assert.equal((await call('GET', '/api/admin/orders', undefined, 'garbage')).status, 401)
  assert.equal((await call('POST', '/api/admin/auth/login', { email: 'admin@test.local', password: 'wrong' })).status, 401)

  const branches = (await call('GET', '/api/admin/branches', undefined, admin)).body
  const zoo = branches.find((b: any) => b.slug === 'zoo-road'), club = branches.find((b: any) => b.slug === 'kano-club')
  assert.equal((await call('POST', '/api/admin/users', { email: 'mgr@test.local', name: 'Club Manager', password: 'ManagerPass1!', role: 'branch_manager', branchId: club.id }, admin)).status, 201)
  assert.equal((await call('POST', '/api/admin/users', { email: 'ord@test.local', name: 'Order Desk', password: 'OrderDeskPass1!', role: 'order_manager', branchId: zoo.id }, admin)).status, 201)
  assert.equal((await call('POST', '/api/admin/users', { email: 'x@test.local', name: 'No Branch', password: 'SomethingLong1!', role: 'branch_manager', branchId: null }, admin)).status, 400)

  const mgr = await login('mgr@test.local', 'ManagerPass1!')
  const ord = await login('ord@test.local', 'OrderDeskPass1!')

  const mine = (await call('GET', '/api/admin/branches', undefined, mgr)).body
  assert.deepEqual(mine.map((b: any) => b.slug), ['kano-club'])
  assert.equal((await call('PATCH', `/api/admin/branches/${zoo.id}`, { hours: 'x' }, mgr)).status, 403)
  assert.equal((await call('PATCH', `/api/admin/branches/${club.id}`, { hours: 'Daily, 9:00 AM – 11:00 PM' }, mgr)).status, 200)
  assert.equal((await call('PATCH', `/api/admin/branches/${club.id}`, { active: false }, mgr)).status, 403)
  assert.equal((await call('GET', '/api/admin/settings', undefined, mgr)).status, 403)
  assert.equal((await call('GET', '/api/admin/users', undefined, mgr)).status, 403)
  assert.equal((await call('POST', '/api/admin/menu/items', { name: 'Secret Dish' }, mgr)).status, 403)

  // order manager: orders only, only their branch
  assert.equal((await call('GET', '/api/admin/payments', undefined, ord)).status, 403)
  assert.equal((await call('GET', '/api/admin/customers', undefined, ord)).status, 403)
  const clubOrder = (await place({ branch: 'kano-club', items: [{ slug: 'mandi-meat', qty: 1 }] })).body
  await pay(clubOrder.payment.reference)
  const zooList = (await call('GET', '/api/admin/orders', undefined, ord)).body.rows
  assert.ok(zooList.length > 0 && zooList.every((r: any) => r.branch === 'Zoo Road'))
  const clubId = (await call('GET', `/api/admin/orders?q=${clubOrder.code}`, undefined, admin)).body.rows[0].id
  assert.equal((await call('GET', `/api/admin/orders/${clubId}`, undefined, ord)).status, 403)
  assert.equal((await call('POST', `/api/admin/orders/${clubId}/status`, { status: 'preparing' }, ord)).status, 403)
  assert.equal((await call('POST', `/api/admin/orders/${clubId}/status`, { status: 'preparing' }, mgr)).status, 200)

  // deactivating a user cuts access immediately, even with a valid token
  const uid = (await call('GET', '/api/admin/users', undefined, admin)).body.find((u: any) => u.email === 'ord@test.local').id
  await call('PATCH', `/api/admin/users/${uid}`, { active: false }, admin)
  assert.equal((await call('GET', '/api/admin/orders', undefined, ord)).status, 401)
  // admin cannot lock themselves out
  const me = (await call('GET', '/api/admin/me', undefined, admin)).body
  assert.equal((await call('PATCH', `/api/admin/users/${me.id}`, { active: false }, admin)).status, 400)
})

test('order creation is rate limited per client', async () => {
  // separate app instance with the real default limit
  process.env.ORDER_RATE_LIMIT = '3'
  // @ts-expect-error query string forces a fresh module instance with the new limit
  const mod = await import('../src/routes/public.ts?limit')
  const express = (await import('express')).default
  const app = express(); app.use(express.json()); app.use('/api', mod.pub)
  const s = app.listen(0); const b = `http://127.0.0.1:${(s.address() as any).port}`
  const codes: number[] = []
  for (let i = 0; i < 5; i++) {
    const r = await fetch(b + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    codes.push(r.status)
  }
  s.close()
  assert.deepEqual(codes, [400, 400, 400, 429, 429])
})

test('webhook rejects a bad signature', async () => {
  const r = await fetch(base + '/api/webhooks/paystack', {
    method: 'POST', headers: { 'x-paystack-signature': 'abc', 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'charge.success', data: { reference: 'x' } }),
  })
  assert.equal(r.status, 401)
})

test('settings round-trip and WhatsApp number validation', async () => {
  const bad = await call('PUT', '/api/admin/settings', { notifications: { recipients: ['08012345678'] } }, admin)
  assert.equal(bad.status, 400)
  const ok = await call('PUT', '/api/admin/settings', { notifications: { whatsappEnabled: true, recipients: ['+2348012345678'] }, restaurant: { phone: '+2348088038055' } }, admin)
  assert.equal(ok.status, 200)
  assert.equal(ok.body.restaurant.name, 'Rashko Restaurant')
  const o = (await place()).body
  await pay(o.payment.reference)
  await new Promise((r) => setTimeout(r, 200))
  const n = await q(`select n.status from notifications n join orders o on o.id = n.order_id where o.code = $1`, [o.code])
  assert.equal(n.length, 1)
  assert.equal(n[0].status, 'logged')
})
