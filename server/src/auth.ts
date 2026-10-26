import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config.ts'
import { HttpError } from './util.ts'
import { one } from './db.ts'

export type Role = 'administrator' | 'branch_manager' | 'order_manager'
export interface Staff { id: number; role: Role; branchId: number | null; name: string }

declare module 'express-serve-static-core' {
  interface Request { staff?: Staff }
}

export const signToken = (s: Staff) =>
  jwt.sign({ sub: s.id, role: s.role, branchId: s.branchId, name: s.name }, config.jwtSecret, { expiresIn: '12h' })

const bearer = (req: Request) => {
  const h = req.headers.authorization
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

/** Verifies the token AND re-checks the account, so deactivating a user cuts access immediately. */
async function resolveStaff(token: string | null): Promise<Staff> {
  if (!token) throw new HttpError(401, 'Sign in required')
  let p: any
  try { p = jwt.verify(token, config.jwtSecret) } catch { throw new HttpError(401, 'Session expired, sign in again') }
  const u = await one<{ id: number; role: Role; branch_id: number | null; name: string; active: boolean }>(
    'select id, role, branch_id, name, active from admin_users where id = $1', [p.sub])
  if (!u || !u.active) throw new HttpError(401, 'Account is not active')
  return { id: u.id, role: u.role, branchId: u.branch_id, name: u.name }
}

/** Header-only. Used everywhere except the event stream, so tokens stay out of URLs. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    req.staff = await resolveStaff(bearer(req))
    next()
  } catch (e) { next(e) }
}

/**
 * Also accepts ?token=, because EventSource cannot send an Authorization header.
 * Only for the server-sent event route: a token in a URL leaks into proxy logs,
 * browser history and Referer headers.
 */
export async function authenticateStream(req: Request, _res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.token === 'string' ? req.query.token : null
    req.staff = await resolveStaff(bearer(req) ?? q)
    next()
  } catch (e) { next(e) }
}

export const allow = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.staff || !roles.includes(req.staff.role)) return next(new HttpError(403, 'You do not have access to this'))
  next()
}

/** Branch the staff member is limited to, or null when they can see every branch. */
export const scopeBranch = (req: Request): number | null =>
  req.staff!.role === 'administrator' ? null : req.staff!.branchId

/** Throws unless the staff member may touch this branch. */
export function assertBranch(req: Request, branchId: number) {
  const s = scopeBranch(req)
  if (s !== null && s !== branchId) throw new HttpError(403, 'That belongs to another branch')
}
