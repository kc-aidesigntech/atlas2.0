/**
 * Journey, Bill of Materials (BOM), and routing dataset contracts sourced from
 * `@atlas/shared`. This feature-local re-export keeps data consumers decoupled
 * from package paths while preserving shared type identities.
 */
// Route-builder data contracts come from `@atlas/shared` and are intentionally
// re-exported unchanged so repository adapters remain source-compatible.
export type {
  AtlasJsonDataset,
  InstructionBomItem,
  JourneyAssignment,
  JourneyPhase,
  JourneyStatus,
  Participant,
  RouteTemplate,
  RoutingStep
} from '@atlas/shared'
