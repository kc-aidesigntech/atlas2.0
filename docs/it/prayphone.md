# Pray Phone Warm Line (IT)

Pray Phone stays its own application (SignalWire agent webpage + Raspberry Pi kiosk). Atlas owns **identity** and the **navigator portal entry**. Do not port the call engine into the Atlas Vite bundle.

## What Atlas does

- Shows **warm line** in the navigator / supervisor / administrator top menu when `VITE_ATLAS_PRAYPHONE_URL` is set.
- Navigates to `{VITE_ATLAS_PRAYPHONE_URL}/agent` and hands off the current Atlas session in the URL fragment (not sent to the server).
- Authorizes the console with Remote Procedure Call (RPC) `atlas.fn_can_access_warmline_agent()`.
  Administrators and supervisors have `warmline_agent.access` by role. Navigators need a non-expiring
  allow exception set in Admin Directory or by their supervisor on the assigned-navigators roster.
  An administrator can deny a supervisor. Partners never pass. The Warm line menu is hidden unless
  this RPC is true.

## What Pray Phone still does

- `/kiosk` — Raspberry Pi Chromium session. **No Atlas login.** Press `0` starts the warm-line conference.
- `/agent` — staff console. Gated by Atlas Auth when Atlas env is configured.
- SignalWire room tokens, SWML, and call commands stay on `prayphone-server`.

Production origin today: `https://prayphone-68d333045316.herokuapp.com`. Prefer a subdomain of the Atlas host (`pray.<atlas-domain>`) as a Heroku custom domain on the **prayphone** app (not `atlas-simplified`).

## Atlas environment (`atlas-simplified`)

```dotenv
# Origin of the Pray Phone Next.js app (no trailing slash)
VITE_ATLAS_PRAYPHONE_URL=https://prayphone-68d333045316.herokuapp.com
```

Redeploy after setting so Vite embeds the value. Until this is set, the warm-line menu stays hidden.

## Pray Phone environment (`prayphone` Heroku app)

Set **before** `next build` (`NEXT_PUBLIC_*` is compile-time):

```dotenv
NEXT_PUBLIC_ATLAS_SUPABASE_URL=<same as Atlas VITE_SUPABASE_URL>
NEXT_PUBLIC_ATLAS_SUPABASE_ANON_KEY=<same as Atlas VITE_SUPABASE_PUBLISHABLE_KEY>
NEXT_PUBLIC_ATLAS_APP_ORIGIN=https://<atlas-simplified-or-custom-host>
NEXT_PUBLIC_KIOSK_INGEST_TOKEN=<same as INGEST_TOKEN so the Pi Chromium can create calls>
INGEST_TOKEN=<device ingest secret>
ATLAS_SUPABASE_SERVICE_ROLE_KEY=<Atlas service role>
NEXT_PUBLIC_ATLAS_SUPABASE_URL=<same as Atlas>
NEXT_PUBLIC_ATLAS_SUPABASE_ANON_KEY=<same as Atlas>
```

If the fleet database is already the Atlas project, `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used as fallbacks.

## Domain Name System (DNS) and Auth redirects

1. Add custom domain `pray.<atlas-host>` on Heroku app `prayphone`.
2. CNAME that hostname to the Pray Phone Heroku DNS target.
3. In Supabase **Authentication → URL configuration**, add:
   - `https://pray.<atlas-host>/agent`
   - the Heroku origin `/agent` if still used
4. Apply Atlas migration `20260817090000_warmline_agent_access.sql`.

## Verification

1. Sign in to Atlas `/app` as a navigator.
2. Confirm **warm line** is in the top menu.
3. Open it — agent console loads without a second password prompt.
4. Sign in as a partner — no warm-line menu; visiting `/agent` directly is denied.
5. On the Pi, `/kiosk` still starts a call with no Atlas session.

## Related

- Sibling repos: `prayphone-server` (agent + APIs), `prayphone-device` (Pi kiosk)
- Identity bridge: [auth-and-identity.md](./auth-and-identity.md)
- Navigator usage: [../users/navigator-guide.md](../users/navigator-guide.md)
