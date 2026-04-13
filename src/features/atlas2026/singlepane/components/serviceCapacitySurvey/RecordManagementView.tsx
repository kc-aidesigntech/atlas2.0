import React from 'react'
import { AtlasInsetCard, AtlasPanel, AtlasStatusPill } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { PartnerServiceCapacitySubmissionRecord } from '@/features/atlas2026/singlepane/types'
import { formatDateTimeLabel } from '@/features/atlas2026/singlepane/components/serviceCapacitySurvey/draft'

export function RecordManagementView({
  records,
  totalSurveyCardCount,
  onCheckoutNewRecord,
  onEditDraftRecord
}: {
  records: PartnerServiceCapacitySubmissionRecord[]
  totalSurveyCardCount: number
  onCheckoutNewRecord: () => void
  onEditDraftRecord: (record: PartnerServiceCapacitySubmissionRecord) => void
}) {
  return (
    <AtlasPanel
      kicker="partner service capacity"
      title="Record management"
      description="Review service-capacity submission history in read-only mode, then check out a new blank survey record when you are ready to reassess."
      className="rounded-[30px] bg-[#020202]"
      actions={
        <button
          type="button"
          onClick={onCheckoutNewRecord}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border text-[28px] font-light transition-[box-shadow,border-color] duration-150 ease-out hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.1)]"
          style={{ borderColor: SP_COLORS.yellow, color: SP_COLORS.yellow }}
          aria-label="Conduct a new service capacity survey"
          title="Conduct a new service capacity survey"
        >
          +
        </button>
      }
    >
      <div className="space-y-3">
        {records.length ? (
          records.map((record) => {
            const updatedLabel = formatDateTimeLabel(record.updatedAtIso || record.submittedAtIso)
            const completedLabel = formatDateTimeLabel(record.completedAtIso)
            const respondentName = [record.header.firstName, record.header.lastName].filter(Boolean).join(' ').trim() || 'respondent not recorded'
            return (
              <AtlasInsetCard key={record.id} className="rounded-[24px] border-white/15 bg-[#060606] px-4 py-4 md:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {record.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => onEditDraftRecord(record)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border transition-[box-shadow,border-color,background-color] duration-150 ease-out hover:border-white/50 hover:bg-white/5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_14px_rgba(255,255,255,0.08)]"
                          style={{ borderColor: '#ffffff2f', color: SP_COLORS.white }}
                          aria-label={`Edit draft record ${record.id}`}
                          title="Edit draft"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
                            <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                            <path d="m12 6 4 4" />
                          </svg>
                        </button>
                      ) : null}
                      <StatusPill status={record.status} />
                      <small className="text-[12px] text-[var(--foreground-secondary)] md:text-[13px]">
                        {formatDateTimeLabel(record.completedAtIso || record.updatedAtIso || record.submittedAtIso) || 'timestamp unavailable'}
                      </small>
                    </div>
                    <div className="text-[18px] font-medium text-white md:text-[20px]">{respondentName}</div>
                  </div>
                  <small className="font-mono text-[11px] lowercase text-[var(--foreground-secondary)] md:text-[12px]">
                    record id {record.id}
                  </small>
                </div>

                <div className="mt-3 grid gap-3 text-[13px] md:grid-cols-4 md:text-[14px]">
                  <ReadOnlyMetric label="organization" value={record.header.organizationName || 'not recorded'} />
                  <ReadOnlyMetric label="updated" value={updatedLabel || 'not recorded'} />
                  <ReadOnlyMetric label="completed" value={completedLabel || 'not completed'} />
                  <ReadOnlyMetric label="ratings captured" value={`${record.answers.length} / ${totalSurveyCardCount}`} />
                </div>
              </AtlasInsetCard>
            )
          })
        ) : (
          <AtlasInsetCard className="rounded-[24px] border-white/15 bg-[#060606] px-4 py-6 text-center md:px-5">
            <div className="text-[18px] font-medium text-white md:text-[20px]">No service-capacity records yet</div>
            <small className="mt-2 block text-[13px] text-[var(--foreground-secondary)] md:text-[15px]">
              Use the + action to check out the first blank survey record for this partner.
            </small>
          </AtlasInsetCard>
        )}
      </div>
    </AtlasPanel>
  )
}

function StatusPill({ status }: { status: PartnerServiceCapacitySubmissionRecord['status'] }) {
  const isCompleted = status === 'completed'
  return <AtlasStatusPill color={isCompleted ? SP_COLORS.deepGreen : SP_COLORS.yellow}>{status}</AtlasStatusPill>
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <AtlasInsetCard className="rounded-[18px] border-white/10 px-3 py-2">
      <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
        {label}
      </small>
      <div className="mt-1 text-white">{value}</div>
    </AtlasInsetCard>
  )
}
