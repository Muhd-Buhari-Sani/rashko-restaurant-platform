# Rashko API

Node + Express + TypeScript + PostgreSQL. Serves the public website and the admin dashboard.

## Run it

1. Install PostgreSQL and create a database, e.g. `createdb rashko`
2. `copy .env.example .env` (Windows) / `cp .env.example .env` and set `DATABASE_URL`, `JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
3. `npm install`
4. `npm run seed`   (creates tables, loads branches + menus from `../site/src/data.ts`, creates the first administrator)
5. `npm run dev`    (API on http://localhost:4000)

`npm test` runs 17 integration tests against a separate `rashko_test` database (it wipes that database).
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

## Public API
| | |
|---|---|
| GET `/api/branches` | branches, services, delivery/pickup flags |
| GET `/api/branches/:slug/menu` | categories and dishes for that branch |
| GET `/api/settings` | public restaurant info |
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
- Set `NODE_ENV=production`, a long random `JWT_SECRET`, `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, and add the webhook URL `https://<api-host>/api/webhooks/paystack` in the Paystack dashboard. The Paystack calls are written from its documented API but have not been run against a live account: do a test-mode order first.
- WhatsApp: `console` just logs. `cloud` sends plain text through Meta's WhatsApp Cloud API, which only delivers to numbers that messaged the business in the last 24 hours; for reliable alerts, register an approved message template.
- Change the seeded administrator password.
