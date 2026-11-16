import React from 'react'
import { getAvatarInitials } from '@/features/atlas2026/components/avatarFallback'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'

/** Border, fill and text colors of a person circle that is chosen or assigned. */
export const PERSON_CIRCLE_SELECTED_STYLE: React.CSSProperties = {
  borderColor: SP_COLORS.deepGreen,
  backgroundColor: `${SP_COLORS.deepGreen}33`,
  color: SP_COLORS.white
}

/** Border, fill and text colors of a person circle that is not chosen. */
export const PERSON_CIRCLE_UNSELECTED_STYLE: React.CSSProperties = {
  borderColor: '#ffffff40',
  backgroundColor: '#111111',
  color: SP_COLORS.white
}

const SIZE_CLASS = {
  regular: 'h-12 w-12 text-[14px]',
  large: 'h-14 w-14 text-[15px]'
} as const

interface PersonCircleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type' | 'style'> {
  /** The person's name; the circle prints its initials. */
  name: string
  selected: boolean
  size?: keyof typeof SIZE_CLASS
}

/** One round button holding a person's initials. My Wallet's claim circles and the task pad's person filter both render it. */
export default function PersonCircleButton({ name, selected, size = 'regular', className = '', ...buttonProps }: PersonCircleButtonProps) {
  return (
    <button
      type="button"
      className={`flex shrink-0 items-center justify-center rounded-full border font-semibold ${SIZE_CLASS[size]} ${className}`.trim()}
      style={selected ? PERSON_CIRCLE_SELECTED_STYLE : PERSON_CIRCLE_UNSELECTED_STYLE}
      aria-pressed={selected}
      {...buttonProps}
    >
      {getAvatarInitials(name)}
    </button>
  )
}
