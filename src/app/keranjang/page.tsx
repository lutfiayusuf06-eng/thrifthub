import PublicFooter from '@/components/public-footer'
import PublicHeader from '@/components/public-header'
import { getDeliveryFee } from '@/lib/order-reservations'
import CartView from './cart-view'

export const dynamic = 'force-dynamic'

export default function CartPage() {
  return (
    <>
      <PublicHeader />
      <CartView deliveryFee={getDeliveryFee()} />
      <PublicFooter />
    </>
  )
}
