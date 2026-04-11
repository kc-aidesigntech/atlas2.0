import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AtlasDatabase,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
} from "./contracts";

function normalizeOrganizationName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function mapSubmissionRow(
  submission: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_submissions"]["Row"],
  answers: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Row"][],
): PartnerServiceCapacitySubmissionRecord {
  return {
    id: submission.id,
    partnerId: submission.partner_id || null,
    organizationNameNormalized: submission.organization_name_normalized,
    submittedAtIso: submission.submitted_at,
    updatedAtIso: submission.updated_at || submission.submitted_at,
    formVersion: submission.form_version,
    header: {
      firstName: submission.respondent_first_name,
      lastName: submission.respondent_last_name,
      organizationName: submission.organization_name,
      jobTitle: submission.job_title || "",
      respondentRoles:
        (submission.respondent_roles as PartnerSurveyRespondentRole[]) || [],
      otherRoleText: submission.other_role_text || "",
    },
    answers: answers.map((answer) => ({
      promptId: answer.prompt_id,
      parentCode: answer.parent_code,
      zCode: answer.z_code,
      normalizedZCode: answer.normalized_z_code,
      title: answer.title,
      description: answer.description || "",
      score: answer.burden_score,
    })),
  };
}

async function ensurePartnerRecord(
  client: SupabaseClient<AtlasDatabase>,
  organizationName: string,
) {
  const organizationNameNormalized = normalizeOrganizationName(organizationName);
  const { data, error } = await client
    .schema("atlas")
    .from("partners")
    .upsert(
      {
        organization_name: organizationName.trim(),
        organization_name_normalized: organizationNameNormalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_name_normalized" },
    )
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function getLatestPartnerServiceCapacitySubmission(
  client: SupabaseClient<AtlasDatabase>,
  organizationName: string,
) {
  const normalized = normalizeOrganizationName(organizationName);
  if (!normalized) return null;

  const { data: submissions, error } = await client
    .schema("atlas")
    .from("partner_service_capacity_submissions")
    .select("*")
    .eq("organization_name_normalized", normalized)
    .order("submitted_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const submission = submissions?.[0];
  if (!submission) return null;

  const { data: answers, error: answersError } = await client
    .schema("atlas")
    .from("partner_service_capacity_answers")
    .select("*")
    .eq("submission_id", submission.id)
    .order("created_at", { ascending: true });

  if (answersError) throw answersError;
  return mapSubmissionRow(submission, answers || []);
}

export async function savePartnerServiceCapacitySubmission(
  client: SupabaseClient<AtlasDatabase>,
  input: PartnerServiceCapacitySubmissionInput,
) {
  const partner = await ensurePartnerRecord(client, input.header.organizationName);
  const normalized = normalizeOrganizationName(input.header.organizationName);
  const { data: submission, error: submissionError } = await client
    .schema("atlas")
    .from("partner_service_capacity_submissions")
    .insert({
      partner_id: partner?.id || null,
      organization_name: input.header.organizationName.trim(),
      organization_name_normalized: normalized,
      respondent_first_name: input.header.firstName.trim(),
      respondent_last_name: input.header.lastName.trim(),
      job_title: input.header.jobTitle.trim() || null,
      respondent_roles: input.header.respondentRoles,
      other_role_text: input.header.otherRoleText.trim() || null,
      form_version: input.formVersion,
      raw_payload: input,
    })
    .select("*")
    .single();

  if (submissionError) throw submissionError;

  const answerRows = input.answers.map((answer) => ({
    submission_id: submission.id,
    prompt_id: answer.promptId,
    parent_code: answer.parentCode,
    z_code: answer.zCode,
    normalized_z_code: answer.normalizedZCode,
    title: answer.title,
    description: answer.description,
    burden_score: answer.score,
  }));

  const { data: answers, error: answersError } = await client
    .schema("atlas")
    .from("partner_service_capacity_answers")
    .insert(answerRows)
    .select("*");

  if (answersError) throw answersError;
  return mapSubmissionRow(submission, answers || []);
}
