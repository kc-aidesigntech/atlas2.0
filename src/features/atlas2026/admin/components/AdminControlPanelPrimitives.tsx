import React from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import { AtlasStatusPill } from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { ZCodeSurveyPrompt } from '@/features/atlas2026/shared/contracts'

export function RecordTable({
  columns,
  rows,
  renderRow
}: {
  columns: string[]
  rows: Array<{ id: string }>
  renderRow: (row: { id: string }, index: number) => React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10">
      <div className="grid grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
        {columns.map((column) => <div key={column}>{column}</div>)}
      </div>
      <div className="divide-y divide-white/10">
        {rows.length ? rows.map((row, index) => <div key={row.id}>{renderRow(row, index)}</div>) : null}
      </div>
    </div>
  )
}

export function ZCodeParentFilterCircle({ parentCode, selected }: { parentCode: string; selected: boolean }) {
  const normalized = parentCode.trim().toUpperCase()
  const fill = getZCodeParentColor(normalized) || SP_COLORS.white
  return (
    <span
      className="inline-flex rounded-full transition-all duration-200 ease-out"
      style={{ boxShadow: selected ? `0 0 0 2px ${SP_COLORS.yellow}` : 'none' }}
    >
      <ZCodeBadge
        value={normalized}
        fill={fill}
        size="filter"
        stripLeadingZ
        checked={selected}
        borderColor={selected ? SP_COLORS.white : fill}
      />
    </span>
  )
}

function ZCodeCircleChip({ code }: { code: string }) {
  const normalized = code.trim().toUpperCase()
  const parentCode = normalized.split('.')[0] || normalized
  const fill = getZCodeParentColor(parentCode) || SP_COLORS.white
  return <ZCodeBadge value={normalized} fill={fill} size="chip" className="transition-all duration-200 ease-out" />
}

export function ZCodeOptionCard({
  option,
  selected,
  onToggle
}: {
  option: ZCodeSurveyPrompt
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-start gap-3 rounded-[16px] border px-3 py-3 text-left transition-all duration-200 ease-out"
      style={{
        borderColor: selected ? SP_COLORS.yellow : '#ffffff18',
        backgroundColor: selected ? '#1a1606' : '#101010'
      }}
    >
      <ZCodeCircleChip code={option.normalizedZCode} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-white">{option.title}</span>
        <span className="mt-1 block text-[12px] text-[var(--foreground-secondary)]">{option.description}</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
          {option.parentTheme}
        </span>
      </span>
      <span
        className="mt-0.5 inline-flex min-w-[64px] justify-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{
          borderColor: selected ? SP_COLORS.yellow : '#ffffff20',
          color: selected ? SP_COLORS.yellow : '#d8d8d8'
        }}
      >
        {selected ? 'selected' : 'select'}
      </span>
    </button>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] text-[var(--foreground-secondary)]">
      <span className="mb-1.5 block uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  )
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const color =
    normalized.includes('inactive') || normalized.includes('archived')
      ? SP_COLORS.red
      : normalized.includes('draft') || normalized.includes('pending') || normalized.includes('invited')
        ? SP_COLORS.yellow
        : SP_COLORS.deepGreen
  return <AtlasStatusPill color={color}>{status}</AtlasStatusPill>
}
