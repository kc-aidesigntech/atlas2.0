/**
 * Partner service-capacity domain helpers for survey normalization, scoring,
 * and deterministic grouping used by API and UI layers.
 */
import type {
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
} from "../supabase/contracts";

export function normalizeOrganizationName(value: string) {
  // Keep this slug strategy stable: partner identity joins rely on this exact normalization
  // across autosave, submission history, and partner lookup tables.
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function createPartnerServiceCapacityDraftKey(prefix = "partner-survey") {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now().toString(36)}`;
}

export function sortPartnerServiceCapacityRecords(records: PartnerServiceCapacitySubmissionRecord[]) {
  return records
    .slice()
    .sort(
      (left, right) =>
        new Date(right.updatedAtIso || right.submittedAtIso).getTime() -
        new Date(left.updatedAtIso || left.submittedAtIso).getTime(),
    );
}

export function derivePartnerCapabilityStrength(score: number) {
  // Scores near the neutral midpoint (4-6) produce no directional signal; only edge scores
  // contribute proportional strength for "specialize"/"interfere" capabilities.
  if (score >= 7) return (score - 6) / 3;
  if (score <= 3) return (4 - score) / 3;
  return 0;
}

export function derivePartnerCapabilityRelation(score: number) {
  if (score >= 7) return "specialize" as const;
  if (score <= 3) return "interfere" as const;
  return null;
}

export function aggregatePartnerSurveyAnswersByNormalizedZCode(input: PartnerServiceCapacitySubmissionInput) {
  const grouped = new Map<string, PartnerServiceCapacitySubmissionInput["answers"][number]>();
  input.answers.forEach((answer) => {
    // "not encountered" and unanswered prompts intentionally do not shape capability derivation.
    if (answer.notEncountered || typeof answer.score !== "number") return;
    const existing = grouped.get(answer.normalizedZCode);
    const existingScore = typeof existing?.score === "number" ? existing.score : Number.NEGATIVE_INFINITY;
    // Keep the highest burden score when duplicate normalized z-codes appear in a submission.
    // This preserves strongest-signal semantics for downstream derived tables.
    if (!existing || answer.score > existingScore) {
      grouped.set(answer.normalizedZCode, answer);
    }
  });
  return Array.from(grouped.values());
}
