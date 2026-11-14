import type { CreateSessionRecord, IpsCompetencySelfAssessmentRecord, RegulationReviewDueItem, SupervisorIpsAssessmentRecord } from '@/features/atlas2026/shared/contracts'
import { getWeekStartIso } from '@/features/atlas2026/singlepane/domain/dates'

/** Where a navigator-route stop opens inside the workspace. */
export type NavigatorRouteTarget =
  | { kind: 'enrollee-claims' }
  | { kind: 'navigator-claims' }
  | { kind: 'point-of-care' }
  | { kind: 'self-assessment' }
  | { kind: 'regulation-review'; enrolleeId: string; missingInstruments?: Array<'mh_sca' | 'svs'> }
  | { kind: 'create-session' }
  | { kind: 'supervisor-weekly' }
  | { kind: 'supervisor-create' }

export interface NavigatorRouteStop {
  id: string
  order: number
  title: string
  detail: string
  status: 'done' | 'now' | 'later'
  target: NavigatorRouteTarget
}

interface NavigatorRouteInput {
  canWorkEnrollees: boolean
  canReceiveSupervision: boolean
  canSupervise: boolean
  assignedEnrolleeCount: number
  ipsccEncounterSubmittedAtIsos: string[]
  regulationReviews: RegulationReviewDueItem[]
  ipsSelfAssessments: IpsCompetencySelfAssessmentRecord[]
  createSessions: CreateSessionRecord[]
  claimedNavigatorCount: number
  availableNavigatorCount: number
  supervisorAssessments: SupervisorIpsAssessmentRecord[]
  supervisorName: string
}

function thisWeek() {
  return getWeekStartIso(new Date().toISOString())
}

function inThisWeek(iso: string | null | undefined) {
  if (!iso) return false
  return getWeekStartIso(iso) === thisWeek()
}

function withStatuses(stops: Array<Omit<NavigatorRouteStop, 'order' | 'status'> & { complete: boolean }>): NavigatorRouteStop[] {
  let opened = false
  return stops.map((stop, index) => {
    if (stop.complete) {
      return { id: stop.id, order: index + 1, title: stop.title, detail: stop.detail, target: stop.target, status: 'done' }
    }
    const status = opened ? 'later' : 'now'
    opened = true
    return { id: stop.id, order: index + 1, title: stop.title, detail: stop.detail, target: stop.target, status }
  })
}

/**
 * The navigator route is the ordered "what's next" path. Care stops come first,
 * then supervision stops. Point of care is the Intentional Peer Support (IPS)
 * Competency Scale. The first incomplete stop is the one to do now.
 */
export function buildNavigatorRoute(input: NavigatorRouteInput): NavigatorRouteStop[] {
  const week = thisWeek()
  const drafts: Array<Omit<NavigatorRouteStop, 'order' | 'status'> & { complete: boolean }> = []
  const openReviews = input.regulationReviews.filter((item) => item.status === 'open')
  const pointOfCareDone = input.ipsccEncounterSubmittedAtIsos.some((iso) => inThisWeek(iso))
  const selfAssessmentDone = input.ipsSelfAssessments.some((record) => record.weekStartIso === week || inThisWeek(record.submittedAtIso))
  const openSessions = input.createSessions.filter((session) => session.status === 'open')
  const createDoneThisWeek = input.createSessions.some((session) => session.status !== 'open' && inThisWeek(session.submittedAtIso || session.sessionAtIso))
  const supervisorReviewDone = input.supervisorAssessments.some(
    (record) => record.supervisorName.trim().toLowerCase() === input.supervisorName.trim().toLowerCase() && (record.weekStartIso === week || inThisWeek(record.submittedAtIso))
  )

  if (input.canWorkEnrollees) {
    drafts.push({
      id: 'caseload',
      title: 'caseload',
      detail: input.assignedEnrolleeCount ? `${input.assignedEnrolleeCount} enrollee${input.assignedEnrolleeCount === 1 ? '' : 's'} assigned to you` : 'Assign yourself to an enrollee.',
      complete: input.assignedEnrolleeCount > 0,
      target: { kind: 'enrollee-claims' }
    })
    drafts.push({
      id: 'point-of-care',
      title: 'point of care',
      detail: pointOfCareDone ? 'IPS Competency Scale recorded this week.' : 'Hand the tablet to an enrollee at the end of the interaction.',
      complete: pointOfCareDone,
      target: { kind: 'point-of-care' }
    })
    if (openReviews.length) {
      openReviews.forEach((review) => {
        drafts.push({
          id: `regulation-${review.id}`,
          title: 'regulation review',
          detail: `${review.enrolleeName} · Stress Vulnerability Scale (SVS) and Mental Health Self-Care Agency (MH-SCA)`,
          complete: false,
          target: { kind: 'regulation-review', enrolleeId: review.enrolleeId, missingInstruments: review.missingInstruments }
        })
      })
    } else {
      drafts.push({
        id: 'regulation-clear',
        title: 'regulation reviews',
        detail: 'No enrollee is due this cycle.',
        complete: true,
        target: { kind: 'regulation-review', enrolleeId: '' }
      })
    }
  }

  if (input.canWorkEnrollees || input.canReceiveSupervision) {
    drafts.push({
      id: 'self-assessment',
      title: 'self-assessment',
      detail: selfAssessmentDone ? 'Weekly self-assessment is in.' : 'Rate the ten competencies before supervision.',
      complete: selfAssessmentDone,
      target: { kind: 'self-assessment' }
    })
    drafts.push({
      id: 'create',
      title: 'c.r.e.a.t.e.',
      detail: openSessions.length
        ? `${openSessions.length} session${openSessions.length === 1 ? '' : 's'} still open`
        : createDoneThisWeek
          ? 'A session was submitted this week.'
          : 'Open a session with your supervisor and submit the form.',
      complete: !openSessions.length && createDoneThisWeek,
      target: input.canSupervise && !input.canWorkEnrollees ? { kind: 'supervisor-create' } : { kind: 'create-session' }
    })
  }

  if (input.canSupervise) {
    const noneAvailable = input.availableNavigatorCount === 0
    drafts.push({
      id: 'claim-navigators',
      title: 'your navigators',
      detail: noneAvailable
        ? 'No navigators are on the roster yet.'
        : input.claimedNavigatorCount
          ? `${input.claimedNavigatorCount} assigned to you`
          : 'Assign navigators to you.',
      complete: noneAvailable || input.claimedNavigatorCount > 0,
      target: { kind: 'navigator-claims' }
    })
    if (!drafts.some((stop) => stop.id === 'create')) {
      drafts.push({
        id: 'create',
        title: 'c.r.e.a.t.e.',
        detail: openSessions.length
          ? `${openSessions.length} session${openSessions.length === 1 ? '' : 's'} still open`
          : createDoneThisWeek
            ? 'A session was submitted this week.'
            : 'Open a session with a navigator, submit the form, then close it.',
        complete: !openSessions.length && createDoneThisWeek,
        target: { kind: 'supervisor-create' }
      })
    }
    drafts.push({
      id: 'supervisor-weekly',
      title: 'weekly review',
      detail: supervisorReviewDone ? 'Weekly navigator review is in.' : 'Score a navigator on the ten competencies.',
      complete: supervisorReviewDone,
      target: { kind: 'supervisor-weekly' }
    })
  }

  return withStatuses(drafts)
}
