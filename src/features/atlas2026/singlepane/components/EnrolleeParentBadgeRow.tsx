import React from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
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
        const isCompleted = completedSet.has(normalized)
        return (
          <ZCodeBadge
            key={normalized}
            value={normalized}
            fill={fill}
            size="compact"
            stripLeadingZ
            checked={isCompleted}
            className={badgeClassName}
          />
        )
      })}
    </div>
  )
}
