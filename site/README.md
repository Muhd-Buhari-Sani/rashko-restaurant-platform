# Rashko Restaurant: public site (phase 1)

React + TypeScript + Tailwind CSS v4 + React Router, built with Vite.

## Run

```bash
npm install
npm run dev      # local dev server (usually http://localhost:5173)
npm run build    # production build in dist/
```

Deploy `dist/` to Netlify (build command `npm run build`, publish directory `dist`). `public/_redirects` makes page refreshes work.

## Brand

- Logo: `public/logo.png` (from the restaurant's own logo). Favicon and touch icon are made from it.
- Green: `#008751`, sampled from the logo. All colours live in the `@theme` block at the top of `src/index.css` (`brand`, `brand-dark`, `ink`, `moss`, `mint`, plus the `ivory`/`cream`/`sand` neutrals).
- The logo is always shown on a white circular badge so it stays readable on dark green.

## Where things are

- `src/data.ts`: branches and both menus (prices come from here). Unverified branch details are `null` and shown as "To be confirmed".
- `src/store.tsx`: cart and branch selection. The cart belongs to one branch; switching branch asks first and empties the cart.
- `src/hooks.ts`: entrance reveal, 3D tilt and parallax (all respect reduced-motion).
- `src/pages/`: Home, Menu (+ dish detail), Cart/Checkout, and Info (About, Branches, Gallery, Contact).
- `src/admin/`: the admin dashboard (orders, menu, payments, customers, staff, settings).

## If the dev server shows a blank page or an error screen

1. Stop the server (Ctrl+C).
2. Delete the `node_modules/.vite` folder (Vite's cache; it can go stale after an interrupted install or after copying files in while the server runs).
3. Run `npm run dev` again.
4. Still broken? Delete `node_modules` and `package-lock.json`, run `npm install`, then `npm run dev`, and note the message shown on screen or in the browser console (F12).

## Backend is connected

Orders, payments, order tracking, the admin dashboard and WhatsApp notifications are all served
by `../server` (see `../server/README.md`). Locally the payment provider is `mock`: checkout
records an order but no money moves.

Checkout flow: `/checkout` creates the order and sends the browser to `/pay/mock?reference=…`,
where "Pay" or "Simulate a failed payment" finishes the test payment. Either way you land on
`/order/:code`, which shows the confirmation, payment state and status timeline. Without a
reference the same page asks for the phone number used at checkout, and `/order` is the manual
tracking form. Adding a Paystack secret key to `../server/.env` switches checkout to Paystack's
own page (test key = test mode, live key = live payments) and the `?ref=…` on the callback URL
lets the order page verify the payment when the browser returns. Checkout asks for an email
whenever Paystack is active, because Paystack needs one for the receipt. Checkout also offers
a WhatsApp updates opt-in when the server has customer updates enabled; the choice is stored
on that order, and `/order/:code` confirms it. The message itself is sent by the API when the
kitchen changes the order status (see the server README for the Meta template setup).

## Still to do
- Reservations and the policy pages are not built.
- Dish photos: `public/images/dishes/<slug>.jpg` is used automatically when the API has no
  uploaded photo for that dish, so adding a file is all it takes to fill a placeholder.

## To do before launch

- Replace the "Photo coming soon" placeholders with real Rashko photography.
- Confirm the Kano Club and Rijiya Zaki addresses, phones and hours, and the Rijiya Zaki menu.
- Confirm the Kaintchkee With Rice price at Kano Club (the source listed both ₦6,500 and ₦5,000); it currently cannot be ordered.
- Decide whether to mention "Swimming Pool" and "Kids Play" (they are on the logo) in the site copy, and at which branch.
