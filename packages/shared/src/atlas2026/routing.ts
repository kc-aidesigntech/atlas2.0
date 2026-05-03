import type {
  AtlasJsonDataset,
  JourneyAssignment,
  Participant,
  RouteTemplate,
  RoutingStep,
} from "./contracts";

export function getSelectedParticipant(
  dataset: AtlasJsonDataset,
  participantId: string,
): Participant | null {
  // Consumer layers (web/mobile) pass IDs from route params; return null instead of
  // throwing so callers can treat "not found" as an empty selection state.
  return dataset.participants.find((participant) => participant.id === participantId) || null;
}

export function getSelectedJourney(
  dataset: AtlasJsonDataset,
  participantId: string,
): JourneyAssignment | null {
  const selectedParticipant = getSelectedParticipant(dataset, participantId);
  if (!selectedParticipant?.activeJourneyId) {
    return null;
  }
  return (
    dataset.journeyAssignments.find(
      (journey) => journey.id === selectedParticipant.activeJourneyId,
    ) || null
  );
}

export function getJourneySteps(
  dataset: AtlasJsonDataset,
  journey: JourneyAssignment | null,
): RoutingStep[] {
  if (!journey) return [];
  // stepIds can drift from routingSteps when datasets are partially synced across
  // environments; we intentionally drop unresolved IDs to keep timeline rendering stable.
  return journey.stepIds
    .map((stepId) => dataset.routingSteps.find((step) => step.id === stepId))
    .filter((step): step is RoutingStep => Boolean(step));
}

export function getRouteTemplate(
  dataset: AtlasJsonDataset,
  templateId: string,
): RouteTemplate | null {
  return dataset.routeTemplates.find((template) => template.id === templateId) || null;
}
