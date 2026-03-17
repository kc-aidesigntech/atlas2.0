import React from 'react'
import type { EnrolleeProfile } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface ProfilePanelProps {
  enrollee: EnrolleeProfile
}

const TAG_COLORS = [SP_COLORS.yellow, SP_COLORS.red, SP_COLORS.blue]

export default function ProfilePanel({ enrollee }: ProfilePanelProps) {
  return (
    <div className="flex items-start gap-3 pt-0.5">
      <div className="h-40 w-[148px] rounded-[22px] border bg-white" style={{ borderColor: SP_COLORS.border }} />
      <div className="space-y-0.5 pt-[2px] text-white" style={{ textTransform: 'none' }}>
        <h2 className="text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
          {enrollee.fullName}
        </h2>
        <small className="block text-[13px] text-white">DOB: mm/dd/yyyy</small>
        <small className="block text-[13px] text-white">C: {enrollee.caseId}</small>
        <small className="block text-[13px] text-white" style={{ textTransform: 'none' }}>
          E: {enrollee.email}
        </small>
        <div className="mt-5 flex items-center gap-[10px]">
          {enrollee.zCodeTags.map((tag, index) => (
            <span
              key={tag}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[30px] font-bold text-black"
              style={{ backgroundColor: TAG_COLORS[index % TAG_COLORS.length] }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
