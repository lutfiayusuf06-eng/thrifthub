'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, RotateCcw } from 'lucide-react'

const acceptedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxPhotoBytes = 5 * 1024 * 1024

export default function ProductPhotoField({
  initialUrl = '',
}: {
  initialUrl?: string
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const previewObjectUrl = useRef<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState(initialUrl)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
  }, [])

  function choosePhoto(file: File | undefined) {
    setError('')
    if (!file) return
    if (
      !acceptedPhotoTypes.includes(file.type) &&
      !/\.(?:jpe?g|png|webp)$/i.test(file.name)
    ) {
      setError('Pilih foto berformat JPG, JPEG, PNG, atau WEBP.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    if (file.size > maxPhotoBytes) {
      setError('Ukuran foto maksimal 5 MB.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }

    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    const objectUrl = URL.createObjectURL(file)
    previewObjectUrl.current = objectUrl
    setSelectedFile(file)
    setPreviewUrl(objectUrl)
  }

  function removeSelection() {
    setSelectedFile(null)
    setPreviewUrl(initialUrl)
    setError('')
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    previewObjectUrl.current = null
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="form-grid-wide">
      <input type="hidden" name="imageUrl" value={initialUrl} />
      <input
        ref={fileInput}
        hidden
        type="file"
        name="imageFile"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={(event) => choosePhoto(event.currentTarget.files?.[0])}
        tabIndex={-1}
        aria-label="Pilih foto produk"
      />
      <p style={{ margin: '0 0 7px', color: '#39483b', fontSize: 10, fontWeight: 600 }}>Foto produk</p>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Pratinjau foto produk"
            style={{
              width: 120,
              height: 140,
              border: '1px solid #e0e2d9',
              background: '#f5f3ec',
              objectFit: 'cover',
            }}
          />
        ) : (
          <span style={{ color: '#788176', fontSize: 10 }}>Foto belum dipilih</span>
        )}
        <div style={{ display: 'grid', justifyItems: 'start', gap: 8 }}>
          <button
            className="refresh-button"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={14} aria-hidden="true" />
            {previewUrl ? 'Ganti Foto' : '+ Tambahkan Foto'}
          </button>
          {selectedFile ? (
            <button className="refresh-button" type="button" onClick={removeSelection}>
              <RotateCcw size={14} aria-hidden="true" />
              {initialUrl ? 'Batalkan foto baru' : 'Hapus foto pilihan'}
            </button>
          ) : null}
          <small style={{ color: '#788176', fontSize: 9 }}>JPG, JPEG, PNG, atau WEBP · maksimal 5 MB</small>
          {selectedFile ? <small style={{ color: '#788176', fontSize: 9 }}>{selectedFile.name}</small> : null}
          {error ? <small style={{ color: '#8f4e42', fontSize: 9 }} role="alert">{error}</small> : null}
        </div>
      </div>
    </div>
  )
}
