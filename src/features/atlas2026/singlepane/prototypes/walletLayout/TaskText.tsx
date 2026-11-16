import React from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { PrototypePerson, ReadinessTask, RegulationInstrument } from './walletLayoutModel'

// Mental Health Self-Care Agency (MH-SCA) and Stress Vulnerability Scale (SVS) words printed on instrument rows.
// Intentional Peer Support Core Competencies (IPSCC) rows print their own words below.
const INSTRUMENT_DUE_LABEL: Record<RegulationInstrument, string> = {
  mh_sca: 'mh-sca due',
  svs: 'svs due'
}

/** The words one task prints on its ruled row. */
export default function TaskText({ task, peopleById }: { task: ReadinessTask; peopleById: ReadonlyMap<string, PrototypePerson> }) {
  switch (task.kind) {
    case 'ipscc_due':
      return (
        <span className="truncate">
          {peopleById.get(task.personId)?.name ?? 'unknown person'} · ipscc due · {task.daysWaiting} days
        </span>
      )
    case 'self_reflection_due':
      return <span className="truncate">self-reflection due · {task.daysWaiting} days</span>
    case 'create_session_due':
      return <span className="truncate">supervisor c.r.e.a.t.e. session due · {task.daysWaiting} days</span>
    case 'instrument_due':
      return (
        <span className="truncate">
          {peopleById.get(task.personId)?.name ?? 'unknown person'} · {INSTRUMENT_DUE_LABEL[task.instrument]}
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
      return <span className="truncate">pick up leads · {task.availableCount} are available</span>
    case 'pick_up_respite_shift':
      return <span className="truncate">pick up respite shift</span>
    case 'follow_up':
      return <span className="truncate">{task.text}</span>
    default: {
      const exhaustive: never = task
      return exhaustive
    }
  }
}
