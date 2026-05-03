import React from 'react'
import { AtlasInsetCard, AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { AccessMatrixDataset, AdminPortalPersonRole } from '@/features/atlas2026/singlepane/types'

interface LiveAccessMatrixPanelProps {
  dataset: AccessMatrixDataset | null
  error: string | null
  isSaving: boolean
  onSavePersonRoles: (personId: string, roleKeys: AdminPortalPersonRole[]) => Promise<void>
  onSaveEnrollmentNavigator: (enrollmentId: string, navigatorPersonId: string | null) => Promise<void>
  onSaveSupervisorAssignment: (navigatorPersonId: string, supervisorPersonId: string | null) => Promise<void>
  onSavePartnerPrimaryContact: (partnerId: string, primaryContactPersonId: string | null) => Promise<void>
}

export default function LiveAccessMatrixPanel({
  dataset,
  error,
  isSaving,
  onSavePersonRoles,
  onSaveEnrollmentNavigator,
  onSaveSupervisorAssignment,
  onSavePartnerPrimaryContact
}: LiveAccessMatrixPanelProps) {
  const [message, setMessage] = React.useState<string | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const people = dataset?.people || []
  const navigators = people.filter((person) => person.roleKeys.includes('navigator'))
  const supervisors = people.filter((person) => person.roleKeys.includes('supervisor') || person.roleKeys.includes('administrator'))
  const roles = dataset?.roleKeys || []
  const personById = new Map(people.map((person) => [person.id, person]))

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
            Writes directly to role and assignment tables so relationship tests reflect production data contracts.
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
              </div>
            ))}
          </div>
        </AtlasInsetCard>

        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <div className="mb-2 text-[16px] font-semibold text-white">Navigator-to-enrollee matrix</div>
          <div className="space-y-2">
            {dataset.enrollmentAssignments.map((row) => (
              <div key={row.enrollmentId} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
                <div className="mb-2">
                  <div className="text-[13px] font-medium text-white">{row.enrolleeName}</div>
                  <small className="text-[11px] text-[var(--foreground-secondary)]">{row.caseId || 'case id pending'}</small>
                </div>
                <select
                  value={row.navigatorPersonId || ''}
                  onChange={(event) => {
                    void runSave(
                      `enrollment:${row.enrollmentId}`,
                      async () => onSaveEnrollmentNavigator(row.enrollmentId, event.target.value || null),
                      `Updated navigator coverage for ${row.enrolleeName}.`
                    )
                  }}
                  className="atlas-admin-input min-w-[220px]"
                  disabled={busyKey === `enrollment:${row.enrollmentId}`}
                >
                  <option value="">unassigned</option>
                  {navigators.map((navigator) => (
                    <option key={navigator.id} value={navigator.id}>
                      {navigator.fullName}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </AtlasInsetCard>

        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <div className="mb-2 text-[16px] font-semibold text-white">Supervisor-to-navigator matrix</div>
          <div className="space-y-2">
            {dataset.supervisorAssignments.map((row) => {
              const navigator = personById.get(row.navigatorPersonId)
              return (
                <div key={row.navigatorPersonId} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 text-[13px] font-medium text-white">{navigator?.fullName || 'navigator'}</div>
                  <select
                    value={row.supervisorPersonId || ''}
                    onChange={(event) => {
                      void runSave(
                        `supervisor:${row.navigatorPersonId}`,
                        async () => onSaveSupervisorAssignment(row.navigatorPersonId, event.target.value || null),
                        `Updated supervisor mapping for ${navigator?.fullName || 'navigator'}.`
                      )
                    }}
                    className="atlas-admin-input min-w-[220px]"
                    disabled={busyKey === `supervisor:${row.navigatorPersonId}`}
                  >
                    <option value="">no supervisor</option>
                    {supervisors
                      .filter((supervisor) => supervisor.id !== row.navigatorPersonId)
                      .map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.id}>
                          {supervisor.fullName}
                        </option>
                      ))}
                  </select>
                </div>
              )
            })}
          </div>
        </AtlasInsetCard>

        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <div className="mb-2 text-[16px] font-semibold text-white">Partner ownership matrix</div>
          <div className="space-y-2">
            {dataset.partnerAssignments.map((row) => (
              <div key={row.partnerId} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
                <div className="mb-2">
                  <div className="text-[13px] font-medium text-white">{row.organizationName}</div>
                  <small className="text-[11px] text-[var(--foreground-secondary)]">
                    {row.primaryContactEmail || 'no primary contact email'}
                  </small>
                </div>
                <select
                  value={row.primaryContactPersonId || ''}
                  onChange={(event) => {
                    void runSave(
                      `partner:${row.partnerId}`,
                      async () => onSavePartnerPrimaryContact(row.partnerId, event.target.value || null),
                      `Updated partner ownership for ${row.organizationName}.`
                    )
                  }}
                  className="atlas-admin-input min-w-[220px]"
                  disabled={busyKey === `partner:${row.partnerId}`}
                >
                  <option value="">unassigned</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </AtlasInsetCard>
      </div>
    </AtlasInsetCard>
  )
}
