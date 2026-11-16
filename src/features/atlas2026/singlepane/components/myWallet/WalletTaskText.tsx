import React from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { RegulationInstrument, WalletTask } from '@/features/atlas2026/singlepane/domain/walletTasks'

// Mental Health Self-Care Agency (MH-SCA) and Stress Vulnerability Scale (SVS) words printed on instrument rows.
// Intentional Peer Support Core Competencies (IPSCC) rows print their own words below.
const INSTRUMENT_DUE_LABEL: Record<RegulationInstrument, string> = {
  mh_sca: 'mh-sca due',
  svs: 'svs due'
}

/** The wait a due row prints after its words: the day count, or `no record yet` when there is no record. */
function waitLabel(daysWaiting: number | null): string {
  if (daysWaiting === null) return 'no record yet'
  return `${daysWaiting} day${daysWaiting === 1 ? '' : 's'}`
}

/** The words one task prints on its ruled row. */
export default function WalletTaskText({ task }: { task: WalletTask }) {
  switch (task.kind) {
    case 'ipscc_due':
      return (
        <span className="truncate">
          {task.personName} · ipscc due · {waitLabel(task.daysWaiting)}
        </span>
      )
    case 'self_reflection_due':
      return <span className="truncate">self-reflection due · {waitLabel(task.daysWaiting)}</span>
    case 'create_session_due':
      return <span className="truncate">supervisor c.r.e.a.t.e. session due · {waitLabel(task.daysWaiting)}</span>
    case 'instrument_due':
      return (
        <span className="truncate">
          {task.personName} · {INSTRUMENT_DUE_LABEL[task.instrument]}
        </span>
      )
    case 'navigator_review_due':
      return (
        <span className="truncate">
          {task.personName} · weekly review due · {waitLabel(task.daysWaiting)}
        </span>
      )
    case 'navigator_create_session_due':
      return (
        <span className="truncate">
          {task.personName} · c.r.e.a.t.e. session due · {waitLabel(task.daysWaiting)}
        </span>
      )
    case 'contact_bridgeline':
      return (
        <>
          <span>contact bridgeline for</span>
          {task.zCodes.map((code, index) => (
            <React.Fragment key={code}>
              {index > 0 ? <span>&amp;</span> : null}
              <ZCodeBadge value={code} fill={getZCodeParentColor(code) ?? SP_COLORS.steel} size="mobile" stripLeadingZ />
            </React.Fragment>
          ))}
        </>
      )
    case 'pick_up_leads':
      return (
        <span className="truncate">
          pick up leads · {task.availableCount} {task.availableCount === 1 ? 'is' : 'are'} available
        </span>
      )
    case 'pick_up_respite_shift':
      return (
        <span className="truncate">
          pick up respite shift
          {task.availableCount === null ? '' : ` · ${task.availableCount} ${task.availableCount === 1 ? 'is' : 'are'} open`}
        </span>
      )
    case 'follow_up':
      return <span className="truncate">{task.text}</span>
    default: {
      const exhaustive: never = task
      return exhaustive
    }
  }
}
