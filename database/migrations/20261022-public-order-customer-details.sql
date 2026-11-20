-- MySQL 5.7.19 compatible. Run only after verifying a fresh backup.
-- Existing POS and historical transactions retain NULL customer fields.

ALTER TABLE sale_transactions
  ADD COLUMN customer_name VARCHAR(120) NULL AFTER public_request_key,
  ADD COLUMN customer_whatsapp VARCHAR(32) NULL AFTER customer_name,
  ADD COLUMN customer_email VARCHAR(254) NULL AFTER customer_whatsapp,
  ADD COLUMN customer_note VARCHAR(500) NULL AFTER customer_email;
