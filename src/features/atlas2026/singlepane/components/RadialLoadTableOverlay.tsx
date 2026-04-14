import React from 'react'
import { AtlasCloseButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { DomainLoad, DomainLoadBreakdown } from '@/features/atlas2026/singlepane/types'

interface RadialLoadTableOverlayProps {
  isOpen: boolean
  load: DomainLoad | null
  breakdown: DomainLoadBreakdown | null
  onClose: () => void
}

export default function RadialLoadTableOverlay({ isOpen, load, breakdown, onClose }: RadialLoadTableOverlayProps) {
  if (!isOpen) return null

  const rows = breakdown?.rows || []
  const isPartnerSurvey = breakdown?.sourceKind === 'partnerSurvey'

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/65 px-5 py-6 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="max-h-[calc(100vh-72px)] w-full max-w-[980px] overflow-y-auto rounded-[34px] border px-6 py-5"
        style={{ borderColor: SP_COLORS.white, backgroundColor: '#020202' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.18em] text-[#9f9f9f]">radial load inputs</small>
            <h3 className="text-[28px] font-medium text-white">{breakdown?.subjectLabel || 'Load details'}</h3>
            <small className="text-[13px] text-[#c7c7c7]">{breakdown?.sourceLabel || 'No source data available.'}</small>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            className="h-9 w-9"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <SummaryChip label="habitat" rawTotal={breakdown?.habitatTotal || 0} chartValue={load?.habitat || 0} color={SP_COLORS.orange} />
          <SummaryChip label="work" rawTotal={breakdown?.workTotal || 0} chartValue={load?.work || 0} color={SP_COLORS.yellow} />
          <SummaryChip
            label="social networks"
            rawTotal={breakdown?.socialNetworksTotal || 0}
            chartValue={load?.socialNetworks || 0}
            color={SP_COLORS.blue}
          />
        </div>

        <div className="rounded-[26px] border p-4" style={{ borderColor: '#ffffff25' }}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <small className="block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">derived source rows</small>
              <small className="text-[12px] text-[#8f8f8f]">
                {isPartnerSurvey
                  ? 'Partner chart values are derived from survey specialize counts mapped into habitat, work, and social domains.'
                  : 'Enrollee chart values are derived from active Z-Code records mapped into habitat, work, and social domains.'}
              </small>
            </div>
            <small className="text-[12px] text-[#9f9f9f]">{rows.length} grouped row{rows.length === 1 ? '' : 's'}</small>
          </div>

          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-[13px] text-white">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">
                    <th className="border-b border-white/10 px-3 py-2 font-medium">z-code</th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium">mapped domain</th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium text-right">chart input</th>
                    {isPartnerSurvey ? <th className="border-b border-white/10 px-3 py-2 font-medium text-right">interfere</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b border-white/5 px-3 py-3">{row.zCodeGroup.toUpperCase()}</td>
                      <td className="border-b border-white/5 px-3 py-3">{formatBucketLabel(row.mappedDomain)}</td>
                      <td className="border-b border-white/5 px-3 py-3 text-right">
                        {isPartnerSurvey ? row.specializeCount || row.rawCount : row.rawCount}
                      </td>
                      {isPartnerSurvey ? (
                        <td className="border-b border-white/5 px-3 py-3 text-right">{row.interfereCount || 0}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[22px] border px-4 py-6 text-[13px] text-[#cfcfcf]" style={{ borderColor: '#ffffff20' }}>
              No mapped Z-Code rows are available for this radial chart yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryChip({
  label,
  rawTotal,
  chartValue,
  color
}: {
  label: string
  rawTotal: number
  chartValue: number
  color: string
}) {
  return (
    <div className="rounded-[22px] border px-4 py-3" style={{ borderColor: '#ffffff20', backgroundColor: '#050505' }}>
      <small className="block text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">{label}</small>
      <div className="mt-1 text-[22px] font-medium" style={{ color }}>
        {chartValue}%
      </div>
      <small className="text-[12px] text-[#bdbdbd]">raw total {rawTotal}</small>
    </div>
  )
}

function formatBucketLabel(bucket: DomainLoadBreakdown['rows'][number]['mappedDomain']) {
  if (bucket === 'socialNetworks') return 'social networks'
  return bucket
}
