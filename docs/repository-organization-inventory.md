# Repository Organization Inventory (Phase 1)

## Purpose

This inventory classifies current repository assets and documentation by ownership and runtime use so low-risk moves can be executed without changing behavior.

## Classification Snapshot

- **Feature-local shipped assets**
  - `src/features/atlas2026/singlepane/assets/navigation-cards/*`
  - Used directly by `ProfileNavigationCard` and owned by the single-pane User Interface (UI) surface.
- **Product-shared shipped assets**
  - `src/features/atlas2026/assets/branding/ATLAS_LOGO_simple_lucidGreenBlue4.png`
  - `src/features/atlas2026/assets/icons/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png`
  - Used across product-level components (`singlepane` + shared component layer).
- **Legacy public-root shipped assets (deferred)**
  - `assets/portraits/elena-rodriguez.jpeg`
  - `assets/Kolbi Christianson-lt.png`
  - Remaining root `assets/*` illustrations and line/ellipse exports.
  - Deferred because current usage includes database-backed or public Uniform Resource Locator (URL) contracts such as `/assets/...` and JSON string literals.
- **Reference-only material (not app-shipped)**
  - `references/*.pdf`
  - `references/*.{png,jpg,jpeg,webp,csv}`
- **Repository documentation**
  - Canonical docs under `docs/`
  - Legacy root markdown files remain in place for now to avoid external-link breakage.

## Runtime Usage Findings That Drove Moves

- Product code imported two image files by module path from root `assets`:
  - `ATLAS_LOGO_simple_lucidGreenBlue4.png`
  - `up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png`
- These were moved to `src/features/atlas2026/assets/*` and imports were updated.
- Root `assets` files referenced via `/assets/...` contracts were intentionally not moved in this phase to avoid public path regressions.

## Low-Risk Moves Executed

- Moved `assets/ATLAS_LOGO_simple_lucidGreenBlue4.png` -> `src/features/atlas2026/assets/branding/ATLAS_LOGO_simple_lucidGreenBlue4.png`
- Moved `assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png` -> `src/features/atlas2026/assets/icons/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png`
- Updated all known imports accordingly.

## Shared Contract Extraction Executed

- Moved product-shared modules out of `singlepane` internals:
  - `singlepane/theme.ts` -> `shared/theme.ts`
  - `singlepane/types.ts` -> `shared/contracts.ts`
  - `singlepane/roleCapabilityPolicy.ts` -> `shared/roleCapabilityPolicy.ts`
- Updated imports to consume `@/features/atlas2026/shared/*`.
- Left compatibility re-export shims under `singlepane/*` for incremental safety during transition.
