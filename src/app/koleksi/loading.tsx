import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'

export default function CollectionLoading() {
  return (
    <>
      <PublicHeader />
      <main className="public-content" aria-busy="true" aria-live="polite">
        <section className="public-page-hero">
          <p className="eyebrow">MEMUAT KOLEKSI</p>
          <h1>Menyiapkan <em>pilihanmu.</em></h1>
        </section>
        <section className="section-wrap collection-loading" aria-label="Memuat produk">
          <div className="loading-toolbar" />
          <div className="loading-grid">
            {[1, 2, 3, 4].map((item) => <div className="loading-card" key={item} />)}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  )
}
