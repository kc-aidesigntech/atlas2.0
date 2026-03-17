import React from 'react'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface RoleMenusProps {
  label: string
  onAppendLog: (label: string) => void
}

export default function RoleMenus({ label, onAppendLog }: RoleMenusProps) {
  return (
    <div className="flex items-center justify-center">
      <button
        onClick={() => onAppendLog(label)}
        className="rounded-full border px-12 py-[5px] text-[15px] font-medium text-white"
        style={{ borderColor: SP_COLORS.border }}
      >
        {label}
      </button>
    </div>
  )
}
