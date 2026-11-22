
import { createPool, type Pool } from 'mysql2/promise'
import fs from 'node:fs'

declare global {
  var thrifthubPool: Pool | undefined
}

function getDatabaseCaCertificate(): Buffer | string {
  const caCertificate = process.env.TIDB_CA_CERT
  if (caCertificate?.trim()) {
    return caCertificate.replace(/\\n/g, '\n')
  }

  const caPath = process.env.TIDB_CA_PATH
  if (!caPath || !fs.existsSync(caPath)) {
    throw new Error(
      'TIDB_CA_CERT or a valid TIDB_CA_PATH is required for non-local database connections.',
    )
  }

  return fs.readFileSync(caPath)
}

export function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required to connect to the ThriftHub database.'
    )
  }

  if (!globalThis.thrifthubPool) {
    const url = new URL(databaseUrl)

    if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
      throw new Error(
        'DATABASE_URL must use mysql:// or mariadb://.'
      )
    }

    const database = decodeURIComponent(
      url.pathname.replace(/^\/+/, '')
    )

    if (!database) {
      throw new Error('DATABASE_URL must include a database name.')
    }

    const isLocalDatabaseHost = ['localhost', '127.0.0.1'].includes(
      url.hostname.toLowerCase(),
    )

    globalThis.thrifthubPool = createPool({
      connectionLimit: 5,
      database,
      enableKeepAlive: true,
      host: url.hostname,
      password: decodeURIComponent(url.password),
      port: Number(url.port || 4000),
      queueLimit: 0,
      user: decodeURIComponent(url.username),
      waitForConnections: true,
      ...(isLocalDatabaseHost
        ? {}
        : {
            ssl: {
              ca: getDatabaseCaCertificate(),
              rejectUnauthorized: true,
            },
          }),
    })
  }

  return globalThis.thrifthubPool
}
