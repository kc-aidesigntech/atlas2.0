import React from 'react'
import type { EnrolleeProfile } from '../types'
import { SP_COLORS } from '../theme'

interface ProfilePanelProps {
  enrollee: EnrolleeProfile
  onSelectZCode?: (zCode: string) => void
  enrollmentStartLabel?: string
}

const TAG_COLORS_BY_GROUP: Record<string, string> = {
  '55': SP_COLORS.yellow,
  '56': SP_COLORS.orange,
  '57': SP_COLORS.red,
  '59': SP_COLORS.deepGreen,
  '60': SP_COLORS.blue,
  '62': SP_COLORS.purple,
  '63': SP_COLORS.brown,
  '64': SP_COLORS.green,
  '65': SP_COLORS.steel,
  '75': SP_COLORS.white
}

export default function ProfilePanel({ enrollee, onSelectZCode, enrollmentStartLabel }: ProfilePanelProps) {
  const avatarSrc = enrollee.avatarUrl || '/assets/Kolbi Christianson-lt.png'

  return (
    <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
      <div className="mx-auto flex w-[150px] shrink-0 flex-col items-start sm:mx-0">
        <div
          className="h-[150px] w-[150px] overflow-hidden rounded-[38px] border bg-white"
          style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
        >
          <img src={avatarSrc} alt={`${enrollee.fullName} profile`} className="h-full w-full object-cover" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-[10px]">
          {enrollee.zCodeTags.map((tag, index) => {
            const group = tag.replace(/^z/i, '').slice(0, 2)
            const bgColor = TAG_COLORS_BY_GROUP[group] || [SP_COLORS.yellow, SP_COLORS.red, SP_COLORS.blue][index % 3]
            const useLightText = [SP_COLORS.blue, SP_COLORS.purple, SP_COLORS.deepGreen, SP_COLORS.red].includes(bgColor)
            return (
              <span
                key={tag}
                className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[30px] font-bold ${
                  useLightText ? 'text-white' : 'text-black'
                }`}
                style={{ backgroundColor: bgColor }}
                onClick={() => onSelectZCode?.(tag)}
              >
                {tag.replace(/^z/i, '')}
              </span>
            )
          })}
        </div>
      </div>
      <div className="min-w-[220px] flex-1 space-y-0.5 pt-[2px] text-white" style={{ textTransform: 'none' }}>
        <h2 className="text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
          {enrollee.fullName}
        </h2>
        <small className="block text-[13px] text-white">DOB: {enrollee.dob || 'not recorded'}</small>
        <small className="block text-[13px] text-white">C: {enrollee.caseId}</small>
        <small className="block text-[13px] text-white" style={{ textTransform: 'none' }}>
          E: {enrollee.email}
        </small>
        <small className="block text-[13px] text-white" style={{ textTransform: 'none' }}>
          N: {enrollee.assignedNavigator || 'unassigned'}
        </small>
        <small className="block text-[13px] text-white">Enrollment start: {enrollmentStartLabel || 'not recorded'}</small>
      </div>
    </div>
  )
}
