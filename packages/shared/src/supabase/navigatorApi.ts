import type { SupabaseClient } from "@supabase/supabase-js";
import type { AtlasDatabase } from "./contracts";

export interface NavigatorAssignedEnrollee {
  navigatorPersonId: string;
  enrollmentId: string;
  enrolleeId: string;
  enrolleeName: string;
  caseId: string | null;
  currentPhase: "regulation" | "readiness" | "renewal";
  avatarUrl: string | null;
}

export interface EnrollmentStationMarker {
  routePlanStopId: string;
  enrollmentId: string;
  assignedAt: string;
  status: string;
  stationId: string;
  stationName: string;
  iconSlug: string | null;
}

type NavigatorAssignedEnrolleeRow =
  AtlasDatabase["atlas"]["Views"]["v_navigator_assigned_enrollees"]["Row"];
type EnrollmentStationMarkerRow =
  AtlasDatabase["atlas"]["Views"]["v_enrollment_station_markers"]["Row"];

function mapNavigatorAssignedEnrolleeRow(
  row: NavigatorAssignedEnrolleeRow,
): NavigatorAssignedEnrollee {
  // Keep the snake_case -> camelCase contract in one place so DB view changes
  // are easy to audit without hunting through query call sites.
  return {
    navigatorPersonId: row.navigator_person_id,
    enrollmentId: row.enrollment_id,
    enrolleeId: row.enrollee_id,
    enrolleeName: row.enrollee_name,
    caseId: row.case_id,
    currentPhase: row.current_phase,
    avatarUrl: row.avatar_url,
  };
}

function mapEnrollmentStationMarkerRow(row: EnrollmentStationMarkerRow): EnrollmentStationMarker {
  return {
    routePlanStopId: row.route_plan_stop_id,
    enrollmentId: row.enrollment_id,
    assignedAt: row.assigned_at,
    status: row.status,
    stationId: row.station_id,
    stationName: row.station_name,
    iconSlug: row.icon_slug,
  };
}

export async function fetchNavigatorAssignedEnrollees(
  client: SupabaseClient<AtlasDatabase>,
): Promise<NavigatorAssignedEnrollee[]> {
  const { data, error } = await client
    .schema("atlas")
    .from("v_navigator_assigned_enrollees")
    .select(
      "navigator_person_id,enrollment_id,enrollee_id,enrollee_name,case_id,current_phase,avatar_url",
    )
    .order("enrollee_name", { ascending: true });

  if (error) throw error;
  // Supabase can return null data with no error for empty views.
  return (data || []).map(mapNavigatorAssignedEnrolleeRow);
}

export async function fetchEnrollmentStationMarkers(
  client: SupabaseClient<AtlasDatabase>,
  enrollmentId: string,
): Promise<EnrollmentStationMarker[]> {
  const { data, error } = await client
    .schema("atlas")
    .from("v_enrollment_station_markers")
    .select(
      "route_plan_stop_id,enrollment_id,assigned_at,status,station_id,station_name,icon_slug",
    )
    .eq("enrollment_id", enrollmentId)
    .order("assigned_at", { ascending: true });

  if (error) throw error;
  // Keep empty enrollment timelines as [] so UI layers can render "no markers"
  // without special null/undefined handling.
  return (data || []).map(mapEnrollmentStationMarkerRow);
}
