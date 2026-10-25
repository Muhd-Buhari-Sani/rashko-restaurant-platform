import { useState } from 'react'
import { Link } from 'react-router-dom'
import { naira } from '../data'
import type { MenuItem } from '../live'
import { useTilt } from '../hooks'
import { useStore } from '../store'
import { Photo, PlusIcon, Stepper } from './ui'

export default function FoodCard({
  item,
  seed,
  orderable,
  priceLabel,
  withStepper = false,
}: {
  item: MenuItem
  seed: number
  /** false when no branch is chosen: the button asks the customer to choose one. */
  orderable: boolean
  priceLabel?: string
  withStepper?: boolean
}) {
  const { add, openPicker } = useStore()
  const ref = useTilt<HTMLElement>(6)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const unavailable = item.price === null || !item.available

  const onAdd = () => {
    if (!orderable) return openPicker()
    add(item, qty)
    setQty(1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 900)
  }

  return (
    <article ref={ref} className="tilt flex h-full flex-col overflow-hidden rounded-3xl bg-cream">
      <Link to={`/menu/${item.slug}`} aria-label={`${item.name} details`} className="block overflow-hidden">
        <Photo
          label={item.name}
          seed={seed}
          src={item.imageUrl ?? undefined}
          className="aspect-[4/3] transition-transform duration-700 ease-out hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl font-semibold leading-tight">
          <Link to={`/menu/${item.slug}`} className="hover:text-brand-dark">{item.name}</Link>
        </h3>
        {item.note && <p className="mt-1 text-xs text-moss/70">{item.note}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <p className="text-lg font-bold tabular-nums">
              {item.price === null ? 'Price to confirm' : naira(item.price)}
            </p>
            {priceLabel && <p className="text-[0.7rem] uppercase tracking-wider text-moss/60">{priceLabel}</p>}
          </div>
          {unavailable ? (
            <span className="rounded-full bg-sand px-3 py-1.5 text-xs font-semibold">Not available to order</span>
          ) : (
            <div className="flex items-center gap-2">
              {withStepper && orderable && <Stepper value={qty} onChange={setQty} label={item.name} />}
              <button
                type="button"
                onClick={onAdd}
                className={`btn !px-4 !py-2.5 text-sm ${added ? 'btn-dark' : 'btn-primary'}`}
              >
                {added ? 'Added ✓' : orderable ? (<><PlusIcon className="h-4 w-4" /> Add</>) : 'Choose branch'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
