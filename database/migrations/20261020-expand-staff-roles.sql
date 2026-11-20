ALTER TABLE staff_users
  MODIFY COLUMN role ENUM(
    'manager',
    'operator',
    'products',
    'technology',
    'marketing',
    'finance',
    'logistics'
  ) NOT NULL;
