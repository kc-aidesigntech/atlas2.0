import type {
  AtlasJsonDataset,
  JourneyAssignment,
  Participant,
  RouteTemplate,
  RoutingStep,
} from "./contracts";

const seededDataset: AtlasJsonDataset = {
  participants: [
    {
      id: "participant-north-01",
      name: "north district participant",
      county: "north district",
      currentPhase: "readiness",
      readinessScore: 0.62,
      activeJourneyId: "journey-001",
    },
    {
      id: "participant-central-02",
      name: "central district participant",
      county: "central district",
      currentPhase: "regulation",
      readinessScore: 0.41,
    },
  ],
  instructionBoms: [
    {
      id: "bom-safety-triage",
      title: "safety triage block",
      domain: "stabilization",
      description:
        "confirm immediate risks, de-escalate pressure, and lock first safe contact.",
      required: true,
      defaultDurationDays: 2,
    },
    {
      id: "bom-housing-anchor",
      title: "housing anchor block",
      domain: "habitat",
      description:
        "secure housing continuity and remove active displacement threats.",
      required: true,
      defaultDurationDays: 7,
    },
    {
      id: "bom-employment-rhythm",
      title: "employment rhythm block",
      domain: "work",
      description:
        "rebuild routine through stable work access and schedule design.",
      required: false,
      defaultDurationDays: 10,
    },
    {
      id: "bom-civic-contribution",
      title: "civic contribution block",
      domain: "renewal",
      description:
        "assign participant to a reciprocity role with verifiable contribution receipts.",
      required: false,
      defaultDurationDays: 14,
    },
  ],
  routingSteps: [
    {
      id: "step-001",
      bomItemId: "bom-safety-triage",
      label: "stabilize immediate risk",
      phase: "regulation",
      instruction:
        "confirm safe location, remove active threat, establish 24-hour check-in cadence.",
      ownerRole: "peer navigator",
      exitCriteria: "no active threat escalation in 24 hours.",
      sequence: 1,
    },
    {
      id: "step-002",
      bomItemId: "bom-housing-anchor",
      label: "secure housing continuity",
      phase: "readiness",
      instruction:
        "activate housing partner and confirm temporary to stable unit path.",
      ownerRole: "station operator",
      exitCriteria: "housing continuity confirmed for 14 days.",
      sequence: 2,
    },
    {
      id: "step-003",
      bomItemId: "bom-employment-rhythm",
      label: "restore work rhythm",
      phase: "readiness",
      instruction: "set weekly schedule and connect with workforce support.",
      ownerRole: "regional director",
      exitCriteria:
        "participant reports predictable routine for 2 consecutive weeks.",
      sequence: 3,
    },
    {
      id: "step-004",
      bomItemId: "bom-civic-contribution",
      label: "activate civic reciprocity role",
      phase: "renewal",
      instruction:
        "assign renewal role and capture first verified contribution receipt.",
      ownerRole: "governance admin",
      exitCriteria: "verified receipt logged and participant role active.",
      sequence: 4,
    },
  ],
  routeTemplates: [
    {
      id: "template-fast-stabilization",
      name: "fast stabilization",
      description:
        "short sequence to move from threat control to readiness posture.",
      targetPhase: "readiness",
      bomItemIds: ["bom-safety-triage", "bom-housing-anchor"],
      stepIds: ["step-001", "step-002"],
      isCore: true,
    },
    {
      id: "template-social-restoration",
      name: "social restoration",
      description:
        "readiness through social/work rhythm and renewal activation.",
      targetPhase: "renewal",
      bomItemIds: [
        "bom-housing-anchor",
        "bom-employment-rhythm",
        "bom-civic-contribution",
      ],
      stepIds: ["step-002", "step-003", "step-004"],
      isCore: true,
    },
  ],
  journeyAssignments: [
    {
      id: "journey-001",
      participantId: "participant-north-01",
      templateId: "template-fast-stabilization",
      stepIds: ["step-001", "step-002"],
      status: "active",
      currentStepIndex: 1,
      startedAt: "2026-01-10T09:00:00.000Z",
    },
  ],
};

export function loadSeededAtlasDataset(): AtlasJsonDataset {
  return JSON.parse(JSON.stringify(seededDataset)) as AtlasJsonDataset;
}

export function getSelectedParticipant(
  dataset: AtlasJsonDataset,
  participantId: string,
): Participant | null {
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
