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
    <article ref={ref} className="tilt flex h-full flex-col rounded-2xl bg-cream md:rounded-3xl md:overflow-hidden">
      <Link to={`/menu/${item.slug}`} aria-label={`${item.name} details`} className="block overflow-hidden">
        <Photo
          label={item.name}
          seed={seed}
          src={item.imageUrl ?? undefined}
          className="aspect-[4/3] transition-transform duration-700 ease-out hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-2 sm:p-3 md:p-5 min-h-0">
        <h3 className="font-display text-sm leading-tight sm:text-base md:text-2xl md:font-semibold">
          <Link to={`/menu/${item.slug}`} className="hover:text-brand-dark">{item.name}</Link>
        </h3>
        {item.note && <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-moss/70 sm:mt-1 sm:line-clamp-1 sm:text-xs">{item.note}</p>}
        <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-1.5 sm:pt-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3 md:pt-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tabular-nums sm:text-sm md:text-lg">
              {item.price === null ? 'Price to confirm' : naira(item.price)}
            </p>
            {priceLabel && <p className="text-[0.55rem] uppercase tracking-wider text-moss/60 sm:text-[0.65rem] md:text-[0.7rem]">{priceLabel}</p>}
          </div>
          {unavailable ? (
            <span className="rounded-full bg-sand px-2 py-1 text-[9px] font-semibold sm:px-2 sm:py-0.5 sm:text-[10px] md:px-3 md:py-1.5 md:text-xs">Not available</span>
          ) : (
            <div className="flex w-full items-center gap-1 sm:w-auto sm:gap-1.5 md:w-auto md:gap-2">
              {withStepper && orderable && <Stepper value={qty} onChange={setQty} label={item.name} />}
              <button
                type="button"
                onClick={onAdd}
                className={`btn w-full !px-2 !py-1.5 text-[10px] leading-tight sm:w-auto sm:!px-2 sm:!py-1.5 sm:text-[11px] md:w-auto md:!px-4 md:!py-2.5 md:text-sm ${added ? 'btn-dark' : 'btn-primary'}`}
              >
                {added ? 'Added ✓' : orderable ? (<><PlusIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" /> Add to Cart</>) : 'Choose branch'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
