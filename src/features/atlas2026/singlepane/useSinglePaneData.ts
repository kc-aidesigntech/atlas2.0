import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { useSinglePaneWorkspaceState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneWorkspaceState'

/**
 * Public facade for the single-pane workspace.
 *
 * The return shape remains owned by the composed workspace hook so existing
 * screens keep one stable integration point while domain workflows stay modular.
 */
export function useSinglePaneData(initialRole: AtlasRole = 'navigator') {
  return useSinglePaneWorkspaceState(initialRole)
}
