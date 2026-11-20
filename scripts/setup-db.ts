import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPool } from '../src/lib/db'

async function setupDatabase() {
  const schema = await readFile(join(process.cwd(), 'database', 'schema.sql'), 'utf8')
  const statements: string[] = []
  let delimiter = ';'
  let buffer = ''

  for (const line of schema.split(/\r?\n/)) {
    const delimiterMatch = line.trim().match(/^DELIMITER\s+(\S+)$/i)
    if (delimiterMatch) {
      delimiter = delimiterMatch[1]
      continue
    }
    buffer += `${line}\n`
    let delimiterIndex = buffer.indexOf(delimiter)
    while (delimiterIndex !== -1) {
      const statement = buffer.slice(0, delimiterIndex).trim()
      if (statement) statements.push(statement)
      buffer = buffer.slice(delimiterIndex + delimiter.length)
      delimiterIndex = buffer.indexOf(delimiter)
    }
  }
  if (buffer.trim()) statements.push(buffer.trim())
  const pool = getPool()

  try {
    for (const statement of statements) {
      const triggerMatch = statement.match(/^CREATE\s+TRIGGER\s+`?([A-Za-z0-9_]+)`?/i)
      if (triggerMatch) {
        const [rows] = await pool.execute(
          `SELECT 1 FROM information_schema.TRIGGERS
           WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ? LIMIT 1`,
          [triggerMatch[1]],
        )
        if (Array.isArray(rows) && rows.length) continue
      }
      await pool.query(statement)
    }
    console.info(`Database schema applied (${statements.length} statements).`)
  } finally {
    await pool.end()
  }
}

setupDatabase().catch((error: unknown) => {
  console.error('Database schema setup failed.', error)
  process.exitCode = 1
})
