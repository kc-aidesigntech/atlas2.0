import React from 'react'
import { AtlasMetricPill, AtlasPanel, AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { AccountSettings } from '@/features/atlas2026/shared/contracts'
import AdminControlPanelSidebar from './AdminControlPanelSidebar'
import type { AdminPortalSection } from './adminDataControlPanelModel'

interface AdminDataControlPanelFrameProps {
  accountSettings: AccountSettings
  activeSection: AdminPortalSection
  onSelectSection: (section: AdminPortalSection) => void
  onJumpToAssignments: () => void
  portalMessage: string | null
  registryError: string | null
  isSavingRegistry: boolean
  overviewCards: Array<{ label: string; value: number; accentColor: string }>
  children: React.ReactNode
}

export default function AdminDataControlPanelFrame({
  accountSettings,
  activeSection,
  onSelectSection,
  onJumpToAssignments,
  portalMessage,
  registryError,
  isSavingRegistry,
  overviewCards,
  children
}: AdminDataControlPanelFrameProps) {
  return (
    <AtlasPanel
      kicker="administrator portal"
      title="System record control center"
      description="Manage directory records, organization ownership, enrollee intake details, and one-to-many assignment relationships from a single operational console."
      className="h-full w-full rounded-[28px] bg-[var(--surface-panel-soft)]"
      contentClassName="space-y-5"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AtlasStatusPill color={isSavingRegistry ? SP_COLORS.yellow : SP_COLORS.deepGreen}>
            {isSavingRegistry ? 'saving portal state' : 'portal synced'}
          </AtlasStatusPill>
          <AtlasTextButton
            onClick={onJumpToAssignments}
            className="px-4 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
          >
            jump to assignments
          </AtlasTextButton>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <AdminControlPanelSidebar
          accountSettings={accountSettings}
          activeSection={activeSection}
          onSelectSection={onSelectSection}
          portalMessage={portalMessage}
          registryError={registryError}
        />
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <AtlasMetricPill key={card.label} label={card.label} value={card.value} accentColor={card.accentColor} className="rounded-[18px]" />
            ))}
          </div>
          {children}
        </div>
      </div>
    </AtlasPanel>
  )
}
