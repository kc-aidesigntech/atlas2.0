import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregatePartnerSurveyAnswersByNormalizedZCode,
  createPartnerServiceCapacityDraftKey,
  derivePartnerCapabilityRelation,
  derivePartnerCapabilityStrength,
  normalizeOrganizationName,
} from "../atlas2026/partnerServiceCapacity";
import type {
  AtlasDatabase,
  PartnerIdentifierRecord,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerServiceCapacitySubmissionStatus,
  PartnerSurveyRespondentRole,
} from "./contracts";

let supportsDraftSubmissionSchema: boolean | null = null;
let supportsNotEncounteredAnswerSchema: boolean | null = null;

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

function shouldFallbackToLegacyNotEncounteredAnswerSchema(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message || "").toLowerCase() : "";
  const details =
    typeof error === "object" && error && "details" in error ? String((error as { details?: string }).details || "").toLowerCase() : "";
  const hint =
    typeof error === "object" && error && "hint" in error ? String((error as { hint?: string }).hint || "").toLowerCase() : "";
  const combined = `${message} ${details} ${hint}`;

  return [
    "not_encountered",
    "burden_score",
    "null value",
    "violates not-null",
    "violates check constraint",
    "partner_service_capacity_answers_burden_score_check",
    "column",
  ].some((token) => combined.includes(token));
}

function getNotEncounteredMigrationRequiredMessage() {
  return "This database is missing the survey answer schema needed for 'not encountered'. Apply `supabase/migrations/20260414_zcode_master_alignment.sql` before using that option.";
}

function mapSubmissionRow(
  submission: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_submissions"]["Row"],
  answers: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Row"][],
): PartnerServiceCapacitySubmissionRecord {
  return {
    id: submission.id,
    draftKey: submission.draft_key || submission.id,
    status: submission.status || "completed",
    completedAtIso: submission.completed_at || null,
    partnerId: submission.partner_id || null,
    organizationNameNormalized: submission.organization_name_normalized || null,
    submittedAtIso: submission.submitted_at,
    updatedAtIso: submission.updated_at || submission.submitted_at,
    formVersion: submission.form_version,
    header: {
      firstName: submission.respondent_first_name || "",
      lastName: submission.respondent_last_name || "",
      email: submission.respondent_email || "",
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
      notEncountered: Boolean(answer.not_encountered),
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

function mapPartnerRowToIdentifier(
  row: Pick<
    AtlasDatabase["atlas"]["Tables"]["partners"]["Row"],
    | "id"
    | "organization_name"
    | "primary_contact_first_name"
    | "primary_contact_last_name"
    | "primary_contact_email"
  >,
): PartnerIdentifierRecord {
  return {
    partnerId: row.id,
    firstName: row.primary_contact_first_name || "",
    lastName: row.primary_contact_last_name || "",
    organizationName: row.organization_name,
    email: row.primary_contact_email || "",
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

export async function deletePartnerServiceCapacityDraft(
  client: SupabaseClient<AtlasDatabase>,
  submissionId: string,
) {
  const trimmedSubmissionId = submissionId.trim();
  if (!trimmedSubmissionId) {
    throw new Error("A draft submission id is required.");
  }

  const { data: submission, error: fetchError } = await client
    .schema("atlas")
    .from("partner_service_capacity_submissions")
    .select("id, draft_key, status")
    .eq("id", trimmedSubmissionId)
    .single();

  if (fetchError) throw fetchError;
  if (!submission) {
    throw new Error("Draft record not found.");
  }
  if (submission.status !== "draft") {
    throw new Error("Only draft service-capacity records can be deleted.");
  }

  const { error: deleteError } = await client
    .schema("atlas")
    .from("partner_service_capacity_submissions")
    .delete()
    .eq("id", trimmedSubmissionId);

  if (deleteError) throw deleteError;
  return {
    id: submission.id,
    draftKey: submission.draft_key || submission.id,
  };
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

export async function ensurePartnerIdentifierRecord(
  client: SupabaseClient<AtlasDatabase>,
  input: {
    firstName: string;
    lastName: string;
    organizationName: string;
    email?: string | null;
  },
) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const organizationName = input.organizationName.trim();
  const email = input.email?.trim() || null;
  const organizationNameNormalized = normalizeOrganizationName(organizationName);

  if (!firstName || !lastName || !organizationName) {
    throw new Error("first name, last name, and organization name are required.");
  }

  const { data: existingPartnerRows, error: existingPartnerError } = await client
    .schema("atlas")
    .from("partners")
    .select("id, organization_name, primary_contact_first_name, primary_contact_last_name, primary_contact_email")
    .eq("organization_name_normalized", organizationNameNormalized)
    .limit(1);

  if (existingPartnerError) throw existingPartnerError;

  const existingPartner = existingPartnerRows?.[0];
  if (existingPartner) {
    const { data: updatedPartner, error: updateError } = await client
      .schema("atlas")
      .from("partners")
      .update({
        primary_contact_first_name: firstName,
        primary_contact_last_name: lastName,
        primary_contact_email: email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPartner.id)
      .select("id, organization_name, primary_contact_first_name, primary_contact_last_name, primary_contact_email")
      .single();

    if (updateError) throw updateError;
    return mapPartnerRowToIdentifier(updatedPartner || existingPartner);
  }

  const { data: insertedPartner, error: insertError } = await client
    .schema("atlas")
    .from("partners")
    .insert({
      organization_name: organizationName,
      organization_name_normalized: organizationNameNormalized,
      primary_contact_first_name: firstName,
      primary_contact_last_name: lastName,
      primary_contact_email: email,
      updated_at: new Date().toISOString(),
    })
    .select("id, organization_name, primary_contact_first_name, primary_contact_last_name, primary_contact_email")
    .single();

  if (insertError) throw insertError;
  return mapPartnerRowToIdentifier(insertedPartner);
}

export async function savePartnerServiceCapacitySubmission(
  client: SupabaseClient<AtlasDatabase>,
  input: PartnerServiceCapacitySubmissionInput,
) {
  const draftKey = input.draftKey?.trim() || createPartnerServiceCapacityDraftKey();
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
    burden_score: answer.notEncountered ? null : answer.score,
    not_encountered: answer.notEncountered,
  }));

  if (!answerRows.length) {
    return {
      ...mapSubmissionRow(submission, []),
      draftKey: submission.draft_key || submission.id,
      status,
      completedAtIso: status === "completed" ? input.completedAtIso || new Date().toISOString() : null,
    };
  }

  const insertAnswerRows = async (
    rows: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Insert"][],
  ) =>
    client
      .schema("atlas")
      .from("partner_service_capacity_answers")
      .insert(rows)
      .select("*");

  let answers:
    | AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Row"][]
    | null = null;

  try {
    if (supportsNotEncounteredAnswerSchema !== false) {
      const { data, error } = await insertAnswerRows(answerRows);
      if (error) throw error;
      supportsNotEncounteredAnswerSchema = true;
      answers = data;
    }
  } catch (error) {
    if (shouldFallbackToLegacyNotEncounteredAnswerSchema(error)) {
      supportsNotEncounteredAnswerSchema = false;
    } else {
      throw error;
    }
  }

  if (!answers) {
    if (input.answers.some((answer) => answer.notEncountered || typeof answer.score !== "number")) {
      throw new Error(getNotEncounteredMigrationRequiredMessage());
    }

    const legacyAnswerRows: AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Insert"][] = input.answers.map(
      (answer) => ({
        submission_id: submission!.id,
        prompt_id: answer.promptId,
        parent_code: answer.parentCode,
        z_code: answer.zCode,
        normalized_z_code: answer.normalizedZCode,
        title: answer.title,
        description: answer.description,
        burden_score: answer.score,
      }),
    );

    const { data, error } = await insertAnswerRows(legacyAnswerRows);
    if (error) throw error;
    answers = data;
  }

  return {
    ...mapSubmissionRow(submission, answers || []),
    draftKey: submission.draft_key || submission.id,
    status,
    completedAtIso: status === "completed" ? input.completedAtIso || new Date().toISOString() : null,
  };
}

export async function syncPartnerServiceCapacityDerivedTables(
  client: SupabaseClient<AtlasDatabase>,
  record: PartnerServiceCapacitySubmissionRecord,
) {
  if (record.status !== "completed" || !record.partnerId) {
    return record;
  }

  const normalizedAnswers = aggregatePartnerSurveyAnswersByNormalizedZCode(record);
  const normalizedZCodes = normalizedAnswers.map((answer) => answer.normalizedZCode);

  if (!normalizedZCodes.length) {
    return record;
  }

  const { data: zCodeRows, error: zCodeLookupError } = await client
    .schema("atlas")
    .from("z_codes")
    .select("id, z_code")
    .in("z_code", normalizedZCodes);

  if (zCodeLookupError) throw zCodeLookupError;

  const zCodeIdByCode = new Map((zCodeRows || []).map((row) => [row.z_code, row.id]));
  const submittedAtIso = record.completedAtIso || record.updatedAtIso || record.submittedAtIso;

  const burdenRows: AtlasDatabase["atlas"]["Tables"]["partner_z_code_burden_scores"]["Insert"][] = normalizedAnswers
    .map((answer) => {
      const zCodeId = zCodeIdByCode.get(answer.normalizedZCode);
      if (!zCodeId) return null;
      return {
        partner_id: record.partnerId!,
        submission_id: record.id,
        z_code_id: zCodeId,
        z_code: answer.normalizedZCode,
        burden_score: answer.score,
        derived_relation_type: derivePartnerCapabilityRelation(answer.score),
        strength: derivePartnerCapabilityStrength(answer.score),
        updated_at: submittedAtIso,
      };
    })
    .filter(Boolean) as AtlasDatabase["atlas"]["Tables"]["partner_z_code_burden_scores"]["Insert"][];

  if (burdenRows.length) {
    const { error: burdenError } = await client
      .schema("atlas")
      .from("partner_z_code_burden_scores")
      .upsert(burdenRows, { onConflict: "partner_id,z_code_id" });

    if (burdenError) throw burdenError;
  }

  const capabilityRows: AtlasDatabase["atlas"]["Tables"]["partner_z_code_capabilities"]["Insert"][] = normalizedAnswers.flatMap((answer) => {
    const zCodeId = zCodeIdByCode.get(answer.normalizedZCode);
    if (!zCodeId) return [];
    const strength = derivePartnerCapabilityStrength(answer.score);
    return [
      {
        partner_id: record.partnerId!,
        z_code_id: zCodeId,
        relation_type: "specialize",
        strength: answer.score >= 7 ? strength : 0,
        source: "service_capacity_survey",
        source_submitted_at: submittedAtIso,
        is_active: answer.score >= 7,
      },
      {
        partner_id: record.partnerId!,
        z_code_id: zCodeId,
        relation_type: "interfere",
        strength: answer.score <= 3 ? strength : 0,
        source: "service_capacity_survey",
        source_submitted_at: submittedAtIso,
        is_active: answer.score <= 3,
      },
    ];
  });

  if (capabilityRows.length) {
    const { error: capabilityError } = await client
      .schema("atlas")
      .from("partner_z_code_capabilities")
      .upsert(capabilityRows, { onConflict: "partner_id,z_code_id,relation_type,source" });

    if (capabilityError) throw capabilityError;
  }

  return record;
}

export async function savePartnerServiceCapacityRecord(
  client: SupabaseClient<AtlasDatabase>,
  input: PartnerServiceCapacitySubmissionInput,
) {
  const record = await savePartnerServiceCapacitySubmission(client, input);
  return syncPartnerServiceCapacityDerivedTables(client, record);
}
