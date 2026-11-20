export const productConditionValues = [
  'new_with_tag',
  'like_new',
  'excellent',
  'good',
  'fair',
] as const

export const cleaningConditionValues = ['clean', 'needs_wash', 'special_care'] as const
export const completenessValues = ['complete', 'no_extras'] as const
export const damageValues = [
  'none',
  'light_stain',
  'moderate_stain',
  'loose_seam',
  'button_damage',
  'torn',
  'other',
] as const

export const productConditionLabels = {
  new_with_tag: 'Baru dengan tag',
  like_new: 'Like New',
  excellent: 'Sangat Baik',
  good: 'Baik',
  fair: 'Cukup Baik',
} satisfies Record<(typeof productConditionValues)[number], string>

export const cleaningConditionLabels = {
  clean: 'Bersih',
  needs_wash: 'Perlu dicuci',
  special_care: 'Perlu perawatan khusus',
} satisfies Record<(typeof cleaningConditionValues)[number], string>

export const completenessLabels = {
  complete: 'Lengkap',
  no_extras: 'Tidak ada kelengkapan tambahan',
} satisfies Record<(typeof completenessValues)[number], string>

export const damageLabels = {
  none: 'Tidak ada',
  light_stain: 'Noda ringan',
  moderate_stain: 'Noda sedang',
  loose_seam: 'Jahitan lepas',
  button_damage: 'Kancing rusak atau hilang',
  torn: 'Sobek',
  other: 'Kerusakan lainnya',
} satisfies Record<(typeof damageValues)[number], string>

export type ProductCondition = (typeof productConditionValues)[number]
export type CleaningCondition = (typeof cleaningConditionValues)[number]
export type ProductCompleteness = (typeof completenessValues)[number]
export type ProductDamage = (typeof damageValues)[number]
