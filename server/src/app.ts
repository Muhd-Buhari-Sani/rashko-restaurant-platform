import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { ZodError } from 'zod'
import { config } from './config.ts'
import { HttpError } from './util.ts'
import { pub, webhooks, whatsapp } from './routes/public.ts'
import { admin } from './routes/admin.ts'
import { uploads } from './uploads.ts'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Last middleware in the stack. Exported so tests can mount the same behaviour on a
 * throwaway app instead of falling through to Express's default 500 + stderr logging.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return _next(err)
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details })
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid input', details: err.flatten() })
  if ((err as any)?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' })
  if ((err as any)?.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large' })
  if ((err as any)?.code === '23505') return res.status(409).json({ error: 'That already exists' })
  if ((err as any)?.code === '23503') return res.status(409).json({ error: 'That is still in use' })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
}

export function buildApp() {
  const app = express()
  app.set('trust proxy', config.trustProxy)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: config.corsOrigins }))
  app.use('/uploads', express.static(join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads')))
  app.use('/api/webhooks', webhooks) // needs the raw body, so it goes before express.json
  app.use('/webhooks/whatsapp', whatsapp) // WhatsApp Cloud API webhook (GET verify, POST events)
  app.use('/api/whatsapp', whatsapp) // also mount under /api for flexibility
  app.use(express.json({ limit: '100kb' }))
  app.use('/api/admin/uploads', uploads)
  app.use('/api/admin', admin)
  app.use('/api', pub)
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')))

  app.use(errorHandler)
  return app
}
