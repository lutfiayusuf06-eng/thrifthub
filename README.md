# ThriftHub

Etalase preloved dan sistem kasir untuk mahasiswa UNM dan masyarakat Makassar. Aplikasi memakai Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, MySQL/MariaDB, dan Auth.js.

## Menjalankan aplikasi

1. Jalankan MySQL/MariaDB melalui Laragon dan buat database `thrifthub`.
2. Salin `.env.example` ke `.env.local`, lalu isi `DATABASE_URL` dan `AUTH_SECRET`. Buat secret acak, jangan gunakan nilai contoh di produksi.
3. Pastikan nama database, host, dan port pada `DATABASE_URL` sama persis dengan yang dipakai di HeidiSQL. Pasang dependensi dan siapkan skema dengan Node.js 20.6 atau lebih baru:

   ```sh
   npm install
   node --env-file=.env.local --import tsx scripts/setup-db.ts
   node --env-file=.env.local --import tsx scripts/create-staff.ts
   npm run dev
   ```

   Skrip CLI tidak memuat `.env.local` secara otomatis; opsi `--env-file` memuat konfigurasi hanya untuk proses tersebut.
4. Buka `/admin/login` untuk masuk ke pengelola. Akun dibuat secara interaktif; kata sandi tidak disimpan di source code.

Untuk mereset kata sandi akun staf yang sudah ada, jalankan `npm run staff:reset-password` dan ikuti prompt di terminal. Periksa nama dan email akun sebelum menyetujui reset. Reset kata sandi tidak mengaktifkan akun yang nonaktif.

Pemeriksaan:

```sh
npm run typecheck
npm run lint
npm run build
```

## Fitur yang tersedia

Halaman publik mencakup beranda, katalog `/koleksi`, detail `/koleksi/[code]`, cerita `/cerita-kami`, panduan `/cara-belanja`, dan pelacakan pesanan `/lacak-pesanan`. Pembeli dapat checkout dan melacak pesanan tanpa akun; pelacakan memerlukan kode transaksi dan nomor WhatsApp yang cocok. Pengiriman ditangani kurir internal ThriftHub untuk wilayah Makassar dengan estimasi 1–2 hari setelah pembayaran dikonfirmasi dan pesanan siap dikirim. Ongkir tetap satu tarif untuk seluruh Makassar dan dapat diatur melalui `THRIFTHUB_DELIVERY_FEE`; nilai awal mempertahankan nominal yang sebelumnya digunakan aplikasi. Katalog mengambil produk dari database dan menyediakan pencarian, filter kategori/ukuran/harga/status, serta pengurutan. Detail produk lama `/produk/[code]` tetap tersedia. Produk hanya tampil setelah pemeriksaan QC lolos dan status pembersihan selesai. Catatan kain, jahitan, kancing, ritsleting, ukuran, foto HTTPS, harga pokok, dan harga jual disimpan bersama produk.

Area pengelola memakai satu dashboard terpadu di `/admin`. Sidebar dan data yang dimuat menyesuaikan role akun; modul yang tersedia mencakup ringkasan, POS/persediaan, dan struktur tim. Route `/admin/pemasaran` dan API internal khusus Teknologi/Pemasaran sudah dihapus. Divisi Teknologi dan Website serta Pemasaran dan Customer Service tetap tercantum di struktur organisasi, tetapi role keduanya tidak lagi dapat login atau diberi ke akun baru. Tugas teknologi tetap mencakup server, database, hosting, keamanan, backup, dan pemeliharaan website; pemasaran/customer service tetap menangani media sosial dan WhatsApp Business. Route lama `/admin/pos` dan `/admin/tim` tetap menjadi alias ke dashboard terpadu. Autentikasi memakai Auth.js Credentials, JWT cookie HttpOnly dengan Path khusus per tab, dan password bcrypt. ID sesi dicatat di `staff_auth_sessions` agar backend dapat mencabut sesi per tab dan membaca role aktif dari database. Setiap tab admin memakai prefix URL internal yang dibuat otomatis; prefix ini bukan token autentikasi. Cookie Path bukan batas keamanan terhadap XSS pada origin yang sama; backend tetap memeriksa sesi dan permission pada setiap endpoint. Akun baru dapat diberi peran Manajer, Produk, Keuangan, atau Logistik; endpoint admin memeriksa hak akses divisi di server.

### HTTPS lokal untuk akses jaringan (development)

`next.config.mjs` sudah mengizinkan origin `192.168.56.1`. Untuk membuat sertifikat development yang valid bagi IP tersebut di Windows, pasang `mkcert` satu kali pada komputer server, lalu jalankan PowerShell:

```powershell
winget install --id FiloSottile.mkcert --exact
mkcert -install
New-Item -ItemType Directory -Force .\certs
mkcert -key-file .\certs\thrifthub-key.pem -cert-file .\certs\thrifthub-cert.pem 192.168.56.1
npm run dev:https
```

`mkcert -install` membuat CA development lokal dan mempercayainya pada komputer server. Untuk setiap komputer klien, pindahkan hanya `rootCA.pem` dari direktori yang ditampilkan oleh `mkcert -CAROOT` melalui saluran tepercaya, verifikasi fingerprint SHA-256 secara terpisah, lalu pasang sertifikat itu ke Trusted Root Certification Authorities Windows pengguna tersebut (misalnya `certutil -user -addstore Root C:\path\to\rootCA.pem`). Jangan pernah menyalin atau membagikan `rootCA-key.pem`; siapa pun yang memilikinya dapat menerbitkan sertifikat yang dipercaya klien. Folder `certs` diabaikan Git agar sertifikat dan private key tidak masuk repository.

Next.js 16 menyediakan HTTPS melalui opsi development `--experimental-https` dan opsi custom key/certificate. Script `dev:https` mengikat hanya ke `192.168.56.1` pada port `3000`; gunakan `https://192.168.56.1:3000/admin/login`. `AUTH_URL` saat ini tidak disetel; jika kelak digunakan, atur ke `https://192.168.56.1:3000`. Cookie autentikasi tetap `HttpOnly` dan `Secure`. Jangan gunakan koneksi HTTP untuk login. Opsi HTTPS ini untuk development; deployment production memerlukan TLS termination yang dikonfigurasi dan disetujui secara terpisah.

Uji melalui browser pada komputer server dan klien: pastikan halaman HTTPS terbuka tanpa peringatan sertifikat, rincian sertifikat menunjukkan SAN `IP Address: 192.168.56.1` dan CA yang dipercaya, lalu periksa bahwa cookie sesi memiliki atribut `Secure` dan `HttpOnly`. Jangan menganggap HTTPS aktif sebelum uji ini lulus. Tabel `staff_auth_sessions` dibuat melalui migrasi additif tersendiri; migrasi itu tidak mengubah akun atau data bisnis.

Hak akses saat ini dibatasi sebagai berikut: hanya akun `roofi` yang memiliki role Super Admin dan akses penuh ke seluruh modul yang tersedia; Manajer memiliki akses penuh selain pengelolaan logistik; Produk melihat, menambah, mengedit, dan memeriksa produk; Keuangan melihat transaksi dan mengonfirmasi pembayaran transfer; Logistik mengelola pengiriman, riwayat status, dan konfirmasi uang COD setelah pesanan berstatus diterima. Super Admin tidak tersedia untuk pembuatan akun staf. Akun dengan role Teknologi atau Pemasaran ditolak pada login dan setiap endpoint staf, termasuk sesi lama. Akses Produk tidak memberikan izin transaksi atau pembayaran. Modul pengelolaan akun staf dan pengeluaran/laba operasional belum tersedia. Akun lama `operator` tetap menerima akses sebelumnya agar tidak terkunci; evaluasi dan penggantian akun lama harus dilakukan secara manual.

Role Super Admin Roofi ditambahkan melalui `database/migrations/20261110-roofi-super-admin.sql`, yang hanya mengubah akun `roofi@gmail.com` bernama `roofi`. Jalankan migrasi pada database ThriftHub yang benar sebelum login ulang agar role baru berlaku pada sesi autentikasi.

Pada 9 November 2026, akun login database `tri` (role `technology`) dan `reva` (role `marketing`) telah dicadangkan lalu dihapus setelah pemeriksaan menunjukkan tidak ada referensi transaksi, produk, pengiriman, atau riwayat status. Jumlah akun `staff_users` berubah dari 6 menjadi 4; tabel dan role organisasi tetap dipertahankan, sementara aplikasi menolak login untuk kedua role tersebut. Checkout, detail pembeli, ongkir, dan logistik memakai migrasi tambahan yang sudah tersedia di `database/migrations/20261022-public-orders-reservations.sql`, `database/migrations/20261022-public-order-customer-details.sql`, `database/migrations/20261022-public-order-delivery-payment.sql`, dan `database/migrations/20261022-logistics-shipments.sql`; terapkan berurutan hanya jika skema database belum memuat perubahan tersebut. Ambil backup dan pastikan database yang benar sebelum menerapkan migrasi apa pun. `db:setup` hanya membuat tabel yang belum ada dan tidak mengubah enum tabel lama. Pesanan transfer tetap memiliki masa reservasi 15 menit; pesanan COD menahan reservasi sampai diproses karena pembayaran dilakukan saat pengantaran. Saat COD diterima dan dikonfirmasi Logistik, status transaksi, waktu dan staf penerima, serta stok produk diperbarui dalam satu transaksi database tanpa membuat transaksi pembayaran baru. Finance menghitung COD tertunda sebagai total penjualan tetapi hanya memasukkan transaksi lunas ke pembayaran diterima dan laporan penerimaan. Baris penjualan menyimpan snapshot HPP dan harga.

Form tambah/edit Produk mendukung ukuran sesuai kategori, warna dan nuansa foto bebas, serta atribut pemeriksaan terstruktur. Migrasi `database/migrations/20261109-expand-product-intake.sql` telah diterapkan pada database `thrifthub`; kolom ukuran sekarang `VARCHAR(32)` dan atribut pemeriksaan baru nullable. Enam produk yang sudah ada tetap tersimpan dengan distribusi ukuran S (1), M (3), L (1), dan XL (1); atribut baru dibiarkan `NULL` sampai produk diedit.

Notifikasi WhatsApp saat pengiriman dimulai menggunakan Fonnte dari backend. Siapkan `FONNTE_TOKEN` dan `THRIFTHUB_PUBLIC_URL` di `.env.local`; keduanya tidak boleh diberi awalan `NEXT_PUBLIC_`. Terapkan migrasi tambahan `database/migrations/20261109-shipment-whatsapp-notifications.sql` setelah skema logistik tersedia. Status serta respons Fonnte dicatat per pengiriman dan event, dengan kirim ulang untuk respons gagal yang terkonfirmasi; timeout berstatus belum terkonfirmasi dan tidak otomatis dapat dikirim ulang untuk menghindari pesan ganda.

Belum tersedia: pengarsipan produk, alamat/resi/bukti pengiriman, pencatatan biaya operasional, laporan laba-rugi, ekspor CSV/JSON, unggah foto ke penyimpanan, dan integrasi payment gateway. Transaksi tertunda belum mengunci stok; ketersediaan diperiksa kembali saat pembayaran dikonfirmasi. Domain produksi dan nomor WhatsApp resmi juga belum ditetapkan. Metadata SEO lokal tersedia; halaman admin memakai `noindex`.

Jangan menaruh rahasia di Git; `.env.local` diabaikan. Jangan menjalankan setup skema sebelum memastikan `DATABASE_URL` menunjuk database yang benar.
