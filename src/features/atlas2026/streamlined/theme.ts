import { ATLAS_STREAMLINED_COLORS } from '@atlas/shared'

// Streamlined views import shared palette tokens but pin one local border tone so
// black-on-black surfaces remain distinguishable across browsers/displays.
export const SUBWAY_COLORS = {
  ...ATLAS_STREAMLINED_COLORS,
  // Local border override keeps streamlined surfaces legible against pure black panels.
  border: '#222222'
}
