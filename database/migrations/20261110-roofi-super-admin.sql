ALTER TABLE staff_users
  MODIFY COLUMN role ENUM(
    'manager',
    'operator',
    'products',
    'technology',
    'marketing',
    'finance',
    'logistics',
    'super_admin'
  ) NOT NULL;

UPDATE staff_users
SET role = 'super_admin'
WHERE email = 'roofi@gmail.com'
  AND name = 'roofi'
  AND role = 'manager'
  AND active = 1;
