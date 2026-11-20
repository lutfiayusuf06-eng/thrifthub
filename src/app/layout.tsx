import type { Metadata, Viewport } from 'next'
import { CartProvider } from '@/components/cart-provider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'ThriftHub — Preloved Terpilih untuk Makassar',
    template: '%s | ThriftHub Makassar',
  },
  description:
    'Temukan baju thrift murah berkualitas dan fashion preloved terjangkau di Makassar. Pilihan terkurasi untuk mahasiswa UNM, dengan informasi kondisi yang transparan.',
  keywords: [
    'thrift shop Makassar',
    'pakaian preloved mahasiswa UNM',
    'baju thrift murah berkualitas',
    'fashion preloved terjangkau',
  ],
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'ThriftHub',
    title: 'ThriftHub — Preloved Terpilih untuk Makassar',
    description:
      'Pakaian preloved terpilih dengan detail kondisi yang jujur, siap menemani gaya harianmu.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ThriftHub — Preloved Terpilih untuk Makassar',
    description:
      'Baju thrift berkualitas untuk mahasiswa UNM dan warga Makassar.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0d1712',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  )
}
