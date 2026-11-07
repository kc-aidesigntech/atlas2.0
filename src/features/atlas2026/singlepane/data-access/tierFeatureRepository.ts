/**
 * Tier feature tables and their Remote Procedure Calls (RPCs), from
 * `20261104190500_tier_feature_tables.sql`: Intentional Peer Support (IPS)
 * cohorts and enrollments, sponsorships, competency cards, respite shifts,
 * secondments with their weekly schedule, and leads. Every read returns a
 * `TierFeatureList` whose `source` is `unavailable` when the table is missing,
 * denied by Row-Level Security (RLS), or Supabase is not configured, the same
 * way `loadMyPermissions` degrades. Writes throw with the database message.
 */
import { isTierKey, type TierKey } from '@/features/atlas2026/shared/tiers'
import { resolveSessionPersonIdFromMetadata } from '@/features/atlas2026/singlepane/data-access/enrollmentAssignmentRepository'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

export type TierFeatureSource = 'table' | 'unavailable'

export interface TierFeatureList<T> {
  source: TierFeatureSource
  rows: T[]
}

export interface PersonDirectoryEntry {
  id: string
  displayName: string
}

export type IpsCohortStatus = 'planned' | 'active' | 'completed'

export interface IpsCohortRecord {
  id: string
  name: string
  startsOn: string | null
  endsOn: string | null
  status: IpsCohortStatus
}

export type IpsCohortEnrollmentStatus = 'enrolled' | 'completed' | 'withdrawn'

export interface IpsCohortEnrollmentRecord {
  id: string
  cohortId: string
  personId: string
  personName: string
  enrolledAtIso: string
  enrolledByPersonId: string | null
  status: IpsCohortEnrollmentStatus
}

export type SponsorshipStatus = 'active' | 'ended'

export interface SponsorshipRecord {
  id: string
  sponsorPersonId: string
  sponsorName: string
  sponsoredPersonId: string
  sponsoredName: string
  status: SponsorshipStatus
  startedAtIso: string
  endedAtIso: string | null
  note: string | null
}

export interface CompetencyCardRecord {
  id: string
  cardKey: string
  title: string
  description: string | null
  tierMin: TierKey | null
}

export interface PersonCompetencyCardRecord {
  id: string
  personId: string
  personName: string
  cardId: string
  cardKey: string
  cardTitle: string
  earnedAtIso: string
  issuedByPersonId: string | null
  issuedByName: string | null
  assessmentId: string | null
  note: string | null
}

export interface CompetencyAssessmentOption {
  id: string
  navigatorPersonId: string
  assessedAtIso: string
}

export type LeadStage = 'new' | 'contacted' | 'engaged' | 'referred' | 'closed'

export const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'engaged', 'referred', 'closed']

export interface LeadRecord {
  id: string
  personId: string | null
  displayName: string
  phone: string | null
  email: string | null
  source: string | null
  stage: LeadStage
  ownerPersonId: string | null
  ownerName: string | null
  notes: string | null
  lastContactAtIso: string | null
  updatedAtIso: string
}

/** Keys `fn_upsert_lead` reads from its payload. `id` present means update. */
export interface LeadUpsertInput {
  id?: string
  personId?: string | null
  displayName?: string
  phone?: string | null
  email?: string | null
  source?: string | null
  stage?: LeadStage
  ownerPersonId?: string | null
  notes?: string | null
  lastContactAtIso?: string | null
}

export type RespiteShiftStatus = 'scheduled' | 'completed' | 'cancelled'

export interface RespiteShiftRecord {
  id: string
  personId: string
  personName: string
  site: string
  startsAtIso: string
  endsAtIso: string
  status: RespiteShiftStatus
  note: string | null
}

export type SecondmentStatus = 'planned' | 'active' | 'completed' | 'cancelled'

export interface SecondmentScheduleRow {
  id: string
  dayOfWeek: number
  startsTime: string
  endsTime: string
  location: string | null
}

export interface SecondmentRecord {
  id: string
  personId: string
  personName: string
  hostOrganization: string
  partnerId: string | null
  startsOn: string
  endsOn: string | null
  status: SecondmentStatus
  schedule: SecondmentScheduleRow[]
}

export interface PartnerStationRecord {
  partnerId: string
  organizationName: string
  stationId: string | null
  stationName: string | null
  countyName: string | null
  primaryContactName: string | null
  primaryContactEmail: string | null
  capacityTotal: number | null
  capacityAvailable: number | null
}

export type RoutePlanStopStatus = 'planned' | 'active' | 'completed' | 'blocked'

export const ROUTE_PLAN_STOP_STATUSES: RoutePlanStopStatus[] = ['planned', 'active', 'completed', 'blocked']

export interface RoutePlanStopRecord {
  id: string
  routePlanId: string
  stationId: string
  stopOrder: number
  assignedDate: string
  targetDate: string | null
  status: RoutePlanStopStatus
}

type Row = Record<string, unknown>

const UNAVAILABLE: TierFeatureList<never> = { source: 'unavailable', rows: [] }

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

function nullableText(value: unknown): string | null {
  const normalized = text(value).trim()
  return normalized ? normalized : null
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Logs the failed read and returns the unavailable list. */
function unavailable<T>(label: string, error: unknown): TierFeatureList<T> {
  console.warn(`${label} read failed`, toSupabaseErrorMessage(error, 'unknown error'))
  return UNAVAILABLE
}

function requireSupabase() {
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase is not configured.')
  return supabase as any
}

function throwOnError(error: unknown, fallbackMessage: string): void {
  if (error) throw new Error(toSupabaseErrorMessage(error, fallbackMessage))
}

/** The caller's `atlas.people.id`; null when no session or no person row. */
export async function resolveViewerPersonId(): Promise<string | null> {
  if (!hasSupabaseConfig || !supabase) return null
  try {
    return await resolveSessionPersonIdFromMetadata()
  } catch (error) {
    console.warn('viewer person id lookup failed', toSupabaseErrorMessage(error, 'unknown error'))
    return null
  }
}

/** Reads `v_people_directory`, every person ordered by display name. */
export async function listPeopleDirectory(): Promise<TierFeatureList<PersonDirectoryEntry>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('v_people_directory')
    .select('id, display_name')
    .order('display_name', { ascending: true })
  if (error) return unavailable('v_people_directory', error)
  return {
    source: 'table',
    rows: ((data || []) as Row[])
      .filter((row) => text(row.id))
      .map((row) => ({ id: text(row.id), displayName: text(row.display_name) || 'unnamed person' }))
  }
}

/** Display names for the given person ids from `v_people_directory`; a failed read yields an empty map. */
async function loadPeopleNames(personIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const ids = Array.from(new Set(personIds.filter((id): id is string => Boolean(id && id.trim()))))
  const names = new Map<string, string>()
  if (!ids.length || !hasSupabaseConfig || !supabase) return names
  const { data, error } = await (supabase as any).schema('atlas').from('v_people_directory').select('id, display_name').in('id', ids)
  if (error) {
    console.warn('v_people_directory read failed', error.message)
    return names
  }
  for (const row of (data || []) as Row[]) names.set(text(row.id), text(row.display_name))
  return names
}

function personName(names: Map<string, string>, personId: string | null): string {
  if (!personId) return ''
  return names.get(personId) || 'unknown person'
}

// ---------------------------------------------------------------------------
// IPS cohorts
// ---------------------------------------------------------------------------

/** Reads `atlas.ips_cohorts`, newest start date first. */
export async function listCohorts(): Promise<TierFeatureList<IpsCohortRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('ips_cohorts')
    .select('id, name, starts_on, ends_on, status')
    .order('starts_on', { ascending: false, nullsFirst: false })
  if (error) return unavailable('ips_cohorts', error)
  return {
    source: 'table',
    rows: ((data || []) as Row[]).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      startsOn: nullableText(row.starts_on),
      endsOn: nullableText(row.ends_on),
      status: oneOf<IpsCohortStatus>(row.status, ['planned', 'active', 'completed'], 'planned')
    }))
  }
}

/** Reads `atlas.ips_cohort_enrollments` with person names, newest enrollment first. */
export async function listCohortEnrollments(): Promise<TierFeatureList<IpsCohortEnrollmentRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('ips_cohort_enrollments')
    .select('id, cohort_id, person_id, enrolled_at, enrolled_by, status')
    .order('enrolled_at', { ascending: false })
  if (error) return unavailable('ips_cohort_enrollments', error)
  const rows = (data || []) as Row[]
  const names = await loadPeopleNames(rows.map((row) => text(row.person_id)))
  return {
    source: 'table',
    rows: rows.map((row) => ({
      id: text(row.id),
      cohortId: text(row.cohort_id),
      personId: text(row.person_id),
      personName: personName(names, text(row.person_id)),
      enrolledAtIso: text(row.enrolled_at),
      enrolledByPersonId: nullableText(row.enrolled_by),
      status: oneOf<IpsCohortEnrollmentStatus>(row.status, ['enrolled', 'completed', 'withdrawn'], 'enrolled')
    }))
  }
}

/** Inserts an `atlas.ips_cohorts` row (RLS: `supervision.give`) and returns its id. */
export async function createCohort(input: { name: string; startsOn: string | null; endsOn: string | null }): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client
    .schema('atlas')
    .from('ips_cohorts')
    .insert({ name: input.name.trim(), starts_on: input.startsOn || null, ends_on: input.endsOn || null })
    .select('id')
    .single()
  throwOnError(error, 'Unable to create the cohort.')
  return text((data as Row | null)?.id)
}

/** Calls `fn_enroll_in_cohort(cohort_id, target_person_id)`; the database trigger moves an active t1 to t2. */
export async function enrollInCohort(cohortId: string, personId: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.schema('atlas').rpc('fn_enroll_in_cohort', { cohort_id: cohortId, target_person_id: personId })
  throwOnError(error, 'Unable to enroll the person in the cohort.')
  return text(data)
}

// ---------------------------------------------------------------------------
// Sponsorships
// ---------------------------------------------------------------------------

/** Reads `atlas.sponsorships` with both names; RLS returns the caller's own rows or every row for `sponsorship.give`. */
export async function listSponsorships(): Promise<TierFeatureList<SponsorshipRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('sponsorships')
    .select('id, sponsor_person_id, sponsored_person_id, status, started_at, ended_at, note')
    .order('started_at', { ascending: false })
  if (error) return unavailable('sponsorships', error)
  const rows = (data || []) as Row[]
  const names = await loadPeopleNames(rows.flatMap((row) => [text(row.sponsor_person_id), text(row.sponsored_person_id)]))
  return {
    source: 'table',
    rows: rows.map((row) => ({
      id: text(row.id),
      sponsorPersonId: text(row.sponsor_person_id),
      sponsorName: personName(names, text(row.sponsor_person_id)),
      sponsoredPersonId: text(row.sponsored_person_id),
      sponsoredName: personName(names, text(row.sponsored_person_id)),
      status: oneOf<SponsorshipStatus>(row.status, ['active', 'ended'], 'active'),
      startedAtIso: text(row.started_at),
      endedAtIso: nullableText(row.ended_at),
      note: nullableText(row.note)
    }))
  }
}

/** Calls `fn_create_sponsorship(sponsor_person_id, sponsored_person_id)` and returns the sponsorship id. */
export async function createSponsorship(sponsorPersonId: string, sponsoredPersonId: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client
    .schema('atlas')
    .rpc('fn_create_sponsorship', { sponsor_person_id: sponsorPersonId, sponsored_person_id: sponsoredPersonId })
  throwOnError(error, 'Unable to create the sponsorship.')
  return text(data)
}

/** Updates the sponsorship row to `ended` with `ended_at` now. */
export async function endSponsorship(sponsorshipId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .schema('atlas')
    .from('sponsorships')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sponsorshipId)
  throwOnError(error, 'Unable to end the sponsorship.')
}

// ---------------------------------------------------------------------------
// Competency cards
// ---------------------------------------------------------------------------

/** Reads the `atlas.competency_cards` catalog ordered by card key. */
export async function listCompetencyCards(): Promise<TierFeatureList<CompetencyCardRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('competency_cards')
    .select('id, card_key, title, description, tier_min')
    .order('card_key', { ascending: true })
  if (error) return unavailable('competency_cards', error)
  return {
    source: 'table',
    rows: ((data || []) as Row[]).map((row) => ({
      id: text(row.id),
      cardKey: text(row.card_key),
      title: text(row.title),
      description: nullableText(row.description),
      tierMin: isTierKey(row.tier_min) ? row.tier_min : null
    }))
  }
}

/** Reads `atlas.people_competency_cards` joined to the catalog, newest first; `personId` narrows to one person. */
export async function listPersonCompetencyCards(personId?: string): Promise<TierFeatureList<PersonCompetencyCardRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  let query = (supabase as any)
    .schema('atlas')
    .from('people_competency_cards')
    .select('id, person_id, card_id, earned_at, issued_by_person_id, assessment_id, note, competency_cards(card_key, title)')
    .order('earned_at', { ascending: false })
  if (personId) query = query.eq('person_id', personId)
  const { data, error } = await query
  if (error) return unavailable('people_competency_cards', error)
  const rows = (data || []) as Row[]
  const names = await loadPeopleNames(rows.flatMap((row) => [text(row.person_id), text(row.issued_by_person_id)]))
  return {
    source: 'table',
    rows: rows.map((row) => {
      const card = (row.competency_cards || {}) as Row
      return {
        id: text(row.id),
        personId: text(row.person_id),
        personName: personName(names, text(row.person_id)),
        cardId: text(row.card_id),
        cardKey: text(card.card_key),
        cardTitle: text(card.title) || text(card.card_key) || 'card',
        earnedAtIso: text(row.earned_at),
        issuedByPersonId: nullableText(row.issued_by_person_id),
        issuedByName: nullableText(row.issued_by_person_id) ? personName(names, text(row.issued_by_person_id)) : null,
        assessmentId: nullableText(row.assessment_id),
        note: nullableText(row.note)
      }
    })
  }
}

/** Reads `atlas.navigator_competency_assessments` for one navigator; the ids feed `fn_issue_competency_card.assessment_id`. */
export async function listCompetencyAssessmentsForPerson(personId: string): Promise<TierFeatureList<CompetencyAssessmentOption>> {
  if (!hasSupabaseConfig || !supabase || !personId) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('navigator_competency_assessments')
    .select('id, navigator_person_id, assessed_at')
    .eq('navigator_person_id', personId)
    .order('assessed_at', { ascending: false })
  if (error) return unavailable('navigator_competency_assessments', error)
  return {
    source: 'table',
    rows: ((data || []) as Row[]).map((row) => ({
      id: text(row.id),
      navigatorPersonId: text(row.navigator_person_id),
      assessedAtIso: text(row.assessed_at)
    }))
  }
}

/** Calls `fn_issue_competency_card(target_person_id, card_id, assessment_id)` and returns the earned-card row id. */
export async function issueCompetencyCard(personId: string, cardId: string, assessmentId: string | null = null): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client
    .schema('atlas')
    .rpc('fn_issue_competency_card', { target_person_id: personId, card_id: cardId, assessment_id: assessmentId })
  throwOnError(error, 'Unable to issue the competency card.')
  return text(data)
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

/** Reads `atlas.leads` with owner names, most recently updated first. */
export async function listLeads(): Promise<TierFeatureList<LeadRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('leads')
    .select('id, person_id, display_name, phone, email, source, stage, owner_person_id, notes, last_contact_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) return unavailable('leads', error)
  const rows = (data || []) as Row[]
  const names = await loadPeopleNames(rows.map((row) => text(row.owner_person_id)))
  return {
    source: 'table',
    rows: rows.map((row) => ({
      id: text(row.id),
      personId: nullableText(row.person_id),
      displayName: text(row.display_name),
      phone: nullableText(row.phone),
      email: nullableText(row.email),
      source: nullableText(row.source),
      stage: oneOf<LeadStage>(row.stage, LEAD_STAGES, 'new'),
      ownerPersonId: nullableText(row.owner_person_id),
      ownerName: nullableText(row.owner_person_id) ? personName(names, text(row.owner_person_id)) : null,
      notes: nullableText(row.notes),
      lastContactAtIso: nullableText(row.last_contact_at),
      updatedAtIso: text(row.updated_at)
    }))
  }
}

/** Calls `fn_upsert_lead(payload)`; only the keys present in `input` are sent, so an update leaves other columns alone. */
export async function upsertLead(input: LeadUpsertInput): Promise<string> {
  const client = requireSupabase()
  const payload: Record<string, unknown> = {}
  if (input.id !== undefined) payload.id = input.id
  if (input.personId !== undefined) payload.person_id = input.personId
  if (input.displayName !== undefined) payload.display_name = input.displayName
  if (input.phone !== undefined) payload.phone = input.phone
  if (input.email !== undefined) payload.email = input.email
  if (input.source !== undefined) payload.source = input.source
  if (input.stage !== undefined) payload.stage = input.stage
  if (input.ownerPersonId !== undefined) payload.owner_person_id = input.ownerPersonId
  if (input.notes !== undefined) payload.notes = input.notes
  if (input.lastContactAtIso !== undefined) payload.last_contact_at = input.lastContactAtIso
  const { data, error } = await client.schema('atlas').rpc('fn_upsert_lead', { payload })
  throwOnError(error, 'Unable to save the lead.')
  return text(data)
}

// ---------------------------------------------------------------------------
// Respite shifts
// ---------------------------------------------------------------------------

/** Reads `atlas.respite_shifts` with person names, soonest start first. */
export async function listRespiteShifts(): Promise<TierFeatureList<RespiteShiftRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('respite_shifts')
    .select('id, person_id, site, starts_at, ends_at, status, note')
    .order('starts_at', { ascending: false })
  if (error) return unavailable('respite_shifts', error)
  const rows = (data || []) as Row[]
  const names = await loadPeopleNames(rows.map((row) => text(row.person_id)))
  return {
    source: 'table',
    rows: rows.map((row) => ({
      id: text(row.id),
      personId: text(row.person_id),
      personName: personName(names, text(row.person_id)),
      site: text(row.site),
      startsAtIso: text(row.starts_at),
      endsAtIso: text(row.ends_at),
      status: oneOf<RespiteShiftStatus>(row.status, ['scheduled', 'completed', 'cancelled'], 'scheduled'),
      note: nullableText(row.note)
    }))
  }
}

/** Inserts a scheduled `atlas.respite_shifts` row for `personId` and returns its id. */
export async function createRespiteShift(input: {
  personId: string
  site: string
  startsAtIso: string
  endsAtIso: string
  note?: string | null
}): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client
    .schema('atlas')
    .from('respite_shifts')
    .insert({
      person_id: input.personId,
      site: input.site.trim(),
      starts_at: input.startsAtIso,
      ends_at: input.endsAtIso,
      status: 'scheduled',
      note: input.note || null
    })
    .select('id')
    .single()
  throwOnError(error, 'Unable to create the respite shift.')
  return text((data as Row | null)?.id)
}

/** Updates the shift's `person_id` to the claimant and resets `status` to `scheduled`. */
export async function claimRespiteShift(shiftId: string, personId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .schema('atlas')
    .from('respite_shifts')
    .update({ person_id: personId, status: 'scheduled' })
    .eq('id', shiftId)
  throwOnError(error, 'Unable to claim the respite shift.')
}

/** Updates the shift's `status`; `cancelled` releases it, `completed` closes it. */
export async function setRespiteShiftStatus(shiftId: string, status: RespiteShiftStatus): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.schema('atlas').from('respite_shifts').update({ status }).eq('id', shiftId)
  throwOnError(error, 'Unable to update the respite shift.')
}

// ---------------------------------------------------------------------------
// Secondments
// ---------------------------------------------------------------------------

/** Reads `atlas.secondments` and nests each one's `atlas.secondment_schedule` rows ordered by day and start time. */
export async function listSecondments(): Promise<TierFeatureList<SecondmentRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('secondments')
    .select('id, person_id, host_organization, partner_id, starts_on, ends_on, status')
    .order('starts_on', { ascending: false })
  if (error) return unavailable('secondments', error)
  const rows = (data || []) as Row[]
  if (!rows.length) return { source: 'table', rows: [] }
  const [names, scheduleResult] = await Promise.all([
    loadPeopleNames(rows.map((row) => text(row.person_id))),
    (supabase as any)
      .schema('atlas')
      .from('secondment_schedule')
      .select('id, secondment_id, day_of_week, starts_time, ends_time, location')
      .in('secondment_id', rows.map((row) => text(row.id)))
      .order('day_of_week', { ascending: true })
      .order('starts_time', { ascending: true })
  ])
  if (scheduleResult.error) console.warn('secondment_schedule read failed', scheduleResult.error.message)
  const scheduleBySecondment = new Map<string, SecondmentScheduleRow[]>()
  for (const row of ((scheduleResult.data || []) as Row[])) {
    const secondmentId = text(row.secondment_id)
    const current = scheduleBySecondment.get(secondmentId) || []
    current.push({
      id: text(row.id),
      dayOfWeek: integer(row.day_of_week) ?? 0,
      startsTime: text(row.starts_time),
      endsTime: text(row.ends_time),
      location: nullableText(row.location)
    })
    scheduleBySecondment.set(secondmentId, current)
  }
  return {
    source: 'table',
    rows: rows.map((row) => ({
      id: text(row.id),
      personId: text(row.person_id),
      personName: personName(names, text(row.person_id)),
      hostOrganization: text(row.host_organization),
      partnerId: nullableText(row.partner_id),
      startsOn: text(row.starts_on),
      endsOn: nullableText(row.ends_on),
      status: oneOf<SecondmentStatus>(row.status, ['planned', 'active', 'completed', 'cancelled'], 'planned'),
      schedule: scheduleBySecondment.get(text(row.id)) || []
    }))
  }
}

// ---------------------------------------------------------------------------
// Partners: station directory, station capacity, route plan stops (milestones)
// ---------------------------------------------------------------------------

/** Reads `v_partner_station_directory`, the same view `loadPartnerStationProfile` uses, for every partner. */
export async function listPartnerStations(): Promise<TierFeatureList<PartnerStationRecord>> {
  if (!hasSupabaseConfig || !supabase) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('v_partner_station_directory')
    .select(
      'partner_id, organization_name, primary_contact_first_name, primary_contact_last_name, primary_contact_email, station_id, station_name, capacity_total, capacity_available, county_name'
    )
    .order('organization_name', { ascending: true })
  if (error) return unavailable('v_partner_station_directory', error)
  return {
    source: 'table',
    rows: ((data || []) as Row[]).map((row) => {
      const contactName = `${text(row.primary_contact_first_name)} ${text(row.primary_contact_last_name)}`.trim()
      return {
        partnerId: text(row.partner_id),
        organizationName: text(row.organization_name),
        stationId: nullableText(row.station_id),
        stationName: nullableText(row.station_name),
        countyName: nullableText(row.county_name),
        primaryContactName: contactName || null,
        primaryContactEmail: nullableText(row.primary_contact_email),
        capacityTotal: integer(row.capacity_total),
        capacityAvailable: integer(row.capacity_available)
      }
    })
  }
}

/** Calls `fn_update_partner_station(target_station_id, payload)` with the station name and capacities; the RPC gates on `partner_profile.write`. */
export async function updatePartnerStation(
  stationId: string,
  input: { stationName: string; capacityTotal: number; capacityAvailable: number }
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.schema('atlas').rpc('fn_update_partner_station', {
    target_station_id: stationId,
    payload: {
      station_name: input.stationName.trim(),
      capacity_total: input.capacityTotal,
      capacity_available: input.capacityAvailable
    }
  })
  throwOnError(error, 'Unable to update the partner station.')
}

/** Reads `atlas.route_plan_stops` for one station, newest assigned date first. */
export async function listRoutePlanStopsForStation(stationId: string): Promise<TierFeatureList<RoutePlanStopRecord>> {
  if (!hasSupabaseConfig || !supabase || !stationId) return UNAVAILABLE
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('route_plan_stops')
    .select('id, route_plan_id, station_id, stop_order, assigned_date, target_date, status')
    .eq('station_id', stationId)
    .order('assigned_date', { ascending: false })
  if (error) return unavailable('route_plan_stops', error)
  return {
    source: 'table',
    rows: ((data || []) as Row[]).map((row) => ({
      id: text(row.id),
      routePlanId: text(row.route_plan_id),
      stationId: text(row.station_id),
      stopOrder: integer(row.stop_order) ?? 0,
      assignedDate: text(row.assigned_date),
      targetDate: nullableText(row.target_date),
      status: oneOf<RoutePlanStopStatus>(row.status, ROUTE_PLAN_STOP_STATUSES, 'planned')
    }))
  }
}

/** Calls `fn_set_route_plan_stop_status(target_stop_id, next_status)`; the RPC gates on `partner_milestones.write`. */
export async function setRoutePlanStopStatus(stopId: string, status: RoutePlanStopStatus): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .schema('atlas')
    .rpc('fn_set_route_plan_stop_status', { target_stop_id: stopId, next_status: status })
  throwOnError(error, 'Unable to update the stop.')
}
