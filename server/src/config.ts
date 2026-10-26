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

const paystackSecret = (env.PAYSTACK_SECRET_KEY ?? '').trim()
const explicitProvider = (env.PAYMENT_PROVIDER ?? '').trim().toLowerCase()

/**
 * The key itself is the switch, so going from test money to real money is only a matter of
 * replacing sk_test_… with sk_live_… in .env. PAYMENT_PROVIDER stays available as an override
 * (e.g. "mock" to demo the site before any Paystack account exists).
 */
function resolveProvider(): 'mock' | 'paystack' {
  if (explicitProvider && explicitProvider !== 'mock' && explicitProvider !== 'paystack') {
    throw new Error(`PAYMENT_PROVIDER must be "mock" or "paystack" (got "${explicitProvider}")`)
  }
  if (explicitProvider === 'mock') return 'mock'
  if (explicitProvider === 'paystack' || paystackSecret) return 'paystack'
  return 'mock'
}

const paymentProvider = resolveProvider()

if (paymentProvider === 'paystack') {
  if (!paystackSecret) {
    throw new Error('Paystack is selected but PAYSTACK_SECRET_KEY is empty. Paste the secret key from your Paystack dashboard '
      + '(sk_test_… for test mode, sk_live_… for live mode).')
  }
  if (paystackSecret.startsWith('pk_')) {
    throw new Error('PAYSTACK_SECRET_KEY is a public key (pk_…). Use the secret key instead (sk_test_… or sk_live_…) — '
      + 'the public key is only used in the browser and is not needed for this redirect flow.')
  }
  if (!/^sk_(test|live)_/.test(paystackSecret)) {
    throw new Error('PAYSTACK_SECRET_KEY does not look like a Paystack secret key (expected sk_test_… or sk_live_…).')
  }
  if (prod && paystackSecret.startsWith('sk_test_') && env.ALLOW_PAYSTACK_TEST_IN_PROD !== 'true') {
    throw new Error('Refusing to start in production with a Paystack TEST key: customers would not be charged. '
      + 'Use the live key (sk_live_…), or set ALLOW_PAYSTACK_TEST_IN_PROD=true for a staging deploy.')
  }
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
  paymentProvider,
  paymentMode: paymentProvider === 'mock'
    ? ('mock' as const)
    : paystackSecret.startsWith('sk_live_') ? ('paystack-live' as const) : ('paystack-test' as const),
  paymentTestMode: paymentProvider === 'mock' || !paystackSecret.startsWith('sk_live_'),
  paystackSecret,
  // Overridable so the Paystack client can be exercised against a stub in tests.
  paystackApiBase: (env.PAYSTACK_API_BASE ?? 'https://api.paystack.co').replace(/\/+$/, ''),
  whatsappProvider: (env.WHATSAPP_PROVIDER ?? 'console') as 'console' | 'cloud',
  whatsappToken: env.WHATSAPP_TOKEN ?? '',
  whatsappPhoneId: env.WHATSAPP_PHONE_NUMBER_ID ?? '',
}

if (prod && config.paymentProvider === 'mock') {
  throw new Error('No payment provider configured for production: set PAYSTACK_SECRET_KEY (sk_live_…).')
}
