'use client'

import { useState } from 'react'
import {
  cleaningConditionLabels,
  cleaningConditionValues,
  completenessLabels,
  completenessValues,
  damageLabels,
  damageValues,
  productConditionLabels,
  productConditionValues,
  type CleaningCondition,
  type ProductCompleteness,
  type ProductCondition,
  type ProductDamage,
} from '@/lib/product-quality'

export default function ProductQualityFields({
  productCondition,
  cleaningCondition,
  completeness,
  damageType,
  damageNote,
}: {
  productCondition: ProductCondition | null
  cleaningCondition: CleaningCondition | null
  completeness: ProductCompleteness | null
  damageType: ProductDamage | null
  damageNote: string | null
}) {
  const [selectedDamage, setSelectedDamage] = useState<ProductDamage | ''>(damageType ?? '')

  return (
    <>
      <label>
        Kondisi produk
        <select name="productCondition" defaultValue={productCondition ?? ''} required>
          <option value="">Pilih kondisi</option>
          {productConditionValues.map((value) => (
            <option key={value} value={value}>{productConditionLabels[value]}</option>
          ))}
        </select>
      </label>
      <label>
        Kebersihan
        <select name="cleaningCondition" defaultValue={cleaningCondition ?? ''} required>
          <option value="">Pilih kebersihan</option>
          {cleaningConditionValues.map((value) => (
            <option key={value} value={value}>{cleaningConditionLabels[value]}</option>
          ))}
        </select>
      </label>
      <label>
        Kelengkapan
        <select name="completeness" defaultValue={completeness ?? ''} required>
          <option value="">Pilih kelengkapan</option>
          {completenessValues.map((value) => (
            <option key={value} value={value}>{completenessLabels[value]}</option>
          ))}
        </select>
      </label>
      <label>
        Cacat atau kerusakan
        <select
          name="damageType"
          value={selectedDamage}
          required
          onChange={(event) => {
            const value = event.currentTarget.value
            setSelectedDamage(damageValues.find((damage) => damage === value) ?? '')
          }}
        >
          <option value="">Pilih kondisi</option>
          {damageValues.map((value) => (
            <option key={value} value={value}>{damageLabels[value]}</option>
          ))}
        </select>
      </label>
      {selectedDamage && selectedDamage !== 'none' ? (
        <label className="form-grid-wide">
          Keterangan kerusakan
          <textarea
            name="damageNote"
            defaultValue={damageNote ?? ''}
            maxLength={240}
            required
            rows={2}
          />
        </label>
      ) : (
        <input type="hidden" name="damageNote" value="" />
      )}
    </>
  )
}
