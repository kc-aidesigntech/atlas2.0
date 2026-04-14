import React from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import type { EnrolleeProfile } from '../types'
import { SP_COLORS } from '../theme'

const elenaRodriguezPortraitUrl = new URL('../../../../../assets/portraits/elena-rodriguez.jpeg', import.meta.url).href

interface ProfilePanelProps {
  enrollee: EnrolleeProfile
  isUploadingAvatar?: boolean
  avatarUploadError?: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  onSelectZCode?: (selection: { parentCode: string; childCodes: string[] }) => void
  enrollmentStartLabel?: string
}

interface ParentZCodeGroup {
  parentCode: string
  childCodes: string[]
}

function normalizeParentCode(value: string) {
  const normalized = getParentZCode(value) || value.trim().toLowerCase()
  return normalized.replace(/^z/i, 'Z')
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

export default function ProfilePanel({
  enrollee,
  isUploadingAvatar = false,
  avatarUploadError = null,
  onReplaceAvatar,
  onSelectZCode,
  enrollmentStartLabel
}: ProfilePanelProps) {
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatar(enrollee.fullName), [enrollee.fullName])
  const isElenaRodriguez = enrollee.fullName.trim().toLowerCase() === 'elena rodriguez'
  const avatarSrc = enrollee.avatarUrl || (isElenaRodriguez ? elenaRodriguezPortraitUrl : fallbackAvatarSrc)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const activeZCodeTags = React.useMemo(
    () => (enrollee.activeZCodeDetails.length ? enrollee.activeZCodeDetails.map((detail) => detail.zCode) : enrollee.zCodeTags),
    [enrollee.activeZCodeDetails, enrollee.zCodeTags]
  )
  const parentGroups = React.useMemo(() => buildParentZCodeGroups(activeZCodeTags), [activeZCodeTags])
  const completedParentCodes = React.useMemo(
    () => new Set(enrollee.completedParentCodes.map((code) => normalizeParentCode(code))),
    [enrollee.completedParentCodes]
  )

  return (
    <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
      <div className="mx-auto flex w-[150px] shrink-0 flex-col items-start sm:mx-0">
        <div
          className="h-[150px] w-[150px] overflow-hidden rounded-[38px] border bg-white"
          style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
        >
          <button
            type="button"
            className="relative h-full w-full cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            disabled={!onReplaceAvatar}
            title={onReplaceAvatar ? 'Replace profile image' : 'Profile image upload unavailable'}
          >
            <img
              src={avatarSrc}
              alt={`${enrollee.fullName} profile`}
              className="h-full w-full object-cover"
              onError={(event) => {
                if (isElenaRodriguez && event.currentTarget.src !== elenaRodriguezPortraitUrl) {
                  event.currentTarget.src = elenaRodriguezPortraitUrl
                  return
                }
                if (event.currentTarget.src !== fallbackAvatarSrc) {
                  event.currentTarget.src = fallbackAvatarSrc
                }
              }}
            />
            <div className="absolute inset-0 flex items-end justify-center bg-black/0 pb-2 opacity-0 transition-opacity hover:bg-black/25 hover:opacity-100">
              <small className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white" style={{ borderColor: '#ffffff90' }}>
                replace image
              </small>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0]
              event.currentTarget.value = ''
              if (!selectedFile || !onReplaceAvatar) return
              void Promise.resolve(onReplaceAvatar(selectedFile))
            }}
          />
        </div>
        {isUploadingAvatar ? (
          <small className="mt-2 block text-[11px]" style={{ color: SP_COLORS.muted }}>
            uploading image...
          </small>
        ) : null}
        {avatarUploadError ? (
          <small className="mt-2 block text-[11px]" style={{ color: SP_COLORS.red }}>
            {avatarUploadError}
          </small>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-[10px]">
          {parentGroups.map((group, index) => {
            const bgColor = getZCodeParentColor(group.parentCode) || [SP_COLORS.yellow, SP_COLORS.red, SP_COLORS.blue][index % 3]
            const useLightText = usesLightTextOnZCodeColor(bgColor)
            const isCompleted = completedParentCodes.has(normalizeParentCode(group.parentCode))
            return (
              <button
                key={group.parentCode}
                type="button"
                className={`relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[30px] font-bold ${
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
                {isCompleted ? (
                  <span
                    className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold"
                    style={{ borderColor: SP_COLORS.white, backgroundColor: SP_COLORS.deepGreen, color: SP_COLORS.white }}
                  >
                    ✓
                  </span>
                ) : null}
                {group.parentCode.replace(/^z/i, '')}
              </button>
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
