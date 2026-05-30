/**
 * Supabase persistence layer for partner service-capacity submissions, including
 * compatibility fallbacks for partially migrated survey schemas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPartnerServiceCapacityDraftKey,
  normalizeOrganizationName,
} from "../atlas2026/partnerServiceCapacity";
import type {
  AtlasDatabase,
  PartnerIdentifierRecord,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerServiceCapacitySubmissionStatus,
  PartnerSurveyRespondentRole,
  ZCodeDomainSurveyAnswerLogRecord,
  ZCodeDomainSurveyHistorySummary,
} from "./contracts";

const ZCODE_DOMAIN_SURVEY_FORM_VERSION = "2026-z-domain-spectrum-v1";

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
      isNullified: Boolean(answer.is_nullified),
      nullifiedAtIso: answer.nullified_at || null,
      nullifiedByEmail: answer.nullified_by_email || null,
      nullifiedReason: answer.nullified_reason || null,
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

export async function listZCodeDomainSurveyHistory(
  client: SupabaseClient<AtlasDatabase>,
): Promise<ZCodeDomainSurveyHistorySummary[]> {
  const { data, error } = await client
    .schema("atlas")
    .from("partner_service_capacity_answers")
    .select(
      `
      id,
      submission_id,
      normalized_z_code,
      z_code,
      title,
      burden_score,
      is_nullified,
      nullified_at,
      nullified_by_email,
      nullified_reason,
      partner_service_capacity_submissions!inner(
        id,
        status,
        form_version,
        respondent_first_name,
        respondent_last_name,
        respondent_email,
        submitted_at,
        completed_at
      )
    `,
    )
    .eq("partner_service_capacity_submissions.status", "completed")
    .eq("partner_service_capacity_submissions.form_version", ZCODE_DOMAIN_SURVEY_FORM_VERSION)
    .not("burden_score", "is", null)
    .order("normalized_z_code", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  type RawAnswerRow = AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_answers"]["Row"] & {
    partner_service_capacity_submissions:
      | AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_submissions"]["Row"]
      | AtlasDatabase["atlas"]["Tables"]["partner_service_capacity_submissions"]["Row"][];
  };
  const rawRows = (data || []) as RawAnswerRow[];
  const rows: ZCodeDomainSurveyAnswerLogRecord[] = rawRows
    .map((row) => {
      const submission = Array.isArray(row.partner_service_capacity_submissions)
        ? row.partner_service_capacity_submissions[0]
        : row.partner_service_capacity_submissions;
      const numericScore = typeof row.burden_score === "number" ? row.burden_score : null;
      if (!submission || numericScore === null) return null;
      return {
        answerId: row.id,
        submissionId: row.submission_id,
        normalizedZCode: row.normalized_z_code,
        zCode: row.z_code,
        title: row.title,
        score: numericScore,
        respondentFirstName: submission.respondent_first_name || "",
        respondentLastName: submission.respondent_last_name || "",
        respondentEmail: submission.respondent_email || "",
        submittedAtIso: submission.submitted_at,
        completedAtIso: submission.completed_at || null,
        isNullified: Boolean(row.is_nullified),
        nullifiedAtIso: row.nullified_at || null,
        nullifiedByEmail: row.nullified_by_email || null,
        nullifiedReason: row.nullified_reason || null,
      };
    })
    .filter(Boolean) as ZCodeDomainSurveyAnswerLogRecord[];

  const historyByZCode = new Map<string, ZCodeDomainSurveyAnswerLogRecord[]>();
  for (const row of rows) {
    const existing = historyByZCode.get(row.normalizedZCode);
    if (existing) {
      existing.push(row);
    } else {
      historyByZCode.set(row.normalizedZCode, [row]);
    }
  }

  // Aggregate by normalized z-code so admin review can compare raw response logs
  // against the active (non-nullified) average used for domain positioning.
  return Array.from(historyByZCode.entries())
    .map(([normalizedZCode, scoreHistory]) => {
      const activeScores = scoreHistory.filter((row) => !row.isNullified).map((row) => row.score);
      const totalScore = activeScores.reduce((sum, score) => sum + score, 0);
      const first = scoreHistory[0];
      return {
        normalizedZCode,
        zCode: first?.zCode || normalizedZCode,
        title: first?.title || normalizedZCode,
        totalResponses: scoreHistory.length,
        activeResponses: activeScores.length,
        nullifiedResponses: scoreHistory.length - activeScores.length,
        averageScore: activeScores.length ? totalScore / activeScores.length : null,
        scoreHistory,
      };
    })
    .sort((left, right) => left.normalizedZCode.localeCompare(right.normalizedZCode, undefined, { numeric: true }));
}

export async function setZCodeDomainSurveyAnswerNullification(
  client: SupabaseClient<AtlasDatabase>,
  input: {
    answerId: string;
    isNullified: boolean;
    nullifiedByEmail?: string | null;
    nullifiedReason?: string | null;
  },
) {
  const trimmedAnswerId = input.answerId.trim();
  if (!trimmedAnswerId) {
    throw new Error("An answer id is required.");
  }

  // Answer nullification is an administrator review action enforced server-side
  // by the SECURITY DEFINER command RPC; direct UPDATE is revoked.
  const { data, error } = await client.schema("atlas").rpc("fn_set_partner_survey_answer_nullification", {
    p_answer_id: trimmedAnswerId,
    p_is_nullified: input.isNullified,
    p_nullified_by_email: input.isNullified ? input.nullifiedByEmail?.trim() || null : null,
    p_nullified_reason: input.isNullified ? input.nullifiedReason?.trim() || null : null,
  });

  if (error) throw error;
  return data;
}

export async function deletePartnerServiceCapacityDraft(
  client: SupabaseClient<AtlasDatabase>,
  submissionId: string,
) {
  const trimmedSubmissionId = submissionId.trim();
  if (!trimmedSubmissionId) {
    throw new Error("A draft submission id is required.");
  }

  // Deletion is funneled through the scoped command RPC (validates draft status
  // server-side and cascades answers); direct DELETE is revoked.
  const { data, error } = await client
    .schema("atlas")
    .rpc("fn_delete_partner_service_capacity_draft", { target_submission_id: trimmedSubmissionId });

  if (error) throw error;
  const result = (data || {}) as { id?: string; draftKey?: string };
  return {
    id: result.id || trimmedSubmissionId,
    draftKey: result.draftKey || trimmedSubmissionId,
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

  if (!firstName || !lastName || !organizationName) {
    throw new Error("first name, last name, and organization name are required.");
  }

  // Partner identity upsert (dedup on normalized org name) is enforced server-side
  // by the SECURITY DEFINER command RPC; direct partner writes are revoked.
  const { data, error } = await client.schema("atlas").rpc("fn_ensure_partner_identifier", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_organization_name: organizationName,
    p_email: email,
  });

  if (error) throw error;
  const result = (data || {}) as Partial<PartnerIdentifierRecord>;
  return {
    partnerId: result.partnerId || "",
    firstName: result.firstName || firstName,
    lastName: result.lastName || lastName,
    organizationName: result.organizationName || organizationName,
    email: result.email || email || "",
  };
}

export async function savePartnerServiceCapacitySubmission(
  client: SupabaseClient<AtlasDatabase>,
  input: PartnerServiceCapacitySubmissionInput,
) {
  // The whole submission (header + answers) is transmitted as one JSON packet to
  // the validated SECURITY DEFINER command RPC, which upserts the partner +
  // submission, fully replaces answers, and (for completed non domain-spectrum
  // forms) syncs the derived burden/capability tables atomically. Direct table
  // writes are revoked, so the record shape is rebuilt from the RPC result plus
  // the validated input rather than read back -- survey-only users cannot read
  // these rows under the scoped policies.
  const draftKey = input.draftKey?.trim() || createPartnerServiceCapacityDraftKey();
  const status: PartnerServiceCapacitySubmissionStatus = input.status || "draft";
  const completedAtIso = status === "completed" ? input.completedAtIso || new Date().toISOString() : null;
  const organizationName = input.header.organizationName.trim();

  const payload = {
    ...input,
    draftKey,
    status,
    completedAtIso,
  };

  const { data, error } = await client
    .schema("atlas")
    .rpc("fn_save_partner_service_capacity", { payload });

  if (error) throw error;
  const result = (data || {}) as {
    submissionId?: string;
    partnerId?: string | null;
    draftKey?: string;
    status?: PartnerServiceCapacitySubmissionStatus;
    organizationNameNormalized?: string | null;
    completedAtIso?: string | null;
    submittedAtIso?: string;
    updatedAtIso?: string;
  };
  if (!result.submissionId) throw new Error("Partner service capacity save returned no id");

  const nowIso = new Date().toISOString();
  return {
    ...input,
    id: result.submissionId,
    draftKey: result.draftKey || draftKey,
    status: result.status || status,
    completedAtIso: result.completedAtIso ?? completedAtIso,
    partnerId: result.partnerId || null,
    organizationNameNormalized:
      result.organizationNameNormalized ??
      (organizationName ? normalizeOrganizationName(organizationName) : null),
    submittedAtIso: result.submittedAtIso || nowIso,
    updatedAtIso: result.updatedAtIso || nowIso,
  } satisfies PartnerServiceCapacitySubmissionRecord;
}

export async function savePartnerServiceCapacityRecord(
  client: SupabaseClient<AtlasDatabase>,
  input: PartnerServiceCapacitySubmissionInput,
) {
  // Derived burden/capability synchronization now happens server-side inside the
  // command RPC, so the record returned by the save is already canonical.
  return savePartnerServiceCapacitySubmission(client, input);
}
