import React, { useEffect, useMemo, useState } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AccountSettings, AtlasRole } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface AccountSettingsPanelProps {
  isOpen: boolean
  role: AtlasRole
  settings: AccountSettings
  onClose: () => void
  onRoleChange: (role: AtlasRole) => void
  onSave: (settings: AccountSettings) => void
}

const ROLE_OPTIONS: AtlasRole[] = ['administrator', 'supervisor', 'partner', 'navigator']

export default function AccountSettingsPanel({
  isOpen,
  role,
  settings,
  onClose,
  onRoleChange,
  onSave
}: AccountSettingsPanelProps) {
  const [draft, setDraft] = useState<AccountSettings>(settings)

  useEffect(() => {
    setDraft(settings)
  }, [settings, isOpen])

  const enabledRoleSet = useMemo(() => new Set(draft.enabledRoles), [draft.enabledRoles])

  if (!isOpen) return null

  function toggleRole(nextRole: AtlasRole) {
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
          <AtlasTextButton
            onClick={onClose}
            className="px-3 py-1 text-[12px] text-white"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          >
            close
          </AtlasTextButton>
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
