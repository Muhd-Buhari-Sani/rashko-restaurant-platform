import { config } from './config.ts'
import { q } from './db.ts'
import { getSettings } from './settings.ts'
import { naira } from './util.ts'

async function send(to: string, body: string): Promise<{ status: string; error?: string }> {
  if (config.whatsappProvider === 'console') {
    console.log(`[whatsapp:console] to ${to}: ${body}`)
    return { status: 'logged' }
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${config.whatsappPhoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.whatsappToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body } }),
    })
    if (!r.ok) return { status: 'failed', error: `${r.status} ${(await r.text()).slice(0, 300)}` }
    return { status: 'sent' }
  } catch (e: any) {
    return { status: 'failed', error: String(e?.message ?? e) }
  }
}

/** Never throws: a failed notification must not break a paid order. */
export async function notifyNewOrder(orderId: number) {
  try {
    const s = await getSettings()
    if (!s.notifications.whatsappEnabled || !s.notifications.recipients.length) return
    const [o] = await q(
      `select o.code, o.type, o.total, o.customer_name, o.customer_phone, b.name branch,
              (select string_agg(qty || 'x ' || name, ', ') from order_items where order_id = o.id) items
         from orders o join branches b on b.id = o.branch_id where o.id = $1`, [orderId])
    if (!o) return
    const body = `New Rashko order ${o.code} (${o.branch}, ${o.type})\n${o.items}\nTotal ${naira(o.total)} - paid\n${o.customer_name} ${o.customer_phone}`
    for (const to of s.notifications.recipients) {
      const r = await send(to, body)
      await q('insert into notifications(order_id, channel, recipient, body, status, error) values ($1,$2,$3,$4,$5,$6)',
        [orderId, 'whatsapp', to, body, r.status, r.error ?? null])
    }
  } catch (e) {
    console.error('notify failed', e)
  }
}
