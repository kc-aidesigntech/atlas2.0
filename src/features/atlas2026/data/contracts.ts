/**
 * Feature-local re-export layer for Atlas (ATLAS) data contracts. This keeps consumers
 * decoupled from package paths while preserving shared type identities.
 */
// Route-builder data contracts come from @atlas/shared and are intentionally
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
