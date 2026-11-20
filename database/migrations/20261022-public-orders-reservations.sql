-- MySQL 5.7.19 compatible. Run once against a verified backup/isolated clone first.
-- Existing rows default to origin='pos'; existing source values remain unchanged.

ALTER TABLE sale_transactions
  MODIFY COLUMN status
    ENUM('pending', 'paid', 'cancelled', 'expired')
    NOT NULL DEFAULT 'pending',
  MODIFY COLUMN created_by CHAR(36) NULL,
  ADD COLUMN origin ENUM('pos', 'website')
    NOT NULL DEFAULT 'pos' AFTER source,
  ADD COLUMN reservation_expires_at DATETIME NULL AFTER paid_at,
  ADD COLUMN public_request_key CHAR(36) NULL,
  ADD UNIQUE KEY uq_sales_public_request_key (public_request_key),
  ADD KEY idx_sales_origin_created (origin, created_at),
  ADD KEY idx_sales_expiration (status, reservation_expires_at);

ALTER TABLE products
  ADD COLUMN reserved_by_transaction_id CHAR(36) NULL AFTER stock_status,
  ADD KEY idx_products_reserved_by_transaction (reserved_by_transaction_id),
  ADD CONSTRAINT fk_products_reserved_by_transaction
    FOREIGN KEY (reserved_by_transaction_id)
    REFERENCES sale_transactions(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT;

DELIMITER //

CREATE TRIGGER trg_sales_origin_creator_insert
BEFORE INSERT ON sale_transactions
FOR EACH ROW
BEGIN
  IF (NEW.origin = 'website' AND NEW.created_by IS NOT NULL)
    OR (NEW.origin = 'pos' AND NEW.created_by IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'created_by must be NULL only for website orders';
  END IF;
END//

CREATE TRIGGER trg_sales_origin_creator_update
BEFORE UPDATE ON sale_transactions
FOR EACH ROW
BEGIN
  IF (NEW.origin = 'website' AND NEW.created_by IS NOT NULL)
    OR (NEW.origin = 'pos' AND NEW.created_by IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'created_by must be NULL only for website orders';
  END IF;
END//

DELIMITER ;
