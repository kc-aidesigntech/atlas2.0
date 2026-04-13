import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface RoleMenusProps {
  labels?: string[]
  label?: string
  activeLabel?: string
  onAction: (label: string) => void
}

export default function RoleMenus({ labels, label, activeLabel, onAction }: RoleMenusProps) {
  const safeLabels = labels?.length ? labels : label ? [label] : []
  const currentActiveLabel = activeLabel || safeLabels[0] || ''

  return (
    <div className="flex w-full items-center justify-center overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 px-1">
        {safeLabels.map((nextLabel) => {
          const isActive = nextLabel === currentActiveLabel
          return (
            <AtlasTextButton
              key={nextLabel}
              onClick={() => onAction(nextLabel)}
              className="px-5 py-[5px] text-[15px] font-medium text-white transition-colors"
              style={{
                ['--button-border-color' as const]: isActive ? SP_COLORS.white : SP_COLORS.border,
                backgroundColor: isActive ? '#111111' : 'transparent'
              } as React.CSSProperties}
            >
              {nextLabel}
            </AtlasTextButton>
          )
        })}
      </div>
    </div>
  )
}
