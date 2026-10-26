import { buildApp } from './app.ts'
import { config } from './config.ts'
import { migrate } from './migrate.ts'

await migrate()
buildApp().listen(config.port, () => {
  console.log(`Rashko API on :${config.port} (payments: ${config.paymentMode}, whatsapp: ${config.whatsappProvider})`)
  if (config.paymentProvider === 'mock') {
    console.log('  no Paystack key set: checkout uses the demo payment page (/pay/mock).')
  } else if (config.paymentTestMode) {
    console.log('  Paystack TEST mode: cards are not charged. Use a Paystack test card.')
  } else {
    console.log('  Paystack LIVE mode: real payments will be charged.')
  }
})
