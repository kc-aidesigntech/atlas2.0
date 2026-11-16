/**
 * Builds the My Wallet task pad's due tasks from records the workspace has
 * already loaded. Nothing here reads the network or the clock; the caller
 * passes `now`.
 */
import type { RegulationReviewDueItem } from '@/features/atlas2026/shared/contracts'
import { DUE_AFTER_DAYS, type RegulationInstrument, type WalletPerson, type WalletTask } from './walletTasks'

const DAY_MS = 24 * 60 * 60 * 1000

export interface WalletTaskSources {
  now: Date
  /** `enrollee_profile.write`. */
  canWorkEnrollees: boolean
  /** `supervision.receive`. */
  canReceiveSupervision: boolean
  /** `supervision.give`. */
  canGiveSupervision: boolean
  /** `leads.engage`. */
  canEngageLeads: boolean
  /** `respite_shifts.take`. */
  canTakeRespiteShifts: boolean
  /** The viewer's name on the records they submit as the supervised person. */
  viewerName: string
  /** The viewer's name on the records they submit as the supervisor. */
  supervisorName: string
  assignedEnrollees: WalletPerson[]
  /** The viewer's Intentional Peer Support Core Competencies (IPSCC) encounter records. */
  ipsccSubmissions: Array<{ enrolleeId: string; submittedAtIso: string }>
  regulationReviews: Array<Pick<RegulationReviewDueItem, 'enrolleeId' | 'enrolleeName' | 'status' | 'missingInstruments'>>
  /** The viewer's own self-reflection records. */
  selfAssessments: Array<{ submittedAtIso: string }>
  /** The Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) sessions the viewer is a party to. */
  createSessions: Array<{ navigatorName: string; supervisorName: string; status: string; submittedAtIso: string; sessionAtIso: string }>
  /** The people the viewer supervises. */
  managedNavigators: WalletPerson[]
  supervisorAssessments: Array<{ supervisorName: string; navigatorName: string; submittedAtIso: string }>
  /** Leads with no owner that are not closed; null when the count was not read. */
  availableLeadCount: number | null
  /** Cancelled respite shifts that have not ended; null when the count was not read. */
  openRespiteShiftCount: number | null
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** The local calendar day `date` is in, as `YYYY-MM-DD`. */
export function businessDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** The Monday of the local calendar week `date` is in, as `YYYY-MM-DD`. */
export function businessWeekKey(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7))
  return businessDayKey(monday)
}

/** The latest valid time in `isos`, in milliseconds; null when none is valid. */
function latestMs(isos: string[]): number | null {
  const times = isos.map((iso) => new Date(iso).getTime()).filter((time) => Number.isFinite(time))
  return times.length ? Math.max(...times) : null
}

/** Whole days from the latest record to `now`; null when there is no record. A record in the future counts as zero days. */
function daysSinceLatest(isos: string[], now: Date): number | null {
  const latest = latestMs(isos)
  return latest === null ? null : Math.max(0, Math.floor((now.getTime() - latest) / DAY_MS))
}

/** True with no record, and with a latest record at or past the due-after day count. */
function isDue(daysWaiting: number | null): boolean {
  return daysWaiting === null || daysWaiting >= DUE_AFTER_DAYS
}

type WaitingTask = Extract<WalletTask, { daysWaiting: number | null }>

/** Longest wait first; a task with no record sorts ahead of every counted wait. */
function byLongestWait(left: WaitingTask, right: WaitingTask): number {
  return (right.daysWaiting ?? Number.POSITIVE_INFINITY) - (left.daysWaiting ?? Number.POSITIVE_INFINITY)
}

/**
 * The due tasks, in pad order: the form tasks at or past the due-after day
 * count (longest wait first), then one task per missing regulation
 * instrument, then the lead and respite pickup tasks.
 *
 * A form task's id ends with the Monday of the current week and a pickup
 * task's id ends with the current day. A task checked without its record
 * being submitted is therefore a new, unchecked task in the next week or day.
 */
export function buildWalletTasks(sources: WalletTaskSources): WalletTask[] {
  const { now } = sources
  const week = businessWeekKey(now)
  const day = businessDayKey(now)
  const waiting: WaitingTask[] = []

  if (sources.canWorkEnrollees) {
    sources.assignedEnrollees.forEach((enrollee) => {
      const daysWaiting = daysSinceLatest(
        sources.ipsccSubmissions.filter((record) => record.enrolleeId === enrollee.id).map((record) => record.submittedAtIso),
        now
      )
      if (!isDue(daysWaiting)) return
      waiting.push({ kind: 'ipscc_due', id: `ipscc:${enrollee.id}:${week}`, personId: enrollee.id, personName: enrollee.name, daysWaiting })
    })
  }

  if (sources.canWorkEnrollees || sources.canReceiveSupervision) {
    const daysWaiting = daysSinceLatest(
      sources.selfAssessments.map((record) => record.submittedAtIso),
      now
    )
    if (isDue(daysWaiting)) waiting.push({ kind: 'self_reflection_due', id: `self-reflection:${week}`, daysWaiting })
  }

  // A closed session is a record; an open session is not.
  const closedSessions = sources.createSessions.filter((session) => session.status !== 'open')
  const sessionTime = (session: (typeof closedSessions)[number]) => session.submittedAtIso || session.sessionAtIso

  if (sources.canGiveSupervision) {
    // A supervisor's session list holds the sessions they gave, so their tasks are one per supervised person.
    sources.managedNavigators.forEach((navigator) => {
      const reviewDays = daysSinceLatest(
        sources.supervisorAssessments
          .filter((record) => sameName(record.supervisorName, sources.supervisorName) && sameName(record.navigatorName, navigator.name))
          .map((record) => record.submittedAtIso),
        now
      )
      if (isDue(reviewDays)) {
        waiting.push({
          kind: 'navigator_review_due',
          id: `navigator-review:${navigator.id}:${week}`,
          personId: navigator.id,
          personName: navigator.name,
          daysWaiting: reviewDays
        })
      }
      const sessionDays = daysSinceLatest(
        closedSessions
          .filter((session) => sameName(session.supervisorName, sources.supervisorName) && sameName(session.navigatorName, navigator.name))
          .map(sessionTime),
        now
      )
      if (isDue(sessionDays)) {
        waiting.push({
          kind: 'navigator_create_session_due',
          id: `navigator-create-session:${navigator.id}:${week}`,
          personId: navigator.id,
          personName: navigator.name,
          daysWaiting: sessionDays
        })
      }
    })
  } else if (sources.canReceiveSupervision) {
    const daysWaiting = daysSinceLatest(
      closedSessions.filter((session) => sameName(session.navigatorName, sources.viewerName)).map(sessionTime),
      now
    )
    if (isDue(daysWaiting)) waiting.push({ kind: 'create_session_due', id: `create-session:${week}`, daysWaiting })
  }

  const tasks: WalletTask[] = waiting.sort(byLongestWait)

  if (sources.canWorkEnrollees) {
    sources.regulationReviews
      .filter((review) => review.status === 'open')
      .forEach((review) => {
        // An open review that names no instrument is missing both.
        const instruments: RegulationInstrument[] = review.missingInstruments ?? ['mh_sca', 'svs']
        instruments.forEach((instrument) => {
          tasks.push({
            kind: 'instrument_due',
            id: `instrument:${review.enrolleeId}:${instrument}:${week}`,
            personId: review.enrolleeId,
            personName: review.enrolleeName,
            instrument
          })
        })
      })
  }

  if (sources.canEngageLeads && sources.availableLeadCount) {
    tasks.push({ kind: 'pick_up_leads', id: `pick-up-leads:${day}`, availableCount: sources.availableLeadCount })
  }
  if (sources.canTakeRespiteShifts && sources.openRespiteShiftCount) {
    tasks.push({ kind: 'pick_up_respite_shift', id: `pick-up-respite-shift:${day}`, availableCount: sources.openRespiteShiftCount })
  }

  return tasks
}
