import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { CartIcon } from './ui'

export default function FloatingCartButton() {
  const { count, drawerOpen, setDrawerOpen } = useStore()
  const [visible, setVisible] = useState(count > 0)
  const [animating, setAnimating] = useState(false)
  const prevCount = useRef(count)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler)
    }
  }, [])

  useEffect(() => {
    if (count > 0 && prevCount.current === 0) {
      setVisible(true)
      setAnimating(true)
      const t = setTimeout(() => setAnimating(false), reduceMotion ? 0 : 400)
      prevCount.current = count
      return () => clearTimeout(t)
    }
    if (count === 0 && prevCount.current > 0) {
      setAnimating(true)
      const t = setTimeout(() => {
        setVisible(false)
        setAnimating(false)
      }, reduceMotion ? 0 : 300)
      prevCount.current = count
      return () => clearTimeout(t)
    }
    if (count > 0 && prevCount.current > 0 && count !== prevCount.current) {
      setAnimating(true)
      const t = setTimeout(() => setAnimating(false), reduceMotion ? 0 : 300)
      prevCount.current = count
      return () => clearTimeout(t)
    }
    prevCount.current = count
  }, [count, reduceMotion])

  if (!visible || count === 0) return null

  const onClick = () => {
    if (drawerOpen) return
    setDrawerOpen(true)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View cart, ${count} item${count === 1 ? '' : 's'}`}
      className={`fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-all md:hidden ${animating ? 'floating-cart-bounce' : 'floating-cart-pulse'} ${reduceMotion ? 'motion-reduce' : ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
    >
      <CartIcon className="h-6 w-6" />
      <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-ink px-1 text-xs font-bold">
        {count}
      </span>
      <style>{`
        @keyframes floating-cart-pop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes floating-cart-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes floating-cart-bounce {
          0%, 100% { transform: scale(1); }
          30% { transform: scale(1.15); }
          60% { transform: scale(0.95); }
        }
        .floating-cart-pulse {
          animation: floating-cart-pop 0.3s ease-out, floating-cart-pulse 2s ease-in-out 0.3s infinite;
        }
        .floating-cart-bounce {
          animation: floating-cart-bounce 0.3s ease-out;
        }
        .motion-reduce.floating-cart-pulse,
        .motion-reduce.floating-cart-bounce {
          animation: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-cart-pulse,
          .floating-cart-bounce {
            animation: none;
          }
        }
      `}</style>
    </button>
  )
}
