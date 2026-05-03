/**
 * Account settings drawer for profile basics, role toggles, and optional live
 * auth provider linking/sign-out controls.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { AtlasCloseButton, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AccountSettings, AtlasRole } from '@/features/atlas2026/singlepane/types'
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
}

const ROLE_OPTIONS: AtlasRole[] = ['administrator', 'supervisor', 'partner', 'navigator']

export default function AccountSettingsPanel({
  isOpen,
  role,
  settings,
  onClose,
  onRoleChange,
  onSave,
  security
}: AccountSettingsPanelProps) {
  const [draft, setDraft] = useState<AccountSettings>(settings)

  useEffect(() => {
    // Reset draft state whenever panel opens or upstream settings change so
    // unsaved edits from previous sessions do not leak into new opens.
    setDraft(settings)
  }, [settings, isOpen])

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
    const sanitizedRoles = draft.enabledRoles.length ? draft.enabledRoles : [role]
    onSave({
      ...draft,
      enabledRoles: sanitizedRoles
    })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-[2px]">
      <div
        className="flex h-full w-full max-w-[420px] flex-col border-l px-5 py-5"
        style={{ borderColor: '#ffffff30', backgroundColor: '#050505' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.18em] text-[#9f9f9f]">top right controls</small>
            <h3 className="text-[24px] font-medium text-white">Account Settings</h3>
            <small className="text-[12px] text-[#c7c7c7]">
              Switch roles, define operator basics, and keep core access controls in one place.
            </small>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            className="h-9 w-9"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        <div className="space-y-4">
          <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff30' }}>
            <small className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-white">active experience</small>
            <small className="mb-3 block text-[12px] text-[#bcbcbc]">
              Switch the live shell instantly to preview each role experience while keeping saved role assignments below.
            </small>
            <label className="block text-[12px] text-[#bcbcbc]">
              Current role view
              <select
                value={role}
                onChange={(event) => onRoleChange(event.target.value as AtlasRole)}
                className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
                style={{ borderColor: '#ffffff30' }}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff30' }}>
            <small className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-white">basic information</small>
            <div className="space-y-3">
              <label className="block text-[12px] text-[#bcbcbc]">
                Full name
                <input
                  value={draft.fullName}
                  onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
                  style={{ borderColor: '#ffffff30' }}
                />
              </label>
              <label className="block text-[12px] text-[#bcbcbc]">
                Email
                <input
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
                  style={{ borderColor: '#ffffff30' }}
                />
              </label>
              <label className="block text-[12px] text-[#bcbcbc]">
                Organization
                <input
                  value={draft.organization}
                  onChange={(event) => setDraft((current) => ({ ...current, organization: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
                  style={{ borderColor: '#ffffff30' }}
                />
              </label>
            </div>
          </section>

          {security ? (
            <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff30' }}>
              <small className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-white">
                sign-in and security
              </small>
              <small className="mb-3 block text-[12px] text-[#bcbcbc]">
                Supabase Auth backs this shell. Use the same verified email across password and SSO so identities stay
                on one user. Enable manual linking in the Supabase dashboard to attach Google or Apple while signed in
                with email.
              </small>
              {security.sessionEmail ? (
                <p className="mb-3 text-[13px] text-white">
                  Signed in as <span className="font-medium">{security.sessionEmail}</span>
                </p>
              ) : null}
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#9f9f9f]">connected providers</p>
              <ul className="mb-4 space-y-1 text-[13px] text-[#dedede]">
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
                  className="w-full px-3 py-2 text-[12px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                >
                  {security.linkBusyProvider === 'google' ? 'Redirecting to Google…' : 'Link Google'}
                </AtlasTextButton>
                <AtlasTextButton
                  type="button"
                  disabled={Boolean(security.linkBusyProvider)}
                  onClick={() => security.onLinkProvider('apple')}
                  className="w-full px-3 py-2 text-[12px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                >
                  {security.linkBusyProvider === 'apple' ? 'Redirecting to Apple…' : 'Link Apple'}
                </AtlasTextButton>
              </div>
              <div className="mt-4 border-t pt-4" style={{ borderColor: '#ffffff18' }}>
                <AtlasTextButton
                  type="button"
                  onClick={() => void security.onSignOut()}
                  className="w-full px-3 py-2 text-[12px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ff6b6b' } as React.CSSProperties}
                >
                  Sign out
                </AtlasTextButton>
              </div>
            </section>
          ) : null}

          <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff30' }}>
            <small className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.12em] text-white">role assignments</small>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <label key={option} className="flex items-center justify-between rounded-2xl border px-3 py-2" style={{ borderColor: '#ffffff20' }}>
                  <span className="text-[13px] capitalize text-white">{option}</span>
                  <input
                    type="checkbox"
                    checked={enabledRoleSet.has(option)}
                    onChange={() => toggleRole(option)}
                    className="h-4 w-4 accent-white"
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-auto flex items-center justify-end gap-3 pt-5">
          <AtlasTextButton
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-medium text-white"
            style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
          >
            cancel
          </AtlasTextButton>
          <AtlasTextButton
            onClick={handleSave}
            className="px-5 py-2 text-[13px] font-medium text-white"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          >
            save account settings
          </AtlasTextButton>
        </div>
      </div>
    </div>
  )
}
