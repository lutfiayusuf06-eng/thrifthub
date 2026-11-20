import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { signIn } from '@/auth'
import { adminTabPath } from '@/lib/admin-tab-path'
import { currentAdminTabId } from '@/lib/admin-tab-session'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import TabSessionBootstrap from './tab-session-bootstrap'

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>
}

async function authenticate(formData: FormData) {
  'use server'

  const tabId = await currentAdminTabId()
  if (!tabId) redirect('/admin/login')

  const email = formData.get('email')
  const password = formData.get('password')
  if (typeof email !== 'string' || typeof password !== 'string') {
    redirect(adminTabPath(tabId, '/admin/login?error=credentials'))
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: adminTabPath(tabId, '/admin'),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(adminTabPath(tabId, '/admin/login?error=credentials'))
    }
    throw error
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <main className="login-page">
      <TabSessionBootstrap />
      <div className="login-panel">
        <a className="wordmark login-wordmark" href="/" aria-label="Kembali ke ThriftHub">
          thrift<span>hub</span><i>.</i>
        </a>
        <div className="login-icon"><ShieldCheck size={21} aria-hidden="true" /></div>
        <p className="eyebrow">AREA PENGELOLA</p>
        <h1>Selamat datang<br /><em>kembali.</em></h1>
        <p className="login-intro">
          Masuk dengan akun anggota tim. Dashboard terpadu akan menampilkan menu dan data
          sesuai divisi serta hak akses Anda.
        </p>
        <form className="login-form" action={authenticate}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
          />
          <label htmlFor="password">Kata sandi</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
          {error ? (
            <p className="login-error" role="alert">
              Email atau kata sandi tidak cocok. Periksa kembali lalu coba lagi.
            </p>
          ) : null}
          <button className="button button--gold" type="submit">
            Masuk ke dashboard <ArrowRight size={15} aria-hidden="true" />
          </button>
        </form>
        <p className="login-safety">Akses terbatas untuk anggota tim ThriftHub.</p>
      </div>
    </main>
  )
}
