import React from 'react'
import { AtlasInsetCard, AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type {
  AccessMatrixPartnerRecord,
  AccessMatrixDataset,
  AdminPortalPersonRole,
  AtlasRole,
  PartnerTroubleshootingGrant,
  TroubleshootingSessionState
} from '@/features/atlas2026/singlepane/types'

interface LiveAccessMatrixPanelProps {
  dataset: AccessMatrixDataset | null
  error: string | null
  isSaving: boolean
  onSavePersonRoles: (personId: string, roleKeys: AdminPortalPersonRole[]) => Promise<void>
  onSaveEnrollmentNavigator: (enrollmentId: string, navigatorPersonIds: string[]) => Promise<void>
  onSaveSupervisorAssignment: (navigatorPersonId: string, supervisorPersonIds: string[]) => Promise<void>
  onSavePartnerPrimaryContact: (partnerId: string, primaryContactPersonIds: string[]) => Promise<void>
  remoteSession: TroubleshootingSessionState | null
  partnerTroubleshootingGrants: Record<string, PartnerTroubleshootingGrant>
  onStartTroubleshooting: (personId: string, role: AtlasRole) => Promise<void> | void
  onStopTroubleshooting: () => void
}

export default function LiveAccessMatrixPanel({
  dataset,
  error,
  isSaving,
  onSavePersonRoles,
  onSaveEnrollmentNavigator,
  onSaveSupervisorAssignment,
  onSavePartnerPrimaryContact,
  remoteSession,
  partnerTroubleshootingGrants,
  onStartTroubleshooting,
  onStopTroubleshooting
}: LiveAccessMatrixPanelProps) {
  const [message, setMessage] = React.useState<string | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const [enrollmentNavigatorSingleChoice, setEnrollmentNavigatorSingleChoice] = React.useState(false)
  const [supervisorSingleChoice, setSupervisorSingleChoice] = React.useState(false)
  const [partnerOwnerSingleChoice, setPartnerOwnerSingleChoice] = React.useState(false)
  const people = dataset?.people || []
  const navigators = people.filter((person) => person.roleKeys.includes('navigator'))
  const supervisors = people.filter((person) => person.roleKeys.includes('supervisor') || person.roleKeys.includes('administrator'))
  const roles = dataset?.roleKeys || []
  const personById = new Map(people.map((person) => [person.id, person]))
  const partnerAssignmentsByPersonId = new Map<string, AccessMatrixPartnerRecord[]>()
  for (const partner of dataset?.partnerAssignments || []) {
    for (const personId of partner.primaryContactPersonIds) {
      const current = partnerAssignmentsByPersonId.get(personId) || []
      partnerAssignmentsByPersonId.set(personId, [...current, partner])
    }
  }
  const troubleshootingRoles: AtlasRole[] = ['administrator', 'supervisor', 'navigator', 'partner']

  async function runSave(key: string, callback: () => Promise<void>, successMessage: string) {
    setBusyKey(key)
    try {
      await callback()
      setMessage(successMessage)
    } finally {
      setBusyKey(null)
    }
  }

  if (!dataset) {
    return (
      <AtlasInsetCard className="rounded-[22px] border-white/15 bg-[#090909] px-5 py-4">
        <div className="text-[15px] text-white">Loading live access matrix...</div>
      </AtlasInsetCard>
    )
  }

  return (
    <AtlasInsetCard className="rounded-[22px] border-white/15 bg-[#090909] px-5 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">live supabase matrix</small>
          <div className="mt-1 text-[20px] font-medium text-white">Identity role and assignment matrix</div>
          <small className="block text-[12px] text-[var(--foreground-secondary)]">
            Saves through guarded admin RPC functions so relationship tests align with production contracts without direct browser writes.
          </small>
        </div>
        <AtlasStatusPill color={isSaving ? SP_COLORS.yellow : SP_COLORS.deepGreen}>
          {isSaving ? 'saving' : 'synced'}
        </AtlasStatusPill>
      </div>

      {message ? <div className="mb-3 text-[12px] text-[var(--atlas-signal-green)]">{message}</div> : null}
      {error ? <div className="mb-3 text-[12px]" style={{ color: SP_COLORS.red }}>{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <div className="mb-2 text-[16px] font-semibold text-white">Person-to-role matrix</div>
          <div className="space-y-2">
            {people.map((person) => (
              <div key={person.id} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
                <div className="mb-2">
                  <div className="text-[13px] font-medium text-white">{person.fullName}</div>
                  <small className="text-[11px] text-[var(--foreground-secondary)]">{person.email || 'email not set'}</small>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((role) => {
                    const active = person.roleKeys.includes(role)
                    return (
                      <AtlasTextButton
                        key={`${person.id}:${role}`}
                        onClick={() => {
                          const nextRoles = active ? person.roleKeys.filter((candidate) => candidate !== role) : [...person.roleKeys, role]
                          void runSave(
                            `role:${person.id}:${role}`,
                            async () => onSavePersonRoles(person.id, nextRoles),
                            `Updated roles for ${person.fullName}.`
                          )
                        }}
                        disabled={busyKey === `role:${person.id}:${role}`}
                        className="px-2.5 py-1 text-[11px] font-medium"
                        style={
                          {
                            ['--button-border-color' as const]: active ? SP_COLORS.yellow : '#ffffff24',
                            color: active ? SP_COLORS.yellow : '#f6f6f6'
                          } as React.CSSProperties
                        }
                      >
                        {role}
                      </AtlasTextButton>
                    )
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                  {troubleshootingRoles
                    .filter((candidateRole) => person.roleKeys.includes(candidateRole))
                    .map((candidateRole) => {
                      const partnerAssignments = candidateRole === 'partner' ? partnerAssignmentsByPersonId.get(person.id) || [] : []
                      const partnerGrant = partnerAssignments[0] ? partnerTroubleshootingGrants[partnerAssignments[0].partnerId] || null : null
                      const isActiveSession =
                        remoteSession?.isActive &&
                        remoteSession.targetPersonId === person.id &&
                        remoteSession.targetRole === candidateRole
                      const disabled = candidateRole === 'partner' && !partnerGrant?.allowedMenus.length
                      const label = disabled
                        ? 'await partner grant'
                        : isActiveSession
                          ? 'troubleshooting now'
                          : `troubleshoot as ${candidateRole}`
                      return (
                        <AtlasTextButton
                          key={`troubleshoot:${person.id}:${candidateRole}`}
                          onClick={() => {
                            if (isActiveSession) {
                              onStopTroubleshooting()
                              return
                            }
                            void onStartTroubleshooting(person.id, candidateRole)
                          }}
                          disabled={disabled}
                          className="px-2.5 py-1 text-[11px] font-medium"
                          style={
                            {
                              ['--button-border-color' as const]: isActiveSession ? SP_COLORS.deepGreen : '#ffffff24',
                              color: isActiveSession ? SP_COLORS.deepGreen : '#f6f6f6'
                            } as React.CSSProperties
                          }
                        >
                          {label}
                        </AtlasTextButton>
                      )
                    })}
                </div>
                {partnerAssignmentsByPersonId.get(person.id)?.length ? (
                  <small className="mt-2 block text-[11px] text-[var(--foreground-secondary)]">
                    Partner grant:{' '}
                    {partnerTroubleshootingGrants[partnerAssignmentsByPersonId.get(person.id)![0]!.partnerId]?.allowedMenus.length
                      ? `${partnerTroubleshootingGrants[partnerAssignmentsByPersonId.get(person.id)![0]!.partnerId]!.allowedMenus.length} menu(s), ${
                          partnerTroubleshootingGrants[partnerAssignmentsByPersonId.get(person.id)![0]!.partnerId]!.allowWrite ? 'write enabled' : 'read only'
                        }`
                      : 'not configured'}
                  </small>
                ) : null}
              </div>
            ))}
          </div>
        </AtlasInsetCard>

        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[16px] font-semibold text-white">Navigator-to-enrollee matrix</div>
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              <span>single choice</span>
              <input
                type="checkbox"
                checked={enrollmentNavigatorSingleChoice}
                onChange={(event) => setEnrollmentNavigatorSingleChoice(event.target.checked)}
                className="h-4 w-4 accent-white"
              />
            </label>
          </div>
          <div className="space-y-2">
            {dataset.enrollmentAssignments.map((row) => (
              <div key={row.enrollmentId} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
                <div className="mb-2">
                  <div className="text-[13px] font-medium text-white">{row.enrolleeName}</div>
                  <small className="text-[11px] text-[var(--foreground-secondary)]">{row.caseId || 'case id pending'}</small>
                </div>
                <select
                  multiple={!enrollmentNavigatorSingleChoice}
                  value={enrollmentNavigatorSingleChoice ? row.navigatorPersonIds[0] || '' : row.navigatorPersonIds}
                  onChange={(event) => {
                    const selectedIds = enrollmentNavigatorSingleChoice
                      ? event.target.value
                        ? [event.target.value]
                        : []
                      : Array.from(event.target.selectedOptions).map((option) => option.value)
                    void runSave(
                      `enrollment:${row.enrollmentId}`,
                      async () => onSaveEnrollmentNavigator(row.enrollmentId, selectedIds),
                      `Updated navigator coverage for ${row.enrolleeName}.`
                    )
                  }}
                  className="atlas-admin-input min-w-[220px]"
                  disabled={busyKey === `enrollment:${row.enrollmentId}`}
                >
                  {enrollmentNavigatorSingleChoice ? <option value="">unassigned</option> : null}
                  {navigators.map((navigator) => (
                    <option key={navigator.id} value={navigator.id}>
                      {navigator.fullName}
                    </option>
                  ))}
                </select>
                <small className="mt-2 block text-[11px] text-[var(--foreground-secondary)]">
                  {enrollmentNavigatorSingleChoice
                    ? 'Single choice mode stores one navigator.'
                    : 'Hold cmd/ctrl to select multiple navigators.'}
                </small>
              </div>
            ))}
          </div>
        </AtlasInsetCard>

        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[16px] font-semibold text-white">Supervisor-to-navigator matrix</div>
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              <span>single choice</span>
              <input
                type="checkbox"
                checked={supervisorSingleChoice}
                onChange={(event) => setSupervisorSingleChoice(event.target.checked)}
                className="h-4 w-4 accent-white"
              />
            </label>
          </div>
          <div className="space-y-2">
            {dataset.supervisorAssignments.map((row) => {
              const navigator = personById.get(row.navigatorPersonId)
              return (
                <div key={row.navigatorPersonId} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 text-[13px] font-medium text-white">{navigator?.fullName || 'navigator'}</div>
                  <select
                    multiple={!supervisorSingleChoice}
                    value={supervisorSingleChoice ? row.supervisorPersonIds[0] || '' : row.supervisorPersonIds}
                    onChange={(event) => {
                      const selectedIds = supervisorSingleChoice
                        ? event.target.value
                          ? [event.target.value]
                          : []
                        : Array.from(event.target.selectedOptions).map((option) => option.value)
                      void runSave(
                        `supervisor:${row.navigatorPersonId}`,
                        async () => onSaveSupervisorAssignment(row.navigatorPersonId, selectedIds),
                        `Updated supervisor mapping for ${navigator?.fullName || 'navigator'}.`
                      )
                    }}
                    className="atlas-admin-input min-w-[220px]"
                    disabled={busyKey === `supervisor:${row.navigatorPersonId}`}
                  >
                    {supervisorSingleChoice ? <option value="">no supervisor</option> : null}
                    {supervisors
                      .filter((supervisor) => supervisor.id !== row.navigatorPersonId)
                      .map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.id}>
                          {supervisor.fullName}
                        </option>
                      ))}
                  </select>
                  <small className="mt-2 block text-[11px] text-[var(--foreground-secondary)]">
                    {supervisorSingleChoice
                      ? 'Single choice mode stores one supervisor.'
                      : 'Hold cmd/ctrl to select multiple supervisors.'}
                  </small>
                </div>
              )
            })}
          </div>
        </AtlasInsetCard>

        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[16px] font-semibold text-white">Partner ownership matrix</div>
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              <span>single choice</span>
              <input
                type="checkbox"
                checked={partnerOwnerSingleChoice}
                onChange={(event) => setPartnerOwnerSingleChoice(event.target.checked)}
                className="h-4 w-4 accent-white"
              />
            </label>
          </div>
          <div className="space-y-2">
            {dataset.partnerAssignments.map((row) => (
              <div key={row.partnerId} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
                <div className="mb-2">
                  <div className="text-[13px] font-medium text-white">{row.organizationName}</div>
                  <small className="text-[11px] text-[var(--foreground-secondary)]">
                    {row.primaryContactEmails.length ? row.primaryContactEmails.join(', ') : 'no primary contact email'}
                  </small>
                </div>
                <select
                  multiple={!partnerOwnerSingleChoice}
                  value={partnerOwnerSingleChoice ? row.primaryContactPersonIds[0] || '' : row.primaryContactPersonIds}
                  onChange={(event) => {
                    const selectedIds = partnerOwnerSingleChoice
                      ? event.target.value
                        ? [event.target.value]
                        : []
                      : Array.from(event.target.selectedOptions).map((option) => option.value)
                    void runSave(
                      `partner:${row.partnerId}`,
                      async () => onSavePartnerPrimaryContact(row.partnerId, selectedIds),
                      `Updated partner ownership for ${row.organizationName}.`
                    )
                  }}
                  className="atlas-admin-input min-w-[220px]"
                  disabled={busyKey === `partner:${row.partnerId}`}
                >
                  {partnerOwnerSingleChoice ? <option value="">unassigned</option> : null}
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>
                <small className="mt-2 block text-[11px] text-[var(--foreground-secondary)]">
                  {partnerOwnerSingleChoice
                    ? 'Single choice mode stores one partner owner.'
                    : 'Hold cmd/ctrl to select multiple partner owners.'}
                </small>
              </div>
            ))}
          </div>
        </AtlasInsetCard>
      </div>
    </AtlasInsetCard>
  )
}
