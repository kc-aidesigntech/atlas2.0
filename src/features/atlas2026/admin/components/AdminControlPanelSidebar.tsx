import React, { useEffect, useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { AtlasIconButton, AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { ADMIN_SECTIONS, parentAdminSectionId, type AdminPortalSection } from './adminDataControlPanelModel'

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
  const [openParentIds, setOpenParentIds] = useState<AdminPortalSection[]>(() => {
    const parentId = parentAdminSectionId(activeSection)
    return parentId ? [parentId] : []
  })

  // A restored matrix editor should show its nav item. Opening happens here
  // only when the active section changes, so a manual collapse stays closed.
  useEffect(() => {
    const parentId = parentAdminSectionId(activeSection)
    if (!parentId) return
    setOpenParentIds((current) => (current.includes(parentId) ? current : [...current, parentId]))
  }, [activeSection])

  function toggleParent(sectionId: AdminPortalSection) {
    const willClose = openParentIds.includes(sectionId)
    setOpenParentIds((current) =>
      current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId]
    )
    // Closing the branch leaves the parent page, so a matrix does not stay open
    // after its nav item is hidden.
    if (willClose && parentAdminSectionId(activeSection) === sectionId) {
      onSelectSection(sectionId)
    }
  }

  function selectSection(sectionId: AdminPortalSection) {
    onSelectSection(sectionId)
    const entry = ADMIN_SECTIONS.find((section) => section.id === sectionId)
    if (!entry?.children?.length) return
    setOpenParentIds((current) => (current.includes(sectionId) ? current : [...current, sectionId]))
  }

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
          const childIsActive = Boolean(section.children?.some((child) => child.id === activeSection))
          const isOpen = openParentIds.includes(section.id)
          return (
            <div key={section.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <AtlasTextButton
                  onClick={() => selectSection(section.id)}
                  className="min-w-0 flex-1 px-4 py-3 text-left"
                  style={{
                    ['--button-border-color' as const]: isActive || childIsActive ? 'var(--atlas-signal-lucid-teal)' : '#ffffff25',
                    color: SP_COLORS.white,
                    backgroundColor: isActive ? 'var(--atlas-signal-lucid-teal)' : 'var(--surface-button)'
                  } as React.CSSProperties}
                >
                  <div className="text-[14px] font-semibold">{section.label}</div>
                  <small className="mt-1 block whitespace-normal text-[12px] text-[var(--foreground-secondary)]">{section.description}</small>
                </AtlasTextButton>
                {section.children?.length ? (
                  <AtlasIconButton
                    aria-expanded={isOpen}
                    aria-label={isOpen ? `Hide ${section.label} matrices` : `Show ${section.label} matrices`}
                    onClick={() => toggleParent(section.id)}
                    style={{
                      ['--button-border-color' as const]: isOpen ? 'var(--atlas-signal-lucid-teal)' : '#ffffff25',
                      color: SP_COLORS.white,
                      backgroundColor: 'var(--surface-button)'
                    } as React.CSSProperties}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </AtlasIconButton>
                ) : null}
              </div>
              {isOpen
                ? section.children?.map((child) => {
                    const isChildActive = child.id === activeSection
                    return (
                      <AtlasTextButton
                        key={child.id}
                        onClick={() => onSelectSection(child.id)}
                        className="ml-4 w-[calc(100%-1rem)] px-3 py-2 text-left"
                        style={{
                          ['--button-border-color' as const]: isChildActive ? 'var(--atlas-signal-lucid-teal)' : '#ffffff25',
                          color: SP_COLORS.white,
                          backgroundColor: isChildActive ? 'var(--atlas-signal-lucid-teal)' : 'var(--surface-button)'
                        } as React.CSSProperties}
                      >
                        <div className="whitespace-normal text-[13px] font-semibold">{child.label}</div>
                        <small className="mt-1 block whitespace-normal text-[12px] text-[var(--foreground-secondary)]">{child.description}</small>
                      </AtlasTextButton>
                    )
                  })
                : null}
            </div>
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
