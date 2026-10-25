export interface MenuItem {
  id: string
  slug: string
  name: string
  /** Price in naira. null = price still to be confirmed (item cannot be ordered). */
  price: number | null
  note?: string
  available: boolean
}

export interface MenuCategory {
  id: string
  name: string
  blurb: string
  items: MenuItem[]
}

export interface Menu {
  id: string
  title: string
  categories: MenuCategory[]
  featured: string[]
}

export interface Branch {
  slug: string
  name: string
  /** null = not yet verified. Never display unverified values as confirmed facts. */
  address: string | null
  phone: string | null
  hours: string | null
  services: string[] | null
  servicesNote?: string
  menuId: string | null
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const item = (menuId: string, name: string, price: number | null, note?: string): MenuItem => ({
  id: `${menuId}:${slugify(name)}`,
  slug: slugify(name),
  name,
  price,
  note,
  available: true,
})

const make = (
  menuId: string,
  id: string,
  name: string,
  blurb: string,
  rows: [string, number | null, string?][],
): MenuCategory => ({
  id,
  name,
  blurb,
  items: rows.map(([n, p, note]) => item(menuId, n, p, note)),
})

const Z = 'zoo-road'
const K = 'kano-club'

export const menus: Record<string, Menu> = {
  [Z]: {
    id: Z,
    title: 'Main Menu',
    featured: [
      'mandi-chicken',
      'kabuli-meat',
      'bbq-chicken-and-rice',
      'pepper-soup-and-rice',
      'arabic-chicken-with-rice',
      'banana-juice',
    ],
    categories: [
      make(Z, 'chicken-fish', 'Chicken & Fish', 'Grilled, fried and Arabic-style chicken, plus fish meals.', [
        ['KFC With Rice', 6500],
        ['KFC Chicken Only', 5000],
        ['BBQ Chicken & Rice', 6500],
        ['BBQ Chicken Only', 5000],
        ['Extra Chicken', 4500],
        ['Big Fish With Rice', 8000],
        ['Medium Fish & Rice', 7000],
        ['Small Fish & Rice', 6500],
        ['Arabic Chicken Only', 5000],
        ['Arabic Chicken With Rice', 6500],
        ['Chips', 3500],
        ['Salad', 1000],
      ]),
      make(Z, 'rice-meat-soups', 'Rice, Meat & Soups', 'Mandi, Kabuli, soups and more.', [
        ['Mandi Chicken', 5500],
        ['Mandi Meat', 6500],
        ['Kabuli Chicken', 5500],
        ['Kabuli Meat', 6500],
        ['Extra Rice', 4000],
        ['Mix Chicken', 5500],
        ['Mix Meat', 6500],
        ['Pepper Soup & Rice', 6500],
        ['Pepper Soup Only', 5000],
        ['Homus Meat', 6500],
        ['Homus Chicken', 5500],
        ['Kabab Only', 4500],
        ['Samosa', 500],
      ]),
      make(Z, 'juices-drinks', 'Juices & Drinks', 'Fresh juices, mojitos, shakes and tea.', [
        ['Banana Juice', 2500],
        ['Avocado Juice', 2500],
        ['Zobo Drink', 1000],
        ['Tamarind Juice', 1000],
        ['Lemon Juice', 1000],
        ['Red Mojito', 2000],
        ['Green Mojito', 2000],
        ['Oreo Juice / Shake', 2500],
        ['Big Tea', 1000],
        ['Medium Tea', 800],
        ['Small Tea', 600],
        ['Orange Juice', 1500],
        ['Pineapple Juice', 1500],
        ['Watermelon Juice', 1500],
        ['Big Milk Tea', 1800],
        ['Small Milk Tea', 1000],
      ]),
    ],
  },
  [K]: {
    id: K,
    title: 'Arabic Dishes & Appetizers',
    featured: [
      'mandi-chicken',
      'mandi-meat',
      'kabuli-chicken',
      'kabuli-meat',
      'fish-with-rice',
      'masoub-with-milk',
    ],
    categories: [
      make(K, 'arabic-dishes', 'Arabic Dishes', 'Mandi, Kabuli, fish and Rashko specials.', [
        ['Mandi Chicken', 5500],
        ['Mandi Meat', 6500],
        ['Kabuli Chicken', 5500],
        ['Kabuli Meat', 6500],
        ['Kaintchkee With Rice', 6500],
        ['Rice Only', 4000],
        ['Chicken Only', 3500],
        ['Meat Only', 4500],
        ['Fish With Rice', 8500],
        ['Fish Only', 5500],
        ['Rashko KFC Without Rice', 7000],
        ['Rashko KFC With Rice', 9500],
        ['BBQ Chicken Without Rice', 7000],
        ['BBQ Chicken With Rice', 9500],
      ]),
      make(K, 'appetizers-snacks', 'Appetizers & Snacks', 'Small bites to start or share.', [
        ['Masoub With Milk', 3500],
        ['Plain Fatayer', 500],
        ['Fatayer With Eggs', 1000],
        ['Cupcake', 400],
        ['Samosa With Beef', 500],
      ]),
    ],
  },
}

// Rijiya Zaki offers the same dishes as the other branches, at the same prices:
// the Main Menu plus the Arabic dishes and appetizers that are not already on it.
const R = 'rijiya-zaki'
const inMain = new Set(menus[Z].categories.flatMap((c) => c.items.map((i) => i.slug)))
const reId = (c: MenuCategory, keep: (i: MenuItem) => boolean): MenuCategory => ({
  ...c,
  items: c.items.filter(keep).map((i) => ({ ...i, id: `${R}:${i.slug}` })),
})
menus[R] = {
  id: R,
  title: 'Full Menu',
  featured: menus[Z].featured,
  categories: [
    ...menus[Z].categories.map((c) => reId(c, () => true)),
    ...menus[K].categories.map((c) => reId(c, (i) => !inMain.has(i.slug))).filter((c) => c.items.length),
  ],
}

export const branches: Branch[] = [
  {
    slug: 'zoo-road',
    name: 'Zoo Road',
    address: '7B Zoo Road, Albasa, Kano 700103, Kano State, Nigeria',
    phone: '+234 808 803 8055',
    hours: 'Daily, 12:00 PM – 11:00 PM',
    services: ['Dine-in', 'Drive-through', 'Delivery'],
    servicesNote: 'Listed publicly. Please confirm availability with the branch.',
    menuId: Z,
  },
  {
    slug: 'kano-club',
    name: 'Kano Club',
    address: '2H42+V76, Club Rd, GRA, Kano 700221, Kano State, Nigeria',
    phone: '+234 806 622 4249',
    hours: 'Daily, 9:00 AM – 11:00 PM',
    services: ['Dine-in', 'Drive-through', 'Delivery'],
    servicesNote: 'Please confirm availability with the branch.',
    menuId: K,
  },
  {
    slug: 'rijiya-zaki',
    name: 'Rijiya Zaki',
    address: 'C41 Gwarzo Rd, New Site, Janbulo, near Next Electro, BUK, Kano 700252, Kano State, Nigeria',
    phone: '+234 808 803 8055',
    hours: 'Daily, 11:00 AM – 11:30 PM',
    services: ['Dine-in', 'Drive-through', 'Delivery'],
    servicesNote: 'Please confirm availability with the branch.',
    menuId: R,
  },
]

export const getBranch = (slug: string | null | undefined) =>
  branches.find((b) => b.slug === slug) ?? null

export const getMenu = (branch: Branch | null) => (branch?.menuId ? menus[branch.menuId] : null)

export const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`

export const TBC = 'To be confirmed'
