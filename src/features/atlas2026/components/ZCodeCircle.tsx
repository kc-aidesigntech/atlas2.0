import React from 'react'
import { usesLightTextOnZCodeColor } from '@atlas/shared'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

type ZCodeCircleSize = 'enrollee'

interface ZCodeCircleProps {
  value: string
  fill: string
  size?: ZCodeCircleSize
  className?: string
}

const SIZE_CLASSNAME: Record<ZCodeCircleSize, string> = {
  // Mirrors the live enrollee Z-code circle motif used in profile surfaces.
  enrollee: 'relative inline-flex h-11 w-11 items-center justify-center rounded-full text-[30px] font-bold'
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export default function ZCodeCircle({
  value,
  fill,
  size = 'enrollee',
  className
}: ZCodeCircleProps) {
  const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
  return (
    <span className={cn(SIZE_CLASSNAME[size], className)} style={{ backgroundColor: fill, color: textColor }}>
      {value}
    </span>
  )
}
