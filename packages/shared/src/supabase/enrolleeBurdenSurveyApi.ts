import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AtlasDatabase,
  EnrolleeBurdenSurveySubmissionInput,
  EnrolleeBurdenSurveySubmissionRecord,
  EnrolleeBurdenSurveySubmissionStatus,
} from "./contracts";

function mapSubmissionRow(
  submission: AtlasDatabase["atlas"]["Tables"]["enrollee_burden_survey_submissions"]["Row"],
  answers: AtlasDatabase["atlas"]["Tables"]["enrollee_burden_survey_answers"]["Row"][],
): EnrolleeBurdenSurveySubmissionRecord {
  return {
    id: submission.id,
    draftKey: submission.draft_key,
    status: submission.status || "completed",
    completedAtIso: submission.completed_at || null,
    submittedAtIso: submission.submitted_at,
    updatedAtIso: submission.updated_at || submission.submitted_at,
    formVersion: submission.form_version,
    header: {
      enrolleeId: submission.enrollee_id,
      enrollmentId: submission.enrollment_id,
      enrolleeName: submission.enrollee_name,
      enrolleeCaseId: submission.enrollee_case_id || "",
      respondentPersonId: submission.respondent_person_id || null,
      respondentName: submission.respondent_name,
      respondentRole: submission.respondent_role,
      organizationName: submission.organization_name || "",
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

async function listAnswersForSubmissionIds(
  client: SupabaseClient<AtlasDatabase>,
  submissionIds: string[],
) {
  if (!submissionIds.length) return [];
  const { data, error } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_answers")
    .select("*")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getEnrolleeBurdenSubmissionByDraftKey(
  client: SupabaseClient<AtlasDatabase>,
  draftKey: string,
) {
  if (!draftKey.trim()) return null;
  const { data, error } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_submissions")
    .select("*")
    .eq("draft_key", draftKey)
    .limit(1);

  if (error) throw error;
  const submission = data?.[0];
  if (!submission) return null;
  const answers = await listAnswersForSubmissionIds(client, [submission.id]);
  return mapSubmissionRow(submission, answers);
}

export async function listEnrolleeBurdenSubmissions(
  client: SupabaseClient<AtlasDatabase>,
  enrollmentId: string,
) {
  if (!enrollmentId.trim()) return [];
  const { data, error } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_submissions")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];
  const answers = await listAnswersForSubmissionIds(
    client,
    data.map((submission) => submission.id),
  );

  return data.map((submission) =>
    mapSubmissionRow(
      submission,
      answers.filter((answer) => answer.submission_id === submission.id),
    ),
  );
}

export async function listLatestCompletedEnrolleeBurdenSubmissions(
  client: SupabaseClient<AtlasDatabase>,
) {
  const { data, error } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_submissions")
    .select("*")
    .eq("status", "completed")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const latestByEnrollmentId = new Map<string, AtlasDatabase["atlas"]["Tables"]["enrollee_burden_survey_submissions"]["Row"]>();
  data.forEach((submission) => {
    if (!latestByEnrollmentId.has(submission.enrollment_id)) {
      latestByEnrollmentId.set(submission.enrollment_id, submission);
    }
  });

  const submissions = Array.from(latestByEnrollmentId.values());
  const answers = await listAnswersForSubmissionIds(
    client,
    submissions.map((submission) => submission.id),
  );

  return submissions.map((submission) =>
    mapSubmissionRow(
      submission,
      answers.filter((answer) => answer.submission_id === submission.id),
    ),
  );
}

export async function saveEnrolleeBurdenSubmission(
  client: SupabaseClient<AtlasDatabase>,
  input: EnrolleeBurdenSurveySubmissionInput,
) {
  // Writes are funneled through the validated SECURITY DEFINER command RPC
  // (fn_save_enrollee_burden_submission): the whole submission is transmitted
  // as one JSON packet and the database scopes/validates it atomically. Direct
  // INSERT/UPDATE on these tables is revoked from the authenticated role.
  const draftKey = input.draftKey?.trim() || crypto.randomUUID();
  const status: EnrolleeBurdenSurveySubmissionStatus = input.status || "draft";
  const completedAtIso = status === "completed" ? input.completedAtIso || new Date().toISOString() : null;

  const payload = {
    ...input,
    draftKey,
    status,
    completedAtIso,
  };

  const { data: submissionId, error } = await client
    .schema("atlas")
    .rpc("fn_save_enrollee_burden_submission", { payload });
  if (error) throw error;
  if (!submissionId) throw new Error("Burden submission save returned no id");

  // Re-read the canonical row + answers so the caller keeps the existing record
  // shape (the RPC intentionally returns only the submission id).
  const { data: rows, error: readError } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_submissions")
    .select("*")
    .eq("id", submissionId as string)
    .limit(1);
  if (readError) throw readError;
  const submission = rows?.[0];
  if (!submission) throw new Error("Burden submission not found after save");

  const answers = await listAnswersForSubmissionIds(client, [submission.id]);
  return mapSubmissionRow(submission, answers);
}

export async function deleteEnrolleeBurdenDraft(
  client: SupabaseClient<AtlasDatabase>,
  submissionId: string,
) {
  // Capture the record for the return contract before the row is removed.
  const { data, error } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_submissions")
    .select("*")
    .eq("id", submissionId)
    .limit(1);

  if (error) throw error;
  const submission = data?.[0];
  if (!submission || submission.status !== "draft") return null;

  const answers = await listAnswersForSubmissionIds(client, [submission.id]);
  const record = mapSubmissionRow(submission, answers);

  // Deletion (with answer cascade) goes through the scoped command RPC.
  const { data: deletedId, error: deleteError } = await client
    .schema("atlas")
    .rpc("fn_delete_enrollee_burden_draft", { target_submission_id: submission.id });
  if (deleteError) throw deleteError;
  if (!deletedId) return null;

  return record;
}
