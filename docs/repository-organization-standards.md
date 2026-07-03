# Repository Organization Standards

## Scope

This standard defines canonical paths and naming conventions for Atlas 2026 assets, shared contracts, and documentation.

## Canonical Paths

- **Feature-local shipped assets**
  - `src/features/<product>/<feature>/assets/**`
  - Use when assets are owned by one feature surface only.
- **Product-shared shipped assets**
  - `src/features/atlas2026/assets/**`
  - Use for shared product visuals (branding, icons, reusable imagery).
- **Product-shared contracts and theme**
  - `src/features/atlas2026/shared/contracts.ts`
  - `src/features/atlas2026/shared/theme.ts`
  - `src/features/atlas2026/shared/roleCapabilityPolicy.ts`
- **Reference-only material**
  - `references/**`
  - Keep design/reference artifacts here when they are not shipped to runtime bundles.
- **Documentation**
  - `docs/**`
  - Root-level markdown files are legacy-only and should not expand.

## Naming Conventions

- Use kebab-case for new markdown filenames in `docs/`.
- Use descriptive asset filenames that communicate intent, owner, and motif.
- Do not add generic names such as `1.svg`, `Line 1.svg`, or `Ellipse 1.svg`.
- Keep product-shared asset subfolders explicit (for example `branding`, `icons`, `portraits`).

## Import Boundary Rules

- Shared or cross-surface modules must import from `src/features/atlas2026/shared/*`.
- Do not import shared contracts/theme/policy from `singlepane` internal paths.
- If a new shared contract is introduced, place it in `shared/contracts.ts` first and consume from there.

## Pull Request (PR) Expectations

- Verify new docs are under `docs/`.
- Verify new shared assets are under `src/features/atlas2026/assets/` (or feature-local assets stay in that feature).
- Verify no new generic asset filenames are introduced.
- Verify no shared module imports from `singlepane` internal theme/contracts paths.
