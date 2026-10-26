// Live menu and branch data, read from the backend. Each branch has its own prices,
// its own availability, and its own photos — nothing here is guessed or cached forever.
import { useEffect, useState } from 'react'
import { api, ApiError, imageSrc } from './api'

export interface Branch {
  slug: string
  name: string
  /** null = not yet verified. Never display an unverified value as a confirmed fact. */
  address: string | null
  phone: string | null
  hours: string | null
  services: string[] | null
  servicesNote?: string | null
  hasMenu: boolean
  pickupEnabled: boolean
  deliveryEnabled: boolean
}

export interface MenuItem {
  id: string
  slug: string
  name: string
  /** null = price still to be confirmed; the dish cannot be ordered. */
  price: number | null
  note?: string | null
  imageUrl?: string | null
  available: boolean
  featured?: boolean
}

export interface MenuCategory {
  id: string
  name: string
  blurb?: string | null
  items: MenuItem[]
}

export interface Menu {
  categories: MenuCategory[]
}

function friendlyError(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

// Both caches are process-lifetime only: a fresh page load always asks the server again,
// so a branch switching its menu on or an admin changing a price shows up on the next visit.
let branchesCache: Branch[] | null = null
let branchesPromise: Promise<Branch[]> | null = null

function loadBranches(): Promise<Branch[]> {
  if (branchesCache) return Promise.resolve(branchesCache)
  if (!branchesPromise) {
    branchesPromise = api<Branch[]>('/branches')
      .then((rows) => { branchesCache = rows; return rows })
      .catch((e) => { branchesPromise = null; throw e })
  }
  return branchesPromise
}

export function useBranches() {
  const [branches, setBranches] = useState<Branch[] | null>(branchesCache)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (branchesCache) { setBranches(branchesCache); return }
    let live = true
    loadBranches()
      .then((b) => live && setBranches(b))
      .catch((e) => live && setError(friendlyError(e, 'Could not load branches.')))
    return () => { live = false }
  }, [])
  return { branches, error }
}

export const getBranch = (branches: Branch[] | null, slug: string | null | undefined): Branch | null =>
  branches?.find((b) => b.slug === slug) ?? null

const menuCache = new Map<string, Menu>()

export function useBranchMenu(slug: string | null | undefined) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setError(null)
    if (!slug) { setMenu(null); return }
    // Always clear the cache entry before fetching so that newly uploaded dish
    // images appear on the very next visit — no hard-reload required.
    menuCache.delete(slug)
    setMenu(null)
    let live = true
    api<{ categories: any[] }>(`/branches/${slug}/menu`)
      .then((r) => {
        const m: Menu = {
          categories: r.categories.map((c) => ({
            id: c.slug,
            name: c.name,
            blurb: c.blurb,
            items: c.items.map((i: any): MenuItem => {
              // Photos uploaded through the admin dashboard live on the API; otherwise fall
              // back to the site's own photo for this dish (public/images/dishes/<slug>.jpg).
              // Photo falls back to the placeholder if that file is missing too.
              const imageUrl = i.imageUrl ? imageSrc(i.imageUrl) : `/images/dishes/${i.slug}.jpg`
              return {
                id: i.slug, slug: i.slug, name: i.name, price: i.price,
                note: i.note,
                imageUrl: imageUrl ?? undefined,
                available: i.available, featured: i.featured,
              }
            }),
          })),
        }
        menuCache.set(slug, m)
        if (live) setMenu(m)
      })
      .catch((e) => live && setError(friendlyError(e, 'Could not load the menu.')))
    return () => { live = false }
  }, [slug])
  return { menu, error }
}

export const findItem = (menu: Menu | null, slug: string | undefined): MenuItem | null =>
  menu?.categories.flatMap((c) => c.items).find((i) => i.slug === slug) ?? null

export const featuredOf = (menu: Menu | null): MenuItem[] =>
  menu ? menu.categories.flatMap((c) => c.items).filter((i) => i.featured) : []
