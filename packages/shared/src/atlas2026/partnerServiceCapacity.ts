import type {
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
} from "../supabase/contracts";

export function normalizeOrganizationName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function createPartnerServiceCapacityDraftKey(prefix = "partner-survey") {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now().toString(36)}`;
}

export function sortPartnerServiceCapacityRecords(records: PartnerServiceCapacitySubmissionRecord[]) {
  return records
    .slice()
    .sort((left, right) => new Date(right.updatedAtIso || right.submittedAtIso).getTime() - new Date(left.updatedAtIso || left.submittedAtIso).getTime());
}

export function derivePartnerCapabilityStrength(score: number) {
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
    if (answer.notEncountered || typeof answer.score !== "number") return;
    const existing = grouped.get(answer.normalizedZCode);
    if (!existing || answer.score > existing.score) {
      grouped.set(answer.normalizedZCode, answer);
    }
  });
  return Array.from(grouped.values());
}
