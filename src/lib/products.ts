export type Product = {
  code: string
  name: string
  category: string
  size: string
  productColor?: string | null
  fit: string
  price: number
  condition: string
  image: string
  imageAlt: string
  available: boolean
  reserved?: boolean
  tone: 'blue' | 'cream' | 'white' | 'olive'
  searchTerms: string[]
  qc: {
    fabric: string
    seams: string
    buttons: string
    zipper: string
  }
}

export const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
