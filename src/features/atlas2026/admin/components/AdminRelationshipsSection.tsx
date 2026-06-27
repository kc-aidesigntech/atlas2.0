import React from 'react'
import { AtlasInsetCard } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AdminRelationshipsSectionDataProps } from '@/features/atlas2026/admin/components/types'

interface AdminRelationshipsSectionProps extends AdminRelationshipsSectionDataProps {}

export default function AdminRelationshipsSection({
  navigators,
  supervisors,
  handlePersonSupervisorAssignment,
  visibleEnrollees,
  accessMatrixDataset,
  navigatorCoverageOptions,
  handleNavigatorCoverageSelection,
  handleNavigatorAssignment,
  combinedPeople,
  combinedOrganizations,
  handlePersonOrganizationAssignment
}: AdminRelationshipsSectionProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="mb-4 text-[22px] font-medium text-white">Supervisor to navigator</div>
        <div className="space-y-3">
          {navigators.map((navigator) => (
            <div key={navigator.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-white">{navigator.fullName}</div>
                  <small className="text-[12px] text-[var(--foreground-secondary)]">{navigator.title || 'navigator'}</small>
                </div>
                <select
                  value={navigator.reportsToPersonId || ''}
                  onChange={(event) => void handlePersonSupervisorAssignment(navigator.id, event.target.value || null)}
                  className="atlas-admin-input min-w-[220px]"
                >
                  <option value="">No supervisor</option>
                  {supervisors.filter((supervisor) => supervisor.id !== navigator.id).map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {!navigators.length ? <small className="text-[13px] text-[var(--foreground-secondary)]">Add navigators in the directory tab to begin building reporting lines.</small> : null}
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="mb-4 text-[22px] font-medium text-white">Navigator to enrollee coverage</div>
        <div className="space-y-3">
          {visibleEnrollees.map((row) => {
            const label = row.kind === 'existing' ? row.intake.fullName || row.profile.fullName : row.record.fullName || row.record.caseId || 'untitled enrollee'
            const assignment =
              row.kind === 'existing' && row.profile.enrollmentId
                ? accessMatrixDataset?.enrollmentAssignments.find((entry) => entry.enrollmentId === row.profile.enrollmentId) || null
                : null
            const selectedNavigatorIds = assignment?.navigatorPersonIds || []
            return (
              <div key={row.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-medium text-white">{label}</div>
                    <small className="text-[12px] text-[var(--foreground-secondary)]">
                      {row.kind === 'existing' ? row.intake.caseId || row.profile.caseId : row.record.caseId || 'case id pending'}
                    </small>
                  </div>
                  {row.kind === 'existing' ? (
                    <select
                      multiple
                      value={selectedNavigatorIds}
                      onChange={(event) =>
                        void handleNavigatorCoverageSelection(
                          row,
                          Array.from(event.target.selectedOptions).map((option) => option.value)
                        )
                      }
                      className="atlas-admin-input min-h-[102px] min-w-[280px]"
                    >
                      {navigatorCoverageOptions.map((navigator) => (
                        <option key={navigator.id} value={navigator.id}>
                          {navigator.label}
                          {navigator.email ? ` (${navigator.email})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={row.record.assignedNavigator}
                      onChange={(event) => void handleNavigatorAssignment(row, event.target.value)}
                      className="atlas-admin-input min-w-[220px]"
                    >
                      <option value="">Unassigned</option>
                      {navigatorCoverageOptions.map((navigator) => (
                        <option key={navigator.id} value={navigator.label}>
                          {navigator.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {row.kind === 'existing' ? (
                  <small className="mt-2 block text-[12px] text-[var(--foreground-secondary)]">
                    Multi-select enabled. Hold Command/Ctrl to toggle multiple navigators quickly.
                  </small>
                ) : null}
              </div>
            )
          })}
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5 xl:col-span-2">
        <div className="mb-4 text-[22px] font-medium text-white">Organization ownership map</div>
        <div className="space-y-3">
          {combinedPeople.map((person) => (
            <div key={person.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-white">{person.fullName}</div>
                  <small className="text-[12px] text-[var(--foreground-secondary)]">{person.roles.join(', ') || 'no roles assigned'}</small>
                </div>
                <select
                  value={person.organizationId || ''}
                  onChange={(event) => void handlePersonOrganizationAssignment(person.id, event.target.value || null)}
                  className="atlas-admin-input min-w-[220px]"
                >
                  <option value="">No organization</option>
                  {combinedOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </AtlasInsetCard>
    </div>
  )
}
