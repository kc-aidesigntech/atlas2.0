## Summary

- [ ] I described the intent and risk profile of this change.

## Repository Organization Checklist

- [ ] New docs are in `docs/` (no new root markdown files unless explicitly approved).
- [ ] New app-shipped assets are feature-local (`src/features/<product>/<feature>/assets`) or product-shared (`src/features/atlas2026/assets`).
- [ ] No new generic asset names were introduced (for example `1.svg`, `Line 1.svg`, `Ellipse 1.svg`).
- [ ] Shared modules import contracts/theme/policy from `src/features/atlas2026/shared/*` instead of `singlepane` internals.
- [ ] I ran `npm run check:repo-organization` locally.

## Verification

- [ ] I ran targeted checks (lint/build/tests) for touched areas and documented the outcome.
