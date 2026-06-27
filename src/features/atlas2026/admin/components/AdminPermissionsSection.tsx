import React from 'react'
import { AtlasInsetCard, AtlasMetricPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { AdminPortalPersonRecord } from '@/features/atlas2026/singlepane/types'
import type { PermissionExceptionRow } from '@/features/atlas2026/admin/components/types'

interface AdminPermissionsSectionProps {
  permissionExceptionRows: PermissionExceptionRow[]
  totalPermissionExceptionCount: number
  onClearPersonPermissionExceptions: (person: AdminPortalPersonRecord) => Promise<void>
}

export default function AdminPermissionsSection({
  permissionExceptionRows,
  totalPermissionExceptionCount,
  onClearPersonPermissionExceptions
}: AdminPermissionsSectionProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
              exception posture
            </small>
            <div className="mt-1 text-[22px] font-medium text-white">Person-level permission overrides</div>
            <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
              Role defaults stay uniform; this panel tracks only explicit exceptions set by administrators.
            </small>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <AtlasMetricPill
            label="users with exceptions"
            value={permissionExceptionRows.length}
            accentColor={SP_COLORS.yellow}
            className="rounded-[18px]"
          />
          <AtlasMetricPill
            label="total exception entries"
            value={totalPermissionExceptionCount}
            accentColor={SP_COLORS.red}
            className="rounded-[18px]"
          />
        </div>
        <small className="mt-4 block text-[12px] text-[var(--foreground-secondary)]">
          Use clear actions to return users to role baseline access when temporary exceptions are no longer needed.
        </small>
      </AtlasInsetCard>
      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="mb-4 text-[22px] font-medium text-white">Exception ledger</div>
        <div className="space-y-3">
          {permissionExceptionRows.map((row) => (
            <div key={row.person.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-white">{row.person.fullName || row.person.email || row.person.id}</div>
                  <small className="block text-[12px] text-[var(--foreground-secondary)]">
                    {row.person.email || 'no email'} · {row.roles.join(', ') || 'no atlas roles'} · {row.entries.length} exception
                    {row.entries.length === 1 ? '' : 's'}
                  </small>
                </div>
                <AtlasTextButton
                  onClick={() => void onClearPersonPermissionExceptions(row.person)}
                  className="px-3 py-2 text-[12px] font-medium"
                  style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                >
                  clear exceptions
                </AtlasTextButton>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.entries.map((entry) => (
                  <span
                    key={entry.id}
                    className="rounded-full border px-2 py-1 text-[11px] leading-none"
                    style={{
                      borderColor: entry.kind === 'allow' ? 'rgba(69,191,85,0.45)' : 'rgba(255,92,92,0.45)',
                      color: entry.kind === 'allow' ? SP_COLORS.deepGreen : SP_COLORS.red
                    }}
                  >
                    {entry.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!permissionExceptionRows.length ? (
            <small className="text-[13px] text-[var(--foreground-secondary)]">
              No person-level exceptions are set. All users currently inherit role defaults.
            </small>
          ) : null}
        </div>
      </AtlasInsetCard>
    </div>
  )
}
