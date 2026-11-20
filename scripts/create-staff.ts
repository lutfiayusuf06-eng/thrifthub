import { input, password, select } from '@inquirer/prompts'
import { hash } from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool } from '../src/lib/db'
import {
  assignableUserRoles,
  staffRoleLabels,
  type AssignableUserRole,
} from '../src/lib/auth-types'

const emailSchema = z.string().trim().email().max(254)

async function createStaffUser() {
  const pool = getPool()
  try {
    const name = (await input({
      message: 'Nama anggota:',
      validate: (value) => value.trim().length > 0 || 'Nama wajib diisi.',
    })).trim()

    const rawEmail = await input({
      message: 'Email:',
      validate: (value) => emailSchema.safeParse(value).success || 'Masukkan email yang valid.',
    })
    const email = emailSchema.parse(rawEmail).toLocaleLowerCase('en-US')

    const role = await select<AssignableUserRole>({
      message: 'Peran akses:',
      choices: assignableUserRoles.map((value) => ({
        name: staffRoleLabels[value],
        value,
      })),
    })

    const secret = await password({
      message: 'Kata sandi (minimal 12 karakter):',
      mask: '*',
      validate: (value) => value.length >= 12 || 'Gunakan minimal 12 karakter.',
    })
    const confirmation = await password({
      message: 'Ulangi kata sandi:',
      mask: '*',
    })
    if (secret !== confirmation) throw new Error('Kata sandi tidak cocok.')

    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM staff_users WHERE email = ? LIMIT 1',
      [email],
    )
    if (existing.length) throw new Error('Email tersebut sudah terdaftar.')

    const passwordHash = await hash(secret, 12)
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO staff_users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), email, name, passwordHash, role],
    )
    if (result.affectedRows !== 1) throw new Error('Akun tidak berhasil dibuat.')

    console.info(`Akun ${role} berhasil dibuat untuk ${email}.`)
  } finally {
    await pool.end()
  }
}

createStaffUser().catch((error: unknown) => {
  console.error('Staff account setup failed.', error)
  process.exitCode = 1
})
