import React, { useEffect, useState } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  adminSetWarmLineAccess,
  isUuidPersonId,
  listWarmLineAccess,
  supervisorSetNavigatorWarmLineAccess
} from '@/features/atlas2026/singlepane/data-access/warmlineAccess'

type WarmLineAccessToggleProps = {
  personId: string
  personRoles: string[]
  mode: 'admin' | 'supervisor'
  disabled?: boolean
}

export default function WarmLineAccessToggle({
  personId,
  personRoles,
  mode,
  disabled = false
}: WarmLineAccessToggleProps) {
  const [hasAccess, setHasAccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const roles = personRoles.map((role) => role.trim().toLowerCase())
  const isNavigator = roles.includes('navigator') && !roles.includes('administrator') && !roles.includes('supervisor')
  const isSupervisor = roles.includes('supervisor') && !roles.includes('administrator')
  const isAdministrator = roles.includes('administrator')

  useEffect(() => {
    let cancelled = false
    if (!isUuidPersonId(personId)) return
    void listWarmLineAccess([personId]).then((rows) => {
      if (cancelled) return
      setHasAccess(rows[0]?.has_access === true)
    })
    return () => {
      cancelled = true
    }
  }, [personId])

  if (!isUuidPersonId(personId)) return null

  async function toggle() {
    if (disabled || busy || isAdministrator) return
    setBusy(true)
    setError(null)
    const next = !hasAccess
    try {
      if (mode === 'supervisor') {
        await supervisorSetNavigatorWarmLineAccess(personId, next)
      } else if (isNavigator) {
        await adminSetWarmLineAccess(personId, next ? 'allow' : 'clear')
      } else if (isSupervisor) {
        await adminSetWarmLineAccess(personId, next ? 'clear' : 'deny')
      } else {
        await adminSetWarmLineAccess(personId, next ? 'allow' : 'clear')
      }
      setHasAccess(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update warm-line access.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AtlasTextButton
        onClick={() => void toggle()}
        disabled={disabled || busy || isAdministrator}
        className="px-[14px] py-[7px] text-[13px] font-medium"
        style={
          {
            ['--button-border-color' as const]: hasAccess ? SP_COLORS.deepGreen : '#ffffff25',
            color: hasAccess ? SP_COLORS.deepGreen : SP_COLORS.white,
            backgroundColor: hasAccess ? 'rgba(69,191,85,0.12)' : 'transparent'
          } as React.CSSProperties
        }
      >
        {hasAccess ? 'warm line enabled' : 'warm line disabled'}
      </AtlasTextButton>
      <small className="text-[12px] text-[var(--foreground-secondary)]">
        {isAdministrator
          ? 'Administrators always have warm-line access.'
          : isSupervisor
            ? 'Supervisors have access by default. Deny to turn it off for this person.'
            : 'Navigators only see Pray Phone when this flag is on.'}
      </small>
      {error ? (
        <small className="block w-full text-[12px] text-[#ffb4b4]">{error}</small>
      ) : null}
    </div>
  )
}
