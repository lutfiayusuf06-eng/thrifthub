CREATE TABLE IF NOT EXISTS staff_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM(
    'manager',
    'operator',
    'products',
    'technology',
    'marketing',
    'finance',
    'logistics',
    'super_admin'
  ) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_transactions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  source ENUM('website', 'instagram', 'tiktok', 'whatsapp', 'direct') NOT NULL,
  origin ENUM('pos', 'website') NOT NULL DEFAULT 'pos',
  status ENUM('pending', 'paid', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  total_amount INT UNSIGNED NOT NULL,
  created_by CHAR(36) NULL,
  paid_by CHAR(36) NULL,
  paid_at TIMESTAMP NULL,
  reservation_expires_at DATETIME NULL,
  public_request_key CHAR(36) NULL,
  customer_name VARCHAR(120) NULL,
  customer_whatsapp VARCHAR(32) NULL,
  customer_email VARCHAR(254) NULL,
  customer_note VARCHAR(500) NULL,
  delivery_district VARCHAR(80) NULL,
  delivery_address VARCHAR(500) NULL,
  payment_method ENUM('transfer', 'cod') NULL,
  delivery_fee INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sales_status_created (status, created_at),
  INDEX idx_sales_origin_created (origin, created_at),
  INDEX idx_sales_expiration (status, reservation_expires_at),
  UNIQUE KEY uq_sales_public_request_key (public_request_key),
  CONSTRAINT fk_sales_creator FOREIGN KEY (created_by) REFERENCES staff_users(id),
  CONSTRAINT fk_sales_paid_by FOREIGN KEY (paid_by) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  size VARCHAR(32) NOT NULL,
  product_color VARCHAR(120) NULL,
  measurements VARCHAR(240) NOT NULL,
  purchase_cost INT UNSIGNED NOT NULL,
  price INT UNSIGNED NOT NULL,
  condition_note VARCHAR(500) NOT NULL,
  image_url VARCHAR(2048) NOT NULL,
  image_alt VARCHAR(180) NOT NULL,
  image_tone ENUM('blue', 'cream', 'white', 'olive') NOT NULL DEFAULT 'olive',
  photo_mood VARCHAR(120) NULL,
  product_condition ENUM('new_with_tag', 'like_new', 'excellent', 'good', 'fair') NULL,
  cleaning_condition ENUM('clean', 'needs_wash', 'special_care') NULL,
  completeness ENUM('complete', 'no_extras') NULL,
  damage_type ENUM('none', 'light_stain', 'moderate_stain', 'loose_seam', 'button_damage', 'torn', 'other') NULL,
  damage_note VARCHAR(240) NULL,
  fabric_check VARCHAR(240) NOT NULL,
  seams_check VARCHAR(240) NOT NULL,
  buttons_check VARCHAR(240) NOT NULL,
  zipper_check VARCHAR(240) NOT NULL,
  inspection_status ENUM('pending', 'passed', 'failed') NOT NULL DEFAULT 'pending',
  cleaning_status ENUM('pending', 'cleaned') NOT NULL DEFAULT 'pending',
  stock_status ENUM('qc_pending', 'available', 'sold', 'archived') NOT NULL DEFAULT 'qc_pending',
  reserved_by_transaction_id CHAR(36) NULL,
  search_terms VARCHAR(500) NOT NULL DEFAULT '',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_public (stock_status, created_at),
  INDEX idx_products_reserved_by_transaction (reserved_by_transaction_id),
  CONSTRAINT fk_products_creator FOREIGN KEY (created_by) REFERENCES staff_users(id),
  CONSTRAINT fk_products_reserved_by_transaction
    FOREIGN KEY (reserved_by_transaction_id)
    REFERENCES sale_transactions(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
  transaction_id CHAR(36) NOT NULL,
  product_code VARCHAR(32) NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  unit_price INT UNSIGNED NOT NULL,
  unit_cost INT UNSIGNED NOT NULL,
  PRIMARY KEY (transaction_id, product_code),
  CONSTRAINT fk_sale_items_transaction FOREIGN KEY (transaction_id) REFERENCES sale_transactions(id),
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_code) REFERENCES products(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
