-- Safe, non-destructive extension for free-form sizes and product intake checks.
-- Existing size values are preserved when the ENUM is widened to VARCHAR.
-- New attributes remain NULL for existing product rows until explicitly edited.
ALTER TABLE products
  MODIFY COLUMN size VARCHAR(32) NOT NULL,
  ADD COLUMN product_color VARCHAR(120) NULL AFTER size,
  ADD COLUMN photo_mood VARCHAR(120) NULL AFTER image_tone,
  ADD COLUMN product_condition ENUM(
    'new_with_tag',
    'like_new',
    'excellent',
    'good',
    'fair'
  ) NULL AFTER photo_mood,
  ADD COLUMN cleaning_condition ENUM(
    'clean',
    'needs_wash',
    'special_care'
  ) NULL AFTER product_condition,
  ADD COLUMN completeness ENUM(
    'complete',
    'no_extras'
  ) NULL AFTER cleaning_condition,
  ADD COLUMN damage_type ENUM(
    'none',
    'light_stain',
    'moderate_stain',
    'loose_seam',
    'button_damage',
    'torn',
    'other'
  ) NULL AFTER completeness,
  ADD COLUMN damage_note VARCHAR(240) NULL AFTER damage_type;
