import React from 'react'
import AdminIntakeForm from '@/features/atlas2026/admin/AdminIntakeForm'
import { AtlasInsetCard, AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AdminDataQualityMetric, EnrolleeIntakeRecord, EnrolleeProfile } from '@/features/atlas2026/singlepane/types'

interface AdminDataControlPanelProps {
  metrics: AdminDataQualityMetric[]
  selectedEnrollee: EnrolleeProfile | null
  intake: EnrolleeIntakeRecord | null
  hasRecordedIntake: boolean
  onSaveIntake: (intake: EnrolleeIntakeRecord) => void
}

export default function AdminDataControlPanel({
  metrics,
  selectedEnrollee,
  intake,
  hasRecordedIntake,
  onSaveIntake
}: AdminDataControlPanelProps) {
  return (
    <AtlasPanel
      kicker="admin data operations"
      description="Record tools are intentionally isolated to this admin-only area. Intake drives the enrollee timeline start date."
      className="h-full w-full"
      contentClassName="space-y-3"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <AtlasInsetCard>
          <small className="mb-2 block text-[12px] font-semibold text-white">data quality snapshot</small>
          <div className="space-y-1.5">
            {metrics.map((metric) => (
              <div key={metric.metric} className="flex items-center justify-between">
                <small className="text-[12px] text-white">{metric.metric.replace(/_/g, ' ')}</small>
                <small className="text-[12px] font-semibold text-white">{metric.countValue}</small>
              </div>
            ))}
          </div>
        </AtlasInsetCard>

        <AtlasInsetCard>
          <small className="mb-2 block text-[12px] font-semibold text-white">ingestion + overrides</small>
          <ul className="space-y-1 text-[12px] text-[#dddddd]">
            <li>partner survey ingestion status</li>
            <li>organization canonicalization overrides</li>
            <li>route ranking policy controls</li>
            <li>timeline month-window overrides (6..12)</li>
          </ul>
        </AtlasInsetCard>
      </div>

      <AtlasInsetCard>
        <small className="mb-2 block text-[12px] font-semibold text-white">selected enrollee</small>
        <small className="text-[12px] text-[#d8d8d8]">
          {selectedEnrollee ? `${selectedEnrollee.fullName} | ${selectedEnrollee.caseId}` : 'no enrollee selected'}
        </small>
        <small className="mt-2 block text-[12px] text-[#bcbcbc]">
          Timeline start source: {hasRecordedIntake ? 'saved intake form' : 'not yet recorded by admin'}
        </small>
      </AtlasInsetCard>

      <AdminIntakeForm intake={intake} onSave={onSaveIntake} />
    </AtlasPanel>
  )
}
