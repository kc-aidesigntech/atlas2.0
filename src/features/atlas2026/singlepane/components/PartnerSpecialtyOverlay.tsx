import React from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import { AtlasCloseButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { PartnerStationSpecialtyGroup } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface PartnerSpecialtyOverlayProps {
  specialtyGroup: PartnerStationSpecialtyGroup | null
  specialtyGroups: PartnerStationSpecialtyGroup[]
  onSelectSpecialty: (group: PartnerStationSpecialtyGroup) => void
  onClose: () => void
}

export default function PartnerSpecialtyOverlay({
  specialtyGroup,
  specialtyGroups,
  onSelectSpecialty,
  onClose
}: PartnerSpecialtyOverlayProps) {
  if (!specialtyGroup) return null

  const accentColor = getZCodeParentColor(specialtyGroup.parentCode) || SP_COLORS.yellow
  const useLightText = usesLightTextOnZCodeColor(accentColor)

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="atlas-surface-panel max-h-[88vh] w-full max-w-[760px] overflow-y-auto bg-[color:var(--surface-panel)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.45)] md:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[28px] font-bold"
              style={{ backgroundColor: accentColor, color: useLightText ? SP_COLORS.white : SP_COLORS.bg }}
            >
              {specialtyGroup.parentCode.replace(/^Z/i, '')}
            </div>
            <div>
              <small className="atlas-overline block text-[#9fb0c1]">partner specialty</small>
              <div className="atlas-h4 mt-1 text-[24px] font-medium text-white">
                Z{specialtyGroup.parentCode.replace(/^Z/i, '')} associated Z-codes
              </div>
              <small className="atlas-panel-copy mt-1 block text-[#c8d0d9]">
                Child Z-codes from the latest completed service-capacity survey with scores above 6.
              </small>
            </div>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            style={{ ['--button-border-color' as const]: '#ffffff30', color: '#ffffff' } as React.CSSProperties}
          />
        </div>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {specialtyGroups.map((group) => {
            const groupAccent = getZCodeParentColor(group.parentCode) || SP_COLORS.yellow
            const groupUsesLightText = usesLightTextOnZCodeColor(groupAccent)
            const ratio = group.totalCount ? group.strengthCount / group.totalCount : 0
            const isActive = group.parentCode === specialtyGroup.parentCode
            return (
              <button
                key={group.parentCode}
                type="button"
                onClick={() => onSelectSpecialty(group)}
                className={`atlas-surface-raised rounded-[18px] border px-3 py-3 text-left transition-[border-color,background-color] duration-150 ${
                  isActive ? 'bg-white/8' : ''
                }`}
                style={{ borderColor: isActive ? `${groupAccent}90` : '#ffffff18' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[22px] font-bold"
                    style={{ backgroundColor: groupAccent, color: groupUsesLightText ? SP_COLORS.white : SP_COLORS.bg }}
                  >
                    {group.parentCode.replace(/^Z/i, '')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-white">{group.strengthCount}/{group.totalCount} strengths</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%`, backgroundColor: groupAccent }} />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <div className="grid gap-3">
          {specialtyGroup.zCodes.map((item) => (
            <div key={item.normalizedZCode} className="atlas-surface-raised px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[18px] font-medium text-white">{item.zCode}</div>
                  <small className="atlas-meta mt-1 block text-[#d3dae2]">{item.title || item.zCode}</small>
                </div>
                <div
                  className="rounded-full border px-3 py-1 text-[13px] font-medium"
                  style={{ borderColor: `${accentColor}80`, color: accentColor }}
                >
                  score {item.score}
                </div>
              </div>
              {item.description ? <small className="atlas-panel-copy mt-3 block text-[#c1c9d2]">{item.description}</small> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
