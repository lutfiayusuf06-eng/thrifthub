-- Apply after 20261022-public-order-customer-details.sql on MySQL 5.7.19.
-- Existing transactions retain NULL delivery and payment details.
-- Verify a fresh backup and inspect the target schema before applying.

ALTER TABLE sale_transactions
  ADD COLUMN delivery_district VARCHAR(80) NULL AFTER customer_note,
  ADD COLUMN delivery_address VARCHAR(500) NULL AFTER delivery_district,
  ADD COLUMN payment_method ENUM('transfer', 'cod') NULL AFTER delivery_address,
  ADD COLUMN delivery_fee INT UNSIGNED NOT NULL DEFAULT 0 AFTER payment_method;
