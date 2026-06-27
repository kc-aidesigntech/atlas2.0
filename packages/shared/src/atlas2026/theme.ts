import { Z_CODE_COLOR_ALIASES } from "./zCodeColors";

export const ATLAS_SIGNAL_COLORS = {
  // Signal color keys are reused by persisted payloads and analytics labels, so
  // we spread aliases directly to preserve stable semantic names across layers.
  ...Z_CODE_COLOR_ALIASES,
} as const;

export const ATLAS_NEUTRAL_COLORS = {
  bg: "#000000",
  panel: "#050505",
  surface: "#0d0d0d",
  border: "#2a2a2a",
  text: "#ffffff",
  // Raised for stronger small-text contrast on dark surfaces across overlays/panels.
  muted: "#bcc2c8",
  steel: "#808183",
} as const;

export const ATLAS_PHASE_COLORS = {
  // These keys mirror workflow phase enums used by Application Programming Interface (API)/view contracts.
  regulation: ATLAS_SIGNAL_COLORS.red,
  readiness: ATLAS_SIGNAL_COLORS.yellow,
  renewal: ATLAS_SIGNAL_COLORS.deepGreen,
} as const;

export const ATLAS_STATUS_COLORS = {
  planned: ATLAS_NEUTRAL_COLORS.steel,
  active: ATLAS_SIGNAL_COLORS.orange,
  completed: ATLAS_SIGNAL_COLORS.deepGreen,
  blocked: ATLAS_SIGNAL_COLORS.red,
} as const;

export const ATLAS_THEME_COLORS = {
  ...ATLAS_NEUTRAL_COLORS,
  ...ATLAS_SIGNAL_COLORS,
} as const;

export const ATLAS_SINGLEPANE_COLORS = {
  ...ATLAS_THEME_COLORS,
  white: ATLAS_THEME_COLORS.text,
} as const;

export const ATLAS_STREAMLINED_COLORS = {
  ...ATLAS_THEME_COLORS,
  black: ATLAS_THEME_COLORS.bg,
  white: ATLAS_THEME_COLORS.text,
} as const;
