CREATE TABLE IF NOT EXISTS staff_auth_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  staff_user_id CHAR(36) NOT NULL,
  tab_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_auth_sessions_tab (tab_id),
  INDEX idx_staff_auth_sessions_user_expiry (staff_user_id, expires_at),
  CONSTRAINT fk_staff_auth_sessions_user
    FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
