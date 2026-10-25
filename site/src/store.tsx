import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getBranch, useBranches } from './live'
import type { Branch, MenuItem } from './live'

export interface CartLine {
  id: string
  slug: string
  name: string
  price: number
  qty: number
}

interface Store {
  branches: Branch[] | null
  branchesError: string | null
  branch: Branch | null
  lines: CartLine[]
  count: number
  subtotal: number
  bump: number
  drawerOpen: boolean
  setDrawerOpen: (v: boolean) => void
  pickerOpen: boolean
  openPicker: () => void
  closePicker: () => void
  chooseBranch: (slug: string) => void
  pendingSwitch: string | null
  confirmSwitch: () => void
  cancelSwitch: () => void
  add: (item: MenuItem, qty?: number) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
  toast: string | null
}

const Ctx = createContext<Store | null>(null)
const KEY = 'rashko-cart-v1'

interface Saved {
  branch: string | null
  lines: CartLine[]
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Saved
      if (Array.isArray(parsed.lines)) {
        // Older saved carts may predate the "slug" field: derive it from the id (menuId:slug).
        const lines = parsed.lines.map((l: any) => ('slug' in l ? l : { ...l, slug: String(l.id).split(':').pop() ?? l.id }))
        return { ...parsed, lines }
      }
    }
  } catch {
    /* ignore */
  }
  return { branch: null, lines: [] }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef(load()).current
  const { branches, error: branchesError } = useBranches()
  const [branchSlug, setBranchSlug] = useState<string | null>(initial.branch)
  const [lines, setLines] = useState<CartLine[]>(initial.lines)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null)
  const [bump, setBump] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ branch: branchSlug, lines }))
    } catch {
      /* ignore */
    }
  }, [branchSlug, lines])

  const branch = getBranch(branches, branchSlug)

  const chooseBranch = useCallback(
    (slug: string) => {
      if (slug === branchSlug) {
        setPickerOpen(false)
        return
      }
      if (lines.length > 0) {
        setPendingSwitch(slug)
        return
      }
      setBranchSlug(slug)
      setPickerOpen(false)
    },
    [branchSlug, lines.length],
  )

  const confirmSwitch = useCallback(() => {
    if (pendingSwitch) {
      setLines([])
      setBranchSlug(pendingSwitch)
    }
    setPendingSwitch(null)
    setPickerOpen(false)
  }, [pendingSwitch])

  const add = useCallback(
    (item: MenuItem, qty = 1) => {
      if (item.price === null || !item.available) return
      const price = item.price
      setLines((prev) => {
        const found = prev.find((l) => l.id === item.id)
        if (found) return prev.map((l) => (l.id === item.id ? { ...l, qty: l.qty + qty } : l))
        return [...prev, { id: item.id, slug: item.slug, name: item.name, price, qty }]
      })
      setBump((b) => b + 1)
      setToast(`${item.name} added to cart`)
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 2200)
    },
    [],
  )

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? { ...l, qty } : l)),
    )
  }, [])
  const remove = useCallback((id: string) => setLines((p) => p.filter((l) => l.id !== id)), [])
  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<Store>(
    () => ({
      branches,
      branchesError,
      branch,
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * l.price, 0),
      bump,
      drawerOpen,
      setDrawerOpen,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
      chooseBranch,
      pendingSwitch,
      confirmSwitch,
      cancelSwitch: () => setPendingSwitch(null),
      add,
      setQty,
      remove,
      clear,
      toast,
    }),
    [branches, branchesError, branch, lines, bump, drawerOpen, pickerOpen, chooseBranch, pendingSwitch, confirmSwitch, add, setQty, remove, clear, toast],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used inside StoreProvider')
  return v
}
