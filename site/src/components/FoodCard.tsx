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
    <article ref={ref} className="tilt flex h-full flex-col overflow-hidden rounded-2xl bg-cream md:rounded-3xl">
      <Link to={`/menu/${item.slug}`} aria-label={`${item.name} details`} className="block overflow-hidden">
        <Photo
          label={item.name}
          seed={seed}
          src={item.imageUrl ?? undefined}
          className="aspect-[4/3] transition-transform duration-700 ease-out hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-2.5 sm:p-4 md:p-5">
        <h3 className="font-display text-base leading-tight sm:text-lg md:text-2xl md:font-semibold">
          <Link to={`/menu/${item.slug}`} className="hover:text-brand-dark">{item.name}</Link>
        </h3>
        {item.note && <p className="mt-0.5 line-clamp-1 text-[10px] text-moss/70 sm:mt-1 sm:text-xs">{item.note}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5 pt-2 sm:gap-2 sm:pt-3 md:gap-3 md:pt-4">
          <div>
            <p className="text-sm font-bold tabular-nums sm:text-base md:text-lg">
              {item.price === null ? 'Price to confirm' : naira(item.price)}
            </p>
            {priceLabel && <p className="text-[0.6rem] uppercase tracking-wider text-moss/60 sm:text-[0.7rem]">{priceLabel}</p>}
          </div>
          {unavailable ? (
            <span className="rounded-full bg-sand px-2 py-1 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs">Not available</span>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              {withStepper && orderable && <Stepper value={qty} onChange={setQty} label={item.name} />}
              <button
                type="button"
                onClick={onAdd}
                className={`btn !px-2 !py-1.5 text-[11px] sm:!px-3 sm:!py-2 sm:text-xs md:!px-4 md:!py-2.5 md:text-sm ${added ? 'btn-dark' : 'btn-primary'}`}
              >
                {added ? 'Added ✓' : orderable ? (<><PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" /> Add</>) : 'Choose branch'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
