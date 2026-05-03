# Atlas Writing Standards

## Purpose

This document defines required writing conventions for all Atlas repository content, including:

- Markdown documentation
- Code comments
- Structured text notes
- SQL comments and migration annotations

## Acronym First-Use Rule (Required)

For every document or file, the first time an acronym appears, write the full term first and then the acronym in parentheses.

After that first use in the same file, the acronym may be used alone.

### Required format

- `Application Programming Interface (API)`
- `Role-Based Access Control (RBAC)`
- `Row-Level Security (RLS)`

### Not allowed on first use

- `API`
- `RBAC`
- `RLS`

## Scope and Interpretation

- This rule is file-local. Each file must define acronyms on first use, even if another file already defines them.
- If a term is uncommon for a general engineering audience, define it.
- For audience-facing executive documents, prefer fewer acronyms even after first definition.

## Consistency Requirements

- Keep definitions consistent across files.
- When editing existing content, preserve valid first-use definitions or improve them if unclear.
- Do not change executable behavior while updating text or comments for acronym compliance.

## Review Checklist

Before merging documentation or comment changes:

1. Confirm first use of each acronym is expanded.
2. Confirm repeated uses in the same file are concise.
3. Confirm no ambiguous acronym appears without a local definition.

