export type PartnerSurveyRespondentRole =
  | "administrator"
  | "direct_service_provider"
  | "other";

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
}

export interface PartnerServiceCapacitySubmissionRecord
  extends PartnerServiceCapacitySubmissionInput {
  id: string;
  partnerId: string | null;
  organizationNameNormalized: string;
  submittedAtIso: string;
  updatedAtIso: string;
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
          partner_id: string | null;
          organization_name: string;
          organization_name_normalized: string;
          respondent_first_name: string;
          respondent_last_name: string;
          job_title: string | null;
          respondent_roles: PartnerSurveyRespondentRole[];
          other_role_text: string | null;
          form_version: string;
          submitted_at: string;
          updated_at: string | null;
          raw_payload: PartnerServiceCapacitySubmissionInput | null;
        };
        Insert: {
          partner_id?: string | null;
          organization_name: string;
          organization_name_normalized: string;
          respondent_first_name: string;
          respondent_last_name: string;
          job_title?: string | null;
          respondent_roles: PartnerSurveyRespondentRole[];
          other_role_text?: string | null;
          form_version: string;
          raw_payload?: PartnerServiceCapacitySubmissionInput;
        };
        Update: Partial<{
          partner_id: string | null;
          organization_name: string;
          organization_name_normalized: string;
          respondent_first_name: string;
          respondent_last_name: string;
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
    };
  };
}
