import type { RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'

type OrderRow = RowDataPacket & {
  id: string
  transaction_status: 'pending' | 'paid' | 'cancelled' | 'expired'
  total_amount: number
  delivery_fee: number
  customer_name: string
  customer_whatsapp: string
  delivery_district: string
  delivery_address: string
  payment_method: 'transfer' | 'cod' | null
  paid_at: Date | string | null
  transaction_updated_at: Date | string
  shipment_status: 'ready_to_ship' | 'in_transit' | 'delivered' | 'problem' | null
  shipment_updated_at: Date | string | null
  delivered_at: Date | string | null
}

type ItemRow = RowDataPacket & {
  product_code: string
  product_name: string
  unit_price: number
}

function normalizedWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.startsWith('62') ? `0${digits.slice(2)}` : digits
}

function toIso(value: Date | string | null) {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function paymentLabel(status: OrderRow['transaction_status']) {
  const labels = {
    pending: 'Menunggu pembayaran',
    paid: 'Lunas',
    cancelled: 'Dibatalkan',
    expired: 'Kedaluwarsa',
  } satisfies Record<OrderRow['transaction_status'], string>
  return labels[status]
}

function orderStatusLabel(order: OrderRow) {
  if (order.transaction_status !== 'paid') return paymentLabel(order.transaction_status)
  const shipmentLabels = {
    ready_to_ship: 'Siap dikirim',
    in_transit: 'Dalam pengiriman',
    delivered: 'Pesanan selesai',
    problem: 'Pengiriman terkendala',
  } as const
  return order.shipment_status
    ? shipmentLabels[order.shipment_status]
    : 'Pembayaran dikonfirmasi · menunggu persiapan pengiriman'
}

export async function getPublicOrderTracking(orderCode: string, whatsapp: string) {
  const [rows] = await getPool().execute<OrderRow[]>(
    `SELECT t.id, t.status AS transaction_status, t.total_amount, t.delivery_fee,
            t.customer_name, t.customer_whatsapp, t.delivery_district,
            t.delivery_address, t.payment_method, t.paid_at,
            t.updated_at AS transaction_updated_at,
            s.status AS shipment_status, s.updated_at AS shipment_updated_at,
            s.delivered_at
     FROM sale_transactions t
     LEFT JOIN shipments s ON s.transaction_id = t.id
     WHERE t.id = ? AND t.origin = 'website'
     LIMIT 1`,
    [orderCode],
  )
  const order = rows[0]
  if (!order || normalizedWhatsapp(order.customer_whatsapp) !== normalizedWhatsapp(whatsapp)) {
    return null
  }

  const [items] = await getPool().execute<ItemRow[]>(
    `SELECT product_code, product_name, unit_price
     FROM sale_items
     WHERE transaction_id = ?
     ORDER BY product_code`,
    [order.id],
  )
  const updatedAt = order.shipment_updated_at ?? order.paid_at ?? order.transaction_updated_at
  return {
    orderCode: order.id,
    items: items.map((item) => ({
      productCode: item.product_code,
      productName: item.product_name,
      unitPrice: Number(item.unit_price),
    })),
    totalAmount: Number(order.total_amount),
    deliveryFee: Number(order.delivery_fee),
    recipientName: order.customer_name,
    deliveryDistrict: order.delivery_district,
    deliveryAddress: order.delivery_address,
    paymentMethod: order.payment_method,
    paymentStatus: paymentLabel(order.transaction_status),
    status: orderStatusLabel(order),
    courier: order.shipment_status ? 'Kurir internal ThriftHub' : null,
    estimatedDelivery: order.shipment_status === 'delivered'
      ? 'Pengiriman telah selesai.'
      : order.transaction_status === 'paid'
        ? '1–2 hari setelah pembayaran dikonfirmasi dan pesanan siap dikirim.'
        : 'Estimasi dihitung setelah pembayaran dikonfirmasi dan pesanan siap dikirim.',
    updatedAt: toIso(updatedAt),
  }
}
