import 'dotenv/config'

const env = process.env
const prod = env.NODE_ENV === 'production'

function parseTrustProxy(v: string | undefined): boolean | number | string {
  if (v === undefined || v.trim() === '' || v === 'false') return false // default: trust nobody
  if (v === 'true') return true
  if (/^\d+$/.test(v)) return Number(v)
  return v // "loopback", or a comma-separated list of subnets
}

if (prod && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a long random string in production')
}

export const config = {
  prod,
  port: Number(env.PORT ?? 4000),
  // Who to believe when reading X-Forwarded-For. Rate limiting keys on the client IP,
  // so trusting a header an attacker can set lets them rotate identities and dodge every
  // limit (including the login limit, i.e. unlimited password guesses). Default: trust
  // nobody. Set TRUST_PROXY=1 only when a proxy you control sits in front of the API and
  // sets X-Forwarded-For itself.
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  databaseUrl: env.DATABASE_URL ?? 'postgres://rashko:rashko@localhost:5432/rashko',
  jwtSecret: env.JWT_SECRET ?? 'dev-only-secret-do-not-use-in-production',
  appUrl: env.APP_URL ?? 'http://localhost:5173',
  corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174').split(',').map((s) => s.trim()),
  paymentProvider: (env.PAYMENT_PROVIDER ?? 'mock') as 'mock' | 'paystack',
  paystackSecret: env.PAYSTACK_SECRET_KEY ?? '',
  paymentFallbackEmail: env.PAYMENT_FALLBACK_EMAIL ?? 'orders@example.com',
  whatsappProvider: (env.WHATSAPP_PROVIDER ?? 'console') as 'console' | 'cloud',
  whatsappToken: env.WHATSAPP_TOKEN ?? '',
  whatsappPhoneId: env.WHATSAPP_PHONE_NUMBER_ID ?? '',
}

if (config.paymentProvider === 'paystack' && !config.paystackSecret) {
  throw new Error('PAYMENT_PROVIDER=paystack needs PAYSTACK_SECRET_KEY')
}
if (prod && config.paymentProvider === 'mock') {
  throw new Error('PAYMENT_PROVIDER=mock is not allowed in production')
}
