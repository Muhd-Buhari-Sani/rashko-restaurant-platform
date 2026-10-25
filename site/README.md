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
- `src/pages/`: Home, Menu (+ dish detail), Branches, About, Gallery, Contact, Cart, Checkout.

## If the dev server shows a blank page or an error screen

1. Stop the server (Ctrl+C).
2. Delete the `node_modules/.vite` folder (Vite's cache; it can go stale after an interrupted install or after copying files in while the server runs).
3. Run `npm run dev` again.
4. Still broken? Delete `node_modules` and `package-lock.json`, run `npm install`, then `npm run dev`, and note the message shown on screen or in the browser console (F12).

## Not built yet (needs the backend phase)

Online payment, real order records, order confirmation and tracking, reservations, admin dashboard, WhatsApp notifications, policy pages. The checkout button says plainly that payment is not connected, and nothing is sent or charged.

## To do before launch

- Replace the "Photo coming soon" placeholders with real Rashko photography.
- Confirm the Kano Club and Rijiya Zaki addresses, phones and hours, and the Rijiya Zaki menu.
- Confirm the Kaintchkee With Rice price at Kano Club (the source listed both ₦6,500 and ₦5,000); it currently cannot be ordered.
- Decide whether to mention "Swimming Pool" and "Kids Play" (they are on the logo) in the site copy, and at which branch.
