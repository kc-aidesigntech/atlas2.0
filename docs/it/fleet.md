# Pray Phone Fleet

The fleet subapp is where administrators and supervisors see which Pray Phone kiosks are online, read call sessions, and set each phone's street address and Wi-Fi login. It is part of the Atlas web app, the same way Scribe is: its own hostname when Domain Name System (DNS) is set, and `/fleet` on the primary domain until then.

The conferencer stays on prayphone-server. This screen does not join SignalWire rooms.

## Access

- Path route: `https://<atlas-host>/fleet` (Supabase session required).
- Optional subdomain: set `VITE_ATLAS_FLEET_HOSTNAME` (for example `fleet.example.org`) on the Atlas Heroku app (`atlas-simplified`), add that custom domain to the same app, and create a DNS Canonical Name (CNAME). Redeploy so Vite embeds the hostname. The workspace **fleet** menu then opens the subdomain. Without the variable, the menu opens `/fleet`.
- Workspace menu: migration `20261004223000_prayphone_fleet_management.sql` appends `fleet` to the administrator and supervisor `top_menus`. Navigators do not get the menu.
- Gate: Remote Procedure Call (RPC) `atlas.fn_can_manage_prayphone_fleet()` is true for administrator and supervisor JSON Web Token (JWT) claims, or an active assignment of those roles. It does not follow `warmline_agent.access`, so a navigator with a warm-line exception still cannot open fleet settings.

In Supabase **Authentication → URL configuration**, add the fleet origin (`https://fleet.<atlas-host>` and `https://<atlas-host>/fleet`) so sign-in on that host can return.

## What the screen shows

- **Online / offline.** A phone is online when `prayphone_devices.last_seen` is within three minutes. The kiosk posts a heartbeat about once a minute from `src/kiosk2.py` (`fleet_presence_loop`). Two missed posts still count as online.
- **Sessions.** Rows come from `atlas.prayphone_call_sessions`. A session is tied to a phone when that phone's `hook_session` device log includes `call_session_id`. Keyword counts come from `atlas.prayphone_kiosk_collections`.
- **Address.** `prayphone_devices.location_address`. Record-keeping only; the kiosk does not display it.
- **Wi-Fi username and password.** The username is the network name (Service Set Identifier (SSID)). The password is the passphrase. The phone pulls both and runs `nmcli` only when it is not in a call.

## Data and security

- Migration: `supabase/migrations/20261004223000_prayphone_fleet_management.sql`.
- Address updates and Wi-Fi writes go through `atlas.fn_save_prayphone_device_config`. A blank password field does not erase a stored passphrase. Clearing it is a separate action in the form.
- `atlas.prayphone_device_network` has Row-Level Security (RLS) enabled and no policies, and `authenticated` has no table grant. The passphrase is not returned by `fn_list_prayphone_device_network`. prayphone-server reads it with the service role for the device only.
- Device pull: `GET /api/device-config?device_id=` on prayphone-server, header `x-ingest-token`. Same ingest secret the kiosk already uses for fleet upserts.

## Code map

- Page: `src/features/atlas2026/fleet/StandaloneFleetPage.tsx`
- Persistence: `src/features/atlas2026/fleet/data-access/fleetRepository.ts`
- Online window and session rollups: `src/features/atlas2026/fleet/fleetPresence.ts`
- Routing: `src/RootApp.jsx`
- Menu handoff: `handleMenuSelect` in `src/features/atlas2026/singlepane/shell/SinglePaneWorkspace.tsx`
- Device heartbeat and Wi-Fi apply: `fleet_presence_loop` in `prayphone-device/src/kiosk2.py`
- Device credential read: `prayphone-server/app/api/device-config/route.ts`

## Verification

1. Apply the migration to the Atlas Supabase project.
2. Sign in as an administrator or supervisor, open **fleet** (or `/fleet`), and confirm phones, the session report, and the address / Wi-Fi form render.
3. Sign in as a navigator, including one with warm-line access. The fleet menu is absent, and `/fleet` says the account cannot open it.
4. Save an address. Reload and confirm it remains. Leave the password blank and save again. Confirm the form still says a password is saved.
5. On a kiosk that is not in a call, confirm the next heartbeat (about a minute) applies a changed network, and that a live call is left alone until it ends.

## Troubleshooting

- Fleet menu missing: migration not applied, or the signed-in role is not administrator or supervisor. The administrator menu is a superset of the other roles, so a supervisor `fleet` entry also appears for administrators.
- `Could not load the fleet`: the migration is missing, or `location_address` / the network functions are not on this database.
- Phone stays offline while it is running: `FLEET_API_BASE` and `INGEST_TOKEN` must be set on the Pi, and the ingest token must match prayphone-server.
- Wi-Fi never joins: the kiosk log subject `network_apply` records success or `nmcli missing`. The phone tries each saved passphrase once, skips the change while a call is active, and tries after that call ends. Save the form again to retry a failed join.
