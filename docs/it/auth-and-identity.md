# Auth and Identity Runbook (IT)

Supabase Auth for the Atlas web shell: email/password, Google, Apple, identity linking, and the `atlas.people` bridge. Includes Health Insurance Portability and Accountability Act (HIPAA)-oriented platform reminders.

## Dashboard checklist (per environment)

In the Supabase project used by that environment:

1. **Authentication → Providers**
   - Enable **Email** (decide whether **Confirm email** is required; automatic linking only treats **verified** emails as safe matches).
   - Enable **Google** and **Apple**; configure OAuth client Identifiers (IDs)/secrets.
2. **Authentication → Uniform Resource Locator (URL) configuration**
   - **Site URL** = primary app origin.
   - **Redirect URLs** for every environment: `http://localhost:5173/`, previews, production (include path prefix if `VITE_BASE_PATH` is set).
3. **Authentication → advanced**
   - Enable **Allow manual identity linking** so operators can use **Link Google / Link Apple** in Account Settings while signed in with email.
4. **Provider consoles**
   - Google / Apple redirect Uniform Resource Identifiers (URIs) must match Supabase callback URLs.
5. **Smoke test**
   - Sign up → confirm if required → sign in → Account Settings shows connected providers.
   - Optional: link Google with the same verified email; confirm one `auth.uid()` and one `atlas.people` row.

## Automatic vs manual linking

Supabase **automatically links** a new OAuth identity to an existing user when emails match and the email is treated as verified. There is no separate “enable automatic linking” toggle for that path.

- Align email confirmation policy with Single Sign-On (SSO) linking expectations.
- Identities that do **not** share an email use **manual linking** (`linkIdentity`) from the signed-in app.

## Database bridge: `auth.users` → `atlas.people`

Canonical migration: `supabase/migrations/20260504010000_launch_identity_bridge_baseline.sql`

Behavior:

- New/updated auth users get a matching `atlas.people` row (`id` = `auth.users.id`, `external_ref` = `auth.uid()::text`).
- Default **navigator** role assignment is applied when that role exists (matches `atlas.fn_current_person_id()` used by Row-Level Security (RLS) helpers).

Every production login needs:

1. Auth user
2. `atlas.people` row (via bridge)
3. Active role assignment(s)
4. Partner/navigator/supervisor edges as applicable (Access Matrix Remote Procedure Calls (RPCs))

## Application environment

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Project Application Programming Interface (API) URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (or legacy anon) key — **never** service role |
| `VITE_SUPABASE_AUTH_REDIRECT_URL` | Optional absolute OAuth/email callback |
| `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP` | When true, shell requires a session before loading the workspace |

The Vite client uses Proof Key for Code Exchange (PKCE) and session detection from the URL (`src/lib/supabaseClient.ts`).

## HIPAA-oriented reminders

Compliance is organizational, not a single repo switch:

- Execute a Business Associate Agreement (BAA) with Supabase where applicable.
- Enable Multi-Factor Authentication (MFA), leaked-password protection, appropriate JavaScript Object Notation (JSON) Web Token (JWT) lifetime, and disable anonymous sign-ins except for the intentional public referral surface.
- Prefer `app_metadata` (not `user_metadata`) for authorization claims.
- Use Transport Layer Security (TLS)-only clients; do not store passwords in Atlas tables.

## Related code

- `src/auth/SupabaseAuthProvider.tsx` — session, sign-in/up, OAuth, `linkIdentity`
- `src/auth/AtlasAuthScreen.tsx` — gate User Interface (UI)
- `src/RootApp.jsx` — auth gate when bootstrap is enabled
- `src/features/atlas2026/singlepane/components/AccountSettingsPanel.tsx` — linked providers

## Related docs

- [security.md](./security.md)
- [assignment-identity-continuity-integration-scenarios.md](../assignment-identity-continuity-integration-scenarios.md)
- Historical multi-role rollout notes (may name specific people/envs): [multi-role-identity-access-matrix.md](../multi-role-identity-access-matrix.md)
