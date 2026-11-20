import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { Pool, PoolConnection } from 'mysql2/promise'
import { getPool } from '@/lib/db'
import type { ShipmentNotificationStatus } from '@/lib/fonnte-shipment-notification'

export type ShipmentStatus = 'ready_to_ship' | 'in_transit' | 'delivered' | 'problem'
export type ShipmentFilterStatus = ShipmentStatus | 'all'

export type LogisticsOrderItem = {
  product_code: string
  product_name: string
}

export type LogisticsOrder = {
  transaction_id: string
  shipment_id?: string | null
  transaction_status: 'pending' | 'paid' | 'cancelled' | 'expired'
  total_amount: number
  created_at: string
  paid_at: string | null
  paid_by_name: string | null
  customer_name: string | null
  customer_whatsapp: string | null
  delivery_district: string | null
  delivery_address: string | null
  customer_note: string | null
  payment_method: 'transfer' | 'cod' | null
  item_count: number
  items: LogisticsOrderItem[]
  eligible: boolean
  ineligible_reasons: string[]
}

export type ShipmentHistoryEntry = {
  id: string
  previous_status: ShipmentStatus | null
  new_status: ShipmentStatus
  changed_by_name: string | null
  note: string | null
  changed_at: string
}

export type LogisticsShipment = LogisticsOrder & {
  shipment_id: string
  status: ShipmentStatus
  courier: string | null
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  problem_note: string | null
  updated_at: string
  notification_status: ShipmentNotificationStatus | null
  notification_error: string | null
  notification_sent_at: string | null
  history: ShipmentHistoryEntry[]
}

type DateRange = { from?: string; to?: string }
type SearchFilters = DateRange & { query?: string; status?: ShipmentFilterStatus }
type QueryExecutor = Pick<Pool, 'execute'>

type OrderRow = RowDataPacket & {
  transaction_id: string
  shipment_id?: string | null
  transaction_status: 'pending' | 'paid' | 'cancelled' | 'expired'
  total_amount: number
  created_at: Date | string
  paid_at: Date | string | null
  paid_by_name: string | null
  reservation_expires_at: Date | string | null
  reservation_expired: number
  customer_name: string | null
  customer_whatsapp: string | null
  delivery_district: string | null
  delivery_address: string | null
  customer_note: string | null
  payment_method: 'transfer' | 'cod' | null
  item_count: number | string
}

type ShipmentRow = OrderRow & {
  shipment_id: string
  shipment_status: ShipmentStatus
  courier: string | null
  tracking_number: string | null
  shipped_at: Date | string | null
  delivered_at: Date | string | null
  problem_note: string | null
  shipment_updated_at: Date | string
  notification_status: ShipmentNotificationStatus | null
  notification_error: string | null
  notification_sent_at: Date | string | null
}

type ItemRow = RowDataPacket & LogisticsOrderItem & { transaction_id: string }
type HistoryRow = RowDataPacket & ShipmentHistoryEntry & {
  changed_at: Date | string
}

export class LogisticsConflictError extends Error {}
export class LogisticsNotFoundError extends Error {}
export class LogisticsEligibilityError extends Error {}

export function canTransitionShipment(
  current: ShipmentStatus,
  next: ShipmentStatus,
) {
  const allowed: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
    ready_to_ship: ['in_transit', 'problem'],
    in_transit: ['delivered', 'problem'],
    problem: ['ready_to_ship', 'in_transit'],
    delivered: [],
  }
  return allowed[current].includes(next)
}

export async function isLogisticsSchemaReady() {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT CONCAT(c.TABLE_NAME, '.', c.COLUMN_NAME)) AS available_columns
     FROM information_schema.COLUMNS c
     INNER JOIN information_schema.TABLES t
       ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
     WHERE c.TABLE_SCHEMA = DATABASE()
       AND t.ENGINE = 'InnoDB'
       AND (
         (c.TABLE_NAME = 'shipments' AND c.COLUMN_NAME IN (
           'id', 'transaction_id', 'status', 'courier', 'tracking_number',
           'shipped_at', 'delivered_at', 'problem_note', 'created_by',
           'updated_by', 'updated_at'
         ))
         OR
         (c.TABLE_NAME = 'shipment_status_history' AND c.COLUMN_NAME IN (
           'id', 'shipment_id', 'previous_status', 'new_status',
           'changed_by', 'note', 'changed_at'
         ))
         OR
         (c.TABLE_NAME = 'shipment_notifications' AND c.COLUMN_NAME IN (
           'id', 'shipment_id', 'event_type', 'status', 'attempt_count',
           'response_body', 'error_message', 'sent_at', 'created_at', 'updated_at'
         ))
       )`,
  )
  return Number(rows[0]?.available_columns) === 28
}

function iso(value: Date | string | null) {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function safeSearch(value: string | undefined) {
  const query = value?.trim().slice(0, 100)
  return query ? `%${query.replace(/[\\%_]/g, '\\$&')}%` : null
}

function dateConditions(range: DateRange, column: string) {
  const clauses: string[] = []
  const values: string[] = []
  if (range.from) {
    clauses.push(`${column} >= ?`)
    values.push(`${range.from} 00:00:00`)
  }
  if (range.to) {
    clauses.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`)
    values.push(`${range.to} 00:00:00`)
  }
  return { clauses, values }
}

async function getItemsByTransactions(
  connection: QueryExecutor,
  transactionIds: string[],
) {
  const grouped = new Map<string, LogisticsOrderItem[]>()
  if (!transactionIds.length) return grouped
  const placeholders = transactionIds.map(() => '?').join(', ')
  const [items] = await connection.execute<ItemRow[]>(
    `SELECT transaction_id, product_code, product_name
     FROM sale_items
     WHERE transaction_id IN (${placeholders})
     ORDER BY transaction_id, product_code`,
    transactionIds,
  )
  for (const item of items) {
    const list = grouped.get(item.transaction_id) ?? []
    list.push({ product_code: item.product_code, product_name: item.product_name })
    grouped.set(item.transaction_id, list)
  }
  return grouped
}

function mapOrder(row: OrderRow, items: LogisticsOrderItem[]): LogisticsOrder {
  const reasons: string[] = []
  if (Number(row.item_count) < 1) reasons.push('Transaksi belum memiliki barang.')
  if (!row.customer_name?.trim()) reasons.push('Nama penerima belum tersedia.')
  if (!row.customer_whatsapp?.trim()) reasons.push('Nomor WhatsApp penerima belum tersedia.')
  if (!row.delivery_district?.trim()) reasons.push('Kecamatan/area pengiriman belum tersedia.')
  if (!row.delivery_address?.trim()) reasons.push('Alamat pengiriman belum tersedia.')

  return {
    transaction_id: row.transaction_id,
    shipment_id: row.shipment_id,
    transaction_status: row.transaction_status,
    total_amount: Number(row.total_amount),
    created_at: iso(row.created_at) ?? '',
    paid_at: iso(row.paid_at),
    paid_by_name: row.paid_by_name,
    customer_name: row.customer_name,
    customer_whatsapp: row.customer_whatsapp,
    delivery_district: row.delivery_district,
    delivery_address: row.delivery_address,
    customer_note: row.customer_note,
    payment_method: row.payment_method,
    item_count: Number(row.item_count),
    items,
    eligible: reasons.length === 0,
    ineligible_reasons: reasons,
  }
}

const orderSelect = `
  SELECT t.id AS transaction_id, t.created_at, t.total_amount, t.paid_at,
         paid_user.name AS paid_by_name, t.reservation_expires_at,
         (t.reservation_expires_at IS NOT NULL AND t.reservation_expires_at <= CURRENT_TIMESTAMP) AS reservation_expired,
         t.customer_name, t.customer_whatsapp,
         t.delivery_district, t.delivery_address, t.customer_note, t.payment_method,
         t.status AS transaction_status,
         (SELECT COUNT(*) FROM sale_items si WHERE si.transaction_id = t.id) AS item_count
  FROM sale_transactions t
  LEFT JOIN staff_users paid_user ON paid_user.id = t.paid_by
`

export async function getLogisticsSummary() {
  const pool = getPool()
  const [[counts]] = await pool.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM shipments WHERE status = 'ready_to_ship') AS ready_shipments,
       COALESCE(SUM(s.status = 'in_transit'), 0) AS in_transit,
       COALESCE(SUM(s.status = 'delivered'), 0) AS delivered,
       COALESCE(SUM(s.status = 'problem'), 0) AS problem
     FROM shipments s`,
  )
  const [[ready]] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM sale_transactions t
     WHERE (
         t.status = 'paid'
         OR (
           t.status = 'pending' AND t.payment_method = 'cod'
           AND (t.reservation_expires_at IS NULL OR t.reservation_expires_at > CURRENT_TIMESTAMP)
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM shipments s WHERE s.transaction_id = t.id
       )
       AND EXISTS (SELECT 1 FROM sale_items si WHERE si.transaction_id = t.id)
       AND NULLIF(TRIM(t.customer_name), '') IS NOT NULL
       AND NULLIF(TRIM(t.customer_whatsapp), '') IS NOT NULL
       AND NULLIF(TRIM(t.delivery_district), '') IS NOT NULL
       AND NULLIF(TRIM(t.delivery_address), '') IS NOT NULL`,
  )
  const [recentRows] = await pool.execute<ShipmentRow[]>(
    `${orderSelect.replace('FROM sale_transactions t', `
      , s.id AS shipment_id, s.status AS shipment_status, s.courier, s.tracking_number,
        s.shipped_at, s.delivered_at, s.problem_note, s.updated_at AS shipment_updated_at
      FROM sale_transactions t`)}
     INNER JOIN shipments s ON s.transaction_id = t.id
     ORDER BY s.updated_at DESC
     LIMIT 6`,
  )
  const recentItems = await getItemsByTransactions(pool, recentRows.map((row) => row.transaction_id))
  const recent = recentRows.map((row) => ({
    transaction_id: row.transaction_id,
    status: row.shipment_status,
    courier: row.courier,
    tracking_number: row.tracking_number,
    updated_at: iso(row.shipment_updated_at) ?? '',
    item_count: Number(row.item_count),
    items: recentItems.get(row.transaction_id) ?? [],
  }))
  return {
    counts: {
      ready_to_ship: Number(ready.total) + Number(counts.ready_shipments),
      in_transit: Number(counts.in_transit),
      delivered: Number(counts.delivered),
      problem: Number(counts.problem),
    },
    recent,
  }
}

export async function getReadyToShipOrders(filters: SearchFilters = {}) {
  const conditions = [
    `(t.status = 'paid' OR (
      t.status = 'pending' AND t.payment_method = 'cod'
      AND (t.reservation_expires_at IS NULL OR t.reservation_expires_at > CURRENT_TIMESTAMP)
    ))`,
    `(s.id IS NULL OR s.status = 'ready_to_ship')`,
  ]
  const values: Array<string | number> = []
  const query = safeSearch(filters.query)
  if (query) {
    conditions.push(`(
      t.id LIKE ? OR REPLACE(t.id, '-', '') LIKE ? OR t.customer_name LIKE ?
      OR t.customer_whatsapp LIKE ? OR EXISTS (
        SELECT 1 FROM sale_items si
        WHERE si.transaction_id = t.id
          AND (si.product_code LIKE ? OR si.product_name LIKE ?)
      )
    )`)
    values.push(query, query, query, query, query, query)
  }
  const dates = dateConditions(filters, 't.created_at')
  conditions.push(...dates.clauses)
  values.push(...dates.values)
  const pool = getPool()
  const [rows] = await pool.execute<OrderRow[]>(
    `${orderSelect.replace('FROM sale_transactions t', `
      , s.id AS shipment_id
      FROM sale_transactions t
      LEFT JOIN shipments s ON s.transaction_id = t.id`)}
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT 250`,
    values,
  )
  const items = await getItemsByTransactions(pool, rows.map((row) => row.transaction_id))
  return rows.map((row) => mapOrder(row, items.get(row.transaction_id) ?? []))
}

export async function getLogisticsShipments(
  filters: SearchFilters = {},
  historyOnly = false,
) {
  const conditions: string[] = [
    historyOnly ? `s.status = 'delivered'` : `s.status IN ('in_transit', 'problem')`,
  ]
  const values: string[] = []
  if (filters.status && filters.status !== 'all') {
    conditions.push('s.status = ?')
    values.push(filters.status)
  }
  const query = safeSearch(filters.query)
  if (query) {
    conditions.push(`(
      t.id LIKE ? OR REPLACE(t.id, '-', '') LIKE ? OR t.customer_name LIKE ?
      OR t.customer_whatsapp LIKE ? OR s.courier LIKE ? OR s.tracking_number LIKE ?
      OR EXISTS (SELECT 1 FROM sale_items si WHERE si.transaction_id = t.id
        AND (si.product_code LIKE ? OR si.product_name LIKE ?))
    )`)
    values.push(query, query, query, query, query, query, query, query)
  }
  const dates = dateConditions(filters, historyOnly ? 'h.changed_at' : 's.updated_at')
  conditions.push(...dates.clauses)
  values.push(...dates.values)
  const historyJoin = historyOnly
    ? 'INNER JOIN shipment_status_history h ON h.shipment_id = s.id'
    : ''
  const pool = getPool()
  const [rows] = await pool.execute<ShipmentRow[]>(
    `${orderSelect.replace('FROM sale_transactions t', `
      , s.id AS shipment_id, s.status AS shipment_status, s.courier, s.tracking_number,
        s.shipped_at, s.delivered_at, s.problem_note, s.updated_at AS shipment_updated_at,
        n.status AS notification_status, n.error_message AS notification_error,
        n.sent_at AS notification_sent_at
      FROM sale_transactions t`) }
     INNER JOIN shipments s ON s.transaction_id = t.id
     LEFT JOIN shipment_notifications n
       ON n.shipment_id = s.id AND n.event_type = 'shipment_started'
     ${historyJoin}
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY ${historyOnly ? 'h.changed_at' : 's.updated_at'} DESC
     LIMIT 250`,
    values,
  )
  const uniqueRows = Array.from(new Map(rows.map((row) => [row.shipment_id, row])).values())
  const transactionIds = uniqueRows.map((row) => row.transaction_id)
  const shipmentIds = uniqueRows.map((row) => row.shipment_id)
  const itemsByTransaction = await getItemsByTransactions(pool, transactionIds)
  const historyByShipment = new Map<string, ShipmentHistoryEntry[]>()
  if (shipmentIds.length) {
    const placeholders = shipmentIds.map(() => '?').join(', ')
    const historyConditions = [`h.shipment_id IN (${placeholders})`]
    const historyValues: Array<string> = [...shipmentIds]
    if (historyOnly) {
      const historyDates = dateConditions(filters, 'h.changed_at')
      historyConditions.push(...historyDates.clauses)
      historyValues.push(...historyDates.values)
    }
    const [entries] = await pool.execute<HistoryRow[]>(
      `SELECT h.id, h.shipment_id, h.previous_status, h.new_status,
              h.changed_at, h.note, u.name AS changed_by_name
       FROM shipment_status_history h
       LEFT JOIN staff_users u ON u.id = h.changed_by
       WHERE ${historyConditions.join(' AND ')}
       ORDER BY h.changed_at DESC`,
      historyValues,
    )
    for (const entry of entries) {
      const list = historyByShipment.get(entry.shipment_id) ?? []
      list.push({
        id: entry.id,
        previous_status: entry.previous_status,
        new_status: entry.new_status,
        changed_by_name: entry.changed_by_name,
        note: entry.note,
        changed_at: iso(entry.changed_at) ?? '',
      })
      historyByShipment.set(entry.shipment_id, list)
    }
  }
  return uniqueRows.map((row) => ({
    ...mapOrder(row, itemsByTransaction.get(row.transaction_id) ?? []),
    shipment_id: row.shipment_id,
    status: row.shipment_status,
    courier: row.courier,
    tracking_number: row.tracking_number,
    shipped_at: iso(row.shipped_at),
    delivered_at: iso(row.delivered_at),
    problem_note: row.problem_note,
    updated_at: iso(row.shipment_updated_at) ?? '',
    notification_status: row.notification_status,
    notification_error: row.notification_error,
    notification_sent_at: iso(row.notification_sent_at),
    history: historyByShipment.get(row.shipment_id) ?? [],
  })) satisfies LogisticsShipment[]
}

async function lockPaidTransaction(connection: PoolConnection, transactionId: string) {
  const [rows] = await connection.execute<OrderRow[]>(
    `${orderSelect}
     WHERE t.id = ?
     FOR UPDATE`,
    [transactionId],
  )
  return rows[0]
}

export async function createShipment(transactionId: string, staffId: string) {
  const connection = await getPool().getConnection()
  let transactionStarted = false
  try {
    await connection.beginTransaction()
    transactionStarted = true
    const order = await lockPaidTransaction(connection, transactionId)
    if (!order) throw new LogisticsNotFoundError('Transaksi tidak ditemukan.')
    const codAwaitingPayment = order.transaction_status === 'pending' &&
      order.payment_method === 'cod' &&
      !Number(order.reservation_expired)
    if (order.transaction_status !== 'paid' && !codAwaitingPayment) {
      throw new LogisticsEligibilityError('Pengiriman hanya dapat dibuat untuk transaksi lunas atau pesanan COD yang belum kedaluwarsa.')
    }
    if (codAwaitingPayment) {
      const [products] = await connection.execute<RowDataPacket[]>(
        `SELECT p.stock_status, p.reserved_by_transaction_id
         FROM sale_items si
         INNER JOIN products p ON p.code = si.product_code
         WHERE si.transaction_id = ?
         ORDER BY p.code`,
        [transactionId],
      )
      if (products.length !== Number(order.item_count) ||
        products.some((product) =>
          product.stock_status !== 'available' ||
          product.reserved_by_transaction_id !== transactionId,
        )) {
        throw new LogisticsEligibilityError('Reservasi produk COD tidak lagi aktif.')
      }
    }
    if (Number(order.item_count) < 1) {
      throw new LogisticsEligibilityError('Transaksi belum memiliki barang.')
    }
    if (!order.customer_name?.trim() || !order.customer_whatsapp?.trim() ||
        !order.delivery_district?.trim() || !order.delivery_address?.trim()) {
      throw new LogisticsEligibilityError('Data penerima, nomor WhatsApp, area, atau alamat belum lengkap.')
    }
    const [existing] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM shipments WHERE transaction_id = ? LIMIT 1 FOR UPDATE',
      [transactionId],
    )
    if (existing.length) throw new LogisticsConflictError('Transaksi ini sudah memiliki pengiriman.')

    const shipmentId = randomUUID()
    const historyId = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO shipments (
         id, transaction_id, status, courier, shipped_at, created_by, updated_by
       ) VALUES (?, ?, 'in_transit', 'ThriftHub', CURRENT_TIMESTAMP, ?, ?)`,
      [shipmentId, transactionId, staffId, staffId],
    )
    await connection.execute<ResultSetHeader>(
      `INSERT INTO shipment_status_history
       (id, shipment_id, previous_status, new_status, changed_by, note)
       VALUES (?, ?, NULL, 'in_transit', ?, ?)`,
      [historyId, shipmentId, staffId, 'Pesanan diserahkan kepada kurir internal ThriftHub.'],
    )
    await connection.commit()
    return { shipmentId }
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    if (
      error && typeof error === 'object' && 'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    ) {
      throw new LogisticsConflictError('Transaksi ini sudah memiliki pengiriman.')
    }
    throw error
  } finally {
    connection.release()
  }
}

export async function updateShipment(
  shipmentId: string,
  staffId: string,
  input: {
    status: ShipmentStatus
    note: string
  },
) {
  const connection = await getPool().getConnection()
  let transactionStarted = false
  try {
    await connection.beginTransaction()
    transactionStarted = true
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, transaction_id, status
       FROM shipments WHERE id = ? FOR UPDATE`,
      [shipmentId],
    )
    const shipment = rows[0]
    if (!shipment) throw new LogisticsNotFoundError('Data pengiriman tidak ditemukan.')
    const currentStatus = shipment.status as ShipmentStatus
    if (currentStatus === 'delivered') {
      throw new LogisticsConflictError('Pengiriman berstatus terkirim dan tidak dapat diubah lagi.')
    }

    if (input.status !== currentStatus && !canTransitionShipment(currentStatus, input.status)) {
      throw new LogisticsConflictError('Perubahan status pengiriman tidak diizinkan.')
    }
    if (input.status === 'problem' && !input.note.trim()) {
      throw new LogisticsEligibilityError('Catatan kendala wajib diisi.')
    }
    if (input.status === currentStatus && !input.note.trim()) {
      throw new LogisticsEligibilityError('Pilih status baru atau isi catatan perubahan.')
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE shipments
       SET status = ?,
           courier = 'ThriftHub',
           shipped_at = CASE
             WHEN ? = 'in_transit' AND shipped_at IS NULL THEN CURRENT_TIMESTAMP
             ELSE shipped_at
           END,
           delivered_at = CASE
             WHEN ? = 'delivered' THEN CURRENT_TIMESTAMP
             ELSE delivered_at
           END,
           problem_note = CASE
             WHEN ? = 'problem' THEN NULLIF(?, '')
             WHEN ? = 'ready_to_ship' OR ? = 'in_transit' THEN NULL
             ELSE problem_note
           END,
           updated_by = ?
       WHERE id = ?`,
      [
        input.status,
        input.status,
        input.status,
        input.status,
        input.note.trim(),
        input.status,
        input.status,
        staffId,
        shipmentId,
      ],
    )
    if (input.status !== currentStatus || input.note.trim()) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO shipment_status_history
         (id, shipment_id, previous_status, new_status, changed_by, note)
         VALUES (?, ?, ?, ?, ?, NULLIF(?, ''))`,
        [
          randomUUID(),
          shipmentId,
          currentStatus,
          input.status,
          staffId,
          input.note.trim() || 'Status diperbarui oleh staf.',
        ],
      )
    }
    await connection.commit()
    return { shipmentId, status: input.status }
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
