import type { Response } from 'express'

/** Server-sent events so the dashboard sees new orders without refreshing. */
type Client = { res: Response; branchId: number | null }
const clients = new Set<Client>()

export function addClient(res: Response, branchId: number | null) {
  const c = { res, branchId }
  clients.add(c)
  res.on('close', () => clients.delete(c))
}

export function broadcast(event: string, branchId: number, data: unknown) {
  for (const c of clients) {
    if (c.branchId !== null && c.branchId !== branchId) continue
    c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
}
