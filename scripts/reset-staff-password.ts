import { input, password, select } from '@inquirer/prompts'
import { hash } from 'bcryptjs'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { z } from 'zod'
import { getPool } from '../src/lib/db'

const emailSchema = z.string().trim().email().max(254)

type StaffAccount = RowDataPacket & {
  id: string
  email: string
  name: string
  active: number
}

async function resetStaffPassword() {
  const pool = getPool()
  try {
    const rawEmail = await input({
      message: 'Email akun yang akan direset:',
      validate: (value) => emailSchema.safeParse(value).success || 'Masukkan email yang valid.',
    })
    const email = emailSchema.parse(rawEmail).toLocaleLowerCase('en-US')

    const [rows] = await pool.execute<StaffAccount[]>(
      'SELECT id, email, name, active FROM staff_users WHERE email = ? LIMIT 1',
      [email],
    )
    const account = rows[0]
    if (!account) throw new Error('Akun dengan email tersebut tidak ditemukan.')

    console.info(`Akun: ${account.name} (${account.email})`)
    if (!account.active) console.info('Status akun: nonaktif; reset kata sandi tidak mengaktifkan akun.')

    const confirmation = await select<'yes' | 'no'>({
      message: 'Lanjutkan reset kata sandi untuk akun ini?',
      choices: [
        { name: 'Ya, lanjutkan', value: 'yes' },
        { name: 'Tidak, batalkan', value: 'no' },
      ],
    })
    if (confirmation !== 'yes') {
      console.info('Reset kata sandi dibatalkan.')
      return
    }

    const secret = await password({
      message: 'Kata sandi baru (12–128 karakter):',
      mask: '*',
      validate: (value) => (
        value.length >= 12 && value.length <= 128
      ) || 'Gunakan 12–128 karakter.',
    })
    const passwordConfirmation = await password({
      message: 'Ulangi kata sandi baru:',
      mask: '*',
    })
    if (secret !== passwordConfirmation) throw new Error('Kata sandi tidak cocok.')

    const passwordHash = await hash(secret, 12)
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE staff_users SET password_hash = ? WHERE id = ?',
      [passwordHash, account.id],
    )
    if (result.affectedRows !== 1) throw new Error('Kata sandi tidak berhasil diubah.')

    console.info(`Kata sandi akun ${account.email} berhasil direset.`)
  } finally {
    await pool.end()
  }
}

resetStaffPassword().catch((error: unknown) => {
  console.error('Staff password reset failed.', error)
  process.exitCode = 1
})
