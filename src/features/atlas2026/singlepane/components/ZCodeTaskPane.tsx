import React, { useMemo, useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { AtlasIconButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface ZCodeTaskPaneProps {
  zCode: string | null
  childCodes?: string[]
  onClose: () => void
}

interface TaskRow {
  id: string
  zCode: string
  label: string
  resolved: boolean
}

const TASK_LABELS: Record<string, string[]> = {
  z55: ['education stability check', 'literacy support referral'],
  z56: ['employment readiness touchpoint', 'job retention barrier check'],
  z57: ['workplace exposure follow-up', 'safety planning confirmation'],
  z58: ['physical environment barrier check', 'basic services access review'],
  z59: ['housing stabilization checkpoint', 'resource access confirmation'],
  z60: ['social support activation', 'family network outreach'],
  z62: ['care coordination with trauma-informed provider', 'household stress buffer check'],
  z63: ['family-system milestone review', 'dependency support follow-up'],
  z64: ['psychosocial stress intervention review', 'behavioral regulation referral'],
  z65: ['system navigation support', 'institutional barrier resolution'],
  z75: ['service accessibility escalation', 'agency handoff confirmation']
}

export default function ZCodeTaskPane({ zCode, childCodes = [], onClose }: ZCodeTaskPaneProps) {
  const [taskState, setTaskState] = useState<Record<string, boolean>>({})

  const rows = useMemo<TaskRow[]>(() => {
    if (!zCode) return []
    const normalized = zCode.trim().toLowerCase()
    const zGroup = normalized.match(/^z?(\d{2})/)?.[1]
    // Fall back to generic tasks so the pane remains usable for newly introduced Z-groups before copy is curated.
    const taskLabels = (zGroup && TASK_LABELS[`z${zGroup}`]) || ['z-code assessment task', 'resolution checkpoint']
    return taskLabels.map((label, index) => ({
      id: `${normalized}-${index}`,
      zCode: normalized.startsWith('z') ? normalized : `z${normalized}`,
      label,
      resolved: Boolean(taskState[`${normalized}-${index}`])
    }))
  }, [taskState, zCode])

  if (!zCode) return null

  return (
    <div className="absolute right-4 top-4 z-30 w-[320px] rounded-2xl border bg-black p-3" style={{ borderColor: SP_COLORS.white }}>
      <div className="mb-2 flex items-center justify-between">
        <small className="text-[13px] font-semibold text-white">z-code task list: {zCode.replace(/^z/i, '')}</small>
        <AtlasIconButton
          onClick={onClose}
          className="h-9 w-9 p-[5px]"
          style={{ ['--button-border-color' as const]: SP_COLORS.border } as React.CSSProperties}
        >
          <X size={14} color={SP_COLORS.white} />
        </AtlasIconButton>
      </div>
      <div className="space-y-2">
        {childCodes.length > 0 ? (
          <div className="rounded-md border px-2 py-1.5" style={{ borderColor: '#ffffff30' }}>
            <small className="block text-[11px] uppercase tracking-[0.08em] text-[#bdbdbd]">child z-codes</small>
            <small className="mt-1 block text-[12px] text-white">
              {childCodes
                .map((code) => code.replace(/^z/i, '').toUpperCase())
                .join(', ')}
            </small>
          </div>
        ) : null}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded-md border px-2 py-1.5" style={{ borderColor: '#ffffff40' }}>
            <div>
              <small className="block text-[12px] text-white">{row.label}</small>
              <small className="text-[11px] text-[#c7c7c7]">{row.zCode.toUpperCase()}</small>
            </div>
            <div className="flex items-center gap-1">
              <AtlasIconButton
                onClick={() => setTaskState((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                className="h-9 w-9 p-[5px]"
                style={{ ['--button-border-color' as const]: row.resolved ? SP_COLORS.deepGreen : SP_COLORS.border } as React.CSSProperties}
                title="mark resolved"
              >
                <Check size={14} color={row.resolved ? SP_COLORS.deepGreen : SP_COLORS.white} />
              </AtlasIconButton>
              <AtlasIconButton
                onClick={() => setTaskState((prev) => ({ ...prev, [row.id]: false }))}
                className="h-9 w-9 p-[5px]"
                style={{ ['--button-border-color' as const]: SP_COLORS.red } as React.CSSProperties}
                title="mark not applicable"
              >
                <Trash2 size={14} color={SP_COLORS.red} />
              </AtlasIconButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
