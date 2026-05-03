# Atlas authentication setup

This document covers Supabase Auth for the web shell (email/password, Google, Apple), identity linking, the `atlas.people` bridge migration, and HIPAA-oriented reminders.

---

## Task for tomorrow (Tuesday, April 21, 2026)

Complete these in the Supabase Dashboard for project **atlas-2.0** (ref `qjsaedamqaqxobslboni`), then smoke-test sign-in on staging or localhost with `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP=true`.

1. **Authentication → Providers**
   - Enable **Email** (confirm whether **Confirm email** is required for your policy; automatic linking only treats **verified** emails as safe matches).
   - Enable **Google** and **Apple**; paste OAuth client IDs/secrets per provider docs.
2. **Authentication → URL configuration**
   - Set **Site URL** to your primary app origin (e.g. production URL).
   - Add **Redirect URLs** for every environment: `http://localhost:5173/` (and path prefix if `VITE_BASE_PATH` is set), preview URLs, and production.
3. **Authentication → Sign in / providers (advanced)**
   - Turn on **Allow manual identity linking** so operators can use **Link Google / Link Apple** in Account Settings while already signed in with email.
4. **OAuth consent screens (Google / Apple developer consoles)**
   - Ensure redirect URIs match what Supabase shows for your project.
5. **Smoke test**
   - Sign up with email → confirm email if enabled → sign in → open Account Settings → confirm **Connected providers** lists `email` (and SSO after linking).
   - Optional: link Google with the same verified email and confirm a single user (same `auth.uid()` in JWT and in `atlas.people.external_ref`).

---

## Automatic identity linking

Supabase Auth **automatically links** a new OAuth identity to an existing user when the **email addresses match and the email is treated as verified** (see [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). There is no separate “enable automatic linking” switch for that behavior on hosted projects; it is part of Auth’s security model (unverified emails are not auto-linked to avoid account takeover).

**What you should verify tomorrow**

- **Email confirmations** align with your workflow: with confirmations on, users must verify email before SSO can safely auto-link to the same mailbox.
- Providers return a stable email for Apple (relay or real) and Google so it can match the email user.

For identities that **do not** share an email, use **manual linking** (`linkIdentity`) from the signed-in app (requires **Allow manual identity linking** above).

---

## Database: `auth.users` → `atlas.people` bridge

Migration file: `supabase/migrations/20260421_auth_provision_atlas_people.sql`

It creates triggers on `auth.users` so new (and updated) auth users get a matching `atlas.people` row (`id` = `auth.users.id`, `external_ref` = `auth.uid()::text`) and a default **navigator** role assignment when that role exists—matching `atlas.fn_current_person_id()` used by RLS helpers.

### Applied to remote (2026-04-21)

The migration SQL was executed against the **linked** Supabase project using the latest CLI (Management API / login role), from the directory that holds the CLI link:

```bash
cd /Users/kc_ai-designtech && npx supabase@latest db query --linked --yes -f atlas/supabase/migrations/20260421_auth_provision_atlas_people.sql
```

Prerequisites: `supabase login`, and `supabase link --project-ref qjsaedamqaqxobslboni` (or equivalent link for your machine).

> **Note:** `supabase db push` from this repo alone may report **migration history drift** if the remote was migrated under different filenames. Re-running the SQL is idempotent for the function/trigger names used (`create or replace`, `drop trigger if exists`). For long-term alignment, consider `supabase db pull` / `migration repair` per CLI hints when you reconcile histories.

---

## Application environment (web)

Set in `.env.local` (see `env.template`):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Project API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (preferred) or legacy anon key—**never** service role in the browser |
| `VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP` | When `true` in dev, or always in production builds as you configure, the shell requires a Supabase session before loading the single pane |

The Vite client uses **PKCE** and **session detection from the URL** for OAuth return traffic (`src/lib/supabaseClient.ts`).

---

## HIPAA-oriented reminders (organizational + platform)

Compliance is not “switched on” in this repo alone. In addition to strong RLS and `app_metadata` (not `user_metadata`) for authorization claims:

- Execute a **Business Associate Agreement (BAA)** with Supabase where applicable.
- In the dashboard: **MFA**, **leaked password protection**, **JWT lifetime**, **disable anonymous sign-ins**, audit logging and access reviews per your security plan.
- Use **TLS-only** clients; passwords are hashed by Supabase Auth—do not store passwords in Atlas tables.

---

## Related code

- `src/auth/SupabaseAuthProvider.tsx` — session, sign-in/up, OAuth, `linkIdentity`
- `src/auth/AtlasAuthScreen.tsx` — gate UI
- `src/RootApp.jsx` — auth gate when Supabase bootstrap is enabled
- `src/features/atlas2026/singlepane/components/AccountSettingsPanel.tsx` — linked providers + link buttons + sign out
