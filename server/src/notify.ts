import { config } from './config.ts'
import { one, q } from './db.ts'
import { getSettings } from './settings.ts'
import { naira } from './util.ts'

export interface SendResult {
  status: 'sent' | 'logged' | 'failed'
  error?: string
}

export interface WhatsAppSender {
  sendText(to: string, body: string): Promise<SendResult>
  sendTemplate(to: string, template: string, params: string[]): Promise<SendResult>
}

const digits = (to: string) => to.replace(/[^\d]/g, '')

/**
 * Meta's WhatsApp Cloud API wrapper. Exported with an overridable base so the request
 * contract (digits-only recipient, template shape, language) can be tested against a stub.
 *
 * Order updates are always templates: business-initiated free-form messages are rejected
 * outside a 24-hour conversation, and a status update is usually the first contact.
 */
export function cloudSender(opts: {
  token: string
  phoneId: string
  base?: string
  lang?: string
}): WhatsAppSender {
  const base = (opts.base ?? 'https://graph.facebook.com/v26.0').replace(/\/+$/, '')
  const lang = opts.lang ?? 'en'

  const post = async (payload: unknown): Promise<SendResult> => {
    try {
      const r = await fetch(`${base}/${opts.phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) return { status: 'failed', error: `${r.status} ${(await r.text()).slice(0, 300)}` }
      return { status: 'sent' }
    } catch (e: any) {
      return { status: 'failed', error: String(e?.message ?? e) }
    }
  }

  return {
    sendText: (to, body) => post({
      messaging_product: 'whatsapp',
      to: digits(to),
      type: 'text',
      text: { body },
    }),
    sendTemplate: (to, template, params) => post({
      messaging_product: 'whatsapp',
      to: digits(to),
      type: 'template',
      template: {
        name: template,
        language: { code: lang },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
      },
    }),
  }
}

const consoleSender: WhatsAppSender = {
  async sendText(to, body) {
    console.log(`[whatsapp:console] to ${to}: ${body}`)
    return { status: 'logged' }
  },
  async sendTemplate(to, template, params) {
    console.log(`[whatsapp:console] to ${to}: template ${template} ${JSON.stringify(params)}`)
    return { status: 'logged' }
  },
}

export const whatsapp: WhatsAppSender = config.whatsappProvider === 'cloud'
  ? cloudSender({
      token: config.whatsappToken,
      phoneId: config.whatsappPhoneId,
      base: config.whatsappApiBase,
      lang: config.whatsappTemplateLang,
    })
  : consoleSender

/**
 * The four moments customers ask about. Deliberately silent for everything else:
 * "preparing" is noise, and an unpaid order that gets cancelled was never confirmed.
 */
export function customerTemplate(status: string, optedIn: boolean, paymentStatus: string): string | null {
  if (!optedIn) return null
  if (status === 'cancelled' && paymentStatus === 'unpaid') return null
  return (config.whatsappTemplates as Record<string, string>)[status] ?? null
}

/** Never throws: a failed notification must not fail the status change that triggered it. */
export async function notifyCustomerStatus(orderId: number, status: string) {
  try {
    // Hard kill-switch until after first launch. Set HOLD_WHATSAPP_NOTIFICATIONS=false to re-enable.
    if ((process.env.HOLD_WHATSAPP_NOTIFICATIONS ?? 'true').toLowerCase() !== 'false') {
      return
    }

    const s = await getSettings()
    if (!s.notifications.customerUpdates) return

    const o = await one<any>(
      `select o.code, o.customer_name "customerName", o.customer_phone "customerPhone",
              o.whatsapp_opt_in "whatsappOptIn", o.payment_status "paymentStatus"
         from orders o where o.id = $1`, [orderId])
    if (!o) return

    const template = customerTemplate(status, Boolean(o.whatsappOptIn), o.paymentStatus)
    if (!template) return

    const firstName = String(o.customerName).trim().split(/\s+/)[0] || 'there'
    // Template bodies must agree with the approved copy: {{1}} name, {{2}} order code.
    const r = await whatsapp.sendTemplate(o.customerPhone, template, [firstName, o.code])
    const body = `Order ${o.code} is ${status.replace(/_/g, ' ')} (template ${template})`
    await q('insert into notifications(order_id, channel, recipient, body, status, error) values ($1,$2,$3,$4,$5,$6)',
      [orderId, 'whatsapp-customer', o.customerPhone, body, r.status, r.error ?? null])
  } catch (e) {
    console.error('customer notification failed', e)
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
      const r = await whatsapp.sendText(to, body)
      await q('insert into notifications(order_id, channel, recipient, body, status, error) values ($1,$2,$3,$4,$5,$6)',
        [orderId, 'whatsapp', to, body, r.status, r.error ?? null])
    }
  } catch (e) {
    console.error('notify failed', e)
  }
}
