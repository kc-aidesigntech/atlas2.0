import React from 'react'
import { usesLightTextOnZCodeColor } from '@atlas/shared'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

type ZCodeBadgeSize = 'mobile' | 'board' | 'enrollee' | 'filter' | 'compact' | 'chip' | 'resolved'

const SIZE_CLASSNAME: Record<ZCodeBadgeSize, string> = {
  mobile: 'h-7 w-7 text-[19px] font-bold',
  board: 'h-9 w-9 text-[24px] font-bold',
  enrollee: 'h-11 w-11 text-[30px] font-bold',
  filter: 'h-12 w-12 text-[22px] font-bold',
  compact: 'h-9 min-w-[2.25rem] px-2 text-[13px] font-semibold tracking-[0.06em]',
  chip: 'h-11 min-w-[4.25rem] px-3 text-[11px] font-semibold tracking-[0.04em]',
  resolved: 'h-12 min-w-[3rem] px-2 text-[18px] font-semibold'
}

const CHECK_CLASSNAME: Record<ZCodeBadgeSize, string> = {
  mobile: 'absolute -right-0.5 -top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-semibold',
  board: 'absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold',
  enrollee: 'absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold',
  filter: 'absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold',
  compact: 'absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold',
  chip: 'absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold',
  resolved: 'absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold'
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

interface ZCodeBadgeProps {
  value: string
  fill: string
  size?: ZCodeBadgeSize
  className?: string
  checked?: boolean
  stripLeadingZ?: boolean
  borderColor?: string
}

export default function ZCodeBadge({
  value,
  fill,
  size = 'board',
  className,
  checked = false,
  stripLeadingZ = false,
  borderColor
}: ZCodeBadgeProps) {
  // Badge sizing stays tokenized so circle and chip motifs remain visually consistent across profile, admin, and survey surfaces.
  const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
  const label = stripLeadingZ ? value.replace(/^z/i, '') : value
  return (
    <span
      className={cn('relative inline-flex items-center justify-center rounded-full border', SIZE_CLASSNAME[size], className)}
      style={{ backgroundColor: fill, borderColor: borderColor ?? fill, color: textColor }}
    >
      {checked ? (
        <span
          className={CHECK_CLASSNAME[size]}
          style={{ borderColor: SP_COLORS.white, backgroundColor: SP_COLORS.deepGreen, color: SP_COLORS.white }}
        >
          ✓
        </span>
      ) : null}
      {label}
    </span>
  )
}
