/**
 * Reusable Atlas (ATLAS) image tile primitive that centralizes upload affordances and
 * status/error messaging for avatar-style image surfaces.
 */
import React from 'react'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface AtlasImageUploadTileProps {
  imageSrc: string
  alt: string
  onSelectFile?: (file: File) => Promise<unknown> | unknown
  onImageError?: React.ReactEventHandler<HTMLImageElement>
  disabled?: boolean
  frameClassName?: string
  imgClassName?: string
  buttonTitle?: string
  ctaLabel?: string
  idleStatusText?: string | null
  statusText?: string | null
  errorText?: string | null
}

/**
 * Standardized image upload tile used across ATLAS screens.
 * Keeps frame styling, click-to-upload behavior, and status/error messaging
 * consistent so image interactions are maintainable and reusable.
 */
export default function AtlasImageUploadTile({
  imageSrc,
  alt,
  onSelectFile,
  onImageError,
  disabled = false,
  frameClassName = 'h-[150px] w-[150px]',
  imgClassName = 'h-full w-full object-cover',
  buttonTitle = 'replace image',
  ctaLabel = 'replace image',
  idleStatusText = null,
  statusText = null,
  errorText = null
}: AtlasImageUploadTileProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    // Reset input so selecting the same file again still triggers onChange.
    event.currentTarget.value = ''
    if (!selectedFile || !onSelectFile) return
    void Promise.resolve(onSelectFile(selectedFile))
  }

  return (
    <div className="mx-auto flex w-[150px] shrink-0 flex-col items-start sm:mx-0">
      <div
        className={`${frameClassName} overflow-hidden rounded-[38px] border bg-white`}
        style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
      >
        <button
          type="button"
          className="relative h-full w-full cursor-pointer disabled:cursor-not-allowed"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !onSelectFile}
          title={buttonTitle}
        >
          <img
            src={imageSrc}
            alt={alt}
            className={imgClassName}
            onError={onImageError}
          />
          <div className="absolute inset-0 flex items-end justify-center bg-black/0 pb-2 opacity-0 transition-opacity hover:bg-black/25 hover:opacity-100">
            <small className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white" style={{ borderColor: '#ffffff90' }}>
              {ctaLabel}
            </small>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelection}
        />
      </div>
      {statusText ? (
        <small className="mt-2 block text-[11px]" style={{ color: SP_COLORS.muted }}>
          {statusText}
        </small>
      ) : idleStatusText ? (
        <small className="mt-2 block text-[11px]" style={{ color: SP_COLORS.muted }}>
          {idleStatusText}
        </small>
      ) : null}
      {errorText ? (
        <small className="mt-2 block text-[11px]" style={{ color: SP_COLORS.red }}>
          {errorText}
        </small>
      ) : null}
    </div>
  )
}
