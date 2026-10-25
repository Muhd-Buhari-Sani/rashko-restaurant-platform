import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { one, q, tx } from '../db.ts'
import { HttpError, slugify } from '../util.ts'
import { allow, assertBranch, authenticate, scopeBranch, signToken } from '../auth.ts'
import { addClient } from '../events.ts'
import { changeStatus } from '../orders.ts'
import { getSettings, putSettings } from '../settings.ts'

export const admin = Router()

const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false })
const ALL = ['administrator', 'branch_manager', 'order_manager'] as const
const MGMT = ['administrator', 'branch_manager'] as const
const parse = <T extends z.ZodTypeAny>(s: T, v: unknown): z.infer<T> => s.parse(v)
const page = (req: any) => ({
  limit: Math.min(Math.max(Number(req.query.limit) || 25, 1), 100),
  offset: Math.max(Number(req.query.offset) || 0, 0),
})
const id = (v: unknown) => { const n = Number(v); if (!Number.isInteger(n)) throw new HttpError(400, 'Bad id'); return n }

// ---------- auth ----------
admin.post('/auth/login', loginLimit, async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body)
  const u = await one<any>('select * from admin_users where lower(email) = lower($1)', [email])
  const ok = u && u.active && (await bcrypt.compare(password, u.password_hash))
  if (!ok) throw new HttpError(401, 'Wrong email or password')
  const staff = { id: u.id, role: u.role, branchId: u.branch_id, name: u.name }
  res.json({ token: signToken(staff), user: { ...staff, email: u.email } })
})

admin.use(authenticate)

admin.get('/me', (req, res) => res.json(req.staff))

admin.get('/events', allow(...ALL), (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write('event: ready\ndata: {}\n\n')
  const keep = setInterval(() => res.write(': ping\n\n'), 25_000)
  res.on('close', () => clearInterval(keep))
  addClient(res, scopeBranch(req))
})

// ---------- overview ----------
admin.get('/overview', allow(...ALL), async (req, res) => {
  const scoped = scopeBranch(req)
  const branch = scoped ?? (req.query.branch ? id(String(req.query.branch)) : null)
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
  const p = [branch, days]
  const W = `o.created_at >= now() - ($2 || ' days')::interval and ($1::int is null or o.branch_id = $1)`
  const PAID = `o.payment_status = 'paid' and o.status <> 'cancelled'`

  const [totals] = await q(`
    select count(*) filter (where o.status <> 'pending_payment')::int orders,
           coalesce(sum(o.total) filter (where ${PAID}), 0)::int revenue,
           coalesce(round(avg(o.total) filter (where ${PAID})), 0)::int "avgOrder",
           count(*) filter (where o.status = 'cancelled')::int cancelled
      from orders o where ${W}`, p)
  const byStatus = await q(`select o.status, count(*)::int n from orders o where ${W} group by 1`, p)
  const live = await q(`select o.status, count(*)::int n from orders o
      where o.status in ('received','preparing','ready','out_for_delivery') and ($1::int is null or o.branch_id = $1) group by 1`, [branch])
  const daily = await q(`
    select to_char(date_trunc('day', o.created_at at time zone 'Africa/Lagos'), 'YYYY-MM-DD') as day,
           count(*) filter (where o.status <> 'pending_payment')::int orders,
           coalesce(sum(o.total) filter (where ${PAID}), 0)::int revenue
      from orders o where ${W} group by 1 order by 1`, p)
  const topItems = await q(`
    select oi.name, sum(oi.qty)::int qty, sum(oi.line_total)::int revenue
      from order_items oi join orders o on o.id = oi.order_id where ${W} and ${PAID} group by oi.name order by qty desc limit 8`, p)
  const byBranch = scoped ? [] : await q(`
    select b.name, count(o.id) filter (where o.status <> 'pending_payment')::int orders,
           coalesce(sum(o.total) filter (where ${PAID}), 0)::int revenue
      from branches b left join orders o on o.branch_id = b.id and o.created_at >= now() - ($1 || ' days')::interval
     group by b.id, b.name order by b.id`, [days])
  const [pay] = await q(`
    select count(*) filter (where p.status = 'success')::int success, count(*) filter (where p.status in ('failed','abandoned'))::int failed
      from payments p join orders o on o.id = p.order_id where ${W}`, p)
  const byType = await q(`select o.type, count(*)::int n from orders o where ${W} and ${PAID} group by 1`, p)

  res.json({ days, totals, byStatus, live, daily, topItems, byBranch, payments: pay, byType })
})

// ---------- orders ----------
admin.get('/orders', allow(...ALL), async (req, res) => {
  const scoped = scopeBranch(req)
  const { limit, offset } = page(req)
  const where: string[] = []; const p: unknown[] = []
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)) }
  if (scoped !== null) add('o.branch_id = ?', scoped)
  else if (req.query.branch) add('o.branch_id = ?', id(String(req.query.branch)))
  if (req.query.status) add('o.status = ?', String(req.query.status))
  else if (req.query.includeUnpaid !== '1') where.push(`o.status <> 'pending_payment'`)
  if (req.query.paymentStatus) add('o.payment_status = ?', String(req.query.paymentStatus))
  if (req.query.type) add('o.type = ?', String(req.query.type))
  if (req.query.from) add('o.created_at >= ?::timestamptz', String(req.query.from))
  if (req.query.to) add('o.created_at < ?::timestamptz', String(req.query.to))
  if (req.query.q) { p.push(`%${req.query.q}%`); where.push(`(o.code ilike $${p.length} or o.customer_name ilike $${p.length} or o.customer_phone like $${p.length})`) }
  const sqlWhere = where.length ? 'where ' + where.join(' and ') : ''
  const [{ n }] = await q(`select count(*)::int n from orders o ${sqlWhere}`, p)
  const rows = await q(
    `select o.id, o.code, o.type, o.status, o.payment_status "paymentStatus", o.total, o.customer_name "customerName",
            o.customer_phone "customerPhone", o.created_at "createdAt", b.name branch,
            (select string_agg(qty || 'x ' || name, ', ') from order_items where order_id = o.id) items
       from orders o join branches b on b.id = o.branch_id ${sqlWhere}
      order by o.created_at desc limit ${limit} offset ${offset}`, p)
  res.json({ total: n, rows })
})

admin.get('/orders/:id', allow(...ALL), async (req, res) => {
  const o = await one<any>(
    `select o.*, b.name branch_name from orders o join branches b on b.id = o.branch_id where o.id = $1`, [id(req.params.id)])
  if (!o) throw new HttpError(404, 'Order not found')
  assertBranch(req, o.branch_id)
  const items = await q('select name, unit_price, qty, line_total from order_items where order_id = $1 order by id', [o.id])
  const events = await q(
    `select e.status, e.note, e.at, a.name "by" from order_events e left join admin_users a on a.id = e.admin_id where e.order_id = $1 order by e.id`, [o.id])
  const payments = await q('select id, provider, reference, amount, status, channel, created_at, paid_at from payments where order_id = $1 order by id', [o.id])
  res.json({ ...o, items, events, payments })
})

admin.post('/orders/:id/status', allow(...ALL), async (req, res) => {
  const { status, note } = parse(z.object({
    status: z.enum(['preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled']),
    note: z.string().max(300).optional(),
  }), req.body)
  const o = await one<any>('select branch_id from orders where id = $1', [id(req.params.id)])
  if (!o) throw new HttpError(404, 'Order not found')
  assertBranch(req, o.branch_id)
  const r = await changeStatus(id(req.params.id), status, req.staff!.id, note)
  res.json({ ok: true, refundDue: r.refund })
})

// ---------- menu (the shared catalogue; prices are per branch) ----------
admin.get('/categories', allow(...MGMT), async (_req, res) => res.json(await q('select * from categories order by sort, name')))

admin.post('/categories', allow('administrator'), async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(2).max(60), blurb: z.string().max(200).optional(), sort: z.number().int().optional() }), req.body)
  res.status(201).json(await one('insert into categories(slug, name, blurb, sort) values ($1,$2,$3,coalesce($4,100)) returning *', [slugify(b.name), b.name, b.blurb ?? null, b.sort ?? null]))
})

admin.patch('/categories/:id', allow('administrator'), async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(2).max(60), blurb: z.string().max(200).nullable(), sort: z.number().int() }).partial(), req.body)
  const r = await one(`update categories set name = coalesce($2, name), blurb = case when $3::boolean then $4 else blurb end, sort = coalesce($5, sort) where id = $1 returning *`,
    [id(req.params.id), b.name ?? null, 'blurb' in b, b.blurb ?? null, b.sort ?? null])
  if (!r) throw new HttpError(404, 'Category not found')
  res.json(r)
})

admin.get('/menu/items', allow(...MGMT), async (req, res) => {
  const scoped = scopeBranch(req)
  const rows = await q(`
    select i.id, i.slug, i.name, i.note, i.image_url "imageUrl", i.active,
      coalesce(json_agg(json_build_object('branchId', bm.branch_id, 'price', bm.price, 'available', bm.available,
               'categoryId', bm.category_id, 'featured', bm.featured) order by bm.branch_id)
               filter (where bm.branch_id is not null and ($1::int is null or bm.branch_id = $1)), '[]') branches
      from menu_items i left join branch_menu bm on bm.item_id = i.id group by i.id order by i.name`, [scoped])
  res.json(rows)
})

const itemBody = z.object({
  name: z.string().trim().min(2).max(100),
  note: z.string().max(200).nullable().optional(),
  imageUrl: z.string().max(300).nullable().optional(),
  active: z.boolean().optional(),
})

admin.post('/menu/items', allow('administrator'), async (req, res) => {
  const b = parse(itemBody, req.body)
  res.status(201).json(await one(
    'insert into menu_items(slug, name, note, image_url) values ($1,$2,$3,$4) returning id, slug, name, note, image_url "imageUrl", active',
    [slugify(b.name), b.name, b.note ?? null, b.imageUrl ?? null]))
})

admin.patch('/menu/items/:id', allow('administrator'), async (req, res) => {
  const b = parse(itemBody.partial(), req.body)
  const r = await one(
    `update menu_items set name = coalesce($2, name), note = case when $3::boolean then $4 else note end,
       image_url = case when $5::boolean then $6 else image_url end, active = coalesce($7, active) where id = $1
     returning id, slug, name, note, image_url "imageUrl", active`,
    [id(req.params.id), b.name ?? null, 'note' in b, b.note ?? null, 'imageUrl' in b, b.imageUrl ?? null, b.active ?? null])
  if (!r) throw new HttpError(404, 'Item not found')
  res.json(r)
})

admin.delete('/menu/items/:id', allow('administrator'), async (req, res) => {
  const r = await q('delete from menu_items where id = $1 returning id', [id(req.params.id)])
  if (!r.length) throw new HttpError(404, 'Item not found')
  res.json({ ok: true }) // past orders keep their own copy of the name and price
})

// ---------- branches and their menus ----------
const branchBody = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().max(300).nullable(),
  phone: z.string().max(40).nullable(),
  hours: z.string().max(120).nullable(),
  services: z.array(z.string().max(40)).max(10).nullable(),
  servicesNote: z.string().max(200).nullable(),
  active: z.boolean(),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  deliveryFee: z.number().int().min(0).nullable(),
  minOrder: z.number().int().min(0),
})
const BRANCH_COLS = `id, slug, name, address, phone, hours, services, services_note "servicesNote", active,
  pickup_enabled "pickupEnabled", delivery_enabled "deliveryEnabled", delivery_fee "deliveryFee", min_order "minOrder"`

admin.get('/branches', allow(...MGMT), async (req, res) => {
  res.json(await q(`select ${BRANCH_COLS},
      (select count(*)::int from branch_menu bm where bm.branch_id = b.id) "menuItems"
    from branches b where ($1::int is null or id = $1) order by id`, [scopeBranch(req)]))
})

admin.post('/branches', allow('administrator'), async (req, res) => {
  const b = parse(branchBody.partial({ address: true, phone: true, hours: true, services: true, servicesNote: true, active: true, pickupEnabled: true, deliveryEnabled: true, deliveryFee: true, minOrder: true }), req.body)
  res.status(201).json(await one(
    `insert into branches(slug, name, address, phone, hours, services, services_note, active, pickup_enabled, delivery_enabled, delivery_fee, min_order)
     values ($1,$2,$3,$4,$5,$6,$7,coalesce($8,true),coalesce($9,true),coalesce($10,false),$11,coalesce($12,0)) returning ${BRANCH_COLS}`,
    [slugify(b.name), b.name, b.address ?? null, b.phone ?? null, b.hours ?? null, b.services ?? null, b.servicesNote ?? null,
      b.active ?? null, b.pickupEnabled ?? null, b.deliveryEnabled ?? null, b.deliveryFee ?? null, b.minOrder ?? null]))
})

admin.patch('/branches/:id', allow(...MGMT), async (req, res) => {
  const bid = id(req.params.id)
  assertBranch(req, bid)
  const b = parse(branchBody.partial(), req.body)
  if (req.staff!.role !== 'administrator' && ('active' in b || 'name' in b))
    throw new HttpError(403, 'Only an administrator can rename or deactivate a branch')
  const cols: Record<string, string> = { name: 'name', address: 'address', phone: 'phone', hours: 'hours', services: 'services',
    servicesNote: 'services_note', active: 'active', pickupEnabled: 'pickup_enabled', deliveryEnabled: 'delivery_enabled',
    deliveryFee: 'delivery_fee', minOrder: 'min_order' }
  const sets: string[] = []; const p: unknown[] = [bid]
  for (const [k, v] of Object.entries(b)) { p.push(v); sets.push(`${cols[k]} = $${p.length}`) }
  if (!sets.length) throw new HttpError(400, 'Nothing to update')
  const r = await one(`update branches set ${sets.join(', ')} where id = $1 returning ${BRANCH_COLS}`, p)
  if (!r) throw new HttpError(404, 'Branch not found')
  res.json(r)
})

admin.get('/branches/:id/menu', allow(...MGMT), async (req, res) => {
  const bid = id(req.params.id); assertBranch(req, bid)
  res.json(await q(`
    select i.id "itemId", i.slug, i.name, i.active "itemActive", bm.price, bm.available, bm.featured, bm.category_id "categoryId", c.name "categoryName", bm.sort
      from branch_menu bm join menu_items i on i.id = bm.item_id left join categories c on c.id = bm.category_id
     where bm.branch_id = $1 order by c.sort nulls last, bm.sort, i.name`, [bid]))
})

// Add an item to a branch menu or change its price / availability / category.
admin.put('/branches/:id/menu/:itemId', allow(...MGMT), async (req, res) => {
  const bid = id(req.params.id); assertBranch(req, bid)
  const b = parse(z.object({
    price: z.number().int().min(0).max(10_000_000).nullable().optional(),
    available: z.boolean().optional(), featured: z.boolean().optional(),
    categoryId: z.number().int().nullable().optional(), sort: z.number().int().optional(),
  }), req.body)
  const r = await one(`
    insert into branch_menu(branch_id, item_id, price, available, featured, category_id, sort)
    values ($1,$2,$3,coalesce($4,true),coalesce($5,false),$6,coalesce($7,0))
    on conflict (branch_id, item_id) do update set
      price = case when $8::boolean then $3 else branch_menu.price end,
      available = coalesce($4, branch_menu.available), featured = coalesce($5, branch_menu.featured),
      category_id = case when $9::boolean then $6 else branch_menu.category_id end, sort = coalesce($7, branch_menu.sort)
    returning item_id "itemId", price, available, featured, category_id "categoryId"`,
    [bid, id(req.params.itemId), b.price ?? null, b.available ?? null, b.featured ?? null, b.categoryId ?? null, b.sort ?? null, 'price' in b, 'categoryId' in b])
  res.json(r)
})

admin.delete('/branches/:id/menu/:itemId', allow(...MGMT), async (req, res) => {
  const bid = id(req.params.id); assertBranch(req, bid)
  await q('delete from branch_menu where branch_id = $1 and item_id = $2', [bid, id(req.params.itemId)])
  res.json({ ok: true })
})

// One-step "add a dish": creates the catalog dish if it doesn't exist yet (or reuses it, matched by
// name), then attaches it to this branch with a category, price and availability — all at once, so a
// new dish shows up immediately on this branch's menu instead of sitting unattached anywhere.
const newDishBody = z.object({
  name: z.string().trim().min(2).max(100),
  note: z.string().max(200).nullable().optional(),
  imageUrl: z.string().max(300).nullable().optional(),
  categoryId: z.number().int().nullable(),
  price: z.number().int().min(0).max(10_000_000).nullable(),
  available: z.boolean().optional(),
})
admin.post('/branches/:id/menu/new', allow(...MGMT), async (req, res) => {
  const bid = id(req.params.id); assertBranch(req, bid)
  const b = parse(newDishBody, req.body)
  const slug = slugify(b.name)
  const existing = await one<{ id: number }>('select id from menu_items where slug = $1', [slug])
  if (!existing && req.staff!.role !== 'administrator')
    throw new HttpError(403, 'Only an administrator can add a brand-new dish to the catalog. Ask them, or pick an existing dish instead.')
  if (b.categoryId !== null) {
    const cat = await one('select 1 from categories where id = $1', [b.categoryId])
    if (!cat) throw new HttpError(400, 'Choose a category for this dish, or create one first')
  }
  const row = await tx(async (c) => {
    const item = await one<any>(
      `insert into menu_items(slug, name, note, image_url) values ($1,$2,$3,$4)
       on conflict (slug) do update set name = excluded.name,
         note = coalesce(excluded.note, menu_items.note), image_url = coalesce(excluded.image_url, menu_items.image_url)
       returning id, slug, name, note, image_url "imageUrl"`,
      [slug, b.name, b.note ?? null, b.imageUrl ?? null], c)
    await c.query(
      `insert into branch_menu(branch_id, item_id, price, available, category_id)
       values ($1,$2,$3,coalesce($4,true),$5)
       on conflict (branch_id, item_id) do update set
         price = $3, available = coalesce($4, branch_menu.available), category_id = $5`,
      [bid, item.id, b.price, b.available ?? null, b.categoryId])
    return item
  })
  const cat = b.categoryId ? await one<any>('select name from categories where id = $1', [b.categoryId]) : null
  res.status(201).json({ itemId: row.id, slug: row.slug, name: row.name, note: row.note, imageUrl: row.imageUrl,
    price: b.price, available: b.available ?? true, categoryId: b.categoryId, categoryName: cat?.name ?? null })
})

// ---------- payments ----------
admin.get('/payments', allow(...MGMT), async (req, res) => {
  const scoped = scopeBranch(req); const { limit, offset } = page(req)
  const where: string[] = []; const p: unknown[] = []
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)) }
  if (scoped !== null) add('o.branch_id = ?', scoped)
  else if (req.query.branch) add('o.branch_id = ?', id(String(req.query.branch)))
  if (req.query.status) add('p.status = ?', String(req.query.status))
  if (req.query.from) add('p.created_at >= ?::timestamptz', String(req.query.from))
  if (req.query.to) add('p.created_at < ?::timestamptz', String(req.query.to))
  if (req.query.q) add('(p.reference ilike ? )', `%${req.query.q}%`)
  const w = where.length ? 'where ' + where.join(' and ') : ''
  const [{ n, sum }] = await q(`select count(*)::int n, coalesce(sum(p.amount) filter (where p.status = 'success'), 0)::int sum
      from payments p join orders o on o.id = p.order_id ${w}`, p)
  const rows = await q(`
    select p.id, p.reference, p.provider, p.amount, p.status, p.channel, p.created_at "createdAt", p.paid_at "paidAt",
           o.code "orderCode", o.id "orderId", o.payment_status "orderPaymentStatus", b.name branch, o.customer_name "customerName"
      from payments p join orders o on o.id = p.order_id join branches b on b.id = o.branch_id ${w}
     order by p.created_at desc limit ${limit} offset ${offset}`, p)
  res.json({ total: n, successfulTotal: sum, rows })
})

// Staff record that a refund has been paid out (the money itself is moved in the payment provider's dashboard).
admin.post('/payments/:id/mark-refunded', allow('administrator'), async (req, res) => {
  await tx(async (c) => {
    const p = await one<any>(`select p.*, o.status order_status from payments p join orders o on o.id = p.order_id where p.id = $1 for update of p`, [id(req.params.id)], c)
    if (!p) throw new HttpError(404, 'Payment not found')
    if (p.status !== 'success') throw new HttpError(409, 'Only a successful payment can be refunded')
    await c.query(`update payments set status = 'refunded' where id = $1`, [p.id])
    await c.query(`update orders set payment_status = 'refunded', updated_at = now() where id = $1`, [p.order_id])
    await c.query(`insert into order_events(order_id, status, note, admin_id) values ($1,$2,'Refund recorded',$3)`, [p.order_id, p.order_status, req.staff!.id])
  })
  res.json({ ok: true })
})

// ---------- customers ----------
admin.get('/customers', allow(...MGMT), async (req, res) => {
  const scoped = scopeBranch(req); const { limit, offset } = page(req)
  const p: unknown[] = [scoped]
  let search = ''
  if (req.query.q) { p.push(`%${req.query.q}%`); search = `and (c.name ilike $2 or c.phone like $2 or c.email ilike $2)` }
  const base = `from customers c join orders o on o.customer_id = c.id and o.status <> 'pending_payment' and ($1::int is null or o.branch_id = $1)
                where true ${search}`
  const [{ n }] = await q(`select count(distinct c.id)::int n ${base}`, p)
  const rows = await q(`
    select c.id, c.name, c.phone, c.email, c.created_at "createdAt", count(o.id)::int orders,
           coalesce(sum(o.total) filter (where o.payment_status = 'paid' and o.status <> 'cancelled'), 0)::int spent,
           max(o.created_at) "lastOrderAt"
      ${base} group by c.id order by max(o.created_at) desc limit ${limit} offset ${offset}`, p)
  res.json({ total: n, rows })
})

admin.get('/customers/:id', allow(...MGMT), async (req, res) => {
  const scoped = scopeBranch(req)
  const c = await one('select id, name, phone, email, created_at "createdAt" from customers where id = $1', [id(req.params.id)])
  if (!c) throw new HttpError(404, 'Customer not found')
  const orders = await q(`
    select o.id, o.code, o.type, o.status, o.payment_status "paymentStatus", o.total, o.created_at "createdAt", b.name branch,
           (select string_agg(qty || 'x ' || name, ', ') from order_items where order_id = o.id) items
      from orders o join branches b on b.id = o.branch_id
     where o.customer_id = $1 and o.status <> 'pending_payment' and ($2::int is null or o.branch_id = $2) order by o.created_at desc limit 100`, [c.id, scoped])
  if (scoped !== null && !orders.length) throw new HttpError(404, 'Customer not found')
  res.json({ ...c, orders })
})

// ---------- settings ----------
admin.get('/settings', allow('administrator'), async (_req, res) => res.json(await getSettings()))

admin.put('/settings', allow('administrator'), async (req, res) => {
  const b = parse(z.object({
    restaurant: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().max(40).nullable(), email: z.string().email().nullable(), address: z.string().max(300).nullable() }).partial(),
    delivery: z.object({ defaultFee: z.number().int().min(0).nullable(), freeAbove: z.number().int().min(0).nullable() }).partial(),
    notifications: z.object({ whatsappEnabled: z.boolean(), recipients: z.array(z.string().regex(/^\+\d{10,15}$/, 'Use international format, e.g. +2348012345678')).max(10) }).partial(),
  }).partial(), req.body)
  const cur = await getSettings()
  res.json(await putSettings({
    ...(b.restaurant && { restaurant: { ...cur.restaurant, ...b.restaurant } }),
    ...(b.delivery && { delivery: { ...cur.delivery, ...b.delivery } }),
    ...(b.notifications && { notifications: { ...cur.notifications, ...b.notifications } }),
  }))
})

// ---------- staff accounts ----------
admin.get('/users', allow('administrator'), async (_req, res) => res.json(await q(
  `select u.id, u.email, u.name, u.role, u.branch_id "branchId", b.name branch, u.active from admin_users u left join branches b on b.id = u.branch_id order by u.id`)))

const userBody = z.object({
  email: z.string().email(), name: z.string().trim().min(2).max(80), password: z.string().min(10).max(100),
  role: z.enum(ALL), branchId: z.number().int().nullable(), active: z.boolean(),
})
const needsBranch = (role: string, branchId: unknown) => {
  if (role !== 'administrator' && !branchId) throw new HttpError(400, 'Branch managers and order managers must be assigned a branch')
}

admin.post('/users', allow('administrator'), async (req, res) => {
  const b = parse(userBody.omit({ active: true }), req.body)
  needsBranch(b.role, b.branchId)
  res.status(201).json(await one(
    `insert into admin_users(email, name, password_hash, role, branch_id) values (lower($1),$2,$3,$4,$5) returning id, email, name, role, branch_id "branchId", active`,
    [b.email, b.name, await bcrypt.hash(b.password, 11), b.role, b.role === 'administrator' ? null : b.branchId]))
})

admin.patch('/users/:id', allow('administrator'), async (req, res) => {
  const uid = id(req.params.id)
  const b = parse(userBody.partial(), req.body)
  if (uid === req.staff!.id && (b.active === false || (b.role && b.role !== 'administrator')))
    throw new HttpError(400, 'You cannot lock yourself out')
  const cur = await one<any>('select role, branch_id from admin_users where id = $1', [uid])
  if (!cur) throw new HttpError(404, 'User not found')
  const role = b.role ?? cur.role
  const branchId = 'branchId' in b ? b.branchId : cur.branch_id
  needsBranch(role, branchId)
  const hash = b.password ? await bcrypt.hash(b.password, 11) : null
  res.json(await one(
    `update admin_users set email = coalesce(lower($2), email), name = coalesce($3, name), password_hash = coalesce($4, password_hash),
       role = $5, branch_id = $6, active = coalesce($7, active) where id = $1 returning id, email, name, role, branch_id "branchId", active`,
    [uid, b.email ?? null, b.name ?? null, hash, role, role === 'administrator' ? null : branchId, b.active ?? null]))
})
