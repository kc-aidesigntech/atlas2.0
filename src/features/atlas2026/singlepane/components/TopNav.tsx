import React from 'react'
import { ChevronDown, Loader2, Menu } from 'lucide-react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AtlasPermissionKey, AtlasRole, EnrolleeProfile, RoleMenuConfig } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { tierDisplayLabel } from '@/features/atlas2026/shared/tiers'
import { isAdministratorExperience, isNavigatorExperience } from '../domain/roles'
import PrayPhoneListenButton from './PrayPhoneListenButton'

interface TopNavProps {
  role: AtlasRole
  /** Permission check from `useViewerPermissions`; the Pray Phone door reads `warmline_agent.access` through it. */
  hasPermission?: (key: AtlasPermissionKey) => boolean
  roleConfig: RoleMenuConfig
  activeMenu: string
  onMenuSelect: (menu: string) => void
  enrollees: EnrolleeProfile[]
  // Enrollee ids whose self-assignment is still syncing to the database. These render with a
  // spinner/label in the dropdown until the authoritative roster reload confirms them.
  syncingEnrolleeIds?: string[]
  selectedEnrolleeId: string
  onSelectEnrollee: (enrolleeId: string) => void
  navigatorEnrolleeView?: 'my' | 'add'
  onNavigatorEnrolleeViewChange?: (view: 'my' | 'add') => void
  onOpenAccountSettings: () => void
}

const ADD_ENROLLEES_OPTION_VALUE = '__atlas_add_enrollees__'
export default function TopNav({
  role,
  hasPermission,
  roleConfig,
  activeMenu,
  onMenuSelect,
  enrollees,
  syncingEnrolleeIds = [],
  selectedEnrolleeId,
  onSelectEnrollee,
  navigatorEnrolleeView = 'my',
  onNavigatorEnrolleeViewChange,
  onOpenAccountSettings
}: TopNavProps) {
  const firstMenu = roleConfig.topMenus[0] || ''
  const hasSyncingEnrollees = syncingEnrolleeIds.length > 0
  // t3a and t2b get the enrollee dropdown with "add enrollees"; t4plus gets the collapsed admin chrome.
  const isNavigatorShell = isNavigatorExperience(role)
  const isAdministratorShell = isAdministratorExperience(role)
  const showEnrolleeSelector = firstMenu === 'enrollees' && (enrollees.length > 0 || isNavigatorShell)
  // Tier keys print as their identity line (for example "T3A Peer Navigator"); partner prints as written.
  const roleDisplayLabel = tierDisplayLabel(role)
  const rolePillLabel = `atlas ${roleDisplayLabel}`
  const enrolleeSelectorValue =
    isNavigatorShell
      ? navigatorEnrolleeView === 'add'
        ? ADD_ENROLLEES_OPTION_VALUE
        : selectedEnrolleeId || enrollees[0]?.id || ADD_ENROLLEES_OPTION_VALUE
      : selectedEnrolleeId || ''
  const enrolleeSelectorLabel = React.useMemo(() => {
    if (isNavigatorShell && enrolleeSelectorValue === ADD_ENROLLEES_OPTION_VALUE) return 'add enrollees'
    const selectedEnrollee = enrollees.find((enrollee) => enrollee.id === enrolleeSelectorValue)
    return selectedEnrollee?.fullName || 'select enrollee'
  }, [enrolleeSelectorValue, enrollees, isNavigatorShell])
  // Size by active label length so long names keep a clear lane for the chevron/spinner.
  const enrolleeSelectorWidthCh = Math.min(Math.max(enrolleeSelectorLabel.length + 6, 18), 42)
  const adminControlsMenu = React.useMemo(() => {
    if (!isAdministratorShell) return ''
    const adminSpecific = roleConfig.topMenus.find((menu) => {
      const normalized = menu.trim().toLowerCase()
      return normalized === 'system operations' || normalized === 'governance'
    })
    return adminSpecific || roleConfig.topMenus[1] || firstMenu
  }, [firstMenu, isAdministratorShell, roleConfig.topMenus])
  const isAdminControlsActive = isAdministratorShell && (activeMenu === adminControlsMenu || activeMenu === 'system operations' || activeMenu === 'governance')
  // Admin chrome collapses every other entry into "admin controls". Scribe is a
  // standalone subapp, so it stays its own item when this permission level has it on.
  const administratorScribeMenu =
    isAdministratorShell && firstMenu.trim().toLowerCase() !== 'scribe'
      ? roleConfig.topMenus.find((menu) => menu.trim().toLowerCase() === 'scribe') || ''
      : ''

  return (
    <header className="border-b bg-black" style={{ borderColor: '#ffffff70' }}>
      <div className="atlas-shell-edge-buffer flex h-[54px] items-center justify-between border-b" style={{ borderColor: '#ffffff45' }}>
        <div className="flex items-center gap-3">
          {role === 'partner' ? (
            <div
              className="inline-flex min-h-[30px] items-center rounded-full border px-4 text-white"
              style={{ borderColor: '#ffffff75' }}
            >
              <small className="atlas-meta leading-none tracking-[0.01em]">{rolePillLabel}</small>
            </div>
          ) : (
            <>
              <small className="atlas-font-heading text-[17px] font-medium tracking-[0.08em] text-white">ATLAS</small>
              <small className="atlas-overline text-[#b9b9b9]">{roleDisplayLabel}</small>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PrayPhoneListenButton role={role} hasPermission={hasPermission} />
          <AtlasTextButton
            onClick={onOpenAccountSettings}
            className="inline-flex items-center gap-2 px-4 py-1 text-[14px] text-white"
            style={{ ['--button-border-color' as const]: SP_COLORS.border, backgroundColor: '#000000' } as React.CSSProperties}
          >
            <span>Account Settings</span>
            <Menu size={18} color={SP_COLORS.white} />
          </AtlasTextButton>
        </div>
      </div>

      <div className="atlas-shell-edge-buffer flex h-[54px] items-center overflow-x-auto text-white">
        <div className="flex min-w-max items-center gap-6 text-white">
          <div className="flex items-center gap-2 pl-2">
            {showEnrolleeSelector ? (
              <div className="flex items-center gap-3">
                <button
                  className="atlas-font-body whitespace-nowrap text-[15px] font-medium text-white"
                  onClick={() => onMenuSelect(firstMenu)}
                  style={{ textDecoration: activeMenu === firstMenu ? 'underline' : 'none' }}
                >
                  {firstMenu}
                </button>
                <div className="relative inline-flex items-center">
                  <select
                    value={enrolleeSelectorValue}
                    onChange={(event) => {
                      onMenuSelect(firstMenu)
                      if (isNavigatorShell) {
                        if (event.target.value === ADD_ENROLLEES_OPTION_VALUE) {
                          onNavigatorEnrolleeViewChange?.('add')
                          return
                        }
                        onNavigatorEnrolleeViewChange?.('my')
                      }
                      onSelectEnrollee(event.target.value)
                    }}
                    className="atlas-select min-h-[34px] w-auto appearance-none rounded-full border-white/30 bg-black pl-3 text-[15px] font-medium text-white"
                    style={{
                      textTransform: 'none',
                      width: `${enrolleeSelectorWidthCh}ch`,
                      maxWidth: 'min(80vw, 42ch)',
                      paddingRight: hasSyncingEnrollees ? '3.2rem' : '2.5rem'
                    }}
                    aria-label="Assigned enrollees"
                  >
                    {isNavigatorShell ? (
                      <option value={ADD_ENROLLEES_OPTION_VALUE} className="bg-black text-white">
                        add enrollees
                      </option>
                    ) : null}
                    {enrollees.map((enrollee) => {
                      // Native <option> cannot host an animated spinner, so a syncing enrollee is
                      // marked textually here; the animated wheel lives in the control below.
                      const isSyncing = syncingEnrolleeIds.includes(enrollee.id)
                      return (
                        <option key={enrollee.id} value={enrollee.id} className="bg-black text-white">
                          {isSyncing ? `${enrollee.fullName} • syncing…` : enrollee.fullName}
                        </option>
                      )
                    })}
                  </select>
                  {hasSyncingEnrollees ? (
                    // Spinning wheel inside the dropdown control: immediate confirmation that an
                    // "assign to me" click registered, shown until the database-synced roster lands.
                    <Loader2
                      size={14}
                      className="pointer-events-none absolute right-8 animate-spin"
                      style={{ color: SP_COLORS.yellow }}
                      aria-hidden
                    />
                  ) : null}
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 text-white" />
                </div>
              </div>
            ) : (
              <button
                className="atlas-font-body whitespace-nowrap text-[15px] font-medium text-white"
                onClick={() => onMenuSelect(firstMenu)}
                style={{ textDecoration: activeMenu === firstMenu ? 'underline' : 'none' }}
              >
                {firstMenu}
              </button>
            )}
          </div>

          {isAdministratorShell
            ? (
              <>
                <button
                  className="atlas-font-body whitespace-nowrap text-[15px] font-medium text-white"
                  onClick={() => onMenuSelect(adminControlsMenu)}
                  style={{ textDecoration: isAdminControlsActive ? 'underline' : 'none' }}
                >
                  admin controls
                </button>
                {administratorScribeMenu ? (
                  <button
                    className="atlas-font-body whitespace-nowrap text-[15px] font-medium text-white"
                    onClick={() => onMenuSelect(administratorScribeMenu)}
                    style={{ textDecoration: activeMenu === administratorScribeMenu ? 'underline' : 'none' }}
                  >
                    {administratorScribeMenu}
                  </button>
                ) : null}
              </>
              )
            : roleConfig.topMenus.slice(1).map((menu) => (
                <button
                  key={menu}
                  className="atlas-font-body whitespace-nowrap text-[15px] font-medium text-white"
                  onClick={() => onMenuSelect(menu)}
                  style={{ textDecoration: activeMenu === menu ? 'underline' : 'none' }}
                >
                  {menu}
                </button>
              ))}
        </div>
      </div>
    </header>
  )
}
