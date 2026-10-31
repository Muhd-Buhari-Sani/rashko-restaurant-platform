import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FoodCard from '../components/FoodCard'
import { ArrowIcon, PinIcon, Photo, Reveal, SearchIcon, Stepper } from '../components/ui'
import { naira } from '../data'
import { usePageTitle } from '../meta'
import { findItem, useBranchMenu } from '../live'
import { useStore } from '../store'

function ChooseBranchPrompt() {
  const { openPicker } = useStore()
  usePageTitle('Menu')
  return (
    <div className="mx-auto max-w-2xl px-5 py-32 text-center">
      <Reveal>
        <h1 className="font-display text-5xl font-semibold md:text-7xl">Choose your branch first</h1>
        <p className="mt-5 text-lg text-moss/80">
          Each Rashko branch has its own menu and its own prices, so we need to know where you are ordering from before showing you dishes.
        </p>
        <button type="button" className="btn btn-primary mt-8" onClick={openPicker}>
          <PinIcon className="h-4 w-4" /> Choose a branch
        </button>
      </Reveal>
    </div>
  )
}

export function MenuPage() {
  const { branch, openPicker } = useStore()
  const { menu, error } = useBranchMenu(branch?.slug)
  usePageTitle('Menu')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')

  const sections = useMemo(() => {
    if (!menu) return []
    const needle = q.trim().toLowerCase()
    return menu.categories
      .filter((c) => cat === 'all' || c.id === cat)
      .map((c) => ({ ...c, items: c.items.filter((i) => !needle || i.name.toLowerCase().includes(needle)) }))
      .filter((c) => c.items.length > 0)
  }, [menu, q, cat])

  if (!branch) return <div className="pt-[72px]"><ChooseBranchPrompt /></div>
  if (error) {
    return (
      <div className="px-5 pb-32 pt-44 text-center">
        <h1 className="font-display text-4xl font-semibold">Could not load the menu</h1>
        <p className="mt-3 text-moss/75">{error}</p>
      </div>
    )
  }
  if (!menu) return <div className="px-5 pb-32 pt-44 text-center text-moss/70">Loading menu…</div>

  let seed = 0
  return (
    <div className="pt-[72px]">
      <section className="pattern-light bg-ink px-5 py-16 text-ivory md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mint">{branch.name}</p>
          <h1 className="mt-3 font-display text-6xl font-semibold md:text-8xl">Our menu</h1>
          <button type="button" onClick={openPicker} className="mt-5 inline-flex items-center gap-2 rounded-full border border-sand/40 px-4 py-2 text-sm font-semibold transition hover:bg-ivory hover:text-ink">
            <PinIcon className="h-4 w-4" /> {branch.name} branch · change
          </button>
        </div>
      </section>

      <div className="sticky top-[72px] z-30 border-b border-ink/10 bg-ivory/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:px-8">
          <label className="relative md:w-72">
            <span className="sr-only">Search the menu</span>
            <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-moss/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search dishes"
              className="w-full rounded-full border border-ink/20 bg-ivory py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand"
            />
          </label>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {[{ id: 'all', name: 'All' }, ...menu.categories].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                aria-pressed={cat === c.id}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  cat === c.id ? 'bg-ink text-ivory' : 'bg-cream hover:bg-sand'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8">
        {sections.length === 0 && (
          <p className="py-16 text-center text-lg text-moss/70">No dishes match “{q}”.</p>
        )}
        {sections.map((c) => (
          <section key={c.id} className="mb-16" aria-labelledby={`cat-${c.id}`}>
            <Reveal>
              <h2 id={`cat-${c.id}`} className="font-display text-4xl font-semibold md:text-5xl">{c.name}</h2>
              {c.blurb && <p className="mt-2 text-moss/75">{c.blurb}</p>}
            </Reveal>
            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {c.items.map((it, i) => (
                <Reveal key={it.id} delay={(i % 3) * 90} className="h-full">
                  <FoodCard item={it} seed={seed++} orderable withStepper />
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export function FoodDetail() {
  const { slug } = useParams()
  const { branch, add, openPicker } = useStore()
  const [qty, setQty] = useState(1)
  const { menu } = useBranchMenu(branch?.slug ?? 'zoo-road')
  const item = findItem(menu, slug)
  usePageTitle(item?.name ?? 'Menu')
  const preview = !branch

  if (!menu) return <div className="px-5 pb-32 pt-44 text-center text-moss/70">Loading…</div>

  if (!item) {
    return (
      <div className="px-5 pb-32 pt-44 text-center">
        <h1 className="font-display text-5xl font-semibold">We couldn’t find that dish</h1>
        <p className="mt-3 text-moss/75">It may not be on the menu of the branch you selected.</p>
        <Link to="/menu" className="btn btn-primary mt-8">Back to the menu</Link>
      </div>
    )
  }
  const canOrder = item.price !== null && item.available
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-28 pt-32 md:grid-cols-2 md:px-8">
      <Reveal variant="left">
        <Photo label={item.name} seed={item.slug.length} className="aspect-square rounded-[2rem]" src={item.imageUrl ?? undefined} />
      </Reveal>
      <Reveal variant="right" className="self-center">
        <Link to="/menu" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-dark">
          <ArrowIcon className="h-4 w-4 rotate-180" /> Back to menu
        </Link>
        <h1 className="font-display text-5xl font-semibold md:text-7xl">{item.name}</h1>
        <p className="mt-5 text-3xl font-bold tabular-nums">{item.price === null ? 'Price to confirm' : naira(item.price)}</p>
        <p className="mt-1 text-sm text-moss/70">
          {branch ? `${branch.name} branch price` : 'Zoo Road price (preview). Choose a branch to order.'}
        </p>
        {item.note && <p className="mt-3 text-moss/80">{item.note}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {canOrder && !preview && <Stepper value={qty} onChange={setQty} label={item.name} />}
          {canOrder ? (
            <button type="button" className="btn btn-primary" onClick={() => (preview ? openPicker() : add(item, qty))}>
              {preview ? 'Choose branch to order' : 'Add to cart'}
            </button>
          ) : (
            <span className="rounded-full bg-sand px-4 py-2 text-sm font-semibold">Not available to order</span>
          )}
        </div>
      </Reveal>
    </div>
  )
}
