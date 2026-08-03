import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { ADMIN_SECTIONS, type AdminPortalSection } from './adminDataControlPanelModel'

interface AdminControlPanelSidebarProps {
  accountSettings: { fullName: string; organization: string }
  activeSection: AdminPortalSection
  onSelectSection: (section: AdminPortalSection) => void
  portalMessage: string | null
  registryError: string | null
}

// The sidebar owns navigation presentation while the parent retains route state.
export default function AdminControlPanelSidebar({
  accountSettings,
  activeSection,
  onSelectSection,
  portalMessage,
  registryError
}: AdminControlPanelSidebarProps) {
  return (
    <div className="space-y-4">
      <AtlasInsetCard className="rounded-[22px] border-white/15 bg-[#090909] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5">
            <ShieldCheck className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
          </div>
          <div>
            <div className="text-[16px] font-medium text-white">{accountSettings.fullName || 'atlas operator'}</div>
            <small className="block text-[12px] text-[var(--foreground-secondary)]">
              {accountSettings.organization || 'atlas operations'}
            </small>
          </div>
        </div>
        <small className="mt-3 block text-[12px] leading-relaxed text-[var(--foreground-secondary)]">
          This portal is designed to be the operational source of truth for front-end administrative control.
        </small>
      </AtlasInsetCard>

      <div className="space-y-2">
        {ADMIN_SECTIONS.map((section) => {
          const isActive = section.id === activeSection
          return (
            <AtlasTextButton
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              className="w-full px-4 py-3 text-left"
              style={{
                ['--button-border-color' as const]: isActive ? 'var(--atlas-signal-lucid-teal)' : '#ffffff25',
                color: SP_COLORS.white,
                backgroundColor: isActive ? 'var(--atlas-signal-lucid-teal)' : 'var(--surface-button)'
              } as React.CSSProperties}
            >
              <div className="text-[14px] font-semibold">{section.label}</div>
              <small className="mt-1 block text-[12px] text-[var(--foreground-secondary)]">{section.description}</small>
            </AtlasTextButton>
          )
        })}
      </div>

      {portalMessage ? (
        <AtlasInsetCard className="rounded-[18px] border-[rgba(69,191,85,0.45)] bg-[rgba(69,191,85,0.08)] px-4 py-3">
          <small className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: SP_COLORS.deepGreen }}>
            last action
          </small>
          <div className="mt-1 text-[13px] text-white">{portalMessage}</div>
        </AtlasInsetCard>
      ) : null}

      {registryError ? (
        <AtlasInsetCard className="rounded-[18px] border-[rgba(255,92,92,0.4)] bg-[rgba(255,92,92,0.08)] px-4 py-3">
          <small className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: SP_COLORS.red }}>
            persistence warning
          </small>
          <div className="mt-1 text-[13px] text-white">{registryError}</div>
        </AtlasInsetCard>
      ) : null}
    </div>
  )
}
