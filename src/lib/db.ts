import { createPool, type Pool } from 'mysql2/promise'

declare global {
  var thrifthubPool: Pool | undefined
}

export function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to the ThriftHub database.')
  }

  if (!globalThis.thrifthubPool) {
    const url = new URL(databaseUrl)
    if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
      throw new Error('DATABASE_URL must use the mysql:// or mariadb:// protocol.')
    }
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (!database) {
      throw new Error('DATABASE_URL must include a database name.')
    }
    globalThis.thrifthubPool = createPool({
      connectionLimit: 10,
      database,
      enableKeepAlive: true,
      host: url.hostname,
      password: decodeURIComponent(url.password),
      port: Number(url.port || 3306),
      queueLimit: 0,
      user: decodeURIComponent(url.username),
      waitForConnections: true,
    })
  }

  return globalThis.thrifthubPool
}
