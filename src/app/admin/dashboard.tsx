'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  Boxes,
  CircleUserRound,
  ClipboardList,
  History,
  Info,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react'
import { hasPermission, staffRoleLabels, type UserRole } from '@/lib/auth-types'
import { formatRupiah, type Product } from '@/lib/products'
import type {
  AdminProduct,
  AdminProductSummary,
  AdminSale,
  SaleProduct,
} from '@/lib/admin-repository'
import { teamMembers } from '@/lib/team'
import { adminTabUrl } from '@/lib/admin-tab-client'
import PosWorkspace from './pos/pos-workspace'
import FinanceWorkspace from './finance-workspace'
import LogisticsWorkspace from './logistics-workspace'

type DashboardSection =
  | 'overview'
  | 'operations'
  | 'products'
  | 'catalog'
  | 'finance'
  | 'ready-orders'
  | 'shipments'
  | 'history'
  | 'team'

type DashboardProps = {
  tabId: string
  role: UserRole
  requestedSection?: string
  userName: string
  products: AdminProduct[]
  productSummary: AdminProductSummary | null
  sales: AdminSale[]
  saleProducts: SaleProduct[]
  catalogProducts: Product[]
  logout: () => Promise<void>
}

const sectionLabels: Record<DashboardSection, string> = {
  overview: 'Ringkasan usaha',
  operations: 'POS & persediaan',
  products: 'Produk',
  catalog: 'Informasi produk',
  finance: 'Finance & Keuangan',
  'ready-orders': 'Pesanan Siap Dikirim',
  shipments: 'Pengiriman & Pelacakan',
  history: 'Riwayat Pengiriman',
  team: 'Struktur tim',
}

function getRoleNote(role: UserRole) {
  switch (role) {
    case 'products':
      return 'Kelola informasi produk, harga, stok melalui QC dan kebersihan. HPP hanya tersedia untuk tugas administrasi produk; akses transaksi dan keuangan tetap dibatasi.'
    case 'finance':
      return 'Transaksi dan konfirmasi pembayaran tersedia. Pengeluaran, modal, dan laba operasional belum dicatat dalam skema saat ini.'
    case 'logistics':
      return 'Proses pesanan lunas, catat ekspedisi dan resi, lalu pantau status hingga diterima konsumen.'
    case 'manager':
    case 'operator':
    case 'technology':
    case 'marketing':
      return 'Ringkasan menggunakan data produk dan transaksi yang tersedia. Pengeluaran operasional, pengiriman, dan modul administrasi staf belum tersedia.'
    case 'super_admin':
      return 'Akses penuh ke seluruh modul dan data operasional yang tersedia.'
  }
}

function DashboardOverview({
  role,
  products,
  sales,
  catalogProducts,
  onNavigate,
}: {
  role: UserRole
  products: AdminProduct[]
  sales: AdminSale[]
  catalogProducts: Product[]
  onNavigate: (section: DashboardSection) => void
}) {
  const canReadProducts = hasPermission(role, 'products:read')
  const canReadCatalog = hasPermission(role, 'products:catalog:read')
  const canReadSales = hasPermission(role, 'sales:read')
  const availableCount = products.filter((product) => product.stock_status === 'available').length
  const pendingCount = products.filter((product) => product.stock_status === 'qc_pending').length
  const paidSales = sales.filter((sale) => sale.status === 'paid')
  const revenue = paidSales.reduce((total, sale) => total + sale.total_amount, 0)
  const pendingSales = sales.filter((sale) => sale.status === 'pending').length

  return (
    <section className="dashboard-overview">
      <div className="dashboard-welcome">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> WORKSPACE THRIFTHUB</p>
          <h2>Selamat datang kembali.</h2>
          <p>Ringkasan dan menu disesuaikan dengan divisi serta hak akses akun Anda.</p>
        </div>
        <span className="dashboard-role-pill"><CircleUserRound size={15} /> {staffRoleLabels[role]}</span>
      </div>

      <div className="dashboard-stat-grid" aria-label="Ringkasan sesuai akses">
        {canReadProducts ? (
          <>
            <article><span>BARANG TERSEDIA</span><strong>{availableCount.toString().padStart(2, '0')}</strong><small>siap ditawarkan</small></article>
            <article><span>MENUNGGU QC</span><strong>{pendingCount.toString().padStart(2, '0')}</strong><small>perlu pemeriksaan</small></article>
          </>
        ) : null}
        {canReadCatalog ? (
          <article><span>PRODUK KATALOG</span><strong>{catalogProducts.length.toString().padStart(2, '0')}</strong><small>informasi untuk konsumen</small></article>
        ) : null}
        {canReadSales ? (
          <>
            <article><span>TRANSAKSI TERTUNDA</span><strong>{pendingSales.toString().padStart(2, '0')}</strong><small>menunggu konfirmasi lunas</small></article>
            <article><span>PENJUALAN LUNAS</span><strong>{formatRupiah(revenue)}</strong><small>{paidSales.length} transaksi tercatat</small></article>
          </>
        ) : null}
      </div>

      <section className="dashboard-shortcuts" aria-labelledby="dashboard-shortcuts-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> MENU DIVISI</p>
            <h2 id="dashboard-shortcuts-title">Ruang kerja Anda</h2>
          </div>
        </div>
        <div className="dashboard-shortcut-grid">
          {canReadProducts || canReadSales ? (
            <button type="button" onClick={() => onNavigate('operations')}>
              <span><Boxes size={18} /></span><strong>POS & Persediaan</strong><small>Produk, QC, dan transaksi sesuai izin</small><ArrowUpRight size={15} />
            </button>
          ) : null}
          {canReadCatalog ? (
            <button type="button" onClick={() => onNavigate('catalog')}>
              <span><Megaphone size={18} /></span><strong>Informasi produk</strong><small>Tinjau informasi yang tampil ke konsumen</small><ArrowUpRight size={15} />
            </button>
          ) : null}
        </div>
      </section>

      <div className="dashboard-role-note" role="note">
        <Info size={17} aria-hidden="true" />
        <p>{getRoleNote(role)}</p>
      </div>
    </section>
  )
}

function CatalogPanel({ products }: { products: Product[] }) {
  return (
    <section className="marketing-catalog" aria-labelledby="marketing-title">
      <div className="marketing-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> INFORMASI UNTUK KONSUMEN</p>
          <h2 id="marketing-title">Detail barang, <em>apa adanya.</em></h2>
          <p>Informasi ini mengikuti katalog publik agar keterangan untuk konsumen konsisten dengan halaman produk.</p>
        </div>
        <span className="marketing-count">{products.length} produk</span>
      </div>
      {products.length ? (
        <div className="marketing-product-list">
          {products.map((product) => (
            <article className="marketing-product" key={product.code}>
              <div className={`marketing-product-image product-image--${product.tone}`}>
                <img src={product.image} alt={product.imageAlt} />
              </div>
              <div className="marketing-product-copy">
                <div className="marketing-product-title">
                  <div><p className="eyebrow">{product.category} · {product.code}</p><h3>{product.name}</h3></div>
                  <span className={`inventory-status ${product.available ? 'inventory-status--available' : 'inventory-status--sold'}`}>
                    {product.available ? 'tersedia · konfirmasi stok' : 'terjual'}
                  </span>
                </div>
                <p className="marketing-product-facts">Ukuran {product.size} · {product.fit}</p>
                <p className="marketing-product-condition">{product.condition}</p>
                <p className="marketing-product-price">{formatRupiah(product.price)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty"><PackageCheck size={22} aria-hidden="true" /><p>Belum ada produk yang dapat dibagikan kepada konsumen.</p></div>
      )}
      <p className="marketing-privacy-note">Informasi HPP, transaksi, dan data pribadi konsumen tidak ditampilkan pada halaman ini.</p>
    </section>
  )
}

function TeamPanel() {
  const [lead, ...departments] = teamMembers

  return (
    <section className="team-admin-content" aria-labelledby="team-page-title">
      <div className="team-page-intro">
        <p className="eyebrow"><span className="eyebrow-line" /> STRUKTUR ORGANISASI</p>
        <h2 id="team-page-title">Satu tim, <em>enam peran.</em></h2>
        <p>Setiap divisi mendukung operasional ThriftHub dari pemilihan produk hingga pesanan diterima.</p>
      </div>
      <div className="team-chart" aria-label="Bagan organisasi ThriftHub">
        <article className={`team-card team-card--${lead.tone} team-card--lead`}>
          <p className="team-card-position">{lead.position}</p>
          <div className="team-card-body">
            <span className="team-card-index" aria-hidden="true">TH</span>
            <div>
              <h3>{lead.name}</h3>
              <p className="team-student-id">{lead.studentId}</p>
              <span className="team-role-access">{staffRoleLabels[lead.role]}</span>
              <ul>{lead.responsibilities.map((duty) => <li key={duty}>{duty}</li>)}</ul>
            </div>
          </div>
        </article>
        <div className="team-connector" aria-hidden="true" />
        <div className="team-departments">
          {departments.map((member) => (
            <article className={`team-card team-card--${member.tone}`} key={member.role}>
              <p className="team-card-position">{member.position}</p>
              <div className="team-card-body">
                <span className="team-card-index" aria-hidden="true">{member.role.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h3>{member.name}</h3>
                  <p className="team-student-id">{member.studentId}</p>
                  <p className="team-department-description">{member.department}</p>
                  <span className="team-role-access">{staffRoleLabels[member.role]}</span>
                  <ul>{member.responsibilities.map((duty) => <li key={duty}>{duty}</li>)}</ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="team-permission-note"><ShieldCheck size={18} aria-hidden="true" /><p>Menu dan data operasional tetap dibatasi menurut role akun.</p></div>
    </section>
  )
}

export default function AdminDashboard({
  tabId,
  role,
  requestedSection,
  userName,
  products,
  productSummary,
  sales,
  saleProducts,
  catalogProducts,
  logout,
}: DashboardProps) {
  const router = useRouter()
  const canUseOperations = hasPermission(role, 'products:read') || hasPermission(role, 'sales:read')
  const canManageProducts = hasPermission(role, 'products:read')
  const canUseCatalog = hasPermission(role, 'products:catalog:read')
  const canReadTeam = role !== 'super_admin' && hasPermission(role, 'team:read')
  const canManageLogistics = hasPermission(role, 'logistics:manage')
  const logisticsSections: DashboardSection[] = [
    'overview',
    'ready-orders',
    'shipments',
    'history',
  ]
  const allowedSections: readonly DashboardSection[] = role === 'logistics'
      ? logisticsSections
      : [
        'overview',
        ...(canUseOperations ? ['operations' as const] : []),
        ...(canManageProducts ? ['products' as const] : []),
        ...(canUseCatalog ? ['catalog' as const] : []),
        ...(role === 'super_admin'
          ? ['finance' as const, 'ready-orders' as const, 'shipments' as const, 'history' as const]
          : []),
        ...(canReadTeam ? ['team' as const] : []),
        ]
  const initialSection = allowedSections.find((item) => item === requestedSection) ??
      'overview'
  const [section, setSection] = useState<DashboardSection>(initialSection)
  const sections: readonly DashboardSection[] = role === 'logistics'
      ? logisticsSections
      : [
        'overview',
        ...(canUseOperations ? ['operations' as const] : []),
        ...(canManageProducts ? ['products' as const] : []),
        ...(canUseCatalog ? ['catalog' as const] : []),
        ...(role === 'super_admin'
          ? ['finance' as const, 'ready-orders' as const, 'shipments' as const, 'history' as const]
          : []),
        ]
  const icons = {
    overview: LayoutDashboard,
    operations: ClipboardList,
    products: PackageCheck,
    catalog: Megaphone,
    finance: ReceiptText,
    'ready-orders': PackageCheck,
    shipments: Truck,
    history: History,
    team: Users,
  }
  const heading = role === 'logistics' && section === 'overview'
    ? 'Ringkasan Logistik'
    : sectionLabels[section]
  const operationsHeading = role === 'finance' ? 'Keuangan & Administrasi' : sectionLabels.operations

  function navigateTo(nextSection: DashboardSection) {
    setSection(nextSection)
    router.push(adminTabUrl(
      tabId,
      nextSection === 'overview' ? '/admin' : `/admin?section=${nextSection}`,
    ))
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="wordmark admin-wordmark" href="/" aria-label="ThriftHub">
          thrift<span>hub</span><i>.</i>
        </Link>
        <p className="admin-overline">DASHBOARD TERPADU</p>
        <nav aria-label="Navigasi dashboard">
          {sections.map((item, index) => {
            const Icon = icons[item]
            return (
              <Link
                className={`admin-nav-link ${section === item ? 'admin-nav-link--active' : ''}`}
                key={item}
                href={adminTabUrl(tabId, `/admin?section=${item}`)}
                aria-current={section === item ? 'page' : undefined}
              >
                <Icon className="admin-nav-icon" size={16} aria-hidden="true" />
                {item === 'operations' ? operationsHeading : sectionLabels[item]}
                <span className="admin-nav-index">{String(index + 1).padStart(2, '0')}</span>
              </Link>
            )
          })}
          {role !== 'logistics' ? (
            <Link className="admin-nav-link" href="/#koleksi">
              <ArrowUpRight className="admin-nav-icon" size={16} aria-hidden="true" /> Lihat etalase
            </Link>
          ) : null}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-badge">
            <span>{userName.slice(0, 1).toUpperCase()}</span>
            <div><strong>{userName}</strong><small>{staffRoleLabels[role]}</small></div>
          </div>
          <form action={logout}>
            <button className="logout-button" type="submit"><LogOut size={15} aria-hidden="true" /> Keluar</button>
          </form>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">THRIFTHUB · MAKASSAR</p>
            <h1>{section === 'operations' ? operationsHeading : heading}</h1>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-secure"><ShieldCheck size={15} aria-hidden="true" /> Akses sesuai role</span>
            <Link href="/" className="admin-open-store">Etalase <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </div>
        </header>

        {section === 'overview' && role !== 'logistics' ? (
          <DashboardOverview
            role={role}
            products={products}
            sales={sales}
            catalogProducts={catalogProducts}
            onNavigate={navigateTo}
          />
        ) : null}
        {canManageLogistics && (
          section === 'overview' ||
          section === 'ready-orders' ||
          section === 'shipments' ||
          section === 'history'
        ) ? (
          <LogisticsWorkspace section={section} />
        ) : null}
        {section === 'finance' && role === 'super_admin' ? (
          <FinanceWorkspace initialSales={sales} role={role} />
        ) : null}
        {section === 'operations' && canUseOperations ? (
          role === 'finance' ? (
            <FinanceWorkspace initialSales={sales} role={role} />
          ) : (
            <PosWorkspace
              initialProducts={products}
              initialSales={sales}
              initialSaleProducts={saleProducts}
              role={role}
            />
          )
        ) : null}
        {section === 'products' && canManageProducts ? (
          <PosWorkspace
            initialProducts={products}
            initialSummary={productSummary ?? undefined}
            initialSales={[]}
            initialSaleProducts={[]}
            role={role}
            productsOnly
          />
        ) : null}
        {section === 'catalog' && canUseCatalog ? <CatalogPanel products={catalogProducts} /> : null}
        {section === 'team' && canReadTeam ? <TeamPanel /> : null}
      </div>
    </main>
  )
}
