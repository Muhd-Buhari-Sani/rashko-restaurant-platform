import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { Router } from 'express'
import { allow, authenticate } from './auth.ts'
import { HttpError } from './util.ts'

// Files are saved to disk under the server folder and served back at /uploads/<name>.
// For a multi-server deployment this would move to S3 or similar; a single server is fine for now.
export const UPLOAD_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'dishes')
mkdirSync(UPLOAD_DIR, { recursive: true })

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, randomUUID() + (EXT[file.mimetype] ?? '')),
})

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true)
    cb(new HttpError(400, 'Please upload a JPEG, PNG or WEBP image'))
  },
})

export const uploads = Router()
uploads.use(authenticate)
uploads.post('/image', allow('administrator'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return next(err instanceof HttpError ? err : new HttpError(400, err.message?.includes('File too large') ? 'Image must be 3MB or smaller' : 'Could not upload that image'))
    if (!req.file) return next(new HttpError(400, 'No image was received'))
    res.status(201).json({ url: `/uploads/dishes/${req.file.filename}` })
  })
})
