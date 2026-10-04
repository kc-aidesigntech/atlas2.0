import React from 'react'

interface AdminPersonNameButtonProps {
  name: string
  onOpen: () => void
  className?: string
}

// Names are record navigation, so they stay text inside the row instead of a
// bordered sign button. The underline is the drill-in into that person's
// permission record; the surrounding row can still select the current list.
export default function AdminPersonNameButton({ name, onOpen, className }: AdminPersonNameButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
      className={`text-left font-medium text-white underline decoration-white/30 underline-offset-[3px] hover:decoration-[var(--atlas-signal-yellow)] ${className || ''}`}
    >
      {name.trim() || 'unnamed person'}
    </button>
  )
}
