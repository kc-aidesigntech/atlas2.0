# PARTNER_MY_STATION

## Purpose

Defines the canonical semantics for the partner **my station** timeline so rendering and interpretation stay stable across updates.

## Timeline Marker Semantics

- **Z-code stage marker**
  - Derived aggregate marker created per scoped enrollee and active Z-code for the enrollee's current phase.
  - Marker id format: `<source>-<enrollee-id>-<z-code>`.
  - Date precedence: referral queue timestamp, then route assignment timestamp, then inferred phase-entry timestamp.

- **Inspector requirement**
  - Every rendered marker must be clickable and open a record inspector.
  - If a marker cannot be inspected, it is considered a bug.
  - Inspector details must include the represented enrollee name and support direct drill-in to the underlying enrollee record.

## Rendering Rules

- Partner markers use the same visual grammar as enrollee timeline markers:
  - full-size on-track circles
  - center marker text uses the enrollee Z-code (for example `Z59.0`)
  - callout label uses the Z-code definition text (shorthand if needed)
  - marker color follows canonical Z-code coin color mapping by parent Z-code
  - synthetic placeholders (for example `Z0.0`, `Z1.0`, `Z2.0`) are never allowed
  - source lineage (`referred` / `active`) remains available inside inspector details
  - click target large enough for reliable interaction
  - x-axis collision lanes: when markers collide by horizontal proximity, they stack into lanes instead of overlapping
  - stacks are grouped by phase + parent Z-code + child Z-code so per-code counts are visible
- Partner aggregate mode includes an in-context **(i)** policy badge that explains marker semantics.

## Continuity Policy

- Do not change marker semantics, id formats, or date precedence without updating this document in the same work session.
