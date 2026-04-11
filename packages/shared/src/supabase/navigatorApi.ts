import type { SupabaseClient } from "@supabase/supabase-js";
import type { AtlasDatabase } from "./contracts";

export interface NavigatorAssignedEnrollee {
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

export async function fetchNavigatorAssignedEnrollees(
  client: SupabaseClient<AtlasDatabase>,
) {
  const { data, error } = await client
    .schema("atlas")
    .from("v_navigator_assigned_enrollees")
    .select(
      "enrollment_id,enrollee_id,enrollee_name,case_id,current_phase,avatar_url",
    )
    .order("enrollee_name", { ascending: true });

  if (error) throw error;
  return (data || []).map(
    (row): NavigatorAssignedEnrollee => ({
      enrollmentId: row.enrollment_id,
      enrolleeId: row.enrollee_id,
      enrolleeName: row.enrollee_name,
      caseId: row.case_id,
      currentPhase: row.current_phase,
      avatarUrl: row.avatar_url,
    }),
  );
}

export async function fetchEnrollmentStationMarkers(
  client: SupabaseClient<AtlasDatabase>,
  enrollmentId: string,
) {
  const { data, error } = await client
    .schema("atlas")
    .from("v_enrollment_station_markers")
    .select(
      "route_plan_stop_id,enrollment_id,assigned_at,status,station_id,station_name,icon_slug",
    )
    .eq("enrollment_id", enrollmentId)
    .order("assigned_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(
    (row): EnrollmentStationMarker => ({
      routePlanStopId: row.route_plan_stop_id,
      enrollmentId: row.enrollment_id,
      assignedAt: row.assigned_at,
      status: row.status,
      stationId: row.station_id,
      stationName: row.station_name,
      iconSlug: row.icon_slug,
    }),
  );
}
