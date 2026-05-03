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
  const draftKey = input.draftKey?.trim() || crypto.randomUUID();
  const status: EnrolleeBurdenSurveySubmissionStatus = input.status || "draft";
  const completedAtIso = status === "completed" ? input.completedAtIso || new Date().toISOString() : null;

  const submissionPayload: AtlasDatabase["atlas"]["Tables"]["enrollee_burden_survey_submissions"]["Insert"] = {
    draft_key: draftKey,
    status,
    completed_at: completedAtIso,
    enrollee_id: input.header.enrolleeId,
    enrollment_id: input.header.enrollmentId,
    enrollee_name: input.header.enrolleeName,
    enrollee_case_id: input.header.enrolleeCaseId || null,
    respondent_person_id: input.header.respondentPersonId || null,
    respondent_name: input.header.respondentName.trim(),
    respondent_role: input.header.respondentRole,
    organization_name: input.header.organizationName.trim() || null,
    form_version: input.formVersion,
    raw_payload: {
      ...input,
      draftKey,
      status,
      completedAtIso,
    },
  };

  const { data: existing, error: existingError } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_submissions")
    .select("id")
    .eq("draft_key", draftKey)
    .limit(1);

  if (existingError) throw existingError;

  const upsert = existing?.[0]
    ? client
        .schema("atlas")
        .from("enrollee_burden_survey_submissions")
        .update({
          ...submissionPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id)
        .select("*")
        .single()
    : client
        .schema("atlas")
        .from("enrollee_burden_survey_submissions")
        .insert(submissionPayload)
        .select("*")
        .single();

  const { data: submission, error: submissionError } = await upsert;
  if (submissionError) throw submissionError;

  const { error: deleteAnswersError } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_answers")
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
    description: answer.description || null,
    burden_score: answer.notEncountered ? null : answer.score,
    not_encountered: answer.notEncountered,
  }));

  if (answerRows.length) {
    const { error: insertAnswersError } = await client
      .schema("atlas")
      .from("enrollee_burden_survey_answers")
      .insert(answerRows);

    if (insertAnswersError) throw insertAnswersError;
  }

  const answers = await listAnswersForSubmissionIds(client, [submission.id]);
  return mapSubmissionRow(submission, answers);
}

export async function deleteEnrolleeBurdenDraft(
  client: SupabaseClient<AtlasDatabase>,
  submissionId: string,
) {
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

  const { error: deleteAnswersError } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_answers")
    .delete()
    .eq("submission_id", submission.id);
  if (deleteAnswersError) throw deleteAnswersError;

  const { error: deleteSubmissionError } = await client
    .schema("atlas")
    .from("enrollee_burden_survey_submissions")
    .delete()
    .eq("id", submission.id);
  if (deleteSubmissionError) throw deleteSubmissionError;

  return record;
}
