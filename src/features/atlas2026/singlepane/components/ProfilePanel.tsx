import React from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import type { EnrolleeProfile } from '../types'
import { SP_COLORS } from '../theme'

interface ProfilePanelProps {
  enrollee: EnrolleeProfile
  onSelectZCode?: (selection: { parentCode: string; childCodes: string[] }) => void
  enrollmentStartLabel?: string
}

interface ParentZCodeGroup {
  parentCode: string
  childCodes: string[]
}

function getInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (!parts.length) return 'A'
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'A'
}

function createFallbackAvatar(fullName: string) {
  const initials = getInitials(fullName)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" rx="56" fill="#111111" />
      <circle cx="150" cy="150" r="114" fill="#1d1d1d" stroke="#ffffff" stroke-width="6" />
      <text x="150" y="170" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function normalizeZCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase().startsWith('z') ? trimmed.toLowerCase() : `z${trimmed.toLowerCase()}`
}

function getParentZCode(value: string) {
  const normalized = normalizeZCode(value)
  if (!normalized) return null
  const group = normalized.match(/^z(\d{2})/)
  if (!group) return null
  return `z${group[1]}`
}

function buildParentZCodeGroups(tags: string[]): ParentZCodeGroup[] {
  const grouped = new Map<string, string[]>()
  for (const tag of tags) {
    const normalized = normalizeZCode(tag)
    const parentCode = getParentZCode(tag)
    if (!normalized || !parentCode) continue
    if (!grouped.has(parentCode)) {
      grouped.set(parentCode, [normalized])
      continue
    }
    const existing = grouped.get(parentCode)!
    if (!existing.includes(normalized)) {
      existing.push(normalized)
    }
  }
  return Array.from(grouped.entries()).map(([parentCode, childCodes]) => ({ parentCode, childCodes }))
}

export default function ProfilePanel({ enrollee, onSelectZCode, enrollmentStartLabel }: ProfilePanelProps) {
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatar(enrollee.fullName), [enrollee.fullName])
  const avatarSrc = enrollee.avatarUrl || fallbackAvatarSrc
  const parentGroups = React.useMemo(() => buildParentZCodeGroups(enrollee.zCodeTags), [enrollee.zCodeTags])

  return (
    <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
      <div className="mx-auto flex w-[150px] shrink-0 flex-col items-start sm:mx-0">
        <div
          className="h-[150px] w-[150px] overflow-hidden rounded-[38px] border bg-white"
          style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
        >
          <img
            src={avatarSrc}
            alt={`${enrollee.fullName} profile`}
            className="h-full w-full object-cover"
            onError={(event) => {
              if (event.currentTarget.src !== fallbackAvatarSrc) {
                event.currentTarget.src = fallbackAvatarSrc
              }
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-[10px]">
          {parentGroups.map((group, index) => {
            const bgColor = getZCodeParentColor(group.parentCode) || [SP_COLORS.yellow, SP_COLORS.red, SP_COLORS.blue][index % 3]
            const useLightText = usesLightTextOnZCodeColor(bgColor)
            return (
              <span
                key={group.parentCode}
                className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[30px] font-bold ${
                  useLightText ? 'text-white' : 'text-black'
                }`}
                style={{ backgroundColor: bgColor }}
                onClick={() =>
                  onSelectZCode?.({
                    parentCode: group.parentCode,
                    childCodes: group.childCodes
                  })
                }
              >
                {group.parentCode.replace(/^z/i, '')}
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
