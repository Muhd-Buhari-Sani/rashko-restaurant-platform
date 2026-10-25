import { randomInt } from 'node:crypto'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

/** Nigerian numbers -> +234XXXXXXXXXX. Throws on anything that is not a plausible number. */
export function normalizePhone(raw: string): string {
  const d = raw.replace(/[^\d+]/g, '')
  let n = d
  if (n.startsWith('+')) n = n.slice(1)
  if (n.startsWith('234')) n = n.slice(3)
  else if (n.startsWith('0')) n = n.slice(1)
  if (!/^\d{10}$/.test(n)) throw new HttpError(400, 'Enter a valid Nigerian phone number')
  return `+234${n}`
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
export const orderCode = () => 'RSK-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

export const naira = (n: number) => '₦' + n.toLocaleString('en-NG')

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
