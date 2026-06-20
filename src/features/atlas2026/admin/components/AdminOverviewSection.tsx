import React from 'react'
import { Building2, GitBranch, Users } from 'lucide-react'
import { AtlasInsetCard, AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { AdminOverviewSectionDataProps, StatusPillComponentType } from '@/features/atlas2026/admin/components/types'

interface AdminOverviewSectionProps extends AdminOverviewSectionDataProps {
  StatusPillComponent: StatusPillComponentType
}

export default function AdminOverviewSection({
  metrics,
  enrollmentRequests,
  selectedEnrollee,
  supervisorNavigatorCompetency,
  isSavingZCodeDomainSurveyNullification,
  isLoadingZCodeDomainSurveyHistorySummary,
  zCodeDomainSurveyHistoryError,
  zCodeDomainSurveyHistorySummary,
  selectedDomainSurveySummary,
  setSelectedDomainSurveyZCode,
  nullificationReasonByAnswerId,
  setNullificationReasonByAnswerId,
  handleSetDomainSurveyNullification,
  formatMetricLabel,
  formatDateLabel,
  StatusPillComponent
}: AdminOverviewSectionProps) {
  // Keep high-signal operational cards together so status scanning remains
  // predictable while the parent file manages data orchestration only.
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              system posture
            </small>
            <div className="mt-1 text-[22px] font-medium text-white">Operational summary</div>
          </div>
          <Users className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {metrics.map((metric) => (
            <AtlasInsetCard key={metric.metric} className="rounded-[16px] px-4 py-3">
              <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                {formatMetricLabel(metric.metric)}
              </small>
              <div className="mt-1 text-[20px] font-semibold text-white">{metric.countValue}</div>
            </AtlasInsetCard>
          ))}
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              pending requests
            </small>
            <div className="mt-1 text-[22px] font-medium text-white">Queue watch</div>
          </div>
          <GitBranch className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
        </div>
        <div className="mt-4 space-y-3">
          {enrollmentRequests.slice(0, 5).map((request) => (
            <div key={request.id} className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-white">{request.prospectiveEnrollee}</div>
                  <small className="block text-[12px] text-[var(--foreground-secondary)]">
                    {request.email || 'email not supplied'} · {formatDateLabel(request.submittedAt)}
                  </small>
                </div>
                <StatusPillComponent status={request.status} />
              </div>
            </div>
          ))}
          {!enrollmentRequests.length ? (
            <small className="text-[13px] text-[var(--foreground-secondary)]">No pending enrollment traffic is waiting right now.</small>
          ) : null}
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              active selection
            </small>
            <div className="mt-1 text-[22px] font-medium text-white">Current enrollee focus</div>
          </div>
          <Building2 className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
        </div>
        <div className="mt-4 rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[18px] font-medium text-white">
            {selectedEnrollee ? selectedEnrollee.fullName : 'No enrollee selected'}
          </div>
          <small className="mt-2 block text-[13px] text-[var(--foreground-secondary)]">
            {selectedEnrollee ? `${selectedEnrollee.caseId} · ${selectedEnrollee.assignedNavigator}` : 'Select an enrollee from the portal tables to inspect assignments.'}
          </small>
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
          relationship health
        </small>
        <div className="mt-1 text-[22px] font-medium text-white">Supervisor coverage</div>
        <div className="mt-4 space-y-3">
          {supervisorNavigatorCompetency.map((summary) => (
            <div key={summary.navigatorName} className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-white">{summary.navigatorName}</div>
                  <small className="block text-[12px] text-[var(--foreground-secondary)]">
                    {summary.assessmentCount} assessments · last recorded {formatDateLabel(summary.lastAssessmentAtIso)}
                  </small>
                </div>
                <div className="text-right">
                  <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">rolling avg</small>
                  <div className="text-[18px] font-semibold text-white">{summary.weightedRollingAverage}</div>
                </div>
              </div>
            </div>
          ))}
          {!supervisorNavigatorCompetency.length ? (
            <small className="text-[13px] text-[var(--foreground-secondary)]">Supervisor assessment records will appear here once the team starts logging them.</small>
          ) : null}
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              z code domain survey
            </small>
            <div className="mt-1 text-[22px] font-medium text-white">Response history and anomaly controls</div>
            <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
              Review every response per Z-code, inspect the rolling average, and nullify anomalous entries without deleting source logs.
            </small>
          </div>
          <AtlasStatusPill color={isSavingZCodeDomainSurveyNullification ? SP_COLORS.yellow : SP_COLORS.deepGreen}>
            {isSavingZCodeDomainSurveyNullification ? 'updating nullification' : 'ready'}
          </AtlasStatusPill>
        </div>
        {isLoadingZCodeDomainSurveyHistorySummary ? (
          <small className="mt-4 block text-[13px] text-[var(--foreground-secondary)]">Loading z-code domain survey history...</small>
        ) : null}
        {zCodeDomainSurveyHistoryError ? (
          <small className="mt-4 block text-[13px]" style={{ color: SP_COLORS.red }}>
            {zCodeDomainSurveyHistoryError}
          </small>
        ) : null}
        {!isLoadingZCodeDomainSurveyHistorySummary && !zCodeDomainSurveyHistorySummary.length ? (
          <small className="mt-4 block text-[13px] text-[var(--foreground-secondary)]">
            No completed public domain survey responses are available yet.
          </small>
        ) : null}
        {zCodeDomainSurveyHistorySummary.length ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.35fr_0.65fr]">
            <div className="space-y-2">
              {zCodeDomainSurveyHistorySummary.map((summary) => {
                const isSelected = selectedDomainSurveySummary?.normalizedZCode === summary.normalizedZCode
                return (
                  <button
                    key={summary.normalizedZCode}
                    type="button"
                    className="w-full rounded-[14px] border px-3 py-2 text-left transition hover:bg-white/10"
                    style={{
                      borderColor: isSelected ? SP_COLORS.yellow : '#ffffff18',
                      backgroundColor: isSelected ? 'rgba(252,192,26,0.08)' : 'rgba(255,255,255,0.02)'
                    }}
                    onClick={() => setSelectedDomainSurveyZCode(summary.normalizedZCode)}
                  >
                    <div className="text-[13px] font-medium text-white">{summary.zCode}</div>
                    <small className="block truncate text-[11px] text-[var(--foreground-secondary)]">{summary.title}</small>
                    <small className="mt-1 block text-[11px] text-[var(--foreground-secondary)]">
                      avg {summary.averageScore ? summary.averageScore.toFixed(2) : 'n/a'} · active {summary.activeResponses} / total {summary.totalResponses}
                    </small>
                  </button>
                )
              })}
            </div>
            <div>
              {selectedDomainSurveySummary ? (
                <div className="space-y-3">
                  <div className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[16px] font-medium text-white">
                          {selectedDomainSurveySummary.zCode} - {selectedDomainSurveySummary.title}
                        </div>
                        <small className="block text-[12px] text-[var(--foreground-secondary)]">
                          Average score {selectedDomainSurveySummary.averageScore ? selectedDomainSurveySummary.averageScore.toFixed(2) : 'n/a'} from {selectedDomainSurveySummary.activeResponses} active responses.
                        </small>
                      </div>
                      <small className="text-[12px] text-[var(--foreground-secondary)]">
                        nullified {selectedDomainSurveySummary.nullifiedResponses}
                      </small>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedDomainSurveySummary.scoreHistory.map((entry) => (
                      <div key={entry.answerId} className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-medium text-white">
                              {entry.respondentFirstName || 'Unknown'} {entry.respondentLastName || ''} · {entry.respondentEmail || 'email not provided'}
                            </div>
                            <small className="block text-[12px] text-[var(--foreground-secondary)]">
                              score {entry.score} · submitted {formatDateLabel(entry.completedAtIso || entry.submittedAtIso)}
                            </small>
                            {entry.isNullified && entry.nullifiedReason ? (
                              <small className="mt-1 block text-[12px] text-[var(--foreground-secondary)]">
                                nullified reason: {entry.nullifiedReason}
                              </small>
                            ) : null}
                          </div>
                          <AtlasStatusPill color={entry.isNullified ? SP_COLORS.red : SP_COLORS.deepGreen}>
                            {entry.isNullified ? 'nullified' : 'active'}
                          </AtlasStatusPill>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                          <input
                            value={nullificationReasonByAnswerId[entry.answerId] || ''}
                            onChange={(event) =>
                              setNullificationReasonByAnswerId((current) => ({
                                ...current,
                                [entry.answerId]: event.target.value
                              }))
                            }
                            placeholder="reason for nullification (optional)"
                            className="atlas-admin-input"
                          />
                          <AtlasTextButton
                            onClick={() => void handleSetDomainSurveyNullification(entry.answerId, !entry.isNullified)}
                            disabled={isSavingZCodeDomainSurveyNullification}
                            className="px-3 py-2 text-[12px] font-medium"
                            style={{
                              ['--button-border-color' as const]: entry.isNullified ? SP_COLORS.deepGreen : SP_COLORS.red,
                              color: entry.isNullified ? SP_COLORS.deepGreen : SP_COLORS.red,
                              opacity: isSavingZCodeDomainSurveyNullification ? 0.65 : 1
                            } as React.CSSProperties}
                          >
                            {entry.isNullified ? 'restore answer' : 'nullify answer'}
                          </AtlasTextButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </AtlasInsetCard>
    </div>
  )
}
