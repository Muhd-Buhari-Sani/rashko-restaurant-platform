import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { pool, q, one, tx } from './db.ts'
import { migrate } from './migrate.ts'
// The website's own data file is the single source for the menu, so the two can never drift apart.
import { branches, menus } from '../../site/src/data.ts'

export async function seed() {
  await migrate()
  await tx(async (c) => {
    let catSort = 0
    for (const b of branches) {
      const row = await one<any>(
        `insert into branches(slug, name, address, phone, hours, services, services_note)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (slug) do update set name = excluded.name, address = excluded.address, phone = excluded.phone,
           hours = excluded.hours, services = excluded.services, services_note = excluded.services_note
         returning id`,
        [b.slug, b.name, b.address, b.phone, b.hours, b.services, b.servicesNote ?? null], c)
      const menu = b.menuId ? menus[b.menuId] : null
      if (!menu) continue
      let sort = 0
      for (const cat of menu.categories) {
        const cr = await one<any>(
          `insert into categories(slug, name, blurb, sort) values ($1,$2,$3,$4)
           on conflict (slug) do update set name = excluded.name, blurb = excluded.blurb returning id`,
          [cat.id, cat.name, cat.blurb, catSort++ * 10], c)
        for (const it of cat.items) {
          const ir = await one<any>(
            `insert into menu_items(slug, name, note) values ($1,$2,$3)
             on conflict (slug) do update set name = excluded.name returning id`, [it.slug, it.name, it.note ?? null], c)
          // Only insert: re-seeding must never overwrite prices an admin has since changed.
          await c.query(
            `insert into branch_menu(branch_id, item_id, category_id, price, available, featured, sort)
             values ($1,$2,$3,$4,$5,$6,$7) on conflict (branch_id, item_id) do nothing`,
            [row.id, ir.id, cr.id, it.price, it.available, menu.featured.includes(it.slug), sort++])
        }
      }
    }
  }, )

  const email = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase()
  const has = await one('select 1 from admin_users')
  if (!has) {
    if (!email) {
      console.log('No admin created: set SEED_ADMIN_EMAIL (and optionally SEED_ADMIN_PASSWORD) and run again.')
    } else {
      const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString('base64url')
      await q(`insert into admin_users(email, name, password_hash, role) values ($1,'Administrator',$2,'administrator')`,
        [email, await bcrypt.hash(password, 11)])
      console.log(`Created administrator ${email}${process.env.SEED_ADMIN_PASSWORD ? '' : ` with password ${password} (shown once, change it)`}`)
    }
  }
  const [{ n }] = await q('select count(*)::int n from branch_menu')
  console.log(`Seeded ${branches.length} branches, ${n} branch menu rows`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1) })
}
