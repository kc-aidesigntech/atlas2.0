import React from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface EnrolleeParentBadgeRowProps {
  parentCodes: string[]
  completedParentCodes?: string[]
  className?: string
  badgeClassName?: string
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export default function EnrolleeParentBadgeRow({
  parentCodes,
  completedParentCodes = [],
  className,
  badgeClassName
}: EnrolleeParentBadgeRowProps) {
  // Normalize once so completion matching is case/whitespace invariant across upstream data sources.
  const completedSet = React.useMemo(() => new Set(completedParentCodes.map((code) => code.trim().toUpperCase())), [completedParentCodes])

  if (!parentCodes.length) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {parentCodes.map((parentCode) => {
        const normalized = parentCode.trim().toUpperCase()
        const fill = getZCodeParentColor(normalized) || SP_COLORS.white
        const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
        const isCompleted = completedSet.has(normalized)
        return (
          <span
            key={normalized}
            className={cn('relative inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border px-2 text-[13px] font-semibold tracking-[0.06em]', badgeClassName)}
            style={{ backgroundColor: fill, borderColor: fill, color: textColor }}
          >
            {isCompleted ? (
              <span
                className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold"
                style={{ borderColor: SP_COLORS.white, backgroundColor: SP_COLORS.deepGreen, color: SP_COLORS.white }}
              >
                ✓
              </span>
            ) : null}
            {normalized.replace(/^Z/, '')}
          </span>
        )
      })}
    </div>
  )
}
