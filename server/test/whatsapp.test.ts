// The WhatsApp Cloud API contract, exercised against a stub. This is the part that cannot
// be tried against Meta in CI, and it is what the "customers get status updates" promise
// relies on: template shape, language, consent and which statuses are allowed to speak.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server, type ServerResponse } from 'node:http'

// Set before importing the module: config.ts reads the environment once.
process.env.WHATSAPP_PROVIDER = 'console'
process.env.WHATSAPP_TEMPLATE_READY = 'ready_tpl'
process.env.WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY = 'delivery_tpl'
process.env.WHATSAPP_TEMPLATE_COMPLETED = 'completed_tpl'
process.env.WHATSAPP_TEMPLATE_CANCELLED = 'cancelled_tpl'

const { cloudSender, customerTemplate } = await import('../src/notify.ts')

let server: Server
let base = ''
let seen: { path: string; authorization: string; body: any } | null = null
let reply: (path: string, res: ServerResponse) => void = () => {}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

before(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      seen = {
        path: req.url ?? '',
        authorization: String(req.headers.authorization ?? ''),
        body: raw ? JSON.parse(raw) : null,
      }
      reply(req.url ?? '', res)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('stub server did not get a port')
  base = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('a status update is sent as an approved template with name then code', async () => {
  reply = (_path, res) => json(res, 200, { messaging_product: 'whatsapp', messages: [{ id: 'wamid.1' }] })
  const sender = cloudSender({ token: 'EAAB_test', phoneId: '123456', base, lang: 'en_US' })

  const r = await sender.sendTemplate('+234 812 960 4069', 'ready_tpl', ['Sani', 'RSK-ABC123'])

  assert.equal(r.status, 'sent')
  assert.equal(seen?.path, '/123456/messages')
  assert.equal(seen?.authorization, 'Bearer EAAB_test')
  assert.deepEqual(seen?.body, {
    messaging_product: 'whatsapp',
    to: '2348129604069',
    type: 'template',
    template: {
      name: 'ready_tpl',
      language: { code: 'en_US' },
      components: [{
        type: 'body',
        parameters: [{ type: 'text', text: 'Sani' }, { type: 'text', text: 'RSK-ABC123' }],
      }],
    },
  })
})

test('the staff alert still sends a plain text message', async () => {
  reply = (_path, res) => json(res, 200, { messages: [{ id: 'wamid.2' }] })
  const sender = cloudSender({ token: 'EAAB_test', phoneId: '123456', base })

  const r = await sender.sendText('+2348012345678', 'New Rashko order')

  assert.equal(r.status, 'sent')
  assert.deepEqual(seen?.body, {
    messaging_product: 'whatsapp',
    to: '2348012345678',
    type: 'text',
    text: { body: 'New Rashko order' },
  })
  assert.equal((seen?.body as any).template, undefined)
})

test('a rejected message keeps Meta’s reason so it can be fixed', async () => {
  reply = (_path, res) => json(res, 400, { error: { message: 'Template name does not exist', code: 132001 } })
  const sender = cloudSender({ token: 'bad', phoneId: '123456', base })

  const r = await sender.sendTemplate('+2348012345678', 'missing_tpl', ['A', 'RSK-X'])

  assert.equal(r.status, 'failed')
  assert.match(r.error ?? '', /132001/)
  assert.match(r.error ?? '', /Template name does not exist/)
})

test('an unreachable Cloud API fails quietly instead of throwing', async () => {
  // Port 1 is closed, so the request fails immediately.
  const sender = cloudSender({ token: 'EAAB_test', phoneId: '123456', base: 'http://127.0.0.1:1' })
  const r = await sender.sendTemplate('+2348012345678', 'ready_tpl', ['A', 'RSK-X'])
  assert.equal(r.status, 'failed')
  assert.ok(r.error)
})

test('consent and status decide whether a customer is messaged', () => {
  // No opt-in means silence, whatever the status.
  assert.equal(customerTemplate('ready', false, 'paid'), null)

  // Only the four moments the customer cares about, using the configured names.
  assert.equal(customerTemplate('ready', true, 'paid'), 'ready_tpl')
  assert.equal(customerTemplate('out_for_delivery', true, 'paid'), 'delivery_tpl')
  assert.equal(customerTemplate('completed', true, 'paid'), 'completed_tpl')
  assert.equal(customerTemplate('cancelled', true, 'paid'), 'cancelled_tpl')

  // Kitchen-internal steps stay quiet.
  assert.equal(customerTemplate('preparing', true, 'paid'), null)
  assert.equal(customerTemplate('received', true, 'paid'), null)

  // An unpaid order that was cancelled was never confirmed, so do not text about it.
  assert.equal(customerTemplate('cancelled', true, 'unpaid'), null)
})
