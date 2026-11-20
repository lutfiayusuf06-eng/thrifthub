import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'

export type ShipmentNotificationStatus = 'sending' | 'sent' | 'failed' | 'unknown'

export type ShipmentNotificationResult = {
  status: ShipmentNotificationStatus
  sentAt: string | null
  error: string | null
  alreadySent?: boolean
}

type NotificationRow = RowDataPacket & {
  id: string
  status: ShipmentNotificationStatus
  sent_at: Date | string | null
  error_message: string | null
}

type ShipmentRecipientRow = RowDataPacket & {
  transaction_id: string
  shipment_status: string
  customer_name: string | null
  customer_whatsapp: string | null
}

function toIso(value: Date | string | null) {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '')
  const international = digits.startsWith('62')
    ? digits
    : digits.startsWith('0')
      ? `62${digits.slice(1)}`
      : `62${digits}`
  return /^628[1-9]\d{6,11}$/.test(international) ? international : null
}

function publicTrackingUrl(requestUrl: string) {
  const configuredUrl = process.env.THRIFTHUB_PUBLIC_URL
  const baseUrl = configuredUrl ? new URL(configuredUrl) : new URL(requestUrl)
  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new Error('Public URL protocol is invalid.')
  }
  return new URL('/lacak-pesanan', baseUrl).toString()
}

async function setNotificationResult(
  notificationId: string,
  result: {
    status: 'sent' | 'failed' | 'unknown'
    responseBody: string | null
    errorMessage: string | null
  },
) {
  const [updated] = await getPool().execute<ResultSetHeader>(
    `UPDATE shipment_notifications
     SET status = ?, response_body = ?, error_message = ?,
         sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id = ? AND status = 'sending'`,
    [
      result.status,
      result.responseBody,
      result.errorMessage,
      result.status,
      notificationId,
    ],
  )
  if (updated.affectedRows !== 1) {
    throw new Error('Shipment notification result could not be recorded.')
  }
}

export async function sendShipmentStartedNotification(
  shipmentId: string,
  requestUrl: string,
  retry = false,
): Promise<ShipmentNotificationResult> {
  const connection = await getPool().getConnection()
  let transactionStarted = false
  let notificationId: string
  let recipient: string
  let recipientName: string
  let transactionId: string

  try {
    await connection.beginTransaction()
    transactionStarted = true
    const [shipments] = await connection.execute<ShipmentRecipientRow[]>(
      `SELECT s.transaction_id, s.status AS shipment_status,
              t.customer_name, t.customer_whatsapp
       FROM shipments s
       INNER JOIN sale_transactions t ON t.id = s.transaction_id
       WHERE s.id = ?
       FOR UPDATE`,
      [shipmentId],
    )
    const shipment = shipments[0]
    if (!shipment) throw new Error('Shipment does not exist.')
    transactionId = shipment.transaction_id
    recipientName = shipment.customer_name?.trim() ?? ''
    recipient = shipment.customer_whatsapp ? normalizeWhatsapp(shipment.customer_whatsapp) ?? '' : ''

    const [existingRows] = await connection.execute<NotificationRow[]>(
      `SELECT id, status, sent_at, error_message
       FROM shipment_notifications
       WHERE shipment_id = ? AND event_type = 'shipment_started'
       LIMIT 1
       FOR UPDATE`,
      [shipmentId],
    )
    const existing = existingRows[0]
    if (shipment.shipment_status !== 'in_transit' && !(retry && existing?.status === 'failed')) {
      throw new Error('Shipment-started notification requires an in-transit shipment.')
    }
    if (existing?.status === 'sent') {
      await connection.commit()
      return {
        status: 'sent',
        sentAt: toIso(existing.sent_at),
        error: null,
        alreadySent: true,
      }
    }
    if (existing?.status === 'sending') {
      await connection.commit()
      return { status: 'sending', sentAt: null, error: null }
    }
    if (existing?.status === 'failed' && !retry) {
      await connection.commit()
      return {
        status: 'failed',
        sentAt: null,
        error: existing.error_message ?? 'Notifikasi sebelumnya gagal.',
      }
    }
    if (retry && existing?.status !== 'failed') {
      await connection.commit()
      return {
        status: existing?.status ?? 'failed',
        sentAt: toIso(existing?.sent_at ?? null),
        error: existing?.error_message ?? 'Tidak ada notifikasi gagal yang dapat dikirim ulang.',
      }
    }

    if (existing) {
      notificationId = existing.id
      await connection.execute<ResultSetHeader>(
        `UPDATE shipment_notifications
         SET status = 'sending', attempt_count = attempt_count + 1,
             response_body = NULL, error_message = NULL, sent_at = NULL
         WHERE id = ? AND status = 'failed'`,
        [notificationId],
      )
    } else {
      notificationId = randomUUID()
      await connection.execute<ResultSetHeader>(
        `INSERT INTO shipment_notifications
         (id, shipment_id, event_type, status, attempt_count)
         VALUES (?, ?, 'shipment_started', 'sending', 1)`,
        [notificationId, shipmentId],
      )
    }
    await connection.commit()
    transactionStarted = false
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const token = process.env.FONNTE_TOKEN?.trim()
  if (!token) {
    const message = 'Fonnte belum dikonfigurasi di server.'
    await setNotificationResult(notificationId, {
      status: 'failed',
      responseBody: null,
      errorMessage: message,
    })
    return { status: 'failed', sentAt: null, error: message }
  }
  if (!recipient) {
    const message = 'Nomor WhatsApp pembeli tidak valid.'
    await setNotificationResult(notificationId, {
      status: 'failed',
      responseBody: null,
      errorMessage: message,
    })
    return { status: 'failed', sentAt: null, error: message }
  }
  if (!recipientName) {
    const message = 'Nama pembeli tidak tersedia.'
    await setNotificationResult(notificationId, {
      status: 'failed',
      responseBody: null,
      errorMessage: message,
    })
    return { status: 'failed', sentAt: null, error: message }
  }

  let trackingUrl: string
  try {
    trackingUrl = publicTrackingUrl(requestUrl)
  } catch {
    const message = 'Tautan pelacakan belum dapat dibuat.'
    await setNotificationResult(notificationId, {
      status: 'failed',
      responseBody: null,
      errorMessage: message,
    })
    return { status: 'failed', sentAt: null, error: message }
  }

  const message = [
    `Halo ${recipientName}!`,
    '',
    'Pesanan kamu di ThriftHub sudah mulai dikirim.',
    '',
    `Kode Pesanan: ${transactionId}`,
    'Status: Dalam Pengiriman',
    '',
    'Silakan lacak pesanan melalui tautan berikut:',
    trackingUrl,
    '',
    'Terima kasih sudah berbelanja di ThriftHub!',
  ].join('\n')
  const body = new FormData()
  body.set('target', recipient)
  body.set('message', message)
  body.set('countryCode', '0')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let responseBody: string | null = null
  let sent = false
  let failureMessage = 'Fonnte tidak mengonfirmasi pengiriman pesan.'

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body,
      signal: controller.signal,
      cache: 'no-store',
    })
    const responseText = await response.text()
    responseBody = responseText.replaceAll(token, '[REDACTED]').slice(0, 4000)
    let responseJson: unknown
    try {
      responseJson = JSON.parse(responseText)
    } catch {
      responseJson = null
    }
    sent = response.ok &&
      typeof responseJson === 'object' &&
      responseJson !== null &&
      'status' in responseJson &&
      responseJson.status === true
    if (!sent) failureMessage = 'Fonnte menolak atau tidak mengonfirmasi pengiriman pesan.'
  } catch (error) {
    failureMessage = error instanceof Error && error.name === 'AbortError'
      ? 'Permintaan ke Fonnte melewati batas waktu; status pengiriman belum terkonfirmasi.'
      : 'Fonnte tidak dapat dihubungi; status pengiriman belum terkonfirmasi.'
  } finally {
    clearTimeout(timeout)
  }

  const notificationStatus = sent
    ? 'sent'
    : failureMessage.includes('belum terkonfirmasi')
      ? 'unknown'
      : 'failed'
  await setNotificationResult(notificationId, {
    status: notificationStatus,
    responseBody,
    errorMessage: sent ? null : failureMessage,
  })

  return {
    status: notificationStatus,
    sentAt: sent ? new Date().toISOString() : null,
    error: sent ? null : failureMessage,
  }
}
