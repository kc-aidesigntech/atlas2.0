import type { RouteLogStatus, StabilizationPhase } from '../types'
import { SP_COLORS } from '../theme'

/**
 * Shared timeline visual tokens used by horizontal/vertical strip-map
 * renderers and control overlays. Centralizing avoids color drift between
 * responsive variants.
 */
export const TIMELINE_STATUS_COLORS: Record<RouteLogStatus, string> = {
  planned: SP_COLORS.steel,
  active: SP_COLORS.orange,
  completed: SP_COLORS.deepGreen,
  blocked: SP_COLORS.red
}

export const TIMELINE_PHASE_COLORS: Record<StabilizationPhase, string> = {
  regulation: SP_COLORS.red,
  readiness: SP_COLORS.yellow,
  renewal: SP_COLORS.deepGreen
}
