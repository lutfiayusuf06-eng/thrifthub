'use client'

import PublicCheckoutForm from '@/components/public-checkout-form'

export default function ProductOrderButton({
  productCode,
  disabled = false,
}: {
  productCode: string
  disabled?: boolean
}) {
  return (
    <PublicCheckoutForm
      productCode={productCode}
      disabled={disabled}
      buttonLabel="Pesan Produk"
    />
  )
}
