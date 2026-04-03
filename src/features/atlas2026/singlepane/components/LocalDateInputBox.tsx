import React from 'react'
import { SP_COLORS } from '../theme'

interface LocalDateInputBoxProps {
  label: string
  value: string
  error?: string | null
  onChange: (nextValue: string) => void
  onSave: () => void
  onCancel: () => void
}

export default function LocalDateInputBox({
  label,
  value,
  error = null,
  onChange,
  onSave,
  onCancel
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
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border px-3 py-1 text-[11px] text-white"
          style={{ borderColor: '#ffffff30' }}
        >
          cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-full border px-3 py-1 text-[11px]"
          style={{ borderColor: `${SP_COLORS.yellow}90`, color: SP_COLORS.yellow }}
        >
          save
        </button>
      </div>
    </div>
  )
}
