import type {
  AdminDataQualityMetric,
  AtlasRole,
  DomainLoadBreakdown,
  CountyHeatPoint,
  DomainLoad,
  EnrollmentRequestRecord,
  EnrolleeProfile,
  PartnerIdentifierRecord,
  RoleMenuConfig,
  RouteCandidateRecord,
  RouteLogEvent,
  RouteMilestoneType,
  RouteLogStatus,
  StabilizationPhase,
  StationIcon,
  TimelineConfig,
  ZDomain
} from '@/features/atlas2026/singlepane/types'
import countiesCsv from '../../../../../sample-data/relational-csv-archive1/counties.csv?raw'
import kolbiAvatarUrl from '../../../../../assets/Kolbi Christianson-lt.png'
import peopleCsv from '../../../../../sample-data/relational-csv-archive1/people.csv?raw'
import contactCsv from '../../../../../sample-data/relational-csv-archive1/people-contactinfo.csv?raw'
import peopleRoleAssignmentsCsv from '../../../../../sample-data/relational-csv-archive1/people-role-assignments.csv?raw'
import progressConditionsCsv from '../../../../../sample-data/relational-csv-archive1/progress-conditions.csv?raw'
import referralsCsv from '../../../../../sample-data/relational-csv-archive1/referrals.csv?raw'
import rolesCsv from '../../../../../sample-data/relational-csv-archive1/roles.csv?raw'
import partnerStationsCsv from '../../../../../sample-data/relational-csv-archive1/partner-stations.csv?raw'
import zCodesCsv from '../../../../../sample-data/relational-csv-archive1/z-codes.csv?raw'
import partnerSurveyCsv from '../../../../../survey-data/Z-Code_Partner_Survey_2026-01-03_19_56_27_unpivoted.csv?raw'

type CsvRecord = Record<string, string>

interface LocalSinglePaneDataset {
  enrollees: EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  roleConfigs: RoleMenuConfig[]
  timelineConfig: TimelineConfig
  timelineConfigsByEnrolleeId: Record<string, TimelineConfig>
  logs: RouteLogEvent[]
  enrollmentRequests: EnrollmentRequestRecord[]
  countyHeatmap: CountyHeatPoint[]
  adminMetrics: AdminDataQualityMetric[]
  partnerLoad: DomainLoad | null
  partnerLoadBreakdown: DomainLoadBreakdown | null
  partnerIdentifierRecords: PartnerIdentifierRecord[]
  surveyCapabilitiesByOrganization: Map<
    string,
    {
      stationId: string
      stationName: string
      groups: Map<string, { specialize: number; interfere: number }>
    }
  >
}

const DEFAULT_AVATAR_URL = kolbiAvatarUrl

const ROLE_MENUS: Record<AtlasRole, RoleMenuConfig> = {
  navigator: {
    role: 'navigator',
    topMenus: ['assigned enrollees', 'requests to enroll', 'referral portal', 'route planning', 'my station', 'county commons'],
    actionMenus: ['route planning']
  },
  partner: {
    role: 'partner',
    topMenus: ['assigned enrollees', 'partner referrals', 'route planning', 'service capacity', 'county commons'],
    actionMenus: ['route planning']
  },
  supervisor: {
    role: 'supervisor',
    topMenus: ['assigned navigators', 'navigator assessments', 'route planning', 'team burden', 'county commons'],
    actionMenus: ['record navigator assessment']
  },
  administrator: {
    role: 'administrator',
    topMenus: ['assigned enrollees', 'system operations', 'route planning', 'governance', 'county commons'],
    actionMenus: ['route planning']
  }
}

const GROUP_TO_DOMAIN: Record<string, ZDomain> = {
  z55: 'education',
  z56: 'work',
  z57: 'work',
  z59: 'housing',
  z60: 'social',
  z62: 'social',
  z63: 'social',
  z64: 'health',
  z65: 'legal',
  z75: 'legal'
}

const DOMAIN_TO_STATION_ICON: Record<ZDomain, StationIcon> = {
  housing: 'housing',
  health: 'health',
  work: 'work',
  social: 'social',
  legal: 'legal',
  education: 'education'
}

let cachedDataset: LocalSinglePaneDataset | null = null

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length > 0))
}

function parseCsv(text: string): CsvRecord[] {
  const [header = [], ...body] = parseCsvRows(text)
  return body.map((row) =>
    header.reduce<CsvRecord>((record, key, index) => {
      record[key] = row[index] || ''
      return record
    }, {})
  )
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatDate(dateValue: string) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (!Number.isFinite(date.getTime())) return dateValue
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date)
}

function toIsoDay(dateValue: string, time = 'T09:00:00.000Z') {
  if (!dateValue) return new Date().toISOString()
  return dateValue.includes('T') ? dateValue : `${dateValue}${time}`
}

function clampDuration(durationMonths: number) {
  return Math.min(12, Math.max(6, durationMonths))
}

function monthDifference(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0
  const yearDelta = end.getUTCFullYear() - start.getUTCFullYear()
  const monthDelta = end.getUTCMonth() - start.getUTCMonth()
  const dayAdjustment = end.getUTCDate() >= start.getUTCDate() ? 0 : -1
  return Math.max(0, yearDelta * 12 + monthDelta + dayAdjustment)
}

function getZGroup(code: string) {
  const match = code.trim().toLowerCase().match(/^z(\d{2})/)
  return match ? `z${match[1]}` : null
}

function mapGroupToDomain(group: string | null): ZDomain | null {
  if (!group) return null
  return GROUP_TO_DOMAIN[group] || null
}

function domainToLoadBucket(domain: ZDomain) {
  if (domain === 'housing') return 'habitat'
  if (domain === 'work' || domain === 'education') return 'work'
  return 'socialNetworks'
}

function normalizeLoadValue(count: number) {
  if (count <= 0) return 0
  return Math.min(100, 20 + count * 26)
}

function createDomainCounts() {
  return { habitat: 0, work: 0, socialNetworks: 0 }
}

function buildDomainLoad(enrolleeId: string, counts: { habitat: number; work: number; socialNetworks: number }): DomainLoad {
  return {
    enrolleeId,
    habitat: normalizeLoadValue(counts.habitat),
    work: normalizeLoadValue(counts.work),
    socialNetworks: normalizeLoadValue(counts.socialNetworks)
  }
}

function sortBreakdownRows(rows: DomainLoadBreakdown['rows']) {
  return rows
    .slice()
    .sort(
      (left, right) =>
        right.rawCount - left.rawCount ||
        left.mappedDomain.localeCompare(right.mappedDomain) ||
        left.zCodeGroup.localeCompare(right.zCodeGroup)
    )
}

function mapReferralStatus(status: string): RouteLogStatus {
  if (status === 'accepted') return 'completed'
  if (status === 'in_progress') return 'active'
  if (status === 'pending') return 'planned'
  if (status === 'rejected') return 'blocked'
  return 'planned'
}

function mapMilestoneType(status: RouteLogStatus, phase: StabilizationPhase): RouteMilestoneType {
  if (status === 'completed') return 'verifiedMilestone'
  if (phase === 'renewal' && status !== 'blocked') return 'sustainedChange'
  return 'intervention'
}

function buildTimelineConfig(planStartIso: string, durationMonths: number): TimelineConfig {
  const safeDuration = clampDuration(durationMonths)
  const regulationCutoff = Math.max(2, Math.floor(safeDuration / 3))
  const readinessCutoff = Math.max(regulationCutoff + 1, Math.floor((safeDuration * 2) / 3))
  return {
    planStartIso,
    durationMonths: safeDuration,
    maxDurationMonths: 12,
    gates: [
      { id: 'gate-regulation-start', label: 'regulation', phase: 'regulation', monthOffset: 0 },
      { id: 'gate-readiness-start', label: 'readiness', phase: 'readiness', monthOffset: regulationCutoff },
      { id: 'gate-renewal-start', label: 'renewal', phase: 'renewal', monthOffset: readinessCutoff },
      { id: 'gate-plan-end', label: 'plan end', phase: 'renewal', monthOffset: safeDuration }
    ]
  }
}

function getLocalDataset(): LocalSinglePaneDataset {
  if (cachedDataset) return cachedDataset

  const people = parseCsv(peopleCsv)
  const contacts = parseCsv(contactCsv)
  const peopleRoleAssignments = parseCsv(peopleRoleAssignmentsCsv)
  const progressConditions = parseCsv(progressConditionsCsv)
  const referrals = parseCsv(referralsCsv)
  const roles = parseCsv(rolesCsv)
  const stations = parseCsv(partnerStationsCsv)
  const zCodes = parseCsv(zCodesCsv)
  const counties = parseCsv(countiesCsv)
  const partnerSurvey = parseCsv(partnerSurveyCsv)

  const peopleById = new Map(people.map((row) => [row.person_id, row]))
  const primaryEmailByPersonId = new Map(
    contacts
      .filter((row) => row.contact_type === 'email' && row.is_primary === 'true')
      .map((row) => [row.person_id, row.contact_value])
  )
  const progressById = new Map(progressConditions.map((row) => [row.progress_condition_id, row]))
  const stationById = new Map(stations.map((row) => [row.partner_station_id, row]))
  const roleKeyById = new Map(roles.map((row) => [row.role_id, row.role_key]))
  const countyById = new Map(counties.map((row) => [row.county_id, row]))
  const zCodeById = new Map(zCodes.map((row) => [row.z_code_id, row]))
  const navigatorName = people.find((row) => row.external_ref === 'staff-001')?.display_name || 'atlas navigator'

  const referralsByPersonId = new Map<string, CsvRecord[]>()
  for (const referral of referrals) {
    const next = referralsByPersonId.get(referral.person_id) || []
    next.push(referral)
    referralsByPersonId.set(referral.person_id, next)
  }

  const roleConfigsFromCsv = roles
    .map((row) => ROLE_MENUS[row.role_key as AtlasRole])
    .filter(Boolean)
  const roleConfigs = [
    ...roleConfigsFromCsv,
    ...Object.values(ROLE_MENUS).filter(
      (defaultConfig) => !roleConfigsFromCsv.some((item) => item.role === defaultConfig.role)
    )
  ]

  const enrollees = people
    .filter((row) => row.person_type === 'enrollee')
    .map((person) => {
      const personReferrals = referralsByPersonId.get(person.person_id) || []
      const zCodeTags = Array.from(
        new Set(
          personReferrals
            .map((referral) => zCodeById.get(referral.z_code_id)?.code || '')
            .map(getZGroup)
            .filter((value): value is string => Boolean(value))
        )
      )
      return {
        id: person.external_ref,
        enrollmentId: person.external_ref,
        fullName: person.display_name || `${person.first_name} ${person.last_name}`.trim(),
        dob: formatDate(person.date_of_birth),
        caseId: person.external_ref.toUpperCase(),
        email: primaryEmailByPersonId.get(person.person_id) || '',
        avatarUrl: DEFAULT_AVATAR_URL,
        assignedNavigator: navigatorName,
        zCodeTags
      }
    })

  const partnerIdentifierRecords = peopleRoleAssignments
    .filter((assignment) => roleKeyById.get(assignment.role_id) === 'partner')
    .map((assignment) => {
      const person = peopleById.get(assignment.person_id)
      const station = stationById.get(assignment.partner_station_id)
      if (!person || !station) return null
      return {
        partnerId: assignment.partner_station_id || assignment.person_id,
        firstName: person.first_name || '',
        lastName: person.last_name || '',
        organizationName: station.station_name || '',
        email: primaryEmailByPersonId.get(assignment.person_id) || ''
      } satisfies PartnerIdentifierRecord
    })
    .filter((record): record is PartnerIdentifierRecord => Boolean(record))
    .sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName) ||
        left.firstName.localeCompare(right.firstName) ||
        left.organizationName.localeCompare(right.organizationName)
    )

  const personIdByEnrolleeId = new Map(enrollees.map((enrollee) => [enrollee.id, people.find((person) => person.external_ref === enrollee.id)?.person_id || '']))

  const loadBreakdownsByEnrolleeId = enrollees.reduce<Record<string, DomainLoadBreakdown>>((acc, enrollee) => {
    const personId = personIdByEnrolleeId.get(enrollee.id)
    const personReferrals = (personId && referralsByPersonId.get(personId)) || []
    const counts = createDomainCounts()
    const rowMap = new Map<string, DomainLoadBreakdown['rows'][number]>()

    for (const referral of personReferrals) {
      const zCode = zCodeById.get(referral.z_code_id)
      const zCodeGroup = getZGroup(zCode?.code || '')
      const domain = mapGroupToDomain(zCodeGroup)
      if (!domain || !zCodeGroup) continue
      const bucket = domainToLoadBucket(domain)
      counts[bucket] += 1
      const existingRow = rowMap.get(zCodeGroup) || {
        id: `${enrollee.id}-${zCodeGroup}`,
        zCodeGroup,
        mappedDomain: bucket,
        rawCount: 0
      }
      existingRow.rawCount += 1
      rowMap.set(zCodeGroup, existingRow)
    }

    acc[enrollee.id] = {
      subjectId: enrollee.id,
      subjectLabel: enrollee.fullName,
      sourceKind: 'enrolleeRecords',
      sourceLabel: 'Active enrollee Z-Code records',
      habitatTotal: counts.habitat,
      workTotal: counts.work,
      socialNetworksTotal: counts.socialNetworks,
      rows: sortBreakdownRows(Array.from(rowMap.values()))
    }
    return acc
  }, {})

  const loads = enrollees.map((enrollee) => {
    const breakdown = loadBreakdownsByEnrolleeId[enrollee.id]
    return buildDomainLoad(enrollee.id, {
      habitat: breakdown?.habitatTotal || 0,
      work: breakdown?.workTotal || 0,
      socialNetworks: breakdown?.socialNetworksTotal || 0
    })
  })

  const logs = referrals
    .map((referral) => {
      const person = peopleById.get(referral.person_id)
      const enrolleeId = person?.external_ref || referral.person_id
      const progress = progressById.get(referral.progress_condition_id)
      const zCode = zCodeById.get(referral.z_code_id)
      const zGroup = getZGroup(zCode?.code || '')
      const domain = mapGroupToDomain(zGroup) || 'social'
      const phase = (progress?.phase as StabilizationPhase) || 'regulation'
      const status = mapReferralStatus(referral.status)
      const station = stationById.get(referral.partner_station_id)
      return {
        id: referral.referral_id,
        enrolleeId,
        label: progress?.label || referral.notes || station?.station_name || 'route milestone',
        timestampIso: toIsoDay(referral.referral_date),
        status,
        phase,
        milestoneType: mapMilestoneType(status, phase),
        domainsRelieved: [domain],
        stationIcon: DOMAIN_TO_STATION_ICON[domain]
      } satisfies RouteLogEvent
    })
    .sort((left, right) => new Date(left.timestampIso).getTime() - new Date(right.timestampIso).getTime())

  const timelineConfigsByEnrolleeId = enrollees.reduce<Record<string, TimelineConfig>>((acc, enrollee) => {
    const personId = personIdByEnrolleeId.get(enrollee.id)
    const personReferrals = ((personId && referralsByPersonId.get(personId)) || []).slice().sort((left, right) => left.referral_date.localeCompare(right.referral_date))
    const firstDate = personReferrals[0]?.referral_date || '2026-03-01'
    const lastDate = personReferrals[personReferrals.length - 1]?.referral_date || firstDate
    const durationMonths = clampDuration(monthDifference(toIsoDay(firstDate), toIsoDay(lastDate)) + 6)
    acc[enrollee.id] = buildTimelineConfig(toIsoDay(firstDate, 'T00:00:00.000Z'), durationMonths)
    return acc
  }, {})

  const timelineConfig = timelineConfigsByEnrolleeId[enrollees[0]?.id || ''] || buildTimelineConfig('2026-03-01T00:00:00.000Z', 6)

  const enrollmentRequests = referrals
    .filter((referral) => referral.status === 'pending')
    .map((referral) => {
      const person = peopleById.get(referral.person_id)
      return {
        id: referral.referral_id,
        submittedAt: toIsoDay(referral.referral_date),
        status: 'pending',
        prospectiveEnrollee: person?.display_name || person?.external_ref || 'pending enrollee',
        email: person ? primaryEmailByPersonId.get(person.person_id) || '' : ''
      } satisfies EnrollmentRequestRecord
    })

  const countyHeatAccumulator = new Map<string, CountyHeatPoint>()
  for (const referral of referrals) {
    const station = stationById.get(referral.partner_station_id)
    const county = countyById.get(station?.county_id || '')
    const zCode = zCodeById.get(referral.z_code_id)
    const zGroup = Number.parseInt((getZGroup(zCode?.code || '') || '').replace('z', ''), 10)
    if (!county || !Number.isFinite(zGroup)) continue
    const key = `${county.county_id}-${zGroup}`
    const current = countyHeatAccumulator.get(key)
    countyHeatAccumulator.set(key, {
      countyId: county.county_id,
      countyName: county.county_name,
      zGroup,
      activeCaseCount: (current?.activeCaseCount || 0) + 1
    })
  }
  const countyHeatmap = Array.from(countyHeatAccumulator.values())

  const surveyCapabilitiesByOrganization = new Map<
    string,
    {
      stationId: string
      stationName: string
      groups: Map<string, { specialize: number; interfere: number }>
    }
  >()

  const localZCodeGroups = new Set(zCodes.map((row) => getZGroup(row.code)).filter((value): value is string => Boolean(value)))
  let surveyRecordsMissingLocalGroup = 0

  for (const row of partnerSurvey) {
    const organizationName = row.organization_normalized || row['The Name of Your Organization'] || ''
    const displayName = row['The Name of Your Organization'] || organizationName
    const relationType = row.z_code_relation_type
    const zGroup = getZGroup(row.z_code || '')
    if (!organizationName || !relationType || !zGroup) continue
    if (!localZCodeGroups.has(zGroup)) surveyRecordsMissingLocalGroup += 1

    const existing =
      surveyCapabilitiesByOrganization.get(organizationName) || {
        stationId: `org-${normalizeSlug(organizationName)}`,
        stationName: displayName,
        groups: new Map<string, { specialize: number; interfere: number }>()
      }
    const currentGroup = existing.groups.get(zGroup) || { specialize: 0, interfere: 0 }
    if (relationType === 'specialize') currentGroup.specialize += 1
    if (relationType === 'interfere') currentGroup.interfere += 1
    existing.groups.set(zGroup, currentGroup)
    surveyCapabilitiesByOrganization.set(organizationName, existing)
  }

  const partnerLoadCounts = createDomainCounts()
  const partnerBreakdownRowMap = new Map<string, DomainLoadBreakdown['rows'][number]>()
  for (const capability of surveyCapabilitiesByOrganization.values()) {
    for (const [group, relationCounts] of capability.groups.entries()) {
      const domain = mapGroupToDomain(group)
      if (!domain) continue
      const bucket = domainToLoadBucket(domain)
      partnerLoadCounts[bucket] += relationCounts.specialize
      const existingRow = partnerBreakdownRowMap.get(group) || {
        id: `partner-${group}`,
        zCodeGroup: group,
        mappedDomain: bucket,
        rawCount: 0,
        specializeCount: 0,
        interfereCount: 0
      }
      existingRow.rawCount += relationCounts.specialize
      existingRow.specializeCount = (existingRow.specializeCount || 0) + relationCounts.specialize
      existingRow.interfereCount = (existingRow.interfereCount || 0) + relationCounts.interfere
      partnerBreakdownRowMap.set(group, existingRow)
    }
  }

  const maxPartnerLoad = Math.max(partnerLoadCounts.habitat, partnerLoadCounts.work, partnerLoadCounts.socialNetworks, 1)
  const partnerLoad = {
    enrolleeId: 'partner-view',
    habitat: Math.round((partnerLoadCounts.habitat / maxPartnerLoad) * 100),
    work: Math.round((partnerLoadCounts.work / maxPartnerLoad) * 100),
    socialNetworks: Math.round((partnerLoadCounts.socialNetworks / maxPartnerLoad) * 100)
  }
  const partnerLoadBreakdown: DomainLoadBreakdown = {
    subjectId: 'partner-view',
    subjectLabel: 'Partner network',
    sourceKind: 'partnerSurvey',
    sourceLabel: 'Partner Z-Code survey responses',
    habitatTotal: partnerLoadCounts.habitat,
    workTotal: partnerLoadCounts.work,
    socialNetworksTotal: partnerLoadCounts.socialNetworks,
    rows: sortBreakdownRows(Array.from(partnerBreakdownRowMap.values()))
  }

  const stationsNearCapacity = stations.filter((station) => {
    const total = Number(station.capacity_total || 0)
    const available = Number(station.capacity_available || 0)
    return total > 0 && available / total < 0.25
  }).length

  const adminMetrics: AdminDataQualityMetric[] = [
    {
      metric: 'orphaned_enrollees',
      countValue: enrollees.filter((enrollee) => {
        const personId = personIdByEnrolleeId.get(enrollee.id)
        return !personId || (referralsByPersonId.get(personId) || []).length === 0
      }).length
    },
    {
      metric: 'pending_referrals',
      countValue: referrals.filter((referral) => referral.status === 'pending').length
    },
    {
      metric: 'stations_near_capacity',
      countValue: stationsNearCapacity
    },
    {
      metric: 'survey_records_missing_local_group',
      countValue: surveyRecordsMissingLocalGroup
    }
  ]

  cachedDataset = {
    enrollees,
    loads,
    loadBreakdownsByEnrolleeId,
    roleConfigs,
    timelineConfig,
    timelineConfigsByEnrolleeId,
    logs,
    enrollmentRequests,
    countyHeatmap,
    adminMetrics,
    partnerLoad,
    partnerLoadBreakdown,
    partnerIdentifierRecords,
    surveyCapabilitiesByOrganization
  }

  return cachedDataset
}

export interface SinglePaneBootstrapData {
  enrollees: EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  roleConfigs: RoleMenuConfig[]
  timelineConfig: TimelineConfig
  timelineConfigsByEnrolleeId: Record<string, TimelineConfig>
  logs: RouteLogEvent[]
}

export function getLocalSinglePaneBootstrap(): SinglePaneBootstrapData {
  const dataset = getLocalDataset()
  return {
    enrollees: dataset.enrollees,
    loads: dataset.loads,
    loadBreakdownsByEnrolleeId: dataset.loadBreakdownsByEnrolleeId,
    roleConfigs: dataset.roleConfigs.length ? dataset.roleConfigs : Object.values(ROLE_MENUS),
    timelineConfig: dataset.timelineConfig,
    timelineConfigsByEnrolleeId: dataset.timelineConfigsByEnrolleeId,
    logs: dataset.logs
  }
}

export function getLocalBaseLogs() {
  return getLocalDataset().logs
}

export function getLocalEnrollmentRequests(role: AtlasRole) {
  return role === 'navigator' ? getLocalDataset().enrollmentRequests : []
}

export function getLocalCountyHeatmap() {
  return getLocalDataset().countyHeatmap
}

export function getLocalAdminDataQuality() {
  return getLocalDataset().adminMetrics
}

export function getLocalPartnerRadialLoad() {
  return getLocalDataset().partnerLoad
}

export function getLocalPartnerRadialLoadBreakdown() {
  return getLocalDataset().partnerLoadBreakdown
}

export function searchLocalPartnerIdentifierRecords(firstName: string, lastName: string): PartnerIdentifierRecord[] {
  const trimmedFirstName = firstName.trim().toLowerCase()
  const trimmedLastName = lastName.trim().toLowerCase()
  if (!trimmedFirstName || !trimmedLastName) return []

  return getLocalDataset().partnerIdentifierRecords
    .filter(
      (record) =>
        record.firstName.toLowerCase().startsWith(trimmedFirstName) &&
        record.lastName.toLowerCase().startsWith(trimmedLastName)
    )
    .slice(0, 8)
}

export function getLocalRouteCandidates(activeZCodes: string[] = []): RouteCandidateRecord[] {
  const activeGroups = Array.from(new Set(activeZCodes.map(getZGroup).filter((value): value is string => Boolean(value))))
  const candidates = Array.from(getLocalDataset().surveyCapabilitiesByOrganization.values())
    .map((organization) => {
      let specializeHits = 0
      let conflictHits = 0
      let interfereHits = 0
      let specializationStrength = 0
      const matchedZCodes: string[] = []

      if (activeGroups.length > 0) {
        for (const group of activeGroups) {
          const relationCounts = organization.groups.get(group)
          if (!relationCounts) continue
          if (relationCounts.specialize > 0 && relationCounts.interfere === 0) specializeHits += 1
          if (relationCounts.specialize > 0 && relationCounts.interfere > 0) conflictHits += 1
          if (relationCounts.specialize === 0 && relationCounts.interfere > 0) interfereHits += 1
          if (relationCounts.specialize > 0) matchedZCodes.push(group.toUpperCase())
          specializationStrength += relationCounts.specialize
        }
      } else {
        for (const relationCounts of organization.groups.values()) {
          if (relationCounts.specialize > 0) specializeHits += 1
          if (relationCounts.specialize > 0 && relationCounts.interfere > 0) conflictHits += 1
          specializationStrength += relationCounts.specialize
        }
      }

      const score = specializeHits * 10 + specializationStrength * 2 - conflictHits * 6 - interfereHits * 4
      return {
        stationId: organization.stationId,
        partnerId: organization.stationId,
        stationName: organization.stationName,
        score,
        specializeHits,
        conflictHits,
        interfereHits,
        matchedZCodes
      } satisfies RouteCandidateRecord
    })
    .filter((candidate) => candidate.specializeHits > 0 || activeGroups.length === 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.specializeHits - left.specializeHits ||
        left.conflictHits - right.conflictHits ||
        left.interfereHits - right.interfereHits ||
        left.stationName.localeCompare(right.stationName)
    )

  return candidates.slice(0, 6)
}
