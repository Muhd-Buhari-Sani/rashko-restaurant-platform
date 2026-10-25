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

/** Verifies the token AND re-checks the account, so deactivating a user cuts access immediately. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization
    const token = h?.startsWith('Bearer ') ? h.slice(7) : typeof req.query.token === 'string' ? req.query.token : null
    if (!token) throw new HttpError(401, 'Sign in required')
    let p: any
    try { p = jwt.verify(token, config.jwtSecret) } catch { throw new HttpError(401, 'Session expired, sign in again') }
    const u = await one<{ id: number; role: Role; branch_id: number | null; name: string; active: boolean }>(
      'select id, role, branch_id, name, active from admin_users where id = $1', [p.sub])
    if (!u || !u.active) throw new HttpError(401, 'Account is not active')
    req.staff = { id: u.id, role: u.role, branchId: u.branch_id, name: u.name }
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
