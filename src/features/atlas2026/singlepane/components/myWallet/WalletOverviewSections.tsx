import React from 'react'
import {
  AtlasInsetCard,
  AtlasMetricPill,
  AtlasPanel,
  AtlasStatusPill,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  WalletCompetencyCard,
  WalletRespiteShift,
  WalletRespiteShiftStatus,
  WalletSecondment,
  WalletSecondmentStatus,
  WalletSponsorship,
  WalletSponsorshipStatus,
  WalletSupervisor
} from '@/features/atlas2026/singlepane/data-access/walletRepository'
import { formatDateLabel } from '../navigatorProfile/model'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** `HH:MM:SS` from `time` columns prints as `HH:MM`. */
function formatClock(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  return match ? `${match[1]}:${match[2]}` : value
}

function formatDateTimeLabel(value: string | null): string {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed)
}

function sponsorshipPillColor(status: WalletSponsorshipStatus): string {
  switch (status) {
    case 'active':
      return SP_COLORS.deepGreen
    case 'ended':
      return SP_COLORS.steel
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

function respiteShiftPillColor(status: WalletRespiteShiftStatus): string {
  switch (status) {
    case 'scheduled':
      return SP_COLORS.blue
    case 'completed':
      return SP_COLORS.deepGreen
    case 'cancelled':
      return SP_COLORS.red
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

function secondmentPillColor(status: WalletSecondmentStatus): string {
  switch (status) {
    case 'planned':
      return SP_COLORS.blue
    case 'active':
      return SP_COLORS.deepGreen
    case 'completed':
      return SP_COLORS.steel
    case 'cancelled':
      return SP_COLORS.red
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

interface SectionShellProps {
  title: string
  description: string
  isLoading: boolean
  emptyLabel: string
  isEmpty: boolean
  children: React.ReactNode
}

/** One wallet section: `AtlasPanel` with the shared `my wallet` kicker, a loading or empty line, else the rows. */
function SectionShell({ title, description, isLoading, emptyLabel, isEmpty, children }: SectionShellProps) {
  return (
    <AtlasPanel kicker="my wallet" title={title} description={description}>
      {isLoading && isEmpty ? (
        <small className="atlas-caption block text-[#bcbcbc]">Loading…</small>
      ) : isEmpty ? (
        <small className="atlas-caption block text-[#bcbcbc]">{emptyLabel}</small>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </AtlasPanel>
  )
}

interface RowProps {
  primary: string
  secondary?: string | null
  trailing?: React.ReactNode
}

function Row({ primary, secondary, trailing }: RowProps) {
  return (
    <AtlasInsetCard className="flex flex-wrap items-center justify-between gap-2 text-white">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{primary}</div>
        {secondary ? <small className="atlas-caption block text-[#bcbcbc]">{secondary}</small> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </AtlasInsetCard>
  )
}

export function CompetencyCardsSection({ cards, isLoading }: { cards: WalletCompetencyCard[]; isLoading: boolean }) {
  return (
    <SectionShell
      title="competency cards"
      description="Cards issued to you from competency assessments."
      isLoading={isLoading}
      isEmpty={!cards.length}
      emptyLabel="No competency cards earned yet."
    >
      {cards.map((card) => (
        <Row key={card.cardKey} primary={card.title} secondary={`earned ${formatDateLabel(card.earnedAtIso)}`} />
      ))}
    </SectionShell>
  )
}

interface SponsorshipSectionProps {
  /** `received` prints the sponsor on each row; `given` prints the sponsored person. */
  direction: 'received' | 'given'
  rows: WalletSponsorship[]
  isLoading: boolean
}

export function SponsorshipSection({ direction, rows, isLoading }: SponsorshipSectionProps) {
  const isReceived = direction === 'received'
  return (
    <SectionShell
      title={isReceived ? 'my sponsor' : 'people I sponsor'}
      description={
        isReceived
          ? 'The tier holder who sponsors you into the Residency.'
          : 'Candidates and apprentices you sponsor. Referrals you submit count toward these.'
      }
      isLoading={isLoading}
      isEmpty={!rows.length}
      emptyLabel={isReceived ? 'No sponsor on record yet.' : 'You are not sponsoring anyone yet.'}
    >
      {rows.map((row) => (
        <Row
          key={row.id}
          primary={row.displayName}
          secondary={`since ${formatDateLabel(row.startedAtIso)}${row.endedAtIso ? ` · ended ${formatDateLabel(row.endedAtIso)}` : ''}`}
          trailing={<AtlasStatusPill color={sponsorshipPillColor(row.status)}>{row.status}</AtlasStatusPill>}
        />
      ))}
    </SectionShell>
  )
}

export function MySupervisorSection({ supervisor, isLoading }: { supervisor: WalletSupervisor | null; isLoading: boolean }) {
  return (
    <SectionShell
      title="my supervisor"
      description="The supervisor who holds your open assignment."
      isLoading={isLoading}
      isEmpty={!supervisor}
      emptyLabel="No supervisor assignment is open for you yet."
    >
      {supervisor ? (
        <Row key={supervisor.personId} primary={supervisor.displayName} secondary={`since ${formatDateLabel(supervisor.startsOn)}`} />
      ) : null}
    </SectionShell>
  )
}

export function SecondmentScheduleSection({ secondments, isLoading }: { secondments: WalletSecondment[]; isLoading: boolean }) {
  return (
    <SectionShell
      title="secondment schedule"
      description="Your host organization placements and the weekly hours at each."
      isLoading={isLoading}
      isEmpty={!secondments.length}
      emptyLabel="No secondment is scheduled for you yet."
    >
      {secondments.map((secondment) => (
        <AtlasInsetCard key={secondment.id} className="text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[14px] font-medium">{secondment.hostOrganization}</div>
              <small className="atlas-caption block text-[#bcbcbc]">
                {formatDateLabel(secondment.startsOn)} – {secondment.endsOn ? formatDateLabel(secondment.endsOn) : 'open'}
              </small>
            </div>
            <AtlasStatusPill color={secondmentPillColor(secondment.status)}>{secondment.status}</AtlasStatusPill>
          </div>
          {secondment.schedule.length ? (
            <ul className="mt-2 flex flex-col gap-1">
              {secondment.schedule.map((slot, index) => (
                <li key={`${secondment.id}-${index}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="w-10 font-medium">{DAY_LABELS[slot.dayOfWeek] ?? '—'}</span>
                  <span>
                    {formatClock(slot.startsTime)} – {formatClock(slot.endsTime)}
                  </span>
                  {slot.location ? <small className="atlas-caption text-[#bcbcbc]">{slot.location}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <small className="atlas-caption mt-2 block text-[#bcbcbc]">No weekly hours recorded.</small>
          )}
        </AtlasInsetCard>
      ))}
    </SectionShell>
  )
}

export function RespiteShiftsSection({ shifts, isLoading }: { shifts: WalletRespiteShift[]; isLoading: boolean }) {
  return (
    <SectionShell
      title="respite shifts"
      description="Shifts you have taken or are scheduled to take."
      isLoading={isLoading}
      isEmpty={!shifts.length}
      emptyLabel="No respite shifts on record yet."
    >
      {shifts.map((shift) => (
        <Row
          key={shift.id}
          primary={shift.site}
          secondary={`${formatDateTimeLabel(shift.startsAtIso)} – ${formatDateTimeLabel(shift.endsAtIso)}`}
          trailing={<AtlasStatusPill color={respiteShiftPillColor(shift.status)}>{shift.status}</AtlasStatusPill>}
        />
      ))}
    </SectionShell>
  )
}

interface LeadsSectionProps {
  count: number
  isLoading: boolean
  /** Present when the `leads` menu is on this role's row; the button calls it with that menu label. */
  onOpenLeads: (() => void) | null
}

export function LeadsSection({ count, isLoading, onOpenLeads }: LeadsSectionProps) {
  return (
    <AtlasPanel
      kicker="my wallet"
      title="leads"
      description="Leads you own in the pipeline."
      actions={
        onOpenLeads ? (
          <AtlasTextButton onClick={onOpenLeads} className="px-3 py-1 text-[12px]">
            open leads
          </AtlasTextButton>
        ) : null
      }
    >
      <AtlasMetricPill label="owned" value={isLoading ? '…' : count} className="inline-block" />
    </AtlasPanel>
  )
}
