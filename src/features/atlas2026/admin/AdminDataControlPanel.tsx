import React from 'react'
import AdminIntakeForm from '@/features/atlas2026/admin/AdminIntakeForm'
import type { AdminDataQualityMetric, EnrolleeIntakeRecord, EnrolleeProfile } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

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
    <div className="flex h-full w-full flex-col gap-3 rounded-2xl border p-4" style={{ borderColor: SP_COLORS.white }}>
      <div>
        <small className="block text-[13px] uppercase tracking-wide text-white">admin data operations</small>
        <small className="text-[12px] text-[#bbbbbb]">
          Record tools are intentionally isolated to this admin-only area. Intake drives the enrollee timeline start date.
        </small>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border p-3" style={{ borderColor: '#ffffff3a' }}>
          <small className="mb-2 block text-[12px] font-semibold text-white">data quality snapshot</small>
          <div className="space-y-1.5">
            {metrics.map((metric) => (
              <div key={metric.metric} className="flex items-center justify-between">
                <small className="text-[12px] text-white">{metric.metric.replace(/_/g, ' ')}</small>
                <small className="text-[12px] font-semibold text-white">{metric.countValue}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border p-3" style={{ borderColor: '#ffffff3a' }}>
          <small className="mb-2 block text-[12px] font-semibold text-white">ingestion + overrides</small>
          <ul className="space-y-1 text-[12px] text-[#dddddd]">
            <li>partner survey ingestion status</li>
            <li>organization canonicalization overrides</li>
            <li>route ranking policy controls</li>
            <li>timeline month-window overrides (6..12)</li>
          </ul>
        </section>
      </div>

      <section className="rounded-xl border p-3" style={{ borderColor: '#ffffff3a' }}>
        <small className="mb-2 block text-[12px] font-semibold text-white">selected enrollee</small>
        <small className="text-[12px] text-[#d8d8d8]">
          {selectedEnrollee ? `${selectedEnrollee.fullName} | ${selectedEnrollee.caseId}` : 'no enrollee selected'}
        </small>
        <small className="mt-2 block text-[12px] text-[#bcbcbc]">
          Timeline start source: {hasRecordedIntake ? 'saved intake form' : 'not yet recorded by admin'}
        </small>
      </section>

      <AdminIntakeForm intake={intake} onSave={onSaveIntake} />
    </div>
  )
}
