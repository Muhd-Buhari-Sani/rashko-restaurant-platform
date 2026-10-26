// The Paystack client, exercised against a stub server. This is the part that cannot be
// tried against the real API in CI, and it is what "swap the key for a live one" relies on:
// the request shape, the callback URL, and how Paystack's statuses map onto ours.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { paystackProvider } from '../src/payments.ts'

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

test('initialize sends the documented body, in kobo, with the callback carrying the reference', async () => {
  reply = (_path, res) => json(res, 200, { status: true, data: { authorization_url: 'https://checkout.paystack.com/abc' } })
  const paystack = paystackProvider('sk_test_example', base)

  const out = await paystack.init({
    reference: 'RSKTEST1', amount: 14500, email: 'guest@example.com', orderCode: 'RSK-ABC123',
  })

  assert.equal(out.authorizationUrl, 'https://checkout.paystack.com/abc')
  assert.equal(seen?.path, '/transaction/initialize')
  assert.equal(seen?.authorization, 'Bearer sk_test_example')
  assert.deepEqual(seen?.body, {
    email: 'guest@example.com',
    amount: 1450000,
    reference: 'RSKTEST1',
    currency: 'NGN',
    callback_url: 'http://localhost:5173/order/RSK-ABC123?ref=RSKTEST1',
    metadata: { orderCode: 'RSK-ABC123' },
  })
})

test('initialize surfaces the provider message, e.g. for a wrong key', async () => {
  reply = (_path, res) => json(res, 401, { status: false, message: 'Invalid key' })
  const paystack = paystackProvider('sk_test_wrong', base)

  await assert.rejects(
    paystack.init({ reference: 'RSKTEST2', amount: 1000, email: 'a@b.co', orderCode: 'RSK-X' }),
    /Invalid key/,
  )
})

test('verify treats a successful transaction as paid, converting kobo back to naira', async () => {
  reply = (_path, res) => json(res, 200, {
    status: true,
    data: { status: 'success', amount: 1450000, channel: 'card', reference: 'RSKTEST1' },
  })
  const paystack = paystackProvider('sk_test_example', base)

  const v = await paystack.verify('RSKTEST1')
  assert.equal(v.status, 'success')
  assert.equal(v.amount, 14500)
  assert.equal(v.channel, 'card')
  assert.equal(seen?.path, '/transaction/verify/RSKTEST1')
})

test('verify maps the remaining Paystack statuses onto ours', async () => {
  const paystack = paystackProvider('sk_test_example', base)
  const cases: [string, string][] = [
    ['failed', 'failed'],
    ['reversed', 'failed'],
    ['abandoned', 'abandoned'],
    ['ongoing', 'pending'],
    ['pending', 'pending'],
    ['processing', 'pending'],
    ['queued', 'pending'],
    ['success', 'success'],
  ]
  for (const [paystackStatus, ours] of cases) {
    reply = (_path, res) => json(res, 200, { status: true, data: { status: paystackStatus, amount: 100 } })
    assert.equal((await paystack.verify('RSKTEST3')).status, ours, paystackStatus)
  }
})

test('verify stays pending when Paystack cannot be reached', async () => {
  // Port 1 is closed, so the request fails immediately.
  const paystack = paystackProvider('sk_test_example', 'http://127.0.0.1:1')
  const v = await paystack.verify('RSKTEST4')
  assert.equal(v.status, 'pending')
  assert.equal(v.amount, 0)
})
