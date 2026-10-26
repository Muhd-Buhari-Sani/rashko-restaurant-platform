# Rashko API

Node + Express + TypeScript + PostgreSQL. Serves the public website and the admin dashboard.

## Run it

1. Install PostgreSQL and create a database, e.g. `createdb rashko`
2. `copy .env.example .env` (Windows) / `cp .env.example .env` and set `DATABASE_URL`, `JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
3. `npm install`
4. `npm run seed`   (creates tables, loads branches + menus from `../site/src/data.ts`, creates the first administrator)
5. `npm run dev`    (API on http://localhost:4000)

`npm test` runs 17 integration tests. They need a **separate** database, because the suite drops
and recreates the schema: it uses `TEST_DATABASE_URL` if set, otherwise your `DATABASE_URL` with
`_test` appended (`rashko` → `rashko_test`), and refuses to run unless that name ends in `_test`.
Create it once, as a superuser, then run the tests:

```bash
createdb rashko_test
npm test
```
Keep the `server` and `site` folders side by side: the seed reads the menu from the site.

## Rules the server enforces
- Prices, availability and the delivery fee come from the database; the browser only sends dish slugs and quantities.
- Each branch has its own price/availability per dish. A null price means "to be confirmed" and cannot be ordered.
- Delivery stays off for every branch until an administrator enables it AND a delivery fee exists.
- Orders store a copy of dish names and prices, so later menu edits never change past orders.
- An order is only "received" after the payment provider confirms the right amount (server-side check, webhook + redirect safe to repeat).
- Roles: `administrator` (everything), `branch_manager` (own branch: orders, menu prices/availability, payments, customers), `order_manager` (own branch orders only).

## Order flow
`pending_payment → received → preparing → ready → (out_for_delivery →) completed`, cancel allowed until completed.
Cancelling a paid order marks it `refund_due`; an administrator records the refund with `mark-refunded` (money is moved in the payment provider's dashboard).

## Payments (Paystack test and live)

Checkout uses Paystack's redirect flow: the server initialises the transaction, the browser goes
to `authorization_url`, and Paystack returns the customer to `/order/:code?ref=…`. The order page
then asks the server to verify that reference. Paystack cannot reach `localhost` with a webhook,
so on a local machine the return trip is what settles an order; the webhook exists for production.

The secret key decides the mode, so switching from test money to real money needs no code change:

1. In the Paystack dashboard, switch to **Test mode** and copy the secret key (`sk_test_…`).
2. Put it in `server/.env` as `PAYSTACK_SECRET_KEY=sk_test_…`. Leave `PAYMENT_PROVIDER` unset and
   restart the API; the startup line reads `payments: paystack-test`.
3. Place an order. Paystack's test page appears with a TEST MODE banner. Use a test card from the
   dashboard (the common one is 4084 0840 8408 4081, any future expiry, CVV 408, PIN 0000, OTP
   123456). No real money moves.
4. For live payments, replace the key with `sk_live_…` and restart. The startup line reads
   `payments: paystack-live`. Add `https://<api-host>/api/webhooks/paystack` as the webhook URL in
   the dashboard so a payment that finishes without the browser returning is still recorded.

Set `APP_URL` to the site's public address before going live: that is where Paystack sends the
customer back. A production build refuses a `sk_test_…` key unless `ALLOW_PAYSTACK_TEST_IN_PROD=true`,
so a staging deploy cannot silently fail to charge. Paystack requires an email address, so checkout
asks for one whenever Paystack is active.

With no key at all, the server falls back to the demo provider and checkout redirects to
`/pay/mock`, which marks the order paid without money moving. That page and its API route are
never mounted in production.

## Public API
| | |
|---|---|
| GET `/api/branches` | branches, services, delivery/pickup flags |
| GET `/api/branches/:slug/menu` | categories and dishes for that branch |
| GET `/api/settings` | public restaurant info plus the payment provider and whether it is in test mode |
| POST `/api/orders` | `{branch,type,customer:{name,phone,email?},address?,notes?,items:[{slug,qty}]}` → `{code,total,payment:{url,reference}}` |
| GET `/api/payments/verify/:reference` | call when the customer returns from payment |
| GET `/api/orders/track/:code?phone=` | order status (needs the phone used) |
| POST `/api/webhooks/paystack` | Paystack webhook (signature checked) |
| POST `/api/payments/mock/:reference` | development only: `{result:"success"|"failed"}` |

## Admin API (`Authorization: Bearer <token>`)
`POST /api/admin/auth/login`, `GET /me`, `GET /events` (live new-order stream, `?token=`),
`GET /overview?days=30&branch=`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/status`,
`GET|POST /menu/items`, `PATCH|DELETE /menu/items/:id`, `GET|POST /categories`, `PATCH /categories/:id`,
`GET|POST /branches`, `PATCH /branches/:id`, `GET /branches/:id/menu`, `PUT|DELETE /branches/:id/menu/:itemId`,
`GET /payments`, `POST /payments/:id/mark-refunded`, `GET /customers`, `GET /customers/:id`,
`GET|PUT /settings`, `GET|POST /users`, `PATCH /users/:id`.

## Before going live
- Set `NODE_ENV=production`, a long random `JWT_SECRET`, and the Paystack **live** key
  (`PAYSTACK_SECRET_KEY=sk_live_…`). Add the webhook URL
  `https://<api-host>/api/webhooks/paystack` in the Paystack dashboard and set `APP_URL` to the
  public site. Do a full test-mode order first (see Payments above).
- Set `TRUST_PROXY` to the number of proxies in front of the API (usually `1`). It is off by
  default because the rate limiters identify clients by IP: trusting `X-Forwarded-For` when no
  proxy sets it lets anyone rotate the header and bypass every limit, including the login limit
  that guards against password guessing.
- Keep `NODE_ENV=production`: it is what disables the development mock-payment endpoint (which
  marks orders paid without money moving) and refuses to start without a Paystack key.
- WhatsApp: `console` just logs. `cloud` sends plain text through Meta's WhatsApp Cloud API, which only delivers to numbers that messaged the business in the last 24 hours; for reliable alerts, register an approved message template.
- Change the seeded administrator password.
