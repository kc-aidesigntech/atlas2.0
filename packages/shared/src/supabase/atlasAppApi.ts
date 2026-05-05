/**
 * Supabase data-access adapter for Atlas (ATLAS) app surfaces. It normalizes mixed
 * table/view payloads into stable records consumed by web and mobile features.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AtlasJsonDataset,
  InstructionBomItem,
  JourneyAssignment,
  Participant,
  RouteTemplate,
  RoutingStep,
} from "../atlas2026/contracts";

type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

export interface AppRoleNavigationRecord {
  roleKey: string;
  topMenus: string[];
  actionMenus: string[];
  metadata: Record<string, unknown>;
}

export interface SinglePaneTimelineGateRecord {
  id: string;
  label: string;
  phase: "regulation" | "readiness" | "renewal";
  monthOffset: number;
}

export interface SinglePaneTimelineConfigRecord {
  durationMonths: number;
  maxDurationMonths: number;
  gates: SinglePaneTimelineGateRecord[];
}

export interface SinglePaneSurveyDefinitionRecord {
  scale: Array<{ value: number; label: string; description: string }>;
  sections: Array<{
    parentCode: string;
    theme: string;
    prompts: Array<{
      id: string;
      parentCode: string;
      parentTheme: string;
      zCode: string;
      normalizedZCode: string;
      title: string;
      description: string;
    }>;
  }>;
}

export interface SinglePaneEnrolleeProfileRecord {
  enrolleeId: string;
  enrollmentId: string;
  fullName: string;
  dob: string;
  caseId: string;
  email: string;
  avatarUrl: string | null;
  assignedNavigator: string;
  zCodeTags: string[];
  activeZCodeDetails: SinglePaneEnrolleeActiveZCodeRecord[];
  completedParentCodes: string[];
  enrollmentStartIso: string;
  targetDurationMonths: number;
  currentPhase: "regulation" | "readiness" | "renewal";
}

export interface SinglePaneEnrolleeActiveZCodeRecord {
  enrolleeZCodeId: string;
  parentCode: string;
  zCode: string;
  title: string;
  description: string;
  isResolved: boolean;
  resolutionAt: string | null;
  resolutionPartnerId: string | null;
  resolutionPartnerName: string | null;
  resolutionNote: string | null;
}

export interface SinglePaneDomainLoadRecord {
  enrollmentId: string;
  habitat: number;
  work: number;
  socialNetworks: number;
}

export interface SinglePaneDomainLoadBreakdownRowRecord {
  enrollmentId: string;
  fullName: string;
  zCodeGroup: string;
  mappedDomain: "habitat" | "work" | "socialNetworks";
  rawCount: number;
}

export interface RouteCandidateDetailsRecord {
  enrollmentId: string;
  stationId: string;
  partnerId: string;
  stationName: string;
  score: number;
  matchedZCodeCount: number;
  needUnitsMatched: number;
  partnerBurdenTotal: number;
  matchedZCodes: string[];
  matchedParentSummaries: RouteCandidateParentSummaryRecord[];
}

export interface RouteCandidateParentSummaryRecord {
  parentCode: string;
  matchedChildCount: number;
  avgBurdenScore: number;
  matchedChildZCodes: string[];
}

export interface PartnerLoadBreakdownRecord {
  subjectId: string;
  subjectLabel: string;
  sourceKind: "partnerSurvey";
  sourceLabel: string;
  habitatTotal: number;
  workTotal: number;
  socialNetworksTotal: number;
  rows: Array<{
    id: string;
    zCodeGroup: string;
    mappedDomain: "habitat" | "work" | "socialNetworks";
    rawCount: number;
  }>;
}

export interface SinglePaneEnrollmentRequestRecord {
  id: string;
  submittedAt: string;
  status: "pending" | "accepted" | "rejected" | "assigned";
  prospectiveEnrollee: string;
  email: string | null;
}

export interface EnrollmentAssignmentBoardRecord {
  enrollmentId: string;
  enrolleeId: string;
  enrolleeName: string;
  caseId: string | null;
  currentPhase: "regulation" | "readiness" | "renewal";
  countyId: string | null;
  countyName: string | null;
  navigatorPersonIds: string[];
  navigatorNames: string[];
  assignedNavigatorLabel: string;
}

export interface SinglePaneCountyHeatPointRecord {
  countyId: string;
  countyName: string;
  zGroup: number;
  activeCaseCount: number;
}

export interface SinglePaneAdminMetricRecord {
  metric: string;
  countValue: number;
}

export interface SupervisorNavigatorCompetencyRollupRecord {
  supervisorPersonId: string;
  supervisorName: string;
  navigatorPersonId: string;
  navigatorName: string;
  assessmentCount: number;
  lastAssessedAt: string | null;
  weightedRollingAverage: number | null;
}

export interface LegacyAtlasRuntimeConfig {
  roles: string[];
  policyBoundaries: Record<string, string[]>;
  stabilizationPhases: string[];
  pressureDomains: Array<{ id: string; label: string }>;
  routeScoringFactors: {
    coverageWeight: number;
    phaseAlignmentWeight: number;
    specializationWeight: number;
    reversibilityWeight: number;
    transferCostPenalty: number;
    interferencePenalty: number;
  };
  reciprocityEthos: string;
  srigCoordinationAreas: string[];
  institutionalEcosystem: Array<{ id: string; label: string; function: string }>;
}

export interface LegacyAtlasParticipantRecord {
  participantId: string;
  countyId: string | null;
  displayName: string;
  currentPhase: string;
  phaseReadiness: number;
  pressureVectors: Array<Record<string, unknown>>;
  constraintFlags: string[];
  activeRouteId: string | null;
}

export interface LegacyAtlasCapacityNodeRecord {
  partnerId: string;
  label: string;
  routeClass: string;
  coverageScore: number;
  phaseAlignment: number;
  specializationScore: number;
  reversibilitySupport: number;
  transferCost: number;
  interferenceRisk: number;
  phaseIndex: number;
  domain?: string | null;
  primaryDomain?: string | null;
  domainCoverage?: string[];
  blockers: string[];
}

export interface LegacyTimestamp {
  seconds: number;
  nanoseconds: number;
  toMillis: () => number;
}

export interface LegacyAtlasRouteRecord {
  id: string;
  routeId: string;
  participantId: string;
  partnerId: string | null;
  routeClass: string;
  status: string;
  score: number | null;
  interferenceRisk: number | null;
  transferCost: number | null;
  activatedByRole: string | null;
  activatedByUserId: string | null;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

export interface LegacyAtlasRouteStepRecord {
  id: string;
  routeRecordId: string | null;
  routeId: string;
  participantId: string;
  partnerId: string | null;
  stepId: string;
  label: string;
  status: string;
  dependencies: string[];
  domain: string | null;
  sequence: number;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

export interface LegacyAtlasMemoryEventRecord {
  id: string;
  participantId: string;
  eventType: string;
  phase: string;
  label: string | null;
  verified: boolean;
  createdByRole: string | null;
  createdByUserId: string | null;
  createdAt: LegacyTimestamp;
}

export interface LegacyAtlasOntologyWeightsRecord {
  coverageWeight: number;
  phaseAlignmentWeight: number;
  specializationWeight: number;
  reversibilityWeight: number;
  transferCostPenalty: number;
  interferencePenalty: number;
  civicDiplomacyBoost: number;
  slaThresholdHours: number;
  interferenceMediumThreshold: number;
  interferenceHighThreshold: number;
  phaseReadinessAlertThreshold: number;
  pcfRefinementWeight: number;
  reciprocityActivationThreshold: number;
}

export interface LegacyAtlasOntologyAuditRecord {
  id: string;
  eventType: string | null;
  actorRole: string | null;
  actorUserId: string | null;
  label: string;
  payload: Record<string, unknown>;
  updatedAt: LegacyTimestamp;
}

export interface LegacyAtlasRenewalRoleRecord {
  id: string;
  participantId: string;
  roleLabel: string | null;
  assignedByRole: string | null;
  assignedByUserId: string | null;
  payload: Record<string, unknown>;
  updatedAt: LegacyTimestamp;
}

// These coercion helpers intentionally absorb backend schema drift so callers
// can rely on strongly shaped records without per-surface defensive parsing.
function toTimestamp(value?: string | null): LegacyTimestamp {
  // Legacy consumers expect a Firestore-like timestamp shape; invalid/missing input is
  // normalized to epoch rather than throwing so snapshot reads stay resilient.
  const millis = value ? new Date(value).getTime() : 0;
  const safeMillis = Number.isFinite(millis) ? millis : 0;
  return {
    seconds: Math.floor(safeMillis / 1000),
    nanoseconds: (safeMillis % 1000) * 1_000_000,
    toMillis: () => safeMillis,
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumber(value: unknown) {
  // Numeric payload fields sometimes arrive as strings from JavaScript Object Notation (JSON) config documents/views.
  // Coerce aggressively and default to 0 to keep downstream math stable.
  return typeof value === "number" ? value : Number(value || 0);
}

function asRouteCandidateParentSummaryArray(value: unknown): RouteCandidateParentSummaryRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const parentCode = typeof record.parentCode === "string" ? record.parentCode : "";
      if (!parentCode) return null;
      return {
        parentCode,
        matchedChildCount: asNumber(record.matchedChildCount),
        avgBurdenScore: asNumber(record.avgBurdenScore),
        matchedChildZCodes: asStringArray(record.matchedChildZCodes),
      } satisfies RouteCandidateParentSummaryRecord;
    })
    .filter((item): item is RouteCandidateParentSummaryRecord => Boolean(item));
}

function asEnrolleeActiveZCodeArray(value: unknown): SinglePaneEnrolleeActiveZCodeRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const enrolleeZCodeId =
        typeof record.enrolleeZCodeId === "string"
          ? record.enrolleeZCodeId
          : typeof record.enrollee_z_code_id === "string"
            ? record.enrollee_z_code_id
            : "";
      const parentCode =
        typeof record.parentCode === "string"
          ? record.parentCode
          : typeof record.parent_code === "string"
            ? record.parent_code
            : "";
      const zCode =
        typeof record.zCode === "string"
          ? record.zCode
          : typeof record.z_code === "string"
            ? record.z_code
            : "";
      // These identifiers form the minimum contract for timeline/actions. Drop malformed
      // rows instead of emitting partial records that can break selection state.
      if (!enrolleeZCodeId || !parentCode || !zCode) return null;
      return {
        enrolleeZCodeId,
        parentCode,
        zCode,
        title: typeof record.title === "string" ? record.title : "",
        description: typeof record.description === "string" ? record.description : "",
        isResolved: Boolean(record.isResolved ?? record.is_resolved),
        resolutionAt:
          typeof record.resolutionAt === "string"
            ? record.resolutionAt
            : typeof record.resolution_at === "string"
              ? record.resolution_at
              : null,
        resolutionPartnerId:
          typeof record.resolutionPartnerId === "string"
            ? record.resolutionPartnerId
            : typeof record.resolution_partner_id === "string"
              ? record.resolution_partner_id
              : null,
        resolutionPartnerName:
          typeof record.resolutionPartnerName === "string"
            ? record.resolutionPartnerName
            : typeof record.resolution_partner_name === "string"
              ? record.resolution_partner_name
              : null,
        resolutionNote:
          typeof record.resolutionNote === "string"
            ? record.resolutionNote
            : typeof record.resolution_note === "string"
              ? record.resolution_note
              : null,
      } satisfies SinglePaneEnrolleeActiveZCodeRecord;
    })
    .filter((item): item is SinglePaneEnrolleeActiveZCodeRecord => Boolean(item));
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toZCodeGroup(value: string) {
  const match = value.trim().toUpperCase().match(/^Z?(\d{2})$/);
  if (!match) return null;
  return Number(match[1]);
}

async function fetchConfigPayload(
  client: AnySupabaseClient,
  surface: string,
  configKey: string,
  version?: string,
) {
  let query = (client as SupabaseClient<any>)
    .schema("atlas")
    .from("app_config_documents")
    .select("payload,version")
    .eq("surface", surface)
    .eq("config_key", configKey)
    .order("created_at", { ascending: false })
    .limit(1);

  if (version) {
    query = query.eq("version", version);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data?.[0]?.payload ?? null;
}

export async function fetchAppRoleNavigation(
  client: AnySupabaseClient,
  surface: string,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("app_role_navigation")
    .select("role_key,top_menus,action_menus,metadata")
    .eq("surface", surface)
    .order("role_key", { ascending: true });

  if (error) throw error;
  return (data || []).map(
    (row): AppRoleNavigationRecord => ({
      roleKey: row.role_key,
      topMenus: asStringArray(row.top_menus),
      actionMenus: asStringArray(row.action_menus),
      metadata: asRecord(row.metadata),
    }),
  );
}

export async function fetchSinglePaneTimelineConfig(client: AnySupabaseClient) {
  const payload = await fetchConfigPayload(client, "singlepane", "timeline_defaults");
  const record = asRecord(payload);
  return {
    durationMonths: Number(record.durationMonths || 9),
    maxDurationMonths: Number(record.maxDurationMonths || 12),
    gates: Array.isArray(record.gates)
      ? record.gates.map((gate) => {
          const typedGate = asRecord(gate);
          return {
            id: String(typedGate.id || ""),
            label: String(typedGate.label || ""),
            phase: String(typedGate.phase || "regulation") as SinglePaneTimelineGateRecord["phase"],
            monthOffset: Number(typedGate.monthOffset || 0),
          };
        })
      : [],
  } satisfies SinglePaneTimelineConfigRecord;
}

export async function fetchSinglePaneSurveyDefinition(
  client: AnySupabaseClient,
  version = "2026-z-burden-v2",
) {
  const payload = await fetchConfigPayload(client, "singlepane", "service_capacity_survey", version);
  const record = asRecord(payload);
  const sectionHeaders = new Map<number, string>();

  const sectionParentGroups = Array.isArray(record.sections)
    ? Array.from(
        new Set(
          record.sections
            .map((section) => toZCodeGroup(String(asRecord(section).parentCode || "")))
            .filter((group): group is number => Number.isFinite(group)),
        ),
      )
    : [];

  if (sectionParentGroups.length) {
    try {
      const { data: groupedRows, error: groupedError } = await (client as SupabaseClient<any>)
        .schema("atlas")
        .from("z_code_headers")
        .select("z_group,z_code_hdr_desc")
        .in("z_group", sectionParentGroups);

      if (!groupedError) {
        (groupedRows || []).forEach((row) => {
          const groupValue = Number(row.z_group);
          const description = String(row.z_code_hdr_desc || "").trim();
          if (!Number.isFinite(groupValue) || !description) return;
          sectionHeaders.set(groupValue, description);
        });
      } else {
        // Some environments still expose legacy key names (`z_code_key`) instead of
        // `z_group`. Fall back so section labels remain available during migrations.
        const { data: keyedRows, error: keyedError } = await (client as SupabaseClient<any>)
          .schema("atlas")
          .from("z_code_headers")
          .select("z_code_key,z_code_hdr_desc")
          .in("z_code_key", sectionParentGroups);
        if (keyedError) throw keyedError;
        (keyedRows || []).forEach((row) => {
          const groupValue = Number(row.z_code_key);
          const description = String(row.z_code_hdr_desc || "").trim();
          if (!Number.isFinite(groupValue) || !description) return;
          sectionHeaders.set(groupValue, description);
        });
      }
    } catch (error) {
      /** Fall back to survey-config theme text when z_code_headers are unavailable. */
      console.warn("Failed to load z_code_headers for service capacity survey progress labels.", error);
    }
  }

  return {
    scale: Array.isArray(record.scale)
      ? record.scale.map((entry) => {
          const item = asRecord(entry);
          return {
            value: Number(item.value || 0),
            label: String(item.label || ""),
            description: String(item.description || ""),
          };
        })
      : [],
    sections: Array.isArray(record.sections)
      ? record.sections.map((section) => {
          const typedSection = asRecord(section);
          const parentCode = String(typedSection.parentCode || "");
          const sectionTheme = String(typedSection.theme || "");
          const zCodeGroup = toZCodeGroup(parentCode);
          const headerDescription = zCodeGroup == null ? null : sectionHeaders.get(zCodeGroup) || null;
          return {
            parentCode,
            theme: headerDescription || sectionTheme,
            prompts: Array.isArray(typedSection.prompts)
              ? typedSection.prompts.map((prompt) => {
                  const typedPrompt = asRecord(prompt);
                  return {
                    id: String(typedPrompt.id || ""),
                    parentCode: String(typedPrompt.parentCode || parentCode),
                    parentTheme: headerDescription || String(typedPrompt.parentTheme || sectionTheme),
                    zCode: String(typedPrompt.zCode || ""),
                    normalizedZCode: String(typedPrompt.normalizedZCode || ""),
                    title: String(typedPrompt.title || ""),
                    description: String(typedPrompt.description || ""),
                  };
                })
              : [],
          };
        })
      : [],
  } satisfies SinglePaneSurveyDefinitionRecord;
}

export async function fetchSinglePaneEnrolleeProfiles(client: AnySupabaseClient) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("v_active_enrollment_roster")
    .select("*")
    .order("enrollee_name", { ascending: true });
  if (error) throw error;
  return (data || []).map(
    (row): SinglePaneEnrolleeProfileRecord => ({
      enrolleeId: row.enrollee_id,
      enrollmentId: row.enrollment_id,
      fullName: row.enrollee_name,
      dob: row.dob,
      caseId: row.case_id || "",
      email: row.enrollee_email || "",
      avatarUrl: row.avatar_url,
      assignedNavigator: row.assigned_navigator,
      zCodeTags: asStringArray(row.z_code_tags),
      activeZCodeDetails: asEnrolleeActiveZCodeArray(row.active_z_code_details),
      completedParentCodes: asStringArray(row.completed_parent_codes),
      enrollmentStartIso: row.start_date,
      targetDurationMonths: Number(row.target_duration_months || 9),
      currentPhase: row.current_phase,
    }),
  );
}

export async function fetchEnrollmentAssignmentBoard(client: AnySupabaseClient) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("v_enrollment_assignment_board")
    .select("*")
    .order("enrollee_name", { ascending: true });
  if (error) throw error;
  return (data || []).map(
    (row): EnrollmentAssignmentBoardRecord => ({
      enrollmentId: row.enrollment_id,
      enrolleeId: row.enrollee_id,
      enrolleeName: row.enrollee_name,
      caseId: row.case_id,
      currentPhase: row.current_phase,
      countyId: row.county_id,
      countyName: row.county_name,
      navigatorPersonIds: asStringArray(row.navigator_person_ids),
      navigatorNames: asStringArray(row.navigator_names),
      assignedNavigatorLabel: row.assigned_navigator_label,
    }),
  );
}

export async function setEnrolleeZCodeResolution(
  client: AnySupabaseClient,
  enrolleeZCodeId: string,
  isResolved: boolean,
  partnerId?: string | null,
  partnerName?: string | null,
  resolutionNote?: string | null,
) {
  const { data, error } = await (client as SupabaseClient<any>).rpc("fn_set_enrollee_z_code_resolution_context", {
    p_enrollee_z_code_id: enrolleeZCodeId,
    p_is_resolved: isResolved,
    p_partner_id: partnerId ?? null,
    p_resolution_note: resolutionNote?.trim() || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const record = asRecord(row);
  return {
    enrolleeZCodeId:
      typeof record.enrollee_z_code_id === "string"
        ? record.enrollee_z_code_id
        : typeof record.enrolleeZCodeId === "string"
          ? record.enrolleeZCodeId
          : enrolleeZCodeId,
    isResolved: Boolean(record.is_resolved ?? record.isResolved ?? isResolved),
    resolutionAt:
      typeof record.resolution_at === "string"
        ? record.resolution_at
        : typeof record.resolutionAt === "string"
          ? record.resolutionAt
          : null,
    resolutionPartnerId:
      typeof record.resolution_partner_id === "string"
        ? record.resolution_partner_id
        : typeof record.resolutionPartnerId === "string"
          ? record.resolutionPartnerId
          : partnerId ?? null,
    resolutionPartnerName:
      typeof record.resolution_partner_name === "string"
        ? record.resolution_partner_name
        : typeof record.resolutionPartnerName === "string"
          ? record.resolutionPartnerName
          : partnerName?.trim() || null,
    resolutionNote:
      typeof record.resolution_note === "string"
        ? record.resolution_note
        : typeof record.resolutionNote === "string"
          ? record.resolutionNote
          : resolutionNote?.trim() || null,
  };
}

export async function fetchSinglePaneEnrolleeDomainLoads(client: AnySupabaseClient) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("v_singlepane_enrollee_domain_loads")
    .select("*");
  if (error) throw error;
  return (data || []).map(
    (row): SinglePaneDomainLoadRecord => ({
      enrollmentId: row.enrollment_id,
      habitat: Number(row.habitat || 0),
      work: Number(row.work || 0),
      socialNetworks: Number(row.social_networks || 0),
    }),
  );
}

export async function fetchSinglePaneEnrolleeDomainLoadBreakdown(client: AnySupabaseClient) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("v_singlepane_enrollee_domain_load_breakdown")
    .select("*");
  if (error) throw error;
  return (data || []).map(
    (row): SinglePaneDomainLoadBreakdownRowRecord => ({
      enrollmentId: row.enrollment_id,
      fullName: row.full_name,
      zCodeGroup: row.z_code_group,
      mappedDomain: row.mapped_domain,
      rawCount: Number(row.raw_count || 0),
    }),
  );
}

export async function fetchSinglePaneRouteCandidates(
  client: AnySupabaseClient,
  enrollmentId: string,
) {
  if (!enrollmentId) return [];
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("v_navigator_route_candidates")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .order("score", { ascending: false });
  if (error) throw error;
  return (data || []).map(
    (row): RouteCandidateDetailsRecord => ({
      enrollmentId: row.enrollment_id,
      stationId: row.station_id,
      partnerId: row.partner_id,
      stationName: row.station_name,
      score: Number(row.score || 0),
      matchedZCodeCount: Number(row.matched_z_code_count || 0),
      needUnitsMatched: Number(row.need_units_matched || 0),
      partnerBurdenTotal: Number(row.partner_burden_total || 0),
      matchedZCodes: asStringArray(row.matched_z_codes),
      matchedParentSummaries: asRouteCandidateParentSummaryArray(row.matched_parent_summaries),
    }),
  );
}

export async function fetchPartnerLoadBreakdown(client: AnySupabaseClient) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("v_partner_z_code_burden")
    .select("*")
    .order("category_key", { ascending: true });
  if (error) throw error;

  const rows = (data || []).map((row) => {
    const categoryKey = String(row.category_key || "").trim().toLowerCase();
    // Unknown categories default to socialNetworks to preserve historical dashboard behavior
    // where non-work/non-habitat codes were bucketed into the social domain.
    const mappedDomain =
      categoryKey === "work"
        ? "work"
        : categoryKey === "habitat"
          ? "habitat"
          : "socialNetworks";
    const zCodeGroup =
      mappedDomain === "work"
        ? "Z55-Z57"
        : mappedDomain === "habitat"
          ? "Z58-Z59"
          : "Z60-Z65";
    return {
      id: `${row.station_id}:${categoryKey}`,
      zCodeGroup,
      mappedDomain,
      rawCount: Number(row.z_code_count || 0),
    } as PartnerLoadBreakdownRecord["rows"][number];
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc[row.mappedDomain] += row.rawCount;
      return acc;
    },
    { habitat: 0, work: 0, socialNetworks: 0 },
  );

  return {
    subjectId: "partner-network",
    subjectLabel: "Partner network",
    sourceKind: "partnerSurvey",
    sourceLabel: "Supabase partner capability network",
    habitatTotal: totals.habitat,
    workTotal: totals.work,
    socialNetworksTotal: totals.socialNetworks,
    rows,
  } satisfies PartnerLoadBreakdownRecord;
}

export async function fetchSinglePaneEnrollmentRequests(client: AnySupabaseClient) {
  const { data, error } = await client
    .schema("atlas")
    .from("v_navigator_enrollment_requests")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(
    (row): SinglePaneEnrollmentRequestRecord => ({
      id: row.request_id,
      submittedAt: row.submitted_at,
      status: row.status,
      prospectiveEnrollee: row.prospective_enrollee,
      email: row.email,
    }),
  );
}

export async function fetchSinglePaneCountyHeatmap(client: AnySupabaseClient) {
  const { data, error } = await client
    .schema("atlas")
    .from("v_county_z_code_heatmap")
    .select("*")
    .order("county_name", { ascending: true });
  if (error) throw error;
  return (data || []).map(
    (row): SinglePaneCountyHeatPointRecord => ({
      countyId: row.county_id,
      countyName: row.county_name,
      zGroup: Number(row.z_group || 0),
      activeCaseCount: Number(row.active_case_count || 0),
    }),
  );
}

export async function fetchSinglePaneAdminMetrics(client: AnySupabaseClient) {
  const { data, error } = await client
    .schema("atlas")
    .from("v_admin_data_quality")
    .select("*");
  if (error) throw error;
  return (data || []).map(
    (row): SinglePaneAdminMetricRecord => ({
      metric: row.metric,
      countValue: Number(row.count_value || 0),
    }),
  );
}

export async function fetchSupervisorNavigatorCompetencyRollup(client: AnySupabaseClient) {
  const { data, error } = await client
    .schema("atlas")
    .from("v_supervisor_navigator_competency_rollup")
    .select("*")
    .order("navigator_name", { ascending: true });
  if (error) throw error;
  return (data || []).map(
    (row): SupervisorNavigatorCompetencyRollupRecord => ({
      supervisorPersonId: row.supervisor_person_id,
      supervisorName: row.supervisor_name,
      navigatorPersonId: row.navigator_person_id,
      navigatorName: row.navigator_name,
      assessmentCount: Number(row.assessment_count || 0),
      lastAssessedAt: row.last_assessed_at,
      weightedRollingAverage: row.weighted_rolling_average == null ? null : Number(row.weighted_rolling_average),
    }),
  );
}

export async function fetchRouteBuilderDataset(client: AnySupabaseClient) {
  const [participantsResult, bomsResult, stepsResult, templatesResult, assignmentsResult] =
    await Promise.all([
      (client as SupabaseClient<any>).schema("atlas").from("v_route_builder_participants").select("*"),
      (client as SupabaseClient<any>).schema("atlas").from("route_builder_bom_items").select("*").eq("is_active", true).order("created_at", { ascending: true }),
      (client as SupabaseClient<any>).schema("atlas").from("route_builder_steps").select("*").eq("is_active", true).order("sequence", { ascending: true }),
      (client as SupabaseClient<any>).schema("atlas").from("route_builder_templates").select("*").eq("is_active", true).order("created_at", { ascending: true }),
      (client as SupabaseClient<any>).schema("atlas").from("route_builder_journey_assignments").select("*").order("started_at", { ascending: false }),
    ]);

  const failures = [participantsResult, bomsResult, stepsResult, templatesResult, assignmentsResult].find(
    (result) => result.error,
  );
  if (failures?.error) throw failures.error;

  const participants: Participant[] = (participantsResult.data || []).map((row) => ({
    id: row.participant_id,
    name: row.participant_name,
    county: row.county_name || "unassigned",
    currentPhase: row.current_phase,
    readinessScore: Number(row.readiness_score || 0),
    activeJourneyId: row.active_journey_id || undefined,
  }));

  const instructionBoms: InstructionBomItem[] = (bomsResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    domain: row.domain,
    description: row.description,
    required: Boolean(row.required),
    defaultDurationDays: Number(row.default_duration_days || 7),
  }));

  const routingSteps: RoutingStep[] = (stepsResult.data || []).map((row) => ({
    id: row.id,
    bomItemId: row.bom_item_id,
    label: row.label,
    phase: row.phase,
    instruction: row.instruction,
    ownerRole: row.owner_role,
    exitCriteria: row.exit_criteria,
    sequence: Number(row.sequence || 0),
  }));

  const routeTemplates: RouteTemplate[] = (templatesResult.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    targetPhase: row.target_phase,
    bomItemIds: asStringArray(row.bom_item_ids),
    stepIds: asStringArray(row.step_ids),
    isCore: Boolean(row.is_core),
  }));

  const journeyAssignments: JourneyAssignment[] = (assignmentsResult.data || []).map((row) => ({
    id: row.id,
    participantId: row.enrollment_id,
    templateId: row.template_id,
    stepIds: asStringArray(row.step_ids),
    status: row.status,
    currentStepIndex: Number(row.current_step_index || 0),
    startedAt: row.started_at,
  }));

  return {
    participants,
    instructionBoms,
    routingSteps,
    routeTemplates,
    journeyAssignments,
  } satisfies AtlasJsonDataset;
}

export async function createRouteBuilderBomItem(
  client: AnySupabaseClient,
  payload: InstructionBomItem,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("route_builder_bom_items")
    .upsert({
      id: payload.id,
      title: payload.title,
      domain: payload.domain,
      description: payload.description,
      required: payload.required,
      default_duration_days: payload.defaultDurationDays,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createRouteBuilderTemplate(
  client: AnySupabaseClient,
  payload: RouteTemplate,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("route_builder_templates")
    .upsert({
      id: payload.id,
      name: payload.name,
      description: payload.description,
      target_phase: payload.targetPhase,
      bom_item_ids: payload.bomItemIds,
      step_ids: payload.stepIds,
      is_core: payload.isCore,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function assignRouteBuilderTemplate(
  client: AnySupabaseClient,
  assignment: JourneyAssignment,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("route_builder_journey_assignments")
    .upsert({
      id: assignment.id,
      enrollment_id: assignment.participantId,
      template_id: assignment.templateId,
      step_ids: assignment.stepIds,
      status: assignment.status,
      current_step_index: assignment.currentStepIndex,
      started_at: assignment.startedAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchLegacyAtlasRuntimeConfig(client: AnySupabaseClient) {
  const payload = await fetchConfigPayload(client, "legacy_atlas", "runtime_config");
  return asRecord(payload) as unknown as LegacyAtlasRuntimeConfig;
}

export async function fetchLegacyAtlasSnapshot(client: AnySupabaseClient) {
  const [participantsResult, capacityResult, routesResult, stepsResult, memoryResult, weightsResult, auditResult, renewalResult] =
    await Promise.all([
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_participants").select("*").order("display_name", { ascending: true }),
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_capacity_nodes").select("*").order("phase_index", { ascending: true }),
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_routes").select("*").order("created_at", { ascending: false }),
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_route_steps").select("*").order("sequence", { ascending: true }),
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_memory_events").select("*").order("created_at", { ascending: false }),
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_ontology_weights").select("*").eq("config_key", "default").limit(1),
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_ontology_audit").select("*").order("updated_at", { ascending: false }),
      (client as SupabaseClient<any>).schema("atlas").from("legacy_atlas_renewal_roles").select("*"),
    ]);

  const failures = [participantsResult, capacityResult, routesResult, stepsResult, memoryResult, weightsResult, auditResult, renewalResult].find(
    (result) => result.error,
  );
  if (failures?.error) throw failures.error;

  return {
    participants: (participantsResult.data || []).map(
      (row): LegacyAtlasParticipantRecord => ({
        participantId: row.participant_id,
        countyId: row.county_id,
        displayName: row.display_name,
        currentPhase: row.current_phase,
        phaseReadiness: Number(row.phase_readiness || 0),
        pressureVectors: Array.isArray(row.pressure_vectors) ? row.pressure_vectors : [],
        constraintFlags: asStringArray(row.constraint_flags),
        activeRouteId: row.active_route_id || null,
      }),
    ),
    capacityTopology: (capacityResult.data || []).map(
      (row): LegacyAtlasCapacityNodeRecord => ({
        partnerId: row.partner_id,
        label: row.label,
        routeClass: row.route_class,
        coverageScore: Number(row.coverage_score || 0),
        phaseAlignment: Number(row.phase_alignment || 0),
        specializationScore: Number(row.specialization_score || 0),
        reversibilitySupport: Number(row.reversibility_support || 0),
        transferCost: Number(row.transfer_cost || 0),
        interferenceRisk: Number(row.interference_risk || 0),
        phaseIndex: Number(row.phase_index || 0),
        domain: row.domain,
        primaryDomain: row.primary_domain,
        domainCoverage: asStringArray(row.domain_coverage),
        blockers: asStringArray(row.blockers),
      }),
    ),
    routeRecords: (routesResult.data || []).map(
      (row): LegacyAtlasRouteRecord => ({
        id: row.id,
        routeId: row.route_id,
        participantId: row.participant_id,
        partnerId: row.partner_id,
        routeClass: row.route_class,
        status: row.status,
        score: row.score == null ? null : Number(row.score),
        interferenceRisk: row.interference_risk == null ? null : Number(row.interference_risk),
        transferCost: row.transfer_cost == null ? null : Number(row.transfer_cost),
        activatedByRole: row.activated_by_role,
        activatedByUserId: row.activated_by_user_id,
        createdAt: toTimestamp(row.created_at),
        updatedAt: toTimestamp(row.updated_at || row.created_at),
      }),
    ),
    routeSteps: (stepsResult.data || []).map(
      (row): LegacyAtlasRouteStepRecord => ({
        id: row.id,
        routeRecordId: row.route_record_id,
        routeId: row.route_id,
        participantId: row.participant_id,
        partnerId: row.partner_id,
        stepId: row.step_id,
        label: row.label,
        status: row.status,
        dependencies: asStringArray(row.dependencies),
        domain: row.domain,
        sequence: Number(row.sequence || 0),
        createdAt: toTimestamp(row.created_at),
        updatedAt: toTimestamp(row.updated_at || row.created_at),
      }),
    ),
    memoryEvents: (memoryResult.data || []).map(
      (row): LegacyAtlasMemoryEventRecord => ({
        id: row.id,
        participantId: row.participant_id,
        eventType: row.event_type,
        phase: row.phase,
        label: row.label,
        verified: Boolean(row.verified),
        createdByRole: row.created_by_role,
        createdByUserId: row.created_by_user_id,
        createdAt: toTimestamp(row.created_at),
      }),
    ),
    ontologyWeights: (() => {
      const row = weightsResult.data?.[0];
      return {
        coverageWeight: Number(row?.coverage_weight || 0.3),
        phaseAlignmentWeight: Number(row?.phase_alignment_weight || 0.2),
        specializationWeight: Number(row?.specialization_weight || 0.2),
        reversibilityWeight: Number(row?.reversibility_weight || 0.15),
        transferCostPenalty: Number(row?.transfer_cost_penalty || 0.1),
        interferencePenalty: Number(row?.interference_penalty || 0.05),
        civicDiplomacyBoost: Number(row?.civic_diplomacy_boost || 0.08),
        slaThresholdHours: Number(row?.sla_threshold_hours || 48),
        interferenceMediumThreshold: Number(row?.interference_medium_threshold || 0.35),
        interferenceHighThreshold: Number(row?.interference_high_threshold || 0.6),
        phaseReadinessAlertThreshold: Number(row?.phase_readiness_alert_threshold || 0.45),
        pcfRefinementWeight: Number(row?.pcf_refinement_weight || 0.6),
        reciprocityActivationThreshold: Number(row?.reciprocity_activation_threshold || 0.6),
      } satisfies LegacyAtlasOntologyWeightsRecord;
    })(),
    ontologyAudit: (auditResult.data || []).map(
      (row): LegacyAtlasOntologyAuditRecord => ({
        id: row.id,
        eventType: row.event_type,
        actorRole: row.actor_role,
        actorUserId: row.actor_user_id,
        label: row.label,
        payload: asRecord(row.payload),
        updatedAt: toTimestamp(row.updated_at),
      }),
    ),
    renewalRoles: (renewalResult.data || []).map(
      (row): LegacyAtlasRenewalRoleRecord => ({
        id: row.participant_id,
        participantId: row.participant_id,
        roleLabel: row.role_label,
        assignedByRole: row.assigned_by_role,
        assignedByUserId: row.assigned_by_user_id,
        payload: asRecord(row.payload),
        updatedAt: toTimestamp(row.updated_at),
      }),
    ),
  };
}

export async function createLegacyRouteRecord(
  client: AnySupabaseClient,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_routes")
    .insert({
      route_id: payload.routeId,
      participant_id: payload.participantId,
      partner_id: payload.partnerId ?? null,
      route_class: payload.routeClass,
      status: payload.status,
      score: payload.score ?? null,
      interference_risk: payload.interferenceRisk ?? null,
      transfer_cost: payload.transferCost ?? null,
      activated_by_role: payload.activatedByRole ?? null,
      activated_by_user_id: payload.activatedByUserId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateLegacyRouteRecord(
  client: AnySupabaseClient,
  routeRecordId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_routes")
    .update({
      route_class: payload.routeClass,
      status: payload.status,
      score: payload.score ?? null,
      interference_risk: payload.interferenceRisk ?? null,
      transfer_cost: payload.transferCost ?? null,
      activated_by_role: payload.activatedByRole ?? null,
      activated_by_user_id: payload.activatedByUserId ?? null,
    })
    .eq("id", routeRecordId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createLegacyRouteStepRecord(
  client: AnySupabaseClient,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_route_steps")
    .insert({
      route_record_id: payload.routeDocId ?? null,
      route_id: payload.routeId,
      participant_id: payload.participantId,
      partner_id: payload.partnerId ?? null,
      step_id: payload.stepId,
      label: payload.label,
      status: payload.status,
      dependencies: payload.dependencies ?? [],
      domain: payload.domain ?? null,
      sequence: payload.sequence ?? 1,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateLegacyRouteStepRecord(
  client: AnySupabaseClient,
  stepRecordId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_route_steps")
    .update({
      status: payload.status,
      dependencies: payload.dependencies ?? [],
      domain: payload.domain ?? null,
      sequence: payload.sequence ?? 1,
    })
    .eq("id", stepRecordId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createLegacyMemoryEvent(
  client: AnySupabaseClient,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_memory_events")
    .insert({
      participant_id: payload.participantId,
      event_type: payload.eventType,
      phase: payload.phase,
      label: payload.label ?? null,
      verified: payload.verified ?? false,
      created_by_role: payload.createdByRole ?? null,
      created_by_user_id: payload.createdByUserId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function saveLegacyOntologyWeights(
  client: AnySupabaseClient,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_ontology_weights")
    .upsert({
      config_key: "default",
      coverage_weight: payload.coverageWeight ?? 0.3,
      phase_alignment_weight: payload.phaseAlignmentWeight ?? 0.2,
      specialization_weight: payload.specializationWeight ?? 0.2,
      reversibility_weight: payload.reversibilityWeight ?? 0.15,
      transfer_cost_penalty: payload.transferCostPenalty ?? 0.1,
      interference_penalty: payload.interferencePenalty ?? 0.05,
      civic_diplomacy_boost: payload.civicDiplomacyBoost ?? 0.08,
      sla_threshold_hours: payload.slaThresholdHours ?? 48,
      interference_medium_threshold: payload.interferenceMediumThreshold ?? 0.35,
      interference_high_threshold: payload.interferenceHighThreshold ?? 0.6,
      phase_readiness_alert_threshold: payload.phaseReadinessAlertThreshold ?? 0.45,
      pcf_refinement_weight: payload.pcfRefinementWeight ?? 0.6,
      reciprocity_activation_threshold: payload.reciprocityActivationThreshold ?? 0.6,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createLegacyOntologyAuditRecord(
  client: AnySupabaseClient,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_ontology_audit")
    .insert({
      event_type: payload.eventType ?? null,
      actor_role: payload.actorRole ?? null,
      actor_user_id: payload.actorUserId ?? null,
      label: payload.label,
      payload: payload.payload ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function saveLegacyRenewalRoleRecord(
  client: AnySupabaseClient,
  participantId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await (client as SupabaseClient<any>)
    .schema("atlas")
    .from("legacy_atlas_renewal_roles")
    .upsert({
      participant_id: participantId,
      role_label: payload.roleLabel ?? null,
      assigned_by_role: payload.assignedByRole ?? null,
      assigned_by_user_id: payload.assignedByUserId ?? null,
      payload: payload.payload ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
