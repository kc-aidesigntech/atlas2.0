# Pray Phone Warm Line (IT)

Canonical set: [../prayphone/README.md](../prayphone/README.md) (customers), [../prayphone/system-design.md](../prayphone/system-design.md), [../prayphone/interaction-procedures.md](../prayphone/interaction-procedures.md), [../prayphone/troubleshooting.md](../prayphone/troubleshooting.md). This page stays the Atlas environment and domain runbook.

Pray Phone stays its own application (SignalWire agent webpage + Raspberry Pi kiosk). Atlas owns **identity** and the **navigator portal entry**. Do not port the call engine into the Atlas Vite bundle.

Words used on this page: the **agent** is the staff member who monitors the warm line and receives calls on `/agent`. Every other participant is a **caller**: the Pi kiosk on `/kiosk/call`, or the phone app on `/mobile/call`.

## What Atlas does

- Shows **warm line** in the navigator / supervisor / administrator top menu when the account may sit the warm line. The phone icon uses the same rule. The agent link is built in: `https://prayphone-68d333045316.herokuapp.com/agent`.
- Shows a Pray Phone icon in the top bar, to the left of Account Settings, on every workspace menu for those same profiles when the warm-line permission is true. The same icon is on the fleet and scribe shells. Partners do not see it. Navigators see it only with the allow exception. Pressing the icon always opens the agent console.
- The icon carries a green count of conferencer sessions whose state is `initiated`, `dialing`, or `ringing`. An empty queue shows zero. Atlas reads `atlas.prayphone_call_sessions` on the same four-second poll as the inbound ring. A kiosk heartbeat is the fleet online window, not this number.
- When a caller presses `0`, prayphone-server writes a ringing row after the call session is saved. The icon turns red and plays a phone ring. Pressing it opens the agent console in a window named `prayphone-agent` for the same Supabase user. The console opened that way does not play its own ringtone; `window.opener` is set and this tab is already ringing. When the agent presses **answer call**, the console posts `{ type: "prayphone-answered" }` to this tab and `PrayPhoneListenButton` stops the chime.
- The ring clears when the agent and the caller are both in the room, or when the call ends. The icon stays in the bar.
- Navigation stays on the Atlas login. Atlas asks Supabase for a 60-second code (`atlas.fn_create_prayphone_handoff`). The agent page trades that code for a normal Supabase session (`POST /api/atlas-handoff`) and removes the code from the address bar. The session token is not placed in the Uniform Resource Locator (URL). A copied phone link cannot be reused to sign in. A direct visit to `/agent` uses the same Atlas email, Google, or Apple sign-in.
- Authorizes the console with Remote Procedure Call (RPC) `atlas.fn_can_access_warmline_agent()`.
  Administrators and supervisors have `warmline_agent.access` by role. Navigators need a non-expiring
  allow exception set in Admin Directory or by their supervisor on the assigned-navigators roster.
  An administrator can deny a supervisor. Partners never pass. The Warm line menu is hidden unless
  this RPC is true.

## What Pray Phone still does

- `/kiosk/call` — Raspberry Pi Chromium session. **No Atlas login and no ingest token in the page.** Key `0` opens it with `deviceId=<device id>`; `POST /api/signalwire/calls` accepts an enabled `atlas.prayphone_devices` row as the credential for that one create and returns a `callKey`. The page sends it as `x-prayphone-call-key` on `room-token`, the session read, `commands`, and `keywords` (`requireSessionCaller` in `lib/requestAuth.ts`). An unknown id is 403 `Unknown device`.
- `/agent` — the agent console. Gated by Atlas Auth when Atlas env is configured (`components/AgentAuthGate.tsx`). Every Application Programming Interface (API) call from the console carries `Authorization: Bearer <Atlas access token>`; the server runs `atlas.fn_can_access_warmline_agent()` with it. `GET /api/signalwire/calls` and `POST /api/signalwire/calls/clear-queue` accept only that bearer.
- `/mobile/call` — phone-app caller. The Expo keypad (`prayphone/mobile`) can call with or without an Atlas account. Key `0` posts `POST /api/signalwire/mobile-calls`. A missing bearer still creates the call. The queue class comes from the requesting device and, when a bearer is present, from `atlas.people`. It writes the same inbound-ring row as a kiosk, so the header rings for its class when that class is enabled. It does not use the kiosk ingest token or the Pi bridge. The one-time code is injected into the page and is not a session token in the address bar; `POST /api/signalwire/mobile-calls/exchange` returns the room token and a call key sent later as `x-mobile-call-key`.
- The Pi process (`src/kiosk2.py`) uses `x-ingest-token` for `POST /api/device-logs`, `POST /api/upsert-device`, `GET /api/device-config`, and for its own hang-up and watchdog `POST /api/signalwire/calls/{sessionId}/commands` `{ action: "end" }`.
- SignalWire room tokens (`join_as: member`, `room.self.*` permissions only, `end_room_session_on_leave: true` for callers and `false` for the agent, `remove_after_seconds_elapsed: 3600`) and call commands stay on `prayphone-server`. The SignalWire Markup Language (SWML) route exists but no provider leg is dialed on the warm line.

Production origin today: `https://prayphone-68d333045316.herokuapp.com`. Prefer a subdomain of the Atlas host (`pray.<atlas-domain>`) as a Heroku custom domain on the **prayphone** app (not `atlas-simplified`).

Fleet monitoring (online status, session reports, street address, and Wi-Fi login) is an Atlas subapp, not a page on the conferencer. See [fleet.md](./fleet.md).

## Atlas environment (`atlas-simplified`)

The phone icon and warm-line menu open `https://prayphone-68d333045316.herokuapp.com/agent` without an extra setting. Set `VITE_ATLAS_PRAYPHONE_URL` only when the conferencer moves to another origin, then redeploy so Vite embeds it.

## Pray Phone environment (`prayphone` Heroku app)

Set **before** `next build` (`NEXT_PUBLIC_*` is compile-time). The live Atlas project is `qjsaedamqaqxobslboni`.

```dotenv
NEXT_PUBLIC_ATLAS_SUPABASE_URL=<same as Atlas VITE_SUPABASE_URL>
NEXT_PUBLIC_ATLAS_SUPABASE_ANON_KEY=<same as Atlas VITE_SUPABASE_PUBLISHABLE_KEY>
NEXT_PUBLIC_ATLAS_APP_ORIGIN=https://<atlas-simplified-or-custom-host>
ATLAS_SUPABASE_SERVICE_ROLE_KEY=<Atlas service role>
INGEST_TOKEN=<device ingest secret; the Pi process sends it as x-ingest-token>
SIGNALWIRE_SPACE_URL=<https://<space>.signalwire.com>   # or SIGNALWIRE_SPACE_HOST
SIGNALWIRE_PROJECT_ID=<SignalWire project id>
SIGNALWIRE_TOKEN=<SignalWire API token>
```

Read by server code but optional on the warm line: `NEXT_PUBLIC_KIOSK_INGEST_TOKEN` (compiled into the kiosk page by `lib/prayphoneApiHeaders.ts`; the Pi page creates its call with `deviceId` and then uses the call key, so this is not needed for the kiosk), `MOBILE_PROXY_DEVICE_ID` (default `prayphone-mobile-001`), `KIOSK_COLLECTION_DIR` (default `data/kiosk-collections`), `NEXT_PUBLIC_KIOSK_SIP_AOR` / `NEXT_PUBLIC_AGENT_SIP_AOR` / `NEXT_PUBLIC_SIP_AOR` (address strings stored on the session row only), `SIGNALWIRE_CALL_START_COMMAND`, `SIGNALWIRE_CALL_END_COMMAND`, `SIGNALWIRE_CALL_COMMANDS_URL`, `SIGNALWIRE_CALL_COMMANDS_DRY_RUN` (provider-leg commands; no provider leg is dialed on the warm line).

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are the fallbacks when the `*_ATLAS_*` names are unset (`lib/requestAuth.ts`, `lib/atlasAuthClient.ts`, `lib/serverSupabase.ts`). The repo `.env.local` points `NEXT_PUBLIC_SUPABASE_URL` at a project host that does not resolve, so a local `npm run dev` returns 403 `Unknown device` on a kiosk create until the Atlas variables above are set. Never commit those values.

When neither `INGEST_TOKEN` nor the Atlas Supabase variables are set, `requireCaller` and `requireAtlas` return null and every conferencer route is open. That is the local-development state, not production.

## Domain Name System (DNS) and Auth redirects

1. Add custom domain `pray.<atlas-host>` on Heroku app `prayphone`.
2. CNAME that hostname to the Pray Phone Heroku DNS target.
3. In Supabase **Authentication → URL configuration**, add:
   - `https://pray.<atlas-host>/agent`
   - the Heroku origin `/agent` if still used
4. Apply the Atlas migrations on project `qjsaedamqaqxobslboni`, in file order: `20260817090000_warmline_agent_access.sql`, `20260817120000_warmline_agent_capability.sql` (`fn_can_access_warmline_agent`, permission `warmline_agent.access`, `fn_supervisor_set_navigator_warmline_access`), `20260817130000_prayphone_fleet_sessions.sql`, `20261004200000_prayphone_inbound_rings.sql`, `20261004223000_prayphone_fleet_management.sql`, `20261009150000_prayphone_devices_realtime.sql`, `20261010210000_prayphone_auth_handoff.sql`, `20261015055100_grant_service_role_atlas_prayphone.sql`, `20261016203000_prayphone_device_signalwire_identity.sql`, `20261017041700_prayphone_caller_class.sql`, `20261017180000_prayphone_inbound_ring_caller_class.sql`, and `20261017193000_prayphone_ring_sources.sql`. The inbound-ring migration enables Supabase Realtime on `atlas.prayphone_inbound_rings`. Until it is applied, a caller's `0` will not turn the icon red. The devices migration enables Realtime on `atlas.prayphone_devices`. The header green number does not read that table. It counts waiting rows on `atlas.prayphone_call_sessions`. The handoff migration is what lets a click on the phone icon sign the same person into the agent without putting a session token in the URL. Until it is applied, the agent page asks for the Atlas password. The service-role grant is what lets the conferencer read `prayphone_devices` for the kiosk create and write rings and sessions.

## Verification

1. Sign in to Atlas `/app` as a navigator.
2. Confirm **warm line** is in the top menu.
3. Open it — agent console loads without a second password prompt. The X in the conferencer header returns to Atlas `/app`.
4. Sign in as a partner — no warm-line menu; visiting `/agent` directly is denied.
5. On the Pi, key `0` still starts a call with no Atlas session. The kiosk's own camera is in the bottom-right corner from the start; the main pane shows the agent's camera only once the agent has joined.
6. As a navigator, supervisor, or administrator with warm-line access, confirm the Pray Phone icon is in the top bar on every menu. The green number is 0 when the conferencer queues are empty, and it rises when a call is waiting. Press it and the agent console opens in its own window. Press `0` on a kiosk. The icon turns red and this browser rings; the console window does not ring on its own. Press the session row, then **answer call**: this browser's chime stops, and the console main pane shows the caller's camera only, with the agent's own camera in the bottom-right corner. A partner account has no icon.

## Clips

Idle and keypad videos are files in `prayphone-device` under `videos/`, stored with Git Large File Storage (LFS) on that same GitHub repository. The Pi copies them into `~/Videos/mp4s/` during over-the-air (OTA) update. Atlas has no screen for uploading a clip. Laptop commands, the pointer check (`git lfs ls-files`), and the publish rules are in [../prayphone/troubleshooting.md](../prayphone/troubleshooting.md).

## Related

- Sibling repos: `prayphone-server` (agent + APIs), `prayphone-device` (Pi kiosk)
- Identity bridge: [auth-and-identity.md](./auth-and-identity.md)
- Navigator usage: [../users/navigator-guide.md](../users/navigator-guide.md)
