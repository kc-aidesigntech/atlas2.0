import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '../theme'

interface LocalDateInputBoxProps {
  label: string
  value: string
  error?: string | null
  onChange: (nextValue: string) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: (() => void) | null
  deleteLabel?: string
}

export default function LocalDateInputBox({
  label,
  value,
  error = null,
  onChange,
  onSave,
  onCancel,
  onDelete = null,
  deleteLabel = 'delete'
}: LocalDateInputBoxProps) {
  return (
    <div
      className="w-[220px] max-w-[calc(100vw-48px)] rounded-[18px] border px-3 py-3 shadow-2xl"
      style={{ borderColor: '#ffffff3d', backgroundColor: '#050505' }}
    >
      <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
        {label}
      </small>
      <input
        type="date"
        value={value}
        // Keep the control fully controlled so parent editors can validate before committing side effects.
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[12px] border px-3 py-2 text-[13px] text-white"
        style={{ borderColor: '#ffffff35', backgroundColor: '#000000' }}
      />
      {error ? (
        <small className="mt-2 block text-[11px]" style={{ color: SP_COLORS.red }}>
          {error}
        </small>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        {onDelete ? (
          <AtlasTextButton
            onClick={onDelete}
            className="px-3 py-1 text-[11px]"
            style={{ ['--button-border-color' as const]: `${SP_COLORS.red}90`, color: SP_COLORS.red } as React.CSSProperties}
          >
            {deleteLabel}
          </AtlasTextButton>
        ) : null}
        <AtlasTextButton
          onClick={onCancel}
          className="px-3 py-1 text-[11px] text-white"
          style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
        >
          cancel
        </AtlasTextButton>
        <AtlasTextButton
          onClick={onSave}
          className="px-3 py-1 text-[11px]"
          style={{ ['--button-border-color' as const]: `${SP_COLORS.yellow}90`, color: SP_COLORS.yellow } as React.CSSProperties}
        >
          save
        </AtlasTextButton>
      </div>
    </div>
  )
}
