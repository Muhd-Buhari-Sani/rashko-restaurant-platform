import pg from 'pg'
import { config } from './config.ts'

export const pool = new pg.Pool({ connectionString: config.databaseUrl })

export type Db = Pick<pg.Pool, 'query'>

export async function q<T = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  return (await db.query(text, params)).rows as T[]
}
export async function one<T = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  return (await q<T>(text, params, db))[0] ?? null
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try {
    await c.query('begin')
    const out = await fn(c)
    await c.query('commit')
    return out
  } catch (e) {
    await c.query('rollback')
    throw e
  } finally {
    c.release()
  }
}
