import React, { useEffect, useState } from 'react'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  fetchScribeMenuVisibility,
  setScribeMenuVisibility,
  type ScribeMenuVisibilityByRole
} from '@/features/atlas2026/scribe/data-access/scribeMenuVisibilityRepository'
import { SCRIBE_MENU_ROLES } from '@/features/atlas2026/scribe/scribeMenuVisibility'

interface AdminScribeMenuCardProps {
  onChanged?: (role: AtlasRole, visible: boolean) => void
}

const EMPTY_VISIBILITY: ScribeMenuVisibilityByRole = {
  administrator: false,
  supervisor: false,
  navigator: false,
  partner: false
}

export default function AdminScribeMenuCard({ onChanged }: AdminScribeMenuCardProps) {
  const [visibility, setVisibility] = useState<ScribeMenuVisibilityByRole>(EMPTY_VISIBILITY)
  const [isLoading, setIsLoading] = useState(true)
  const [busyRole, setBusyRole] = useState<AtlasRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    void fetchScribeMenuVisibility()
      .then((next) => {
        if (cancelled) return
        setVisibility(next)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Unable to load scribe menu settings.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleRole(role: AtlasRole) {
    if (busyRole) return
    const nextVisible = !visibility[role]
    setBusyRole(role)
    setError(null)
    try {
      await setScribeMenuVisibility(role, nextVisible)
      setVisibility((current) => ({ ...current, [role]: nextVisible }))
      onChanged?.(role, nextVisible)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update the scribe menu.')
    } finally {
      setBusyRole(null)
    }
  }

  return (
    <AtlasInsetCard className="rounded-[22px] px-5 py-5">
      <div className="mb-4">
        <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
          workspace menu
        </small>
        <div className="mt-1 text-[22px] font-medium text-white">Scribe</div>
        <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
          Show or hide scribe in the menu for each permission level. Only an administrator profile can change this.
          Other people see the update the next time their workspace loads.
        </small>
      </div>
      <div className="space-y-3">
        {SCRIBE_MENU_ROLES.map((role) => {
          const visible = visibility[role]
          const isBusy = busyRole === role
          return (
            <div key={role} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[15px] font-medium text-white">{role}</div>
              <AtlasTextButton
                onClick={() => void toggleRole(role)}
                disabled={isLoading || Boolean(busyRole)}
                aria-pressed={visible}
                className="px-[14px] py-[7px] text-[13px] font-medium"
                style={
                  {
                    ['--button-border-color' as const]: visible ? SP_COLORS.deepGreen : '#ffffff25',
                    color: visible ? SP_COLORS.deepGreen : SP_COLORS.white,
                    backgroundColor: visible ? 'rgba(69,191,85,0.12)' : 'transparent'
                  } as React.CSSProperties
                }
              >
                {isBusy ? 'saving…' : visible ? 'shown in menu' : 'hidden from menu'}
              </AtlasTextButton>
            </div>
          )
        })}
      </div>
      {error ? <small className="mt-3 block text-[12px] text-[#ffb4b4]">{error}</small> : null}
    </AtlasInsetCard>
  )
}
