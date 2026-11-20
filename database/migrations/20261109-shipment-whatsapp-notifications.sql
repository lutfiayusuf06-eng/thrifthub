CREATE TABLE shipment_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  shipment_id CHAR(36) NOT NULL,
  event_type ENUM('shipment_started') NOT NULL,
  status ENUM('sending', 'sent', 'failed', 'unknown') NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  response_body TEXT NULL,
  error_message VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shipment_notification_event (shipment_id, event_type),
  KEY idx_shipment_notification_status (status, updated_at),
  CONSTRAINT fk_shipment_notification_shipment
    FOREIGN KEY (shipment_id)
    REFERENCES shipments(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
