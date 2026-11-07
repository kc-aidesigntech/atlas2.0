/**
 * The `activeMenu` screen ids from `TIER_MENU_SCREEN_IDS` that `TierFeatureScreen`
 * renders. Kept apart from the component so the workspace can test a menu id
 * without statically importing the lazily loaded panel chunk.
 */
export const TIER_FEATURE_SCREEN_IDS = [
  'leads',
  'respite shifts',
  'secondment schedule',
  'partners',
  'cohorts',
  'sponsorships',
  'competency cards'
] as const

export type TierFeatureScreenId = (typeof TIER_FEATURE_SCREEN_IDS)[number]

export function isTierFeatureScreenId(value: string): value is TierFeatureScreenId {
  return (TIER_FEATURE_SCREEN_IDS as readonly string[]).includes(value)
}
