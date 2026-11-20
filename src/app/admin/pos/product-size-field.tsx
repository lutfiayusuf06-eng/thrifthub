'use client'

import { useState } from 'react'

const apparelSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL / 2XL', 'XXXL / 3XL', 'All Size']
const pantsSizes = ['28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '40']
const shoeSizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']
const customSize = '__custom__'

function optionsForCategory(category: string) {
  if (/(celana|pants|trouser|jeans|shorts?)/i.test(category)) return pantsSizes
  if (/(sepatu|sandal|footwear|shoes?)/i.test(category)) return shoeSizes
  return apparelSizes
}

export default function ProductSizeField({
  initialCategory = '',
  initialSize = '',
}: {
  initialCategory?: string
  initialSize?: string
}) {
  const [category, setCategory] = useState(initialCategory)
  const options = optionsForCategory(category)
  const [selection, setSelection] = useState(
    initialSize && !options.includes(initialSize) ? customSize : initialSize,
  )
  const [manualValue, setManualValue] = useState(
    initialSize && !options.includes(initialSize) ? initialSize : '',
  )

  const visibleSelection =
    selection !== customSize && selection && !options.includes(selection) ? '' : selection

  return (
    <>
      <label>Kategori<input name="category" value={category} maxLength={80} required onChange={(event) => setCategory(event.currentTarget.value)} /></label>
      <label>
        Ukuran
        <select
          value={visibleSelection}
          required
          onChange={(event) => setSelection(event.currentTarget.value)}
        >
          <option value="">Pilih ukuran</option>
          {options.map((size) => <option key={size} value={size}>{size}</option>)}
          <option value={customSize}>Ukuran lainnya (isi manual)</option>
        </select>
        {selection === customSize ? (
          <input
            aria-label="Ukuran manual"
            maxLength={32}
            placeholder="Ketik ukuran"
            required
            value={manualValue}
            onChange={(event) => setManualValue(event.currentTarget.value)}
          />
        ) : null}
        <input type="hidden" name="size" value={visibleSelection === customSize ? manualValue : visibleSelection} />
      </label>
    </>
  )
}
