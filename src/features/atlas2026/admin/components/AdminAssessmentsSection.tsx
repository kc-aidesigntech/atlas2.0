import React from 'react'
import { AtlasInsetCard, AtlasMetricPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type {
  AdminAssessmentsSectionDataProps,
  FieldComponentType,
  StatusPillComponentType
} from '@/features/atlas2026/admin/components/types'

interface AdminAssessmentsSectionProps extends AdminAssessmentsSectionDataProps {
  StatusPillComponent: StatusPillComponentType
  FieldComponent: FieldComponentType
}

export default function AdminAssessmentsSection({
  setIntervalRuleDraft,
  buildBlankIntervalAssessmentRule,
  navigatorProgramState,
  intervalRuleDraft,
  handleSaveIntervalRule,
  handleSaveRegulationReviewSettings,
  regulationReviewDraft,
  isSavingRegulationReview,
  regulationReviewError,
  effectiveRegulationReview,
  setRegulationReviewDraft,
  regulationReviewDueItems,
  regulationReviewRoster,
  updateRegulationReviewEnrolleeSetting,
  navigatorIntervalDueItems,
  supervisorNavigatorCompetency,
  formatDateLabel,
  StatusPillComponent,
  FieldComponent
}: AdminAssessmentsSectionProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[22px] font-medium text-white">Interval assessment rules</div>
            <small className="block text-[13px] text-[var(--foreground-secondary)]">
              Define cadence, assignee scope, and rule metadata that drive recurring navigator assessments and supervision workflows.
            </small>
          </div>
          <AtlasTextButton
            onClick={() => setIntervalRuleDraft(buildBlankIntervalAssessmentRule())}
            className="px-4 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
          >
            new rule
          </AtlasTextButton>
        </div>
        <div className="space-y-3">
          {navigatorProgramState.intervalAssessmentRules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
              onClick={() => setIntervalRuleDraft(rule)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-white">{rule.title || 'Untitled rule'}</div>
                  <small className="block text-[12px] text-[var(--foreground-secondary)]">
                    {rule.assessmentType} · {rule.cadence} · {rule.navigatorName || 'all navigators'}
                  </small>
                </div>
                <StatusPillComponent status={rule.isActive ? 'active' : 'inactive'} />
              </div>
            </button>
          ))}
          {!navigatorProgramState.intervalAssessmentRules.length ? (
            <small className="text-[13px] text-[var(--foreground-secondary)]">No interval rules configured yet.</small>
          ) : null}
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="mb-4 text-[22px] font-medium text-white">Rule editor</div>
        {intervalRuleDraft ? (
          <div className="space-y-3">
            <FieldComponent label="title">
              <input
                value={intervalRuleDraft.title}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setIntervalRuleDraft({ ...intervalRuleDraft, title: event.target.value })}
                className="atlas-admin-input"
              />
            </FieldComponent>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldComponent label="assessment type">
                <select
                  value={intervalRuleDraft.assessmentType}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setIntervalRuleDraft({
                      ...intervalRuleDraft,
                      assessmentType: event.target.value
                    })
                  }
                  className="atlas-admin-input"
                >
                  <option value="navigator_self_assessment">navigator self assessment</option>
                  <option value="navigator_competency_review">navigator competency review</option>
                  <option value="supervision_session">supervision session</option>
                </select>
              </FieldComponent>
              <FieldComponent label="cadence">
                <select
                  value={intervalRuleDraft.cadence}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setIntervalRuleDraft({
                      ...intervalRuleDraft,
                      cadence: event.target.value
                    })
                  }
                  className="atlas-admin-input"
                >
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                  <option value="quarterly">quarterly</option>
                </select>
              </FieldComponent>
              <FieldComponent label="assignee role">
                <select
                  value={intervalRuleDraft.assigneeRole}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setIntervalRuleDraft({
                      ...intervalRuleDraft,
                      assigneeRole: event.target.value
                    })
                  }
                  className="atlas-admin-input"
                >
                  <option value="navigator">navigator</option>
                  <option value="supervisor">supervisor</option>
                </select>
              </FieldComponent>
              <FieldComponent label="navigator scope">
                <input
                  value={intervalRuleDraft.navigatorName || ''}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setIntervalRuleDraft({ ...intervalRuleDraft, navigatorName: event.target.value || null })}
                  className="atlas-admin-input"
                  placeholder="Leave blank for all navigators"
                />
              </FieldComponent>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldComponent label="starts at">
                <input
                  type="date"
                  value={intervalRuleDraft.startsAtIso.slice(0, 10)}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setIntervalRuleDraft({
                      ...intervalRuleDraft,
                      startsAtIso: `${event.target.value || '2026-01-01'}T00:00:00.000Z`
                    })
                  }
                  className="atlas-admin-input"
                />
              </FieldComponent>
              <FieldComponent label="weekday">
                <select
                  value={intervalRuleDraft.weekday ?? ''}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setIntervalRuleDraft({
                      ...intervalRuleDraft,
                      weekday: event.target.value ? Number(event.target.value) : null
                    })
                  }
                  className="atlas-admin-input"
                >
                  <option value="">not weekday-bound</option>
                  <option value="1">monday</option>
                  <option value="2">tuesday</option>
                  <option value="3">wednesday</option>
                  <option value="4">thursday</option>
                  <option value="5">friday</option>
                </select>
              </FieldComponent>
            </div>
            <FieldComponent label="instructions">
              <textarea
                value={intervalRuleDraft.instructions}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setIntervalRuleDraft({ ...intervalRuleDraft, instructions: event.target.value })}
                className="atlas-admin-input min-h-[96px] resize-y"
              />
            </FieldComponent>
            <label className="flex items-center gap-2 text-[13px] text-white">
              <input
                type="checkbox"
                checked={intervalRuleDraft.isActive}
                onChange={(event) => setIntervalRuleDraft({ ...intervalRuleDraft, isActive: event.target.checked })}
              />
              active rule
            </label>
            <div className="flex justify-end">
              <AtlasTextButton
                onClick={() => void handleSaveIntervalRule()}
                className="px-4 py-2 text-[13px] font-medium"
                style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
              >
                save rule
              </AtlasTextButton>
            </div>
          </div>
        ) : (
          <small className="text-[13px] text-[var(--foreground-secondary)]">Select a rule or create a new one to edit interval cadence.</small>
        )}
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5 xl:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[22px] font-medium text-white">Forced regulation review</div>
            <small className="block text-[13px] text-[var(--foreground-secondary)]">
              Active by default for new enrollees. Edit the review frequency or disable the review per enrollee; the owning
              navigator sees an action item in their profile each cycle until a regulation test is completed.
            </small>
          </div>
          <AtlasTextButton
            onClick={() => void handleSaveRegulationReviewSettings()}
            disabled={!regulationReviewDraft || isSavingRegulationReview}
            className="px-4 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
          >
            {isSavingRegulationReview ? 'saving...' : regulationReviewDraft ? 'save review settings' : 'saved'}
          </AtlasTextButton>
        </div>
        {regulationReviewError ? (
          <AtlasInsetCard className="mb-4 rounded-[18px] border-[rgba(255,92,92,0.4)] bg-[rgba(255,92,92,0.08)] px-4 py-3">
            <small className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: SP_COLORS.red }}>
              persistence warning
            </small>
            <div className="mt-1 text-[13px] text-white">{regulationReviewError}</div>
          </AtlasInsetCard>
        ) : null}
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <FieldComponent label="default frequency">
            <select
              value={effectiveRegulationReview.defaultCadence}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setRegulationReviewDraft({
                  ...effectiveRegulationReview,
                  defaultCadence: event.target.value
                })
              }
              className="atlas-admin-input"
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
            </select>
          </FieldComponent>
          <AtlasMetricPill
            label="open regulation reviews"
            value={regulationReviewDueItems.filter((item) => item.status === 'open').length}
            accentColor={SP_COLORS.red}
            className="rounded-[18px]"
          />
          <AtlasMetricPill
            label="reviews satisfied this cycle"
            value={regulationReviewDueItems.filter((item) => item.status === 'completed').length}
            accentColor={SP_COLORS.deepGreen}
            className="rounded-[18px]"
          />
        </div>
        <div className="space-y-2">
          {regulationReviewRoster.map((row) => {
            const entry = effectiveRegulationReview.enrolleeSettings[row.enrolleeId] || null
            // Mirror runtime due semantics: missing explicit enrollee config inherits
            // the default cadence and active state for new enrollees.
            const isActive = entry ? entry.isActive : effectiveRegulationReview.isActiveForNewEnrollees
            return (
              <div key={row.enrolleeId} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-medium text-white">{row.enrolleeName}</div>
                    <small className="block text-[12px] text-[var(--foreground-secondary)]">
                      {entry ? 'explicit setting' : 'inherits default (active for new enrollees)'}
                    </small>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={entry?.cadence || ''}
                      onChange={(event) =>
                        updateRegulationReviewEnrolleeSetting(row.enrolleeId, row.enrolleeName, {
                          cadence: event.target.value ? event.target.value : null
                        })
                      }
                      className="atlas-admin-input"
                    >
                      <option value="">default frequency</option>
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                      <option value="quarterly">quarterly</option>
                    </select>
                    <label className="flex items-center gap-2 text-[13px] text-white">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(event) =>
                          updateRegulationReviewEnrolleeSetting(row.enrolleeId, row.enrolleeName, {
                            isActive: event.target.checked
                          })
                        }
                      />
                      review active
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
          {!regulationReviewRoster.length ? (
            <small className="text-[13px] text-[var(--foreground-secondary)]">
              No enrollees yet. New enrollees are added with the review active automatically.
            </small>
          ) : null}
        </div>
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5 xl:col-span-2">
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">due monitor</small>
            <div className="mt-1 text-[22px] font-medium text-white">Open and completed items</div>
          </div>
          <AtlasMetricPill
            label="open due items"
            value={navigatorIntervalDueItems.filter((item) => item.status === 'open').length}
            accentColor={SP_COLORS.red}
            className="rounded-[18px]"
          />
          <AtlasMetricPill
            label="completed due items"
            value={navigatorIntervalDueItems.filter((item) => item.status === 'completed').length}
            accentColor={SP_COLORS.deepGreen}
            className="rounded-[18px]"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            {navigatorIntervalDueItems.map((item) => (
              <div key={item.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-medium text-white">{item.title}</div>
                    <small className="block text-[12px] text-[var(--foreground-secondary)]">
                      {item.navigatorName || 'all navigators'} · due {formatDateLabel(item.dueAtIso)} · {item.cadence}
                    </small>
                  </div>
                  <StatusPillComponent status={item.status} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <AtlasInsetCard className="rounded-[18px] px-4 py-4">
              <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">pickup queue watch</small>
              <div className="mt-1 text-[22px] font-medium text-white">Unassigned intake pool</div>
              <div className="mt-3 space-y-2">
                {navigatorProgramState.pickupQueue.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[14px] font-medium text-white">{item.fullName}</div>
                    <small className="block text-[12px] text-[var(--foreground-secondary)]">
                      {item.referrerOrganization} · {formatDateLabel(item.referredAtIso)} · {item.status}
                    </small>
                  </div>
                ))}
              </div>
            </AtlasInsetCard>
            <AtlasInsetCard className="rounded-[18px] px-4 py-4">
              <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">submission watch</small>
              <div className="mt-1 text-[22px] font-medium text-white">Navigator signal volume</div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <AtlasMetricPill label="self assessments" value={navigatorProgramState.selfAssessments.length} accentColor={SP_COLORS.yellow} className="rounded-[16px]" />
                <AtlasMetricPill label="supervision notes" value={navigatorProgramState.supervisionSessions.length} accentColor={SP_COLORS.blue} className="rounded-[16px]" />
                <AtlasMetricPill label="competency reviews" value={supervisorNavigatorCompetency.reduce((sum, item) => sum + item.assessmentCount, 0)} accentColor={SP_COLORS.deepGreen} className="rounded-[16px]" />
              </div>
            </AtlasInsetCard>
          </div>
        </div>
      </AtlasInsetCard>
    </div>
  )
}
