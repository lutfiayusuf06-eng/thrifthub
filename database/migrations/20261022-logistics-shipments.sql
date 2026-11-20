-- MySQL 5.7.19 compatible.
-- Create only after reviewing the schema and taking a verified backup.
-- One shipment record is allowed per sale transaction in this initial version.

CREATE TABLE shipments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  transaction_id CHAR(36) NOT NULL,
  courier VARCHAR(100) NULL,
  tracking_number VARCHAR(100) NULL,
  status ENUM(
    'ready_to_ship',
    'in_transit',
    'delivered',
    'problem'
  ) NOT NULL DEFAULT 'ready_to_ship',
  shipped_at DATETIME NULL,
  delivered_at DATETIME NULL,
  problem_note VARCHAR(1000) NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_shipments_transaction (transaction_id),
  KEY idx_shipments_status_updated (status, updated_at),
  KEY idx_shipments_created_by (created_by),
  KEY idx_shipments_updated_by (updated_by),

  CONSTRAINT fk_shipments_transaction
    FOREIGN KEY (transaction_id)
    REFERENCES sale_transactions(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  CONSTRAINT fk_shipments_created_by
    FOREIGN KEY (created_by)
    REFERENCES staff_users(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  CONSTRAINT fk_shipments_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES staff_users(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shipment_status_history (
  id CHAR(36) NOT NULL PRIMARY KEY,
  shipment_id CHAR(36) NOT NULL,
  previous_status ENUM(
    'ready_to_ship',
    'in_transit',
    'delivered',
    'problem'
  ) NULL,
  new_status ENUM(
    'ready_to_ship',
    'in_transit',
    'delivered',
    'problem'
  ) NOT NULL,
  changed_by CHAR(36) NULL,
  note VARCHAR(1000) NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_shipment_history_time (shipment_id, changed_at),
  KEY idx_shipment_history_changed_by (changed_by),

  CONSTRAINT fk_shipment_history_shipment
    FOREIGN KEY (shipment_id)
    REFERENCES shipments(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  CONSTRAINT fk_shipment_history_actor
    FOREIGN KEY (changed_by)
    REFERENCES staff_users(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
