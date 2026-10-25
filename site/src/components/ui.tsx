import { useState } from 'react'
import type { ReactNode } from 'react'
import { useReveal } from '../hooks'

type IconProps = { className?: string }
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const CartIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1" />
    <circle cx="9.5" cy="19.5" r="1.2" />
    <circle cx="17" cy="19.5" r="1.2" />
  </svg>
)
export const MenuIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
)
export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const MinusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14" />
  </svg>
)
export const PinIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
)
export const PhoneIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 4h3.5l1.6 4-2 1.3a11 11 0 0 0 5.6 5.6l1.3-2 4 1.6V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
)
export const ClockIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const ArrowIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const TrashIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
  </svg>
)
export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4-4" />
  </svg>
)

export const Star = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
    <path
      d="M32 4l7 14.5L55 11l-7 16 11 5-11 5 7 16-16-7.5L32 60l-7-14.5L9 53l7-16L5 32l11-5-7-16 16 7.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    />
  </svg>
)

export function Reveal({
  children,
  className = '',
  delay = 0,
  variant = '',
}: {
  children: ReactNode
  className?: string
  delay?: number
  variant?: '' | 'left' | 'right' | 'zoom'
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`reveal ${variant} ${className}`}
      style={{ ['--d' as string]: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

const palettes: [string, string][] = [
  ['#58b384', '#0b6b44'],
  ['#9ccf9e', '#2f7d55'],
  ['#79b89a', '#15543a'],
  ['#b7d9a8', '#3c8a5a'],
  ['#6fc3a0', '#0c5a3e'],
]

/** Shows a real photo when `src` is given and loads; falls back to an honest placeholder otherwise. */
export function Photo({
  label,
  seed = 0,
  className = '',
  caption = true,
  src,
}: {
  label: string
  seed?: number
  className?: string
  caption?: boolean
  src?: string | null
}) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      </div>
    )
  }
  const [a, b] = palettes[Math.abs(seed) % palettes.length]
  return (
    <div
      className={`photo-ph grid place-items-center text-ivory ${className}`}
      style={{ ['--ph-a' as string]: a, ['--ph-b' as string]: b }}
      role="img"
      aria-label={`${label} (photo coming soon)`}
    >
      <div className="relative z-10 px-4 text-center">
        <Star size={34} className="mx-auto mb-2 opacity-80" />
        {caption && (
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] opacity-85">
            Photo coming soon
          </p>
        )}
      </div>
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  min = 1,
  label,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  label: string
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-ink/20 bg-ivory">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-sand active:scale-90"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(value + 1)}
        className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-sand active:scale-90"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  children,
  light = false,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
  light?: boolean
}) {
  return (
    <div className="max-w-2xl">
      <p
        className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] ${light ? 'text-mint' : 'text-brand-dark'}`}
      >
        <Star size={14} /> {eyebrow}
      </p>
      <h2 className="font-display text-4xl font-semibold md:text-6xl">{title}</h2>
      {children && (
        <p className={`mt-4 text-base leading-relaxed md:text-lg ${light ? 'text-sand/80' : 'text-moss/80'}`}>
          {children}
        </p>
      )}
    </div>
  )
}
