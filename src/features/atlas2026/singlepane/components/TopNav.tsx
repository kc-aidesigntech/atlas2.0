import React from 'react'
import { Menu } from 'lucide-react'
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
  const showEnrolleeSelector = firstMenu === 'assigned enrollees' && enrollees.length > 0

  return (
    <header className="border-b bg-black" style={{ borderColor: '#ffffff70' }}>
      <div className="flex h-[44px] items-center justify-between border-b px-5" style={{ borderColor: '#ffffff45' }}>
        <div className="flex items-center gap-3">
          <small className="text-[15px] font-medium tracking-[0.08em] text-white">ATLAS</small>
          <small className="text-[11px] uppercase tracking-[0.16em] text-[#b9b9b9]">{role}</small>
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

      <div className="overflow-x-auto px-4 py-2 text-white">
        <div className="flex min-w-max items-center gap-6 text-white">
          <div className="flex items-center gap-2 pl-2">
            {showEnrolleeSelector ? (
              <>
                <small className="text-[15px] font-medium text-white">{firstMenu} ▼</small>
                <select
                  value={selectedEnrolleeId}
                  onChange={(event) => onSelectEnrollee(event.target.value)}
                  className="border-none bg-transparent text-[15px] font-medium text-white"
                  style={{ textTransform: 'none' }}
                >
                  {enrollees.map((enrollee) => (
                    <option key={enrollee.id} value={enrollee.id} className="bg-black text-white">
                      {enrollee.fullName}
                    </option>
                  ))}
                </select>
              </>
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
              {indexIsRequests(menu, roleConfig.topMenus) ? `${menu} ▼` : menu}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

function indexIsRequests(menu: string, menus: string[]) {
  return menus.indexOf(menu) === 1
}
