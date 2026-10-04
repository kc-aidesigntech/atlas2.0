import React from 'react'
import AdminPermissionRecordDesk from '@/features/atlas2026/admin/components/AdminPermissionRecordDesk'
import AdminScribeMenuCard from '@/features/atlas2026/admin/components/AdminScribeMenuCard'
import type { AdminPermissionInteraction, AdminPermissionRecordKind } from '@/features/atlas2026/admin/components/adminDataControlPanelModel'
import type { AdminPortalFeaturePolicy, AdminPortalPersonRecord, AdminRoleCapabilityPolicies, AtlasRole } from '@/features/atlas2026/shared/contracts'

interface AdminPermissionsSectionProps {
  people: AdminPortalPersonRecord[]
  rolePolicies: AdminRoleCapabilityPolicies
  recordKind: AdminPermissionRecordKind
  onRecordKindChange: (kind: AdminPermissionRecordKind) => void
  interaction: AdminPermissionInteraction
  onInteractionChange: (interaction: AdminPermissionInteraction) => void
  selectedPersonId: string | null
  onSelectPerson: (personId: string) => void
  selectedRole: AtlasRole
  onSelectRole: (role: AtlasRole) => void
  isSaving: boolean
  onSavePersonPolicy: (personId: string, featurePolicy: AdminPortalFeaturePolicy) => Promise<void>
  onSaveRolePolicies: (rolePolicies: AdminRoleCapabilityPolicies, role: AtlasRole) => Promise<void>
  onClearPersonExceptions: (person: AdminPortalPersonRecord) => Promise<void>
  onScribeMenuChanged?: (role: AtlasRole, visible: boolean) => void
}

export default function AdminPermissionsSection(props: AdminPermissionsSectionProps) {
  const { onScribeMenuChanged, ...deskProps } = props
  return (
    <div className="space-y-4">
      <AdminPermissionRecordDesk {...deskProps} />
      <AdminScribeMenuCard onChanged={onScribeMenuChanged} />
    </div>
  )
}
