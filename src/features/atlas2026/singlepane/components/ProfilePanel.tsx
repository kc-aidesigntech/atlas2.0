import React from 'react'
import type { EnrolleeProfile } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface ProfilePanelProps {
  enrollee: EnrolleeProfile
}

const TAG_COLORS = [SP_COLORS.yellow, SP_COLORS.red, SP_COLORS.blue]

export default function ProfilePanel({ enrollee }: ProfilePanelProps) {
  const avatarSrc = enrollee.avatarUrl || '/assets/Kolbi Christianson-lt.png'

  return (
    <div className="flex items-start gap-3 pt-0.5">
      <div className="flex w-[150px] flex-col items-start">
        <div
          className="h-[150px] w-[150px] overflow-hidden rounded-[38px] border bg-white"
          style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
        >
          <img src={avatarSrc} alt={`${enrollee.fullName} profile`} className="h-full w-full object-cover" />
        </div>
        <div className="mt-4 flex items-center gap-[10px]">
          {enrollee.zCodeTags.map((tag, index) => (
            <span
              key={tag}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-[30px] font-bold ${
                index % TAG_COLORS.length === 2 ? 'text-white' : 'text-black'
              }`}
              style={{ backgroundColor: TAG_COLORS[index % TAG_COLORS.length] }}
            >
              {tag.replace(/^z/i, '')}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-0.5 pt-[2px] text-white" style={{ textTransform: 'none' }}>
        <h2 className="text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
          {enrollee.fullName}
        </h2>
        <small className="block text-[13px] text-white">DOB: mm/dd/yyyy</small>
        <small className="block text-[13px] text-white">C: {enrollee.caseId}</small>
        <small className="block text-[13px] text-white" style={{ textTransform: 'none' }}>
          E: {enrollee.email}
        </small>
      </div>
    </div>
  )
}
