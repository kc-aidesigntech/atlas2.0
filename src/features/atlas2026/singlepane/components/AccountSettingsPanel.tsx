import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AtlasCloseButton, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AccountSettings, AtlasRole, PartnerTroubleshootingGrant } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

export type AccountSecurityAuthProvider = 'google' | 'apple'

export interface AccountSecurityPanelProps {
  sessionEmail: string | null
  /** When null, linked providers are still loading. */
  linkedProviders: string[] | null
  linkBusyProvider: AccountSecurityAuthProvider | null
  onLinkProvider: (provider: AccountSecurityAuthProvider) => void
  onSignOut: () => void
}

interface AccountSettingsPanelProps {
  isOpen: boolean
  role: AtlasRole
  settings: AccountSettings
  onClose: () => void
  onRoleChange: (role: AtlasRole) => void
  onSave: (settings: AccountSettings) => void
  security?: AccountSecurityPanelProps | null
  partnerTroubleshootingGrant?: PartnerTroubleshootingGrant | null
  onSavePartnerTroubleshootingGrant?: (grant: PartnerTroubleshootingGrant) => Promise<unknown> | unknown
}

const ROLE_OPTIONS: AtlasRole[] = ['administrator', 'supervisor', 'partner', 'navigator']
type AccountSectionKey = 'activeExperience' | 'basicInformation' | 'security' | 'roleAssignments' | 'troubleshootingGrant'

function buildInitialExpandedSections(hasSecurity: boolean, hasTroubleshootingGrant: boolean): Record<AccountSectionKey, boolean> {
  return {
    activeExperience: true,
    basicInformation: true,
    security: hasSecurity,
    roleAssignments: true,
    troubleshootingGrant: hasTroubleshootingGrant
  }
}

function areAccountSettingsEqual(left: AccountSettings, right: AccountSettings) {
  if (left.fullName !== right.fullName) return false
  if (left.email !== right.email) return false
  if (left.organization !== right.organization) return false
  if (left.enabledRoles.length !== right.enabledRoles.length) return false
  return left.enabledRoles.every((value, index) => value === right.enabledRoles[index])
}

function arePartnerGrantEqual(left: PartnerTroubleshootingGrant | null, right: PartnerTroubleshootingGrant | null) {
  if (left === right) return true
  if (!left || !right) return false
  if (left.partnerId !== right.partnerId) return false
  if (left.organizationName !== right.organizationName) return false
  if (left.allowWrite !== right.allowWrite) return false
  if (left.updatedAtIso !== right.updatedAtIso) return false
  if (left.allowedMenus.length !== right.allowedMenus.length) return false
  return left.allowedMenus.every((menu, index) => menu === right.allowedMenus[index])
}

export default function AccountSettingsPanel({
  isOpen,
  role,
  settings,
  onClose,
  onRoleChange,
  onSave,
  security,
  partnerTroubleshootingGrant = null,
  onSavePartnerTroubleshootingGrant
}: AccountSettingsPanelProps) {
  const [draft, setDraft] = useState<AccountSettings>(settings)
  const [grantDraft, setGrantDraft] = useState<PartnerTroubleshootingGrant | null>(partnerTroubleshootingGrant)
  const [expandedSections, setExpandedSections] = useState<Record<AccountSectionKey, boolean>>(() =>
    buildInitialExpandedSections(Boolean(security), Boolean(partnerTroubleshootingGrant && onSavePartnerTroubleshootingGrant))
  )
  const canEditRoleAssignments = role === 'administrator'

  useEffect(() => {
    if (!isOpen) return
    setDraft((current) => (areAccountSettingsEqual(current, settings) ? current : settings))
  }, [settings, isOpen])

  useEffect(() => {
    if (!isOpen) return
    setGrantDraft((current) => (arePartnerGrantEqual(current, partnerTroubleshootingGrant) ? current : partnerTroubleshootingGrant))
  }, [partnerTroubleshootingGrant, isOpen])

  useEffect(() => {
    if (!isOpen) return
    setExpandedSections(buildInitialExpandedSections(Boolean(security), Boolean(partnerTroubleshootingGrant && onSavePartnerTroubleshootingGrant)))
  }, [isOpen, security, partnerTroubleshootingGrant, onSavePartnerTroubleshootingGrant])

  const enabledRoleSet = useMemo(() => new Set(draft.enabledRoles), [draft.enabledRoles])

  if (!isOpen) return null

  function toggleRole(nextRole: AtlasRole) {
    // Keep at least one enabled role so shell permissions never collapse into
    // an unusable "no-role" state.
    const nextEnabledRoles = enabledRoleSet.has(nextRole)
      ? draft.enabledRoles.filter((item) => item !== nextRole)
      : [...draft.enabledRoles, nextRole]
    setDraft((current) => ({
      ...current,
      enabledRoles: nextEnabledRoles.length ? nextEnabledRoles : [nextRole]
    }))
  }

  function handleSave() {
    const sanitizedRoles = canEditRoleAssignments
      ? draft.enabledRoles.length
        ? draft.enabledRoles
        : [role]
      : settings.enabledRoles.length
        ? settings.enabledRoles
        : (['partner'] as AtlasRole[])
    onSave({
      ...draft,
      enabledRoles: sanitizedRoles
    })
    onClose()
  }

  function togglePartnerMenu(menu: string) {
    if (!grantDraft) return
    const allowedMenus = grantDraft.allowedMenus.includes(menu)
      ? grantDraft.allowedMenus.filter((item) => item !== menu)
      : [...grantDraft.allowedMenus, menu]
    setGrantDraft({
      ...grantDraft,
      allowedMenus,
      updatedAtIso: new Date().toISOString()
    })
  }

  function toggleSection(section: AccountSectionKey) {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section]
    }))
  }

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-[2px]">
      <div
        className="flex h-full w-full max-w-[520px] flex-col border-l px-5 py-5 md:max-w-[560px]"
        style={{ borderColor: '#ffffff30', backgroundColor: '#050505' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <small className="atlas-overline block text-[#9f9f9f]">top right controls</small>
            <h3 className="atlas-h4 text-[24px] font-medium text-white">Account Settings</h3>
            <small className="atlas-caption text-[#c7c7c7]">
              Switch roles, define operator basics, and keep core access controls in one place.
            </small>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <CollapsibleAccountSection
            title="active experience"
            description="Switch the live shell instantly to preview each role experience while keeping saved role assignments below."
            isExpanded={expandedSections.activeExperience}
            onToggle={() => toggleSection('activeExperience')}
          >
            <label className="atlas-meta block text-[#c7c7c7]">
              Current role view
              <select
                value={role}
                onChange={(event) => onRoleChange(event.target.value as AtlasRole)}
                className="atlas-select mt-2 bg-black text-[16px] text-white"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </CollapsibleAccountSection>

          <CollapsibleAccountSection
            title="basic information"
            isExpanded={expandedSections.basicInformation}
            onToggle={() => toggleSection('basicInformation')}
          >
            <div className="space-y-4">
              <label className="atlas-meta block text-[#c7c7c7]">
                Full name
                <input
                  value={draft.fullName}
                  onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
                  className="atlas-input mt-2 bg-black text-[15px] text-white"
                />
              </label>
              <label className="atlas-meta block text-[#c7c7c7]">
                Email
                <input
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  className="atlas-input mt-2 bg-black text-[15px] text-white"
                />
              </label>
              <label className="atlas-meta block text-[#c7c7c7]">
                Organization
                <input
                  value={draft.organization}
                  onChange={(event) => setDraft((current) => ({ ...current, organization: event.target.value }))}
                  className="atlas-input mt-2 bg-black text-[15px] text-white"
                />
              </label>
            </div>
          </CollapsibleAccountSection>

          {security ? (
            <CollapsibleAccountSection
              title="sign-in and security"
              description="Supabase Auth backs this shell. Use the same verified email across password and SSO so identities stay on one user."
              isExpanded={expandedSections.security}
              onToggle={() => toggleSection('security')}
            >
              {security.sessionEmail ? (
                <p className="atlas-body mb-4 text-[15px] text-white">
                  Signed in as <span className="font-medium">{security.sessionEmail}</span>
                </p>
              ) : null}
              <p className="atlas-overline mb-2 text-[#9f9f9f]">connected providers</p>
              <ul className="mb-4 space-y-1 text-[14px] text-[#dedede]">
                {security.linkedProviders === null ? (
                  <li className="text-[#9f9f9f]">Loading…</li>
                ) : security.linkedProviders.length ? (
                  security.linkedProviders.map((p) => (
                    <li key={p} className="capitalize">
                      {p}
                    </li>
                  ))
                ) : (
                  <li className="text-[#9f9f9f]">Email only — link a provider below.</li>
                )}
              </ul>
              <div className="flex flex-col gap-2">
                <AtlasTextButton
                  type="button"
                  disabled={Boolean(security.linkBusyProvider)}
                  onClick={() => security.onLinkProvider('google')}
                  className="w-full px-[16px] py-[11px] text-[15px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                >
                  {security.linkBusyProvider === 'google' ? 'Redirecting to Google…' : 'Link Google'}
                </AtlasTextButton>
                <AtlasTextButton
                  type="button"
                  disabled={Boolean(security.linkBusyProvider)}
                  onClick={() => security.onLinkProvider('apple')}
                  className="w-full px-[16px] py-[11px] text-[15px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                >
                  {security.linkBusyProvider === 'apple' ? 'Redirecting to Apple…' : 'Link Apple'}
                </AtlasTextButton>
              </div>
              <div className="mt-4 border-t pt-4" style={{ borderColor: '#ffffff18' }}>
                <AtlasTextButton
                  type="button"
                  onClick={() => void security.onSignOut()}
                  className="w-full px-[16px] py-[11px] text-[15px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ff6b6b' } as React.CSSProperties}
                >
                  Sign out
                </AtlasTextButton>
              </div>
            </CollapsibleAccountSection>
          ) : null}

          <CollapsibleAccountSection
            title="role assignments"
            isExpanded={expandedSections.roleAssignments}
            onToggle={() => toggleSection('roleAssignments')}
          >
            {canEditRoleAssignments ? (
              <div className="space-y-2">
                {ROLE_OPTIONS.map((option) => (
                  <label key={option} className="atlas-surface-raised flex items-center justify-between px-4 py-3">
                    <span className="atlas-meta text-[15px] capitalize text-white">{option}</span>
                    <input
                      type="checkbox"
                      checked={enabledRoleSet.has(option)}
                      onChange={() => toggleRole(option)}
                      className="h-5 w-5 accent-white"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <small className="atlas-panel-copy block text-[#cfcfcf]">
                Role assignments are managed by administrators. New signups default to partner access.
              </small>
            )}
          </CollapsibleAccountSection>

          {role === 'partner' && grantDraft && onSavePartnerTroubleshootingGrant ? (
            <CollapsibleAccountSection
              title="admin troubleshooting grant"
              description="Choose what an administrator can open while troubleshooting this partner shell."
              isExpanded={expandedSections.troubleshootingGrant}
              onToggle={() => toggleSection('troubleshootingGrant')}
            >
              <div className="space-y-2">
                {['referral portal', 'my station', 'service capacity'].map((menu) => (
                  <label key={menu} className="atlas-surface-raised flex items-center justify-between px-4 py-3">
                    <span className="atlas-meta text-[15px] text-white">{menu}</span>
                    <input
                      type="checkbox"
                      checked={grantDraft.allowedMenus.includes(menu)}
                      onChange={() => togglePartnerMenu(menu)}
                      className="h-5 w-5 accent-white"
                    />
                  </label>
                ))}
                <label className="atlas-surface-raised mt-3 flex items-center justify-between px-4 py-3">
                  <span className="atlas-meta text-[15px] text-white">Allow write access during troubleshooting</span>
                  <input
                    type="checkbox"
                    checked={grantDraft.allowWrite}
                    onChange={() =>
                      setGrantDraft({
                        ...grantDraft,
                        allowWrite: !grantDraft.allowWrite,
                        updatedAtIso: new Date().toISOString()
                      })
                    }
                    className="h-5 w-5 accent-white"
                  />
                </label>
              </div>
              <AtlasTextButton
                onClick={() => void onSavePartnerTroubleshootingGrant(grantDraft)}
                className="mt-4 w-full px-[19px] py-[11px] text-[15px] font-medium text-white"
                style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
              >
                save admin troubleshooting grant
              </AtlasTextButton>
            </CollapsibleAccountSection>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-end gap-3 pt-5">
          <AtlasTextButton
            onClick={onClose}
            className="px-6 py-[10px] text-[16px] font-medium text-white"
            style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
          >
            cancel
          </AtlasTextButton>
          <AtlasTextButton
            onClick={handleSave}
            className="px-6 py-[10px] text-[16px] font-medium text-white"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          >
            save account settings
          </AtlasTextButton>
        </div>
      </div>
    </div>
  )
}

function CollapsibleAccountSection({
  title,
  description,
  isExpanded,
  onToggle,
  children
}: {
  title: string
  description?: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="atlas-surface-panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <small className="atlas-overline mb-1 block text-white">{title}</small>
          {description ? <small className="atlas-caption block text-[#bcbcbc]">{description}</small> : null}
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border" style={{ borderColor: '#ffffff24' }}>
          <ChevronDown
            size={18}
            className={`text-white transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {isExpanded ? (
        <div className="atlas-divider border-t px-4 pb-4 pt-4">
          {children}
        </div>
      ) : null}
    </section>
  )
}
