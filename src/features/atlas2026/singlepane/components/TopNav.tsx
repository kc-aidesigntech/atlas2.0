import React from 'react'
import { Menu } from 'lucide-react'
import type { AtlasRole, EnrolleeProfile, RoleMenuConfig } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface TopNavProps {
  role: AtlasRole
  onRoleChange: (role: AtlasRole) => void
  roleConfig: RoleMenuConfig
  enrollees: EnrolleeProfile[]
  selectedEnrolleeId: string
  onSelectEnrollee: (enrolleeId: string) => void
}

export default function TopNav({ role, onRoleChange, roleConfig, enrollees, selectedEnrolleeId, onSelectEnrollee }: TopNavProps) {
  void role
  void onRoleChange
  return (
    <header className="border-b bg-black" style={{ borderColor: '#ffffff70' }}>
      <div className="flex h-[44px] items-center justify-between border-b px-5" style={{ borderColor: '#ffffff45' }}>
        <div className="rounded-full border px-5 py-1 text-[15px] font-medium tracking-[0.01em] text-white" style={{ borderColor: SP_COLORS.border }}>
          atlas navigator
        </div>
        <div className="flex items-center gap-2">
          <Menu size={20} color={SP_COLORS.white} />
        </div>
      </div>

      <div className="flex h-[47px] items-center gap-10 px-6 text-white">
        <div className="flex items-center gap-2">
          <small className="text-[15px] font-medium text-white">{roleConfig.topMenus[0]} ▼</small>
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
        </div>

        {roleConfig.topMenus.slice(1).map((menu) => (
          <button key={menu} className="text-[15px] font-medium text-white">
            {indexIsRequests(menu, roleConfig.topMenus) ? `${menu} ▼` : menu}
          </button>
        ))}
      </div>
    </header>
  )
}

function indexIsRequests(menu: string, menus: string[]) {
  return menus.indexOf(menu) === 1
}
