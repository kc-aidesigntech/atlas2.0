export type PartnerSurveyRespondentRole =
  | "administrator"
  | "direct_service_provider"
  | "other";

export type PartnerServiceCapacitySubmissionStatus = "draft" | "completed";

export interface PartnerServiceCapacityHeader {
  firstName: string;
  lastName: string;
  organizationName: string;
  jobTitle: string;
  respondentRoles: PartnerSurveyRespondentRole[];
  otherRoleText: string;
}

export interface PartnerServiceCapacityAnswer {
  promptId: string;
  parentCode: string;
  zCode: string;
  normalizedZCode: string;
  title: string;
  description: string;
  score: number;
}

export interface PartnerServiceCapacitySubmissionInput {
  header: PartnerServiceCapacityHeader;
  answers: PartnerServiceCapacityAnswer[];
  formVersion: string;
  draftKey?: string;
  status?: PartnerServiceCapacitySubmissionStatus;
  completedAtIso?: string | null;
}

export interface PartnerServiceCapacitySubmissionRecord
  extends PartnerServiceCapacitySubmissionInput {
  id: string;
  partnerId: string | null;
  organizationNameNormalized: string | null;
  submittedAtIso: string;
  updatedAtIso: string;
  draftKey: string;
  status: PartnerServiceCapacitySubmissionStatus;
  completedAtIso: string | null;
}

export interface AtlasDatabase {
  atlas: {
    Tables: {
      partners: {
        Row: {
          id: string;
          organization_name: string;
          organization_name_normalized: string;
          updated_at: string;
        };
        Insert: {
          organization_name: string;
          organization_name_normalized: string;
          updated_at?: string;
        };
        Update: Partial<{
          organization_name: string;
          organization_name_normalized: string;
          updated_at: string;
        }>;
      };
      partner_service_capacity_submissions: {
        Row: {
          id: string;
          draft_key: string;
          status: PartnerServiceCapacitySubmissionStatus;
          completed_at: string | null;
          partner_id: string | null;
          organization_name: string | null;
          organization_name_normalized: string | null;
          respondent_first_name: string | null;
          respondent_last_name: string | null;
          job_title: string | null;
          respondent_roles: PartnerSurveyRespondentRole[];
          other_role_text: string | null;
          form_version: string;
          submitted_at: string;
          updated_at: string | null;
          raw_payload: PartnerServiceCapacitySubmissionInput | null;
        };
        Insert: {
          draft_key?: string;
          status?: PartnerServiceCapacitySubmissionStatus;
          completed_at?: string | null;
          partner_id?: string | null;
          organization_name?: string | null;
          organization_name_normalized?: string | null;
          respondent_first_name?: string | null;
          respondent_last_name?: string | null;
          job_title?: string | null;
          respondent_roles?: PartnerSurveyRespondentRole[];
          other_role_text?: string | null;
          form_version: string;
          raw_payload?: PartnerServiceCapacitySubmissionInput;
        };
        Update: Partial<{
          draft_key: string;
          status: PartnerServiceCapacitySubmissionStatus;
          completed_at: string | null;
          partner_id: string | null;
          organization_name: string | null;
          organization_name_normalized: string | null;
          respondent_first_name: string | null;
          respondent_last_name: string | null;
          job_title: string | null;
          respondent_roles: PartnerSurveyRespondentRole[];
          other_role_text: string | null;
          form_version: string;
          updated_at: string | null;
          raw_payload: PartnerServiceCapacitySubmissionInput | null;
        }>;
      };
      partner_service_capacity_answers: {
        Row: {
          id: string;
          submission_id: string;
          prompt_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description: string | null;
          burden_score: number;
          created_at: string;
        };
        Insert: {
          submission_id: string;
          prompt_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description?: string | null;
          burden_score: number;
        };
        Update: Partial<{
          prompt_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description: string | null;
          burden_score: number;
        }>;
      };
      supervisor_navigator_assignments: {
        Row: {
          id: string;
          supervisor_person_id: string;
          navigator_person_id: string;
          starts_on: string;
          ends_on: string | null;
          created_at: string;
        };
        Insert: {
          supervisor_person_id: string;
          navigator_person_id: string;
          starts_on?: string;
          ends_on?: string | null;
        };
        Update: Partial<{
          starts_on: string;
          ends_on: string | null;
        }>;
      };
      navigator_competency_assessments: {
        Row: {
          id: string;
          supervisor_person_id: string;
          navigator_person_id: string;
          form_version: string;
          assessed_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          supervisor_person_id: string;
          navigator_person_id: string;
          form_version?: string;
          assessed_at?: string;
          notes?: string | null;
        };
        Update: Partial<{
          form_version: string;
          assessed_at: string;
          notes: string | null;
        }>;
      };
      navigator_competency_assessment_answers: {
        Row: {
          id: string;
          assessment_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description: string | null;
          competency_score: number;
          created_at: string;
        };
        Insert: {
          assessment_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description?: string | null;
          competency_score: number;
        };
        Update: Partial<{
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description: string | null;
          competency_score: number;
        }>;
      };
    };
    Views: {
      v_navigator_assigned_enrollees: {
        Row: {
          navigator_person_id: string;
          enrollment_id: string;
          enrollee_id: string;
          enrollee_name: string;
          case_id: string | null;
          current_phase: "regulation" | "readiness" | "renewal";
          avatar_url: string | null;
        };
      };
      v_enrollment_station_markers: {
        Row: {
          route_plan_stop_id: string;
          enrollment_id: string;
          assigned_at: string;
          status: string;
          station_id: string;
          station_name: string;
          icon_slug: string | null;
        };
      };
      v_supervisor_navigator_competency_rollup: {
        Row: {
          supervisor_person_id: string;
          supervisor_name: string;
          navigator_person_id: string;
          navigator_name: string;
          assessment_count: number;
          last_assessed_at: string | null;
          weighted_rolling_average: number | null;
        };
      };
    };
  };
}
