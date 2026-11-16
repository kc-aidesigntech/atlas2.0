import React from 'react'
import { AtlasIconBadge } from '@/features/atlas2026/components/AtlasPrimitives'

interface ColumnHeadingProps {
  sequenceNumber: number
  title: string
  /** Printed after the title, on the same line. */
  titleTrailing?: React.ReactNode
}

/** The numbered circle and the column title that open each prototype column. */
export default function ColumnHeading({ sequenceNumber, title, titleTrailing }: ColumnHeadingProps) {
  return (
    <div className="flex items-center gap-3">
      <AtlasIconBadge className="shrink-0 text-[18px] font-semibold text-white">{sequenceNumber}</AtlasIconBadge>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h3 className="atlas-panel-title">{title}</h3>
        {titleTrailing}
      </div>
    </div>
  )
}
