import { one, q, type Db, pool } from './db.ts'

export interface Settings {
  restaurant: { name: string; phone: string | null; email: string | null; address: string | null }
  delivery: { defaultFee: number | null; freeAbove: number | null }
  notifications: { whatsappEnabled: boolean; recipients: string[] }
}

export const DEFAULTS: Settings = {
  restaurant: { name: 'Rashko Restaurant', phone: null, email: null, address: null },
  // null = not decided yet. Delivery orders are refused until a fee is set.
  delivery: { defaultFee: null, freeAbove: null },
  notifications: { whatsappEnabled: false, recipients: [] },
}

export async function getSettings(db: Db = pool): Promise<Settings> {
  const rows = await q<{ key: keyof Settings; value: any }>('select key, value from settings', [], db)
  const out: any = structuredClone(DEFAULTS)
  for (const r of rows) out[r.key] = { ...out[r.key], ...r.value }
  return out
}

export async function putSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    await q(
      `insert into settings(key, value) values ($1, $2) on conflict (key) do update set value = $2, updated_at = now()`,
      [key, JSON.stringify(value)])
  }
  return getSettings()
}
export { one }
