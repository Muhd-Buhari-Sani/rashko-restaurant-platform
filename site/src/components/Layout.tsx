import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { naira, TBC } from '../data'
import { prefersReduced } from '../hooks'
import { useRestaurant } from '../live'
import { useStore } from '../store'
import {
  ArrowIcon,
  CartIcon,
  CloseIcon,
  MenuIcon,
  MinusIcon,
  PinIcon,
  PlusIcon,
  Star,
  TrashIcon,
} from './ui'

// Computed once at module load: calling Date during render is impure and
// can produce different output across re-renders.
const YEAR = new Date().getFullYear()

const links = [
  { to: '/', label: 'Home' },
  { to: '/menu', label: 'Menu' },
  { to: '/about', label: 'Our Story' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/branches', label: 'Branches' },
  { to: '/contact', label: 'Contact' },
]

function Loader() {
  const [done, setDone] = useState(false)
  // Decide up front (no flash): skip the loader on repeat visits in the same session or with reduced motion.
  const [gone, setGone] = useState(() => {
    if (prefersReduced()) return true
    try {
      return sessionStorage.getItem('rashko-loaded') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (gone) return
    const t1 = window.setTimeout(() => setDone(true), 1050)
    const t2 = window.setTimeout(() => {
      setGone(true)
      try {
        // Written only once the loader has finished, so React StrictMode's double effect run in dev can't skip it.
        sessionStorage.setItem('rashko-loaded', '1')
      } catch {
        /* ignore */
      }
    }, 2100)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [gone])
  if (gone) return null
  return (
    <div className={`loader ${done ? 'done' : ''}`} aria-hidden="true">
      <div className="flex flex-col items-center gap-9">
        <div className="loader-badge">
          <img src="/logo.png" alt="" width="120" height="139" />
        </div>
        <div className="loader-bar">
          <i />
        </div>
      </div>
    </div>
  )
}

function Navbar() {
  const { count, bump, setDrawerOpen, branch, openPicker } = useStore()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const solid = scrolled || pathname !== '/' || open

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        solid ? 'bg-ivory/90 text-ink shadow-[0_1px_0_rgb(12_46_32/0.08)] backdrop-blur-md' : 'text-ivory'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
        <Link to="/" className="group relative z-10 block shrink-0 md:translate-y-2.5" aria-label="Rashko Restaurant home">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white p-1.5 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)] ring-1 ring-ink/10 transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105 md:h-[76px] md:w-[76px] md:p-2">
            <img src="/logo.png" alt="Rashko Restaurant" className="h-full w-full object-contain" />
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={openPicker}
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition md:flex ${
              solid ? 'border-ink/25 hover:bg-sand' : 'border-ivory/40 hover:bg-ivory/15'
            }`}
          >
            <PinIcon className="h-3.5 w-3.5" />
            {branch ? branch.name : 'Choose branch'}
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}
            className="relative grid h-11 w-11 place-items-center rounded-full transition hover:bg-sand/60 hover:text-ink active:scale-90"
          >
            <span key={bump} className={bump ? 'bump' : ''}>
              <CartIcon className="h-6 w-6" />
            </span>
            {count > 0 && (
              <span
                key={`c${count}`}
                className="bump absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.7rem] font-bold text-white"
              >
                {count}
              </span>
            )}
          </button>
          <Link to="/menu" className="btn btn-primary hidden !py-2.5 md:inline-flex">
            Order Now
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="fade-in border-t border-ink/10 bg-ivory px-5 pb-6 pt-3 text-ink lg:hidden" aria-label="Mobile">
          {links.map((l, i) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              style={{ animationDelay: `${i * 45}ms` }}
              className="pop-in block border-b border-ink/10 py-3.5 font-display text-2xl font-semibold"
            >
              {l.label}
            </NavLink>
          ))}
          <Link to="/menu" className="btn btn-primary mt-5 w-full">
            Order Now
          </Link>
        </nav>
      )}
    </header>
  )
}

function CartDrawer() {
  const { drawerOpen, setDrawerOpen, lines, subtotal, setQty, remove, branch, openPicker, count } = useStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname, setDrawerOpen])
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [drawerOpen, setDrawerOpen])
  if (!drawerOpen) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your cart">
      <button
        type="button"
        aria-label="Close cart"
        className="fade-in absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className="drawer absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-ivory shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
          <div>
            <h2 className="font-display text-3xl font-semibold">Your cart</h2>
            {branch && (
              <button type="button" onClick={openPicker} className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-dark underline-offset-2 hover:underline">
                <PinIcon className="h-3.5 w-3.5" /> {branch.name} branch · change
              </button>
            )}
          </div>
          <button type="button" aria-label="Close cart" onClick={() => setDrawerOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand">
            <CloseIcon />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <div>
              <Star size={46} className="float mx-auto mb-4 text-brand-dark" />
              <p className="font-display text-3xl font-semibold">Nothing here yet</p>
              <p className="mt-2 text-moss/75">Pick a branch and add something delicious.</p>
              <button type="button" className="btn btn-primary mt-6" onClick={() => { setDrawerOpen(false); navigate('/menu') }}>
                Browse the menu
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {lines.map((l) => (
                <li key={l.id} className="pop-in flex items-center gap-3 rounded-2xl bg-cream p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="text-sm text-moss/70">{naira(l.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Decrease ${l.name}`} onClick={() => setQty(l.id, l.qty - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-ivory transition hover:bg-sand active:scale-90">
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                    <button type="button" aria-label={`Increase ${l.name}`} onClick={() => setQty(l.id, l.qty + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-ivory transition hover:bg-sand active:scale-90">
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="w-20 text-right text-sm font-semibold tabular-nums">{naira(l.price * l.qty)}</p>
                  <button type="button" aria-label={`Remove ${l.name}`} onClick={() => remove(l.id)} className="text-moss/50 transition hover:text-brand-dark">
                    <TrashIcon className="h-[18px] w-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-ink/10 px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-moss/80">Subtotal ({count} item{count === 1 ? '' : 's'})</span>
                <span className="font-display text-3xl font-semibold tabular-nums">{naira(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-moss/60">Delivery fee, if any, is confirmed by the branch at checkout.</p>
              <button type="button" className="btn btn-primary pulse-ring mt-4 w-full" onClick={() => { setDrawerOpen(false); navigate('/checkout') }}>
                Checkout <ArrowIcon className="h-4 w-4" />
              </button>
              <button type="button" className="btn btn-ghost mt-2.5 w-full" onClick={() => { setDrawerOpen(false); navigate('/cart') }}>
                View full cart
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function BranchPicker() {
  const { pickerOpen, closePicker, chooseBranch, branch, branches, branchesError, pendingSwitch, confirmSwitch, cancelSwitch } = useStore()
  useEffect(() => {
    if (!pickerOpen) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && closePicker()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [pickerOpen, closePicker])
  if (!pickerOpen) return null
  const target = branches?.find((b) => b.slug === pendingSwitch)
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Choose a branch">
      <button type="button" aria-label="Close" className="fade-in absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={closePicker} />
      <div className="pop-in relative w-full max-w-lg rounded-3xl bg-ivory p-6 shadow-2xl md:p-8">
        {target ? (
          <>
            <h2 className="font-display text-3xl font-semibold">Switch to {target.name}?</h2>
            <p className="mt-3 text-moss/80">
              Menus and prices differ between branches, so switching will empty your current cart.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" className="btn btn-ghost flex-1" onClick={cancelSwitch}>Keep my cart</button>
              <button type="button" className="btn btn-primary flex-1" onClick={confirmSwitch}>Switch branch</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-semibold">Where are you ordering from?</h2>
                <p className="mt-2 text-sm text-moss/75">Each branch has its own menu and prices.</p>
              </div>
              <button type="button" aria-label="Close" onClick={closePicker} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-sand">
                <CloseIcon />
              </button>
            </div>
            {branchesError && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{branchesError}</p>}
            {!branches && !branchesError && <p className="mt-5 text-sm text-moss/70">Loading branches…</p>}
            <ul className="mt-5 space-y-3">
              {branches?.map((b) => {
                const hasMenu = b.hasMenu
                const active = branch?.slug === b.slug
                return (
                  <li key={b.slug}>
                    <button
                      type="button"
                      disabled={!hasMenu}
                      onClick={() => chooseBranch(b.slug)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                        active ? 'border-brand bg-brand/10' : 'border-ink/10 hover:border-brand/60 hover:bg-cream'
                      } disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-ink/10 disabled:hover:bg-transparent`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-2xl font-semibold">{b.name}</span>
                        {active && <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">Selected</span>}
                        {!hasMenu && <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold">Menu coming soon</span>}
                      </div>
                      <p className="mt-1 text-sm text-moss/75">{b.address ?? `Address: ${TBC.toLowerCase()}`}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function Toast() {
  const { toast } = useStore()
  if (!toast) return null
  return (
    <div
      key={toast}
      role="status"
      className="toast fixed bottom-6 left-1/2 z-[70] flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-ivory shadow-xl"
    >
      <Star size={14} className="text-mint" /> {toast}
    </div>
  )
}

function Footer() {
  const restaurant = useRestaurant()
  const tel = restaurant.phone?.replace(/[^\d+]/g, '') ?? ''
  return (
    <footer className="pattern-light relative overflow-hidden bg-ink text-sand">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <span className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-white p-3">
            <img src="/logo.png" alt="Rashko Restaurant" className="h-full w-full object-contain" />
          </span>
          <p className="mt-4 max-w-md leading-relaxed text-sand/80">
            Yemeni, Arabic and Middle Eastern cuisine in Kano. Mandi, Kabuli, BBQ chicken, fresh juices and more.
          </p>
        </div>
        <div>
          <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-mint">Explore</h3>
          <ul className="mt-4 space-y-2.5">
            {links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="transition hover:text-ivory">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-mint">Zoo Road branch</h3>
          <address className="mt-4 space-y-2.5 not-italic">
            {restaurant.address && <p>{restaurant.address}</p>}
            {restaurant.phone && (
              <p><a href={`tel:${tel}`} className="transition hover:text-ivory">{restaurant.phone}</a></p>
            )}
            {restaurant.email && (
              <p><a href={`mailto:${restaurant.email}`} className="break-all transition hover:text-ivory">{restaurant.email}</a></p>
            )}
            {restaurant.hours && <p>{restaurant.hours}</p>}
          </address>
        </div>
      </div>
      <div className="border-t border-sand/15 px-5 py-5 text-center text-xs text-sand/60">
        © {YEAR} {restaurant.name}.
      </div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Block body on purpose: an effect must not return scrollTo's result as its "cleanup".
    window.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <>
      <Loader />
      <Navbar />
      <main key={pathname} className="page-enter">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <BranchPicker />
      <Toast />
    </>
  )
}
