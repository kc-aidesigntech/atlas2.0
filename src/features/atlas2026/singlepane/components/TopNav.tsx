import React from 'react'
import { ChevronDown, Menu } from 'lucide-react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AtlasRole, EnrolleeProfile, RoleMenuConfig } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface TopNavProps {
  role: AtlasRole
  roleConfig: RoleMenuConfig
  activeMenu: string
  onMenuSelect: (menu: string) => void
  enrollees: EnrolleeProfile[]
  selectedEnrolleeId: string
  onSelectEnrollee: (enrolleeId: string) => void
  onOpenAccountSettings: () => void
}

export default function TopNav({
  role,
  roleConfig,
  activeMenu,
  onMenuSelect,
  enrollees,
  selectedEnrolleeId,
  onSelectEnrollee,
  onOpenAccountSettings
}: TopNavProps) {
  const firstMenu = roleConfig.topMenus[0] || ''
  // Enrollee picker is intentionally scoped to the primary enrollees menu to keep top-nav interactions predictable.
  const showEnrolleeSelector = firstMenu === 'enrollees' && enrollees.length > 0
  const rolePillLabel = `atlas ${role}`

  return (
    <header className="border-b bg-black" style={{ borderColor: '#ffffff70' }}>
      <div className="atlas-shell-edge-buffer flex h-[44px] items-center justify-between border-b" style={{ borderColor: '#ffffff45' }}>
        <div className="flex items-center gap-3">
          {role === 'partner' ? (
            <div
              className="inline-flex min-h-[30px] items-center rounded-full border px-4 text-white"
              style={{ borderColor: '#ffffff75' }}
            >
              <small className="text-[15px] leading-none tracking-[0.01em]">{rolePillLabel}</small>
            </div>
          ) : (
            <>
              <small className="text-[15px] font-medium tracking-[0.08em] text-white">ATLAS</small>
              <small className="text-[11px] uppercase tracking-[0.16em] text-[#b9b9b9]">{role}</small>
            </>
          )}
        </div>
        <AtlasTextButton
          onClick={onOpenAccountSettings}
          className="inline-flex items-center gap-2 px-4 py-1 text-[13px] text-white"
          style={{ ['--button-border-color' as const]: SP_COLORS.border, backgroundColor: '#000000' } as React.CSSProperties}
        >
          <span>Account Settings</span>
          <Menu size={18} color={SP_COLORS.white} />
        </AtlasTextButton>
      </div>

      <div className="atlas-shell-edge-buffer overflow-x-auto py-2 text-white">
        <div className="flex min-w-max items-center gap-6 text-white">
          <div className="flex items-center gap-2 pl-2">
            {showEnrolleeSelector ? (
              <div className="flex items-center gap-3">
                <button
                  className="whitespace-nowrap text-[15px] font-medium text-white"
                  onClick={() => onMenuSelect(firstMenu)}
                  style={{ textDecoration: activeMenu === firstMenu ? 'underline' : 'none' }}
                >
                  {firstMenu}
                </button>
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedEnrolleeId}
                    onChange={(event) => {
                      onMenuSelect(firstMenu)
                      onSelectEnrollee(event.target.value)
                    }}
                    className="appearance-none border border-white/30 bg-black pl-3 pr-9 text-[15px] font-medium text-white"
                    style={{ textTransform: 'none', borderRadius: '999px', minHeight: '34px' }}
                    aria-label="Assigned enrollees"
                  >
                    {enrollees.map((enrollee) => (
                      <option key={enrollee.id} value={enrollee.id} className="bg-black text-white">
                        {enrollee.fullName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 text-white" />
                </div>
              </div>
            ) : (
              <button
                className="whitespace-nowrap text-[15px] font-medium text-white"
                onClick={() => onMenuSelect(firstMenu)}
                style={{ textDecoration: activeMenu === firstMenu ? 'underline' : 'none' }}
              >
                {firstMenu}
              </button>
            )}
          </div>

          {roleConfig.topMenus.slice(1).map((menu) => (
            <button
              key={menu}
              className="whitespace-nowrap text-[15px] font-medium text-white"
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
