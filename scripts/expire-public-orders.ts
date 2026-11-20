import { createRequire } from 'node:module'
import { expirePublicOrders } from '../src/lib/order-reservations'
import { getPool } from '../src/lib/db'

const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(process.cwd())

async function main() {
  const count = await expirePublicOrders()
  console.info(`Expired ${count} public order reservation(s).`)
}

main()
  .catch((error: unknown) => {
    console.error('Failed to expire public order reservations.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await getPool().end()
  })
