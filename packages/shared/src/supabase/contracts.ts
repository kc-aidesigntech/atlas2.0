export type PartnerSurveyRespondentRole =
  | "administrator"
  | "direct_service_provider"
  | "other";

export type PartnerServiceCapacitySubmissionStatus = "draft" | "completed";

export type EnrolleeBurdenSurveyRespondentRole = "navigator" | "supervisor";

export type EnrolleeBurdenSurveySubmissionStatus = "draft" | "completed";

export interface PartnerServiceCapacityHeader {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  jobTitle: string;
  respondentRoles: PartnerSurveyRespondentRole[];
  otherRoleText: string;
}

export interface PartnerServiceCapacityAnswer {
  promptId: string;
  parentCode: string;
  zCode: string;
  // normalizedZCode is the join-safe key used by scoring queries and historical
  // rollups; keep it persisted instead of re-deriving to avoid drift across clients.
  normalizedZCode: string;
  title: string;
  description: string;
  score: number | null;
  notEncountered: boolean;
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

export interface EnrolleeBurdenSurveyHeader {
  enrolleeId: string;
  enrollmentId: string;
  enrolleeName: string;
  enrolleeCaseId: string;
  respondentPersonId: string | null;
  respondentName: string;
  respondentRole: EnrolleeBurdenSurveyRespondentRole;
  organizationName: string;
}

export interface EnrolleeBurdenSurveyAnswer {
  promptId: string;
  parentCode: string;
  zCode: string;
  normalizedZCode: string;
  title: string;
  description: string;
  score: number | null;
  notEncountered: boolean;
}

export interface EnrolleeBurdenSurveySubmissionInput {
  header: EnrolleeBurdenSurveyHeader;
  answers: EnrolleeBurdenSurveyAnswer[];
  formVersion: string;
  draftKey?: string;
  status?: EnrolleeBurdenSurveySubmissionStatus;
  completedAtIso?: string | null;
}

export interface EnrolleeBurdenSurveySubmissionRecord extends EnrolleeBurdenSurveySubmissionInput {
  id: string;
  submittedAtIso: string;
  updatedAtIso: string;
  draftKey: string;
  status: EnrolleeBurdenSurveySubmissionStatus;
  completedAtIso: string | null;
}

export interface PartnerIdentifierRecord {
  partnerId: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  email: string;
}

export interface AtlasDatabase {
  // Shared Database (DB) contract for typed Supabase calls across web/mobile packages.
  // When schema changes, update this file first so type errors expose cross-layer drift.
  atlas: {
    Tables: {
      partners: {
        Row: {
          id: string;
          organization_name: string;
          organization_name_normalized: string;
          primary_contact_first_name: string | null;
          primary_contact_last_name: string | null;
          primary_contact_email: string | null;
          updated_at: string;
        };
        Insert: {
          organization_name: string;
          organization_name_normalized: string;
          primary_contact_first_name?: string | null;
          primary_contact_last_name?: string | null;
          primary_contact_email?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          organization_name: string;
          organization_name_normalized: string;
          primary_contact_first_name: string | null;
          primary_contact_last_name: string | null;
          primary_contact_email: string | null;
          updated_at: string;
        }>;
      };
      partner_contact_assignments: {
        Row: {
          id: string;
          partner_id: string;
          person_id: string;
          starts_on: string;
          ends_on: string | null;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          partner_id: string;
          person_id: string;
          starts_on?: string;
          ends_on?: string | null;
          is_primary?: boolean;
        };
        Update: Partial<{
          starts_on: string;
          ends_on: string | null;
          is_primary: boolean;
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
          respondent_email: string | null;
          job_title: string | null;
          respondent_roles: PartnerSurveyRespondentRole[];
          other_role_text: string | null;
          form_version: string;
          submitted_at: string;
          updated_at: string | null;
          // raw_payload preserves the original submission envelope for auditing and
          // replay in case flattened columns evolve over time.
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
          respondent_email?: string | null;
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
          respondent_email: string | null;
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
          burden_score: number | null;
          not_encountered: boolean;
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
          burden_score?: number | null;
          not_encountered?: boolean;
        };
        Update: Partial<{
          prompt_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description: string | null;
          burden_score: number | null;
          not_encountered: boolean;
        }>;
      };
      enrollee_burden_survey_submissions: {
        Row: {
          id: string;
          draft_key: string;
          status: EnrolleeBurdenSurveySubmissionStatus;
          completed_at: string | null;
          enrollee_id: string;
          enrollment_id: string;
          enrollee_name: string;
          enrollee_case_id: string | null;
          respondent_person_id: string | null;
          respondent_name: string;
          respondent_role: EnrolleeBurdenSurveyRespondentRole;
          organization_name: string | null;
          form_version: string;
          submitted_at: string;
          updated_at: string | null;
          raw_payload: EnrolleeBurdenSurveySubmissionInput | null;
        };
        Insert: {
          draft_key?: string;
          status?: EnrolleeBurdenSurveySubmissionStatus;
          completed_at?: string | null;
          enrollee_id: string;
          enrollment_id: string;
          enrollee_name: string;
          enrollee_case_id?: string | null;
          respondent_person_id?: string | null;
          respondent_name: string;
          respondent_role: EnrolleeBurdenSurveyRespondentRole;
          organization_name?: string | null;
          form_version: string;
          raw_payload?: EnrolleeBurdenSurveySubmissionInput | null;
        };
        Update: Partial<{
          draft_key: string;
          status: EnrolleeBurdenSurveySubmissionStatus;
          completed_at: string | null;
          enrollee_id: string;
          enrollment_id: string;
          enrollee_name: string;
          enrollee_case_id: string | null;
          respondent_person_id: string | null;
          respondent_name: string;
          respondent_role: EnrolleeBurdenSurveyRespondentRole;
          organization_name: string | null;
          form_version: string;
          updated_at: string | null;
          raw_payload: EnrolleeBurdenSurveySubmissionInput | null;
        }>;
      };
      enrollee_burden_survey_answers: {
        Row: {
          id: string;
          submission_id: string;
          prompt_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description: string | null;
          burden_score: number | null;
          not_encountered: boolean;
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
          burden_score?: number | null;
          not_encountered?: boolean;
        };
        Update: Partial<{
          prompt_id: string;
          parent_code: string;
          z_code: string;
          normalized_z_code: string;
          title: string;
          description: string | null;
          burden_score: number | null;
          not_encountered: boolean;
        }>;
      };
      partner_service_capacity_submission_subjects: {
        Row: {
          id: string;
          submission_id: string;
          subject_person_id: string;
          subject_role: string;
          created_at: string;
        };
        Insert: {
          submission_id: string;
          subject_person_id: string;
          subject_role?: string;
        };
        Update: Partial<{
          subject_role: string;
        }>;
      };
      partner_service_capacity_submission_reviewers: {
        Row: {
          id: string;
          submission_id: string;
          reviewer_person_id: string;
          reviewer_role: string;
          created_at: string;
        };
        Insert: {
          submission_id: string;
          reviewer_person_id: string;
          reviewer_role?: string;
        };
        Update: Partial<{
          reviewer_role: string;
        }>;
      };
      z_codes: {
        Row: {
          id: string;
          z_code: string;
          z_group: number | null;
        };
        Insert: {
          id?: string;
          z_code: string;
          z_group?: number | null;
        };
        Update: Partial<{
          z_code: string;
          z_group: number | null;
        }>;
      };
      z_code_headers: {
        Row: {
          id: number;
          z_code_key: number | null;
          z_group: number | null;
          z_code_hdr_desc: string;
        };
        Insert: {
          id?: number;
          z_code_key?: number | null;
          z_group?: number | null;
          z_code_hdr_desc: string;
        };
        Update: Partial<{
          z_code_key: number | null;
          z_group: number | null;
          z_code_hdr_desc: string;
        }>;
      };
      partner_z_code_burden_scores: {
        Row: {
          id: string;
          partner_id: string;
          submission_id: string | null;
          z_code_id: string;
          z_code: string;
          burden_score: number;
          derived_relation_type: "specialize" | "interfere" | null;
          strength: number;
          updated_at: string;
        };
        Insert: {
          partner_id: string;
          submission_id?: string | null;
          z_code_id: string;
          z_code: string;
          burden_score: number;
          derived_relation_type?: "specialize" | "interfere" | null;
          strength: number;
          updated_at?: string;
        };
        Update: Partial<{
          submission_id: string | null;
          burden_score: number;
          derived_relation_type: "specialize" | "interfere" | null;
          strength: number;
          updated_at: string;
        }>;
      };
      partner_z_code_capabilities: {
        Row: {
          id: string;
          partner_id: string;
          z_code_id: string;
          relation_type: "specialize" | "interfere";
          strength: number;
          source: string;
          source_submitted_at: string | null;
          is_active: boolean;
        };
        Insert: {
          partner_id: string;
          z_code_id: string;
          relation_type: "specialize" | "interfere";
          strength: number;
          source: string;
          source_submitted_at?: string | null;
          is_active?: boolean;
        };
        Update: Partial<{
          strength: number;
          source_submitted_at: string | null;
          is_active: boolean;
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
      navigator_competency_assessment_subjects: {
        Row: {
          id: string;
          assessment_id: string;
          subject_person_id: string;
          subject_role: string;
          created_at: string;
        };
        Insert: {
          assessment_id: string;
          subject_person_id: string;
          subject_role?: string;
        };
        Update: Partial<{
          subject_role: string;
        }>;
      };
      navigator_competency_assessment_reviewers: {
        Row: {
          id: string;
          assessment_id: string;
          reviewer_person_id: string;
          reviewer_role: string;
          created_at: string;
        };
        Insert: {
          assessment_id: string;
          reviewer_person_id: string;
          reviewer_role?: string;
        };
        Update: Partial<{
          reviewer_role: string;
        }>;
      };
      navigator_regulation_test_submission_subjects: {
        Row: {
          id: string;
          submission_id: string;
          subject_person_id: string;
          subject_role: string;
          created_at: string;
        };
        Insert: {
          submission_id: string;
          subject_person_id: string;
          subject_role?: string;
        };
        Update: Partial<{
          subject_role: string;
        }>;
      };
      navigator_regulation_test_submission_reviewers: {
        Row: {
          id: string;
          submission_id: string;
          reviewer_person_id: string;
          reviewer_role: string;
          created_at: string;
        };
        Insert: {
          submission_id: string;
          reviewer_person_id: string;
          reviewer_role?: string;
        };
        Update: Partial<{
          reviewer_role: string;
        }>;
      };
    };
    Views: {
      v_active_navigator_assignment_edges: {
        Row: {
          enrollment_id: string;
          enrollee_id: string;
          enrollee_name: string;
          case_id: string | null;
          current_phase: "regulation" | "readiness" | "renewal";
          avatar_url: string | null;
          navigator_person_id: string;
          navigator_name: string | null;
          station_id: string | null;
          station_name: string | null;
          partner_id: string | null;
          partner_name: string | null;
          county_id: string | null;
          county_name: string | null;
          starts_on: string;
        };
      };
      v_active_supervisor_assignment_edges: {
        Row: {
          navigator_person_id: string;
          navigator_name: string | null;
          supervisor_person_id: string;
          supervisor_name: string | null;
          starts_on: string;
        };
      };
      v_active_enrollment_roster: {
        Row: {
          enrollment_id: string;
          enrollment_status: "active" | "paused" | "completed" | "cancelled";
          start_date: string;
          target_duration_months: number;
          enrollee_id: string;
          enrollee_person_id: string;
          enrollee_name: string;
          dob: string;
          enrollee_email: string;
          avatar_url: string | null;
          case_id: string | null;
          current_phase: "regulation" | "readiness" | "renewal";
          county_id: string | null;
          county_name: string | null;
          navigator_person_ids: string[];
          navigator_names: string[];
          assigned_navigator: string;
          z_code_tags: string[];
          active_z_code_details: unknown;
          completed_parent_codes: string[];
        };
      };
      v_enrollment_assignment_board: {
        Row: {
          enrollment_id: string;
          enrollee_id: string;
          enrollee_name: string;
          case_id: string | null;
          current_phase: "regulation" | "readiness" | "renewal";
          county_id: string | null;
          county_name: string | null;
          navigator_person_ids: string[];
          navigator_names: string[];
          assigned_navigator_label: string;
        };
      };
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
      v_partner_identifier_records: {
        Row: {
          partner_id: string;
          first_name: string | null;
          last_name: string | null;
          organization_name: string;
          email: string | null;
        };
      };
    };
  };
}
