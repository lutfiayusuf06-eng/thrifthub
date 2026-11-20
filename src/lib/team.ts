import type { UserRole } from '@/lib/auth-types'

export type TeamMember = {
  name: string
  studentId: string
  position: string
  department: string
  role: UserRole
  tone: 'lead' | 'product' | 'technology' | 'marketing' | 'finance' | 'logistics'
  responsibilities: readonly string[]
}

export const teamMembers: readonly TeamMember[] = [
  {
    name: "Muhammad Roofi'u",
    studentId: '240210501028',
    position: 'Ketua Tim / Manajer Usaha',
    department: 'Koordinasi dan keputusan usaha',
    role: 'manager',
    tone: 'lead',
    responsibilities: [
      'Mengkoordinasikan kegiatan usaha',
      'Menetapkan target kerja',
      'Memantau perkembangan usaha',
      'Mengambil keputusan strategis',
      'Melakukan evaluasi usaha',
    ],
  },
  {
    name: 'Nabilah Anwar',
    studentId: '240210501039',
    position: 'Divisi Produk dan Persediaan',
    department: 'Pengadaan, pemeriksaan, dan stok',
    role: 'products',
    tone: 'product',
    responsibilities: [
      'Melakukan pengadaan pakaian thrift dan preloved',
      'Memeriksa kondisi barang',
      'Mendata ukuran dan kategori produk',
      'Memantau stok barang',
      'Bekerja sama dengan divisi pemasaran dalam menentukan produk yang akan dipromosikan',
    ],
  },
  {
    name: 'Tri Lutfia Yusuf',
    studentId: '240210500023',
    position: 'Divisi Teknologi dan Website',
    department: 'Pengelolaan teknis dan pemeliharaan website',
    role: 'technology',
    tone: 'technology',
    responsibilities: [
      'Mengelola server, database, hosting, keamanan, dan backup',
      'Memelihara website dan memastikan layanan tetap tersedia',
      'Menangani pembaruan teknis dan perbaikan sistem',
    ],
  },
  {
    name: 'Reva Febrianti',
    studentId: '240210500044',
    position: 'Divisi Pemasaran dan Customer Service',
    department: 'Promosi media sosial dan layanan pelanggan',
    role: 'marketing',
    tone: 'marketing',
    responsibilities: [
      'Merencanakan promosi dan membuat konten media sosial',
      'Mengelola akun media sosial dan WhatsApp Business',
      'Menjawab pertanyaan serta melayani pelanggan',
      'Memberikan informasi produk dan mencatat masukan konsumen',
    ],
  },
  {
    name: 'Khusnul Khatimah',
    studentId: '240210502051',
    position: 'Divisi Keuangan dan Administrasi',
    department: 'Pemasukan, pengeluaran, dan pelaporan',
    role: 'finance',
    tone: 'finance',
    responsibilities: [
      'Mencatat pemasukan dan pengeluaran',
      'Memantau penggunaan modal',
      'Menyusun rekap transaksi dan laporan keuangan',
      'Menghitung biaya pengadaan, harga pokok produk, dan margin keuntungan',
      'Membantu pengelolaan administrasi usaha',
    ],
  },
  {
    name: 'Muh. Ammar Faiqhsyah',
    studentId: '240210502005',
    position: 'Divisi Logistik dan Distribusi',
    department: 'Pengemasan, pengiriman, dan distribusi',
    role: 'logistics',
    tone: 'logistics',
    responsibilities: [
      'Menyiapkan dan mengemas pesanan',
      'Mengatur proses pengiriman barang',
      'Bekerja sama dengan jasa ekspedisi',
      'Memantau status pengiriman',
      'Memastikan pesanan diterima oleh konsumen dalam kondisi baik',
      'Membantu penanganan kendala pengiriman',
    ],
  },
]
