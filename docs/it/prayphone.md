# Pray Phone Warm Line (IT)

Canonical set: [../prayphone/README.md](../prayphone/README.md) (customers), [../prayphone/system-design.md](../prayphone/system-design.md), [../prayphone/interaction-procedures.md](../prayphone/interaction-procedures.md), [../prayphone/troubleshooting.md](../prayphone/troubleshooting.md). This page stays the Atlas environment and domain runbook.

Pray Phone stays its own application (SignalWire agent webpage + Raspberry Pi kiosk). Atlas owns **identity** and the **navigator portal entry**. Do not port the call engine into the Atlas Vite bundle.

## What Atlas does

- Shows **warm line** in the navigator / supervisor / administrator top menu when the account may sit the warm line. The phone icon uses the same rule. The agent link is built in: `https://prayphone-68d333045316.herokuapp.com/agent`.
- Shows a Pray Phone icon in the top bar, to the left of Account Settings, on every workspace menu for those same profiles when the warm-line permission is true. The same icon is on the fleet and scribe shells. Partners do not see it. Navigators see it only with the allow exception. Pressing the icon always opens the agent console.
- The icon carries a green count of conferencer sessions whose state is `initiated`, `dialing`, or `ringing`. An empty queue shows zero. Atlas reads `atlas.prayphone_call_sessions` on the same four-second poll as the inbound ring. A kiosk heartbeat is the fleet online window, not this number.
- When a kiosk presses `0`, prayphone-server writes a ringing row after the call session is saved. The icon turns red and plays a phone ring. Pressing it opens the agent console for the same Supabase user.
- The ring clears when a staff member and the kiosk are both in the room, or when the call ends. The icon stays in the bar.
- Navigation stays on the Atlas login. Atlas asks Supabase for a 60-second code (`atlas.fn_create_prayphone_handoff`). The agent page trades that code for a normal Supabase session (`POST /api/atlas-handoff`) and removes the code from the address bar. The session token is not placed in the Uniform Resource Locator (URL). A copied phone link cannot be reused to sign in. A direct visit to `/agent` uses the same Atlas email, Google, or Apple sign-in.
- Authorizes the console with Remote Procedure Call (RPC) `atlas.fn_can_access_warmline_agent()`.
  Administrators and supervisors have `warmline_agent.access` by role. Navigators need a non-expiring
  allow exception set in Admin Directory or by their supervisor on the assigned-navigators roster.
  An administrator can deny a supervisor. Partners never pass. The Warm line menu is hidden unless
  this RPC is true.

## What Pray Phone still does

- `/kiosk` — Raspberry Pi Chromium session. **No Atlas login.** Press `0` starts the warm-line conference.
- `/agent` — staff console. Gated by Atlas Auth when Atlas env is configured.
- `/mobile/call` — phone-app caller. The Expo keypad (`prayphone/mobile`) can call with or without an Atlas account. Key `0` posts `POST /api/signalwire/mobile-calls`. A missing bearer still creates the call. The queue class comes from the requesting device and, when a bearer is present, from `atlas.people`. It does not ring the header and it does not use the kiosk ingest token or the Pi bridge. The one-time code is injected into the page and is not a session token in the address bar.
- SignalWire room tokens, SignalWire Markup Language (SWML), and call commands stay on `prayphone-server`.

Production origin today: `https://prayphone-68d333045316.herokuapp.com`. Prefer a subdomain of the Atlas host (`pray.<atlas-domain>`) as a Heroku custom domain on the **prayphone** app (not `atlas-simplified`).

Fleet monitoring (online status, session reports, street address, and Wi-Fi login) is an Atlas subapp, not a page on the conferencer. See [fleet.md](./fleet.md).

## Atlas environment (`atlas-simplified`)

The phone icon and warm-line menu open `https://prayphone-68d333045316.herokuapp.com/agent` without an extra setting. Set `VITE_ATLAS_PRAYPHONE_URL` only when the conferencer moves to another origin, then redeploy so Vite embeds it.

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
4. Apply Atlas migrations `20260817090000_warmline_agent_access.sql`, `20261004200000_prayphone_inbound_rings.sql`, `20261009150000_prayphone_devices_realtime.sql`, and `20261010210000_prayphone_auth_handoff.sql`. The inbound-ring migration enables Supabase Realtime on `atlas.prayphone_inbound_rings`. Until it is applied, a kiosk press will not turn the icon red. The devices migration enables Realtime on `atlas.prayphone_devices`. The header green number does not read that table. It counts waiting rows on `atlas.prayphone_call_sessions`. The handoff migration is what lets a click on the phone icon sign the same person into the agent without putting a session token in the URL. Until it is applied, the agent page asks for the Atlas password.

## Verification

1. Sign in to Atlas `/app` as a navigator.
2. Confirm **warm line** is in the top menu.
3. Open it — agent console loads without a second password prompt. The X in the conferencer header returns to Atlas `/app`.
4. Sign in as a partner — no warm-line menu; visiting `/agent` directly is denied.
5. On the Pi, `/kiosk` still starts a call with no Atlas session.
6. As a navigator, supervisor, or administrator with warm-line access, confirm the Pray Phone icon is in the top bar on every menu. The green number is 0 when the conferencer queues are empty, and it rises when a call is waiting. Press it and the agent console opens. Press `0` on a kiosk. The icon turns red and this browser rings. A partner account has no icon.

## Clips

Idle and keypad videos are files in `prayphone-device` under `videos/`, stored with Git Large File Storage (LFS) on that same GitHub repository. The Pi copies them into `~/Videos/mp4s/` during over-the-air (OTA) update. Atlas has no screen for uploading a clip. Laptop commands, the pointer check (`git lfs ls-files`), and the publish rules are in [../prayphone/troubleshooting.md](../prayphone/troubleshooting.md).

## Related

- Sibling repos: `prayphone-server` (agent + APIs), `prayphone-device` (Pi kiosk)
- Identity bridge: [auth-and-identity.md](./auth-and-identity.md)
- Navigator usage: [../users/navigator-guide.md](../users/navigator-guide.md)
