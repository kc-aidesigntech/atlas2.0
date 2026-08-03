import type React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { ZCodeSurveyPrompt } from '@/features/atlas2026/shared/contracts'
import { ADMIN_Z_CODE_PARENT_CODES } from './adminDataControlPanelModel'
import { ZCodeOptionCard, ZCodeParentFilterCircle } from './AdminControlPanelPrimitives'

interface AdminZCodePickerOverlayProps {
  panelRef: React.RefObject<HTMLDivElement>
  listRef: React.RefObject<HTMLDivElement>
  activeParentFilters: string[]
  selectedZCodes: string[]
  visibleOptions: ZCodeSurveyPrompt[]
  onClose: () => void
  onToggleParentFilter: (parentCode: string) => void
  onToggleZCode: (zCode: string) => void
}

// Keep the modal's filtering presentation independent from enrollee persistence.
export default function AdminZCodePickerOverlay({
  panelRef,
  listRef,
  activeParentFilters,
  selectedZCodes,
  visibleOptions,
  onClose,
  onToggleParentFilter,
  onToggleZCode
}: AdminZCodePickerOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-[2px]">
      <div
        ref={panelRef}
        className="max-h-[85vh] w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/15 bg-[#080808] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">z-code selector</small>
            <div className="mt-1 text-[24px] font-medium text-white">Select active z-codes</div>
            <small className="block text-[12px] text-[var(--foreground-secondary)]">
              Parent filters default to the currently selected families. Click the circles to add or remove parent groups.
            </small>
          </div>
          <AtlasTextButton
            type="button"
            onClick={onClose}
            className="px-[19px] py-[10px] text-[14px]"
            style={{ ['--button-border-color' as const]: '#ffffff30', color: '#f1f1f1' } as React.CSSProperties}
          >
            close
          </AtlasTextButton>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {ADMIN_Z_CODE_PARENT_CODES.map((parentCode) => (
            <button
              key={parentCode}
              type="button"
              onClick={() => onToggleParentFilter(parentCode)}
              className="rounded-full"
            >
              <ZCodeParentFilterCircle parentCode={parentCode} selected={activeParentFilters.includes(parentCode)} />
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--foreground-secondary)]">
          <span>{selectedZCodes.length} z-code{selectedZCodes.length === 1 ? '' : 's'} selected</span>
          <span>{activeParentFilters.length ? `showing ${activeParentFilters.join(', ')}` : 'no parent filters active'}</span>
        </div>
        <div ref={listRef} className="mt-5 max-h-[56vh] overflow-y-auto">
          {activeParentFilters.length ? (
            <div className="grid gap-2">
              {visibleOptions.map((option) => (
                <ZCodeOptionCard
                  key={option.id}
                  option={option}
                  selected={selectedZCodes.includes(option.normalizedZCode)}
                  onToggle={() => onToggleZCode(option.normalizedZCode)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-white/10 px-4 py-4 text-[13px] text-[var(--foreground-secondary)]">
              Turn on at least one parent circle to show its child z-codes.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
