import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AtlasDatabase,
  PartnerIdentifierRecord,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerServiceCapacitySubmissionStatus,
  PartnerSurveyRespondentRole,
} from "./contracts";

function normalizeOrganizationName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function createDraftKey() {
  return globalThis.crypto?.randomUUID?.() || `partner-survey-${Date.now().toString(36)}`;
}

let supportsDraftSubmissionSchema: boolean | null = null;

function hasLegacyRequiredHeaderFields(input: PartnerServiceCapacitySubmissionInput) {
  return Boolean(
    input.header.firstName.trim() &&
      input.header.lastName.trim() &&
      input.header.organizationName.trim() &&
      input.header.respondentRoles.length,
  );
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function shouldFallbackToLegacyDraftSchema(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message || "").toLowerCase() : "";
  const details =
    typeof error === "object" && error && "details" in error ? String((error as { details?: string }).details || "").toLowerCase() : "";
  const hint =
    typeof error === "object" && error && "hint" in error ? String((error as { hint?: string }).hint || "").toLowerCase() : "";

  return ["draft_key", "completed_at", "status", "on_conflict", "on conflict", "no unique", "column"]
    .some((token) => message.includes(token) || details.includes(token) || hint.includes(token));
}

function mapSubmissionRow(
  submission: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_submissions"]["Row"],
  answers: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Row"][],
): PartnerServiceCapacitySubmissionRecord {
  return {
    id: submission.id,
    draftKey: (submission as { draft_key?: string }).draft_key || submission.id,
    status:
      ((submission as { status?: PartnerServiceCapacitySubmissionStatus }).status as PartnerServiceCapacitySubmissionStatus) ||
      "completed",
    completedAtIso: (submission as { completed_at?: string | null }).completed_at || null,
    partnerId: submission.partner_id || null,
    organizationNameNormalized: submission.organization_name_normalized || null,
    submittedAtIso: submission.submitted_at,
    updatedAtIso: submission.updated_at || submission.submitted_at,
    formVersion: submission.form_version,
    header: {
      firstName: submission.respondent_first_name || "",
      lastName: submission.respondent_last_name || "",
      email: (submission as { respondent_email?: string | null }).respondent_email || "",
      organizationName: submission.organization_name || "",
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

function mapPartnerIdentifierRow(
  row: AtlasDatabase["atlas"]["Views"]["v_partner_identifier_records"]["Row"],
): PartnerIdentifierRecord {
  return {
    partnerId: row.partner_id,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    organizationName: row.organization_name,
    email: row.email || "",
  };
}

async function ensurePartnerRecord(
  client: SupabaseClient<AtlasDatabase>,
  header: PartnerServiceCapacitySubmissionInput["header"],
) {
  const organizationName = header.organizationName.trim();
  const organizationNameNormalized = normalizeOrganizationName(organizationName);
  const { data: existingPartner, error: existingPartnerError } = await client
    .schema("atlas")
    .from("partners")
    .select("id")
    .eq("organization_name_normalized", organizationNameNormalized)
    .limit(1);

  if (existingPartnerError) throw existingPartnerError;
  if (existingPartner?.[0]) return existingPartner[0];

  const { data, error } = await client
    .schema("atlas")
    .from("partners")
    .insert(
      {
        organization_name: organizationName,
        organization_name_normalized: organizationNameNormalized,
        primary_contact_first_name: header.firstName.trim() || null,
        primary_contact_last_name: header.lastName.trim() || null,
        primary_contact_email: header.email.trim() || null,
        updated_at: new Date().toISOString(),
      },
    )
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function getPartnerServiceCapacitySubmissionByDraftKey(
  client: SupabaseClient<AtlasDatabase>,
  draftKey: string,
) {
  if (!draftKey.trim()) return null;

  const { data: submissions, error } = await client
    .schema("atlas")
    .from("partner_service_capacity_submissions")
    .select("*")
    .eq("draft_key", draftKey)
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
    .order("updated_at", { ascending: false })
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

export async function listPartnerServiceCapacitySubmissions(
  client: SupabaseClient<AtlasDatabase>,
  organizationName: string,
) {
  const normalized = normalizeOrganizationName(organizationName);
  if (!normalized) return [];

  const { data: submissions, error } = await client
    .schema("atlas")
    .from("partner_service_capacity_submissions")
    .select("*")
    .eq("organization_name_normalized", normalized)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!submissions?.length) return [];

  const submissionIds = submissions.map((submission) => submission.id);
  const { data: answers, error: answersError } = await client
    .schema("atlas")
    .from("partner_service_capacity_answers")
    .select("*")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: true });

  if (answersError) throw answersError;

  const answersBySubmissionId = new Map<string, AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Row"][]>();
  (answers || []).forEach((answer) => {
    const existing = answersBySubmissionId.get(answer.submission_id);
    if (existing) {
      existing.push(answer);
      return;
    }
    answersBySubmissionId.set(answer.submission_id, [answer]);
  });

  return submissions.map((submission) => mapSubmissionRow(submission, answersBySubmissionId.get(submission.id) || []));
}

export async function searchPartnerIdentifierRecords(
  client: SupabaseClient<AtlasDatabase>,
  firstName: string,
  lastName: string,
) {
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  if (!trimmedFirstName || !trimmedLastName) return [];

  const { data, error } = await client
    .schema("atlas")
    .from("v_partner_identifier_records")
    .select("*")
    .ilike("first_name", `${trimmedFirstName}%`)
    .ilike("last_name", `${trimmedLastName}%`)
    .order("organization_name", { ascending: true })
    .limit(8);

  if (error) throw error;
  return (data || []).map(mapPartnerIdentifierRow);
}

export async function savePartnerServiceCapacitySubmission(
  client: SupabaseClient<AtlasDatabase>,
  input: PartnerServiceCapacitySubmissionInput,
) {
  const draftKey = input.draftKey?.trim() || createDraftKey();
  const status: PartnerServiceCapacitySubmissionStatus = input.status || "draft";
  const organizationName = input.header.organizationName.trim();
  const normalized = organizationName ? normalizeOrganizationName(organizationName) : null;
  const partner = organizationName ? await ensurePartnerRecord(client, input.header) : null;
  let submission:
    | AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_submissions"]["Row"]
    | null = null;

  try {
    if (supportsDraftSubmissionSchema !== false) {
      const { data, error: submissionError } = await client
        .schema("atlas")
        .from("partner_service_capacity_submissions")
        .upsert({
          draft_key: draftKey,
          status,
          completed_at: status === "completed" ? input.completedAtIso || new Date().toISOString() : null,
          partner_id: partner?.id || null,
          organization_name: organizationName || null,
          organization_name_normalized: normalized,
          respondent_first_name: input.header.firstName.trim() || null,
          respondent_last_name: input.header.lastName.trim() || null,
          respondent_email: input.header.email.trim() || null,
          job_title: input.header.jobTitle.trim() || null,
          respondent_roles: input.header.respondentRoles,
          other_role_text: input.header.otherRoleText.trim() || null,
          form_version: input.formVersion,
          raw_payload: input,
        }, { onConflict: "draft_key" })
        .select("*")
        .single();

      if (submissionError) throw submissionError;
      supportsDraftSubmissionSchema = true;
      submission = data;
    }
  } catch (error) {
    if (shouldFallbackToLegacyDraftSchema(error)) {
      supportsDraftSubmissionSchema = false;
    } else {
      throw error;
    }
  }

  if (!submission) {
    if (!hasLegacyRequiredHeaderFields(input)) {
      throw new Error("Draft autosave requires completed respondent details before this database can store legacy survey records.");
    }

    const legacyPayload = {
      partner_id: partner?.id || null,
      organization_name: organizationName,
      organization_name_normalized: normalized,
      respondent_first_name: input.header.firstName.trim(),
      respondent_last_name: input.header.lastName.trim(),
      respondent_email: input.header.email.trim() || null,
      job_title: input.header.jobTitle.trim() || null,
      respondent_roles: input.header.respondentRoles,
      other_role_text: input.header.otherRoleText.trim() || null,
      form_version: input.formVersion,
      raw_payload: input,
    };

    const existingLegacyId = draftKey && isUuidLike(draftKey) ? draftKey : null;

    if (existingLegacyId) {
      const { data, error: updateError } = await client
        .schema("atlas")
        .from("partner_service_capacity_submissions")
        .update(legacyPayload)
        .eq("id", existingLegacyId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      submission = data;
    } else {
      const { data, error: insertError } = await client
        .schema("atlas")
        .from("partner_service_capacity_submissions")
        .insert(legacyPayload)
        .select("*")
        .single();
      if (insertError) throw insertError;
      submission = data;
    }
  }

  if (!submission) {
    throw new Error("Unable to persist partner service capacity submission.");
  }

  const { error: deleteAnswersError } = await client
    .schema("atlas")
    .from("partner_service_capacity_answers")
    .delete()
    .eq("submission_id", submission.id);

  if (deleteAnswersError) throw deleteAnswersError;

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

  if (!answerRows.length) {
    return {
      ...mapSubmissionRow(submission, []),
      draftKey: (submission as { draft_key?: string }).draft_key || submission.id,
      status,
      completedAtIso: status === "completed" ? input.completedAtIso || new Date().toISOString() : null,
    };
  }

  const { data: answers, error: answersError } = await client
    .schema("atlas")
    .from("partner_service_capacity_answers")
    .insert(answerRows)
    .select("*");

  if (answersError) throw answersError;
  return {
    ...mapSubmissionRow(submission, answers || []),
    draftKey: (submission as { draft_key?: string }).draft_key || submission.id,
    status,
    completedAtIso: status === "completed" ? input.completedAtIso || new Date().toISOString() : null,
  };
}
