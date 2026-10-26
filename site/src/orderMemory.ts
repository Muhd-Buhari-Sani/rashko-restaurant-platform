// Small helpers that remember just enough about an order to finish the flow on the
// return trip from the payment page. sessionStorage is per-tab and clears when the
// tab closes, so nothing here outlives the checkout it belongs to.

export interface RememberedOrder {
  code: string
  phone: string
  reference?: string
  total?: number
}

const orderKey = (code: string) => `rashko-order:${code.trim().toUpperCase()}`
const paymentKey = (reference: string) => `rashko-payment:${reference.trim().toUpperCase()}`
const LATEST = 'rashko-order:latest'

function read<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode: the flow still works, it just asks for the phone again */
  }
}

/** Called at checkout, before the browser leaves for the payment page. */
export function rememberOrder(o: RememberedOrder) {
  const code = o.code.trim().toUpperCase()
  write(orderKey(code), { ...o, code })
  write(LATEST, { code, phone: o.phone })
  if (o.reference) write(paymentKey(o.reference), { code, total: o.total })
}

export const recallOrder = (code: string) => read<RememberedOrder>(orderKey(code))

/** The test-payment page uses this to show the amount without asking the server. */
export const recallPayment = (reference: string) => read<{ code: string; total?: number }>(paymentKey(reference))

export const latestOrder = () => read<{ code: string; phone: string }>(LATEST)

/** Used by the manual tracking form so the phone is only asked for once per order. */
export function rememberPhone(code: string, phone: string) {
  const c = code.trim().toUpperCase()
  const prev = recallOrder(c)
  write(orderKey(c), prev ? { ...prev, phone } : { code: c, phone })
}
