import { buildApp } from './app.ts'
import { config } from './config.ts'
import { migrate } from './migrate.ts'

await migrate()
buildApp().listen(config.port, () => {
  console.log(`Rashko API on :${config.port} (payments: ${config.paymentProvider}, whatsapp: ${config.whatsappProvider})`)
})
