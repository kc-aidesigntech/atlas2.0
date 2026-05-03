# Atlas (ATLAS) Branding Style Specification

## Document Control

- Version: `1.1`
- Status: `Active`
- Applies to: `web app`, `single-pane workspace`, `public landing pages`, `admin workflows`
- Primary implementation references: `src/index.css`, `packages/shared/src/atlas2026/theme.ts`, `packages/shared/src/atlas2026/zCodeColors.ts`
- Last refreshed: `2026-05-03`

## Purpose

This specification defines the universal visual and interaction language for ATLAS.  
It is the canonical style source for design, product, and engineering decisions so all surfaces feel like one product system rather than separate screens.

## Brand Principles

- **Operational clarity first**: Interface choices prioritize legibility and decision speed in high-context care workflows.
- **Signal-rich, noise-light**: Color is used intentionally for status, urgency, and routing signal; decoration is minimized.
- **Dark-native environment**: Core surfaces are tuned for dark operation and prolonged use.
- **Consistent semantics**: The same role, phase, or state always uses the same visual meaning.
- **Human and grounded**: Typography and spacing are calm, compact, and practical.

## Universal Voice and Copy Styling

- Default product voice is lowercase across the interface.
- Components that require explicit capitalization (for legal names, external data, or proper nouns) must opt out intentionally.
- Avoid all-caps body copy. Reserve uppercase tracking styles for small utility labels and metadata only.

## Color System

### 0) Token Layers (source-of-truth order)

- **Shared canonical tokens**: `packages/shared/src/atlas2026/theme.ts` and `packages/shared/src/atlas2026/zCodeColors.ts`.
- **Global interface tokens**: `src/index.css` custom properties (`--atlas-*`, `--surface-*`, `--foreground-*`).
- **Component-level variables**: local CSS variables for button/input variants (for example `--button-border-color`).
- When tokens conflict, canonical shared tokens define semantic meaning and global interface tokens define shell presentation defaults.

### 1) Core Neutrals (foundation surfaces)

- `bg`: `#000000`
- `panel`: `#050505`
- `surface`: `#0d0d0d`
- `border`: `#2a2a2a`
- `text`: `#ffffff`
- `muted`: `#a7a9ac`
- `steel`: `#808183`

### 2) Signal Palette (semantic action/status)

- `yellow`: `#fcc01a`
- `orange`: `#ff6319`
- `red`: `#ee352e`
- `deepGreen`: `#00933c`
- `green`: `#6cbe45`
- `blue`: `#0039a6`
- `purple`: `#b933ad`
- `brown`: `#996633`
- `steel`: `#808183`
- `white`: `#ffffff`

### 3) Lucid Accent Layer (global UI accent)

- `lucidGreen`: `rgb(129 188 54)`
- `lucidTeal`: `rgb(58 104 130)`
- Default shell accent token (`--accent-color`) is `lucidGreen`.
- Selection tint and ambient accent surfaces derive from the current accent token.
- Input focus treatment uses `lucidTeal` as the field border and focus ring signal.

### 4) Semantic Usage Rules

- `lucidGreen` = universal interface accent for shell emphasis and non-critical highlights.
- `lucidTeal` = focus and interactive control affordance, especially form fields.
- `yellow` = readiness, primary operational accent, highlight intent.
- `orange` = in-progress or active operational work.
- `red` = blocked, failed, or immediate risk.
- `deepGreen` = resolved, completed, or cleared states.
- `steel` and `muted` = secondary information and non-blocking metadata.
- Never invent one-off hex values when an existing semantic token fits.

### 5) Workflow Phase and Status Mappings

- Phase colors:
  - `regulation -> red`
  - `readiness -> yellow`
  - `renewal -> deepGreen`
- Status colors:
  - `planned -> steel`
  - `active -> orange`
  - `completed -> deepGreen`
  - `blocked -> red`

### 6) Z-Code Parent Mapping (must remain stable)

- `Z55 -> yellow`
- `Z56 -> orange`
- `Z57 -> red`
- `Z58 -> green`
- `Z59 -> deepGreen`
- `Z60 -> blue`
- `Z62 -> purple`
- `Z63 -> brown`
- `Z64 -> green`
- `Z65 -> steel`
- `Z75 -> white`

## Typography

### Font Families

- Body: `Helvetica, Arial, sans-serif`
- Heading: `Helvetica, Arial, sans-serif`

### Base Rhythm

- Base size: `17px`
- Base line height: `1.65`
- Body paragraph target: `~1.06rem` with `~1.7` line-height for readable dense content.

### Type Scale Intent

- `h1`: flagship context titles and page anchors.
- `h2`: major section boundaries.
- `h3`: panel-level headings.
- `h4`: sub-panel labels and grouped control sections.
- `p`: narrative and supporting context.
- `small`: secondary metadata and helper text.

### Typography Rules

- Prefer medium/semibold weights over heavy bold for most interface text.
- Keep line lengths short-to-medium for task surfaces.
- Use increased letter spacing only for micro-labels and overlines.

## Spacing and Layout

### Spacing System

- Base spacing unit: `4px`.
- Build layout spacing from multiples of the base unit.
- Keep compact vertical rhythm in operational panels; use larger spacing only for section boundaries.

### Shell Layout

- Header height token: `96px`.
- Edge buffer token: `clamp(0.25in, 5vw, 0.75in)`.
- Maintain consistent horizontal gutters across public and authenticated shells.

### Corner Radius Language

- Inputs and controls: rounded, medium-soft corners.
- Baseline admin/public intake field radius: `14px`.
- Panels/cards: larger radius for containment and hierarchy.
- Keep radius values consistent by component type; avoid arbitrary one-offs.

## Surface and Border Treatment

- Primary app background is true black or near-black.
- Raised surfaces use subtle tonal separation, not high-contrast jumps.
- Border opacity should be low-to-moderate and used to separate content blocks, not decorate them.
- Glass/translucent overlays must preserve text contrast and reduce background noise.

## Component Styling Standards

### Buttons

- Use sign-line button language for primary ATLAS controls.
- Primary action buttons default to `yellow` operational semantics unless a stronger status semantic is required.
- Hover and active interactions use subtle brightness lift, not large motion shifts.
- Disabled states must reduce contrast and remove hover affordances.
- Keep sign-line interaction brightness conservative (`~1.18` default max lift).

### Inputs and Form Controls

- Inputs are full-width within their field container.
- Default field styling: dark surface, light text, subtle border.
- Focus styling must be visible and accessible (teal-tinted border + soft ring).
- Form labels are concise, small, and clearly associated with controls.

### Sliders and Specialized Controls

- Capacity sliders use a high-contrast light thumb on a subdued neutral track.
- Track styling stays visually secondary so thumb position and value context remain primary.
- Browser-specific implementations (`webkit` and `moz`) must remain behaviorally aligned.

### Cards and Panels

- Cards must communicate hierarchy with spacing and border/surface contrast.
- Avoid stacked heavy shadows in dark mode; prefer subtle border + tonal separation.
- Critical action panels require explicit status text in addition to color.

### Data and Status Indicators

- Status badges and markers must use semantic token colors only.
- Do not encode meaning with color alone; include text labels/icons where needed.
- Timeline and map marker colors must remain synchronized with shared semantic mappings.

## Motion and Interaction

- Motion should support context transitions, not attract attention.
- Default transitions are short (`~150ms`) and predictable.
- Use linear marquee or continuous motion sparingly and only for passive telemetry regions.
- Never introduce motion that blocks key workflows or causes visual fatigue.

## Accessibility and Contrast

- Preserve strong contrast between text and surfaces in all states.
- Focus indicators must remain visible on dark backgrounds.
- Critical workflows must be operable by keyboard-only navigation.
- Avoid low-opacity text for essential information.
- Maintain semantic HTML for labels, headings, and status messaging.

## Iconography and Visual Assets

- Prefer simple, geometric icons with consistent stroke weight.
- Icons should support text labels rather than replace them for critical actions.
- Imagery should be operationally relevant, not decorative-first.
- Profile and avatar visuals should not disrupt panel readability.

## Responsive Behavior

- Prioritize stable desktop and large-tablet single-pane workflows.
- Collapse secondary layout columns progressively on narrower widths.
- Keep primary actions and status information visible without deep scrolling where possible.
- Preserve spacing rhythm and text hierarchy at all breakpoints.

## Implementation Contract for Engineering

- Treat shared color constants as source of truth for semantic colors.
- New feature styling must map to existing tokens before introducing new tokens.
- If a new token is required, document its semantic purpose and approved use cases.
- Keep global style behavior aligned with brand voice and accessibility rules.
- Avoid inline style drift when a reusable token/class pattern exists.
- Preserve global Tailwind compatibility overrides for slate/background utilities on dark surfaces unless an approved migration replaces them.

## Governance and Change Management

- Any change to color semantics, type scale, or universal behavior requires:
  - product review,
  - design review,
  - engineering validation for compatibility.
- Backward-incompatible token renames must include migration notes and update references.
- Update this spec whenever implementation behavior changes in shared theme or global style files.

## Quick Reference (Do / Do Not)

- Do use semantic tokens and shared constants for status color.
- Do keep surfaces dark, calm, and high-contrast for long sessions.
- Do prioritize readability over novelty.
- Do align focus and interaction styling with the lucid accent layer.
- Do not introduce random hex values for one-off components.
- Do not rely on color alone to communicate critical state.
- Do not ship new UI primitives without documenting token usage.
