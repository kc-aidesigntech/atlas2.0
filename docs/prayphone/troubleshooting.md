# Pray Phone troubleshooting

Operator notes. Staff-facing steps are in [interaction-procedures.md](./interaction-procedures.md). Design is in [system-design.md](./system-design.md).

Do not change `prayphone-ota.timer` or `prayphone-reboot.timer` to "fix" a one-off. The hourly update and the midnight reboot are product behavior.

## Secure Shell (SSH) into the Pi

The service user in the device repo is `ppadmin`. The install notes use this shape and say to adjust the host. They show `PrayPhonePi` only as a sample name.

```bash
ssh ppadmin@________
```

The key path for an operator login is ________. The file `/home/ppadmin/.ssh/prayphone_device_ota` is the GitHub deploy key used by over-the-air (OTA) updates. It is not documented as the key you use to log in from a laptop.

Live checkout: `/home/ppadmin/live/prayphone-device`.

## Set up a Pi from scratch

Follow `prayphone-device/docs/INSTALL_SCRIPT.md`, which mirrors `scripts/install_device.sh`.

```bash
cd /home/ppadmin/live/prayphone-device
./scripts/install_device.sh
```

Already cloned:

```bash
./scripts/install_device.sh --existing-clone
# same path:
./scripts/commission_device.sh
```

The script creates user `ppadmin` if needed, adds groups `gpio`, `video`, `audio`, and `render` when those groups exist, and clones `kc-aidesigntech/prayphone-device` over SSH with the deploy key.

Bootstrap packages, before the repo exists:

```bash
sudo apt-get update -y
sudo apt-get install -y \
  git openssh-client ca-certificates curl \
  python3 python3-pip python3-venv \
  build-essential
```

Full system packages are the non-comment lines in `config/system_requirements.txt`:

`git`, `python3`, `python3-pip`, `python3-venv`, `chromium-browser`, `mpv`, `alsa-utils`, `v4l2loopback-dkms`, `gstreamer1.0-tools`, `gstreamer1.0-plugins-base`, `gstreamer1.0-plugins-good`, `gstreamer1.0-libcamera`, `sqlite3`, `build-essential`, `git-lfs`, `ufw`, `unzip`.

Python packages in the kiosk virtual environment are `RPi.GPIO` (General Purpose Input/Output (GPIO) library) and `requests` (`config/requirements.txt`). The virtual environment is `src/ppvenv`.

Services the installer enables:

| Unit | Role |
| --- | --- |
| `prayphone.service` | `kiosk2.py` |
| `prayphone-camera.service` | CSI (Camera Serial Interface) camera to `/dev/video8` |
| `prayphone-ota.timer` | git update 5 minutes after boot, then hourly |
| `prayphone-reboot.timer` | reboot at 00:00 local time |

Environment file: `/home/ppadmin/live/prayphone-device/config/.env` (mode 600). The unit also sets `FLEET_API_BASE=https://prayphone-68d333045316.herokuapp.com`. Keys the installer asks for, from `config/.env.example`:

```env
DEVICE_ID=prayphone-device-001
DEVICE_NAME="PrayPhone Device 001"
FLEET_API_BASE=https://prayphone-68d333045316.herokuapp.com
INGEST_TOKEN=replace-with-server-INGEST_TOKEN
PRAYPHONE_OTA_CHANNEL=main
DEVICE_APP_VERSION=
DEVICE_MODEL=raspberry-pi
```

`INGEST_TOKEN` must match `INGEST_TOKEN` on the Heroku app `prayphone`. Do not put that value in Atlas docs or in a chat log.

`kiosk_app_url` in `config/config.json` is `https://prayphone-68d333045316.herokuapp.com/kiosk`.

## Logs

On the Pi, successful check-ins are silent. Key presses, hook changes, and a missing camera are printed.

```bash
journalctl -u prayphone.service -f
```

On the server:

```bash
heroku logs --tail -a prayphone
```

A healthy phone produces a Heroku router line for Application Programming Interface (API) `POST /api/upsert-device` about once a minute. The application log does not print a success line for that route. It prints `API /upsert-device error` only when the handler throws. An ingest rejection is HTTP (Hypertext Transfer Protocol) 401 from the route, with body `Unauthorized`, and no application error line.

Silence on `POST /api/upsert-device` means no Pi is posting.

## Ingest 401

`POST /api/upsert-device` and `POST /api/device-logs` require header `x-ingest-token` equal to the server `INGEST_TOKEN`. A mismatch returns 401. The Pi heartbeat does not print that failure. Check the Heroku router status for those posts, then compare `config/.env` on the Pi with the Heroku config. Restart `prayphone.service` after fixing the file so the process reads it.

## Phone stays offline, or the green count stays 0

Atlas counts a phone online only when `atlas.prayphone_devices.last_seen` is inside three minutes (`FLEET_ONLINE_WINDOW_MS`). The table stays empty until a kiosk posts. There is no network scan.

Check, in order:

1. `heroku logs --tail -a prayphone` shows `POST /api/upsert-device` about once a minute.
2. That line is not status 401.
3. `FLEET_API_BASE` on the Pi is `https://prayphone-68d333045316.herokuapp.com`.
4. The Pi has a working network. A Wi-Fi change is skipped during a call and is not retried every minute after a failed join. Subject `network_apply` in device logs says `nmcli missing`, a failed join, or a successful join. The passphrase is not in that log.
5. You are looking at Atlas `/fleet` or the green count. The conferencer page `/devices` still badges "online" with a five-minute window in `app/devices/page.tsx`. That is not the Atlas rule. `GET /api/devices` does return `last_seen`.

## No upsert-device lines

The Pi is not posting. On the device: `systemctl status prayphone.service`, then the journal. Confirm `INGEST_TOKEN` and `FLEET_API_BASE` are in the environment of that process (`systemctl show prayphone.service -p Environment` will include the token; do not paste that output into a ticket). Confirm the Pi can reach the Heroku origin. A stopped service or a boot that never reached `fleet_presence_loop` produces silence on the router.

## Camera `/dev/video8` missing

`prayphone.service` prints `WARNING: /dev/video8 missing` when it launches Chromium. The conferencer then has no Pi camera.

```bash
systemctl status prayphone-camera.service
journalctl -u prayphone-camera.service -n 80 --no-pager
ls -l /dev/video8
```

The camera unit waits up to about ten seconds for `/dev/video8`, then runs the GStreamer pipeline in `config/prayphone-camera.service`. After installing `v4l2loopback`, a reboot may be required before the device node exists. `scripts/test_camera.sh` is the repo's camera check. User `ppadmin` must be able to read `/dev/video8` (video group; udev rule `config/99-v4l2loopback.rules`).

## Chromium and the player

Chromium should be full screen on `http://127.0.0.1:8765/` showing `LOOP.mp4`. If the display socket is not up yet, `mpv` holds the loop and Chromium retries. The journal says `Display not ready` at most every 30 seconds in that wait.

Missing browser binary: journal says no Chromium/Chrome binary was found. The unit looks for `chromium-browser`, `chromium`, and `google-chrome`. The package list installs `chromium-browser`.

Player problems on the device itself (bridge down, or `LOOP.mp4` missing) are drawn by `player.html` when its debug overlay is on. The bridge listens on port 8765.

Profile locks live under `~/.cache/prayphone-kiosk-chromium`. The process clears stale singleton locks before launch.

## Hook and keypad

Rows BCM (Broadcom pin numbering) 25, 12, 13, 16. Columns BCM 22, 17, 4. On-hook BCM 7. Off-hook BCM 6. See [system-design.md](./system-design.md).

Journal lines:

- `Key '…' published to kiosk shell` — a key was seen.
- `Receiver off-hook; LOOP restart published` — handset lifted.
- `Receiver on-hook; reset published` — handset replaced.

No key lines while someone is pressing means the matrix is not being read (wiring, GPIO permission, or `prayphone.service` not running as `ppadmin`). A call that dies immediately after key `0` is often the handset still down: the poll ends any session while the on-hook contact is made.

## SignalWire join

The kiosk creates `POST /api/signalwire/calls`, posts the session id to `http://127.0.0.1:8765/session`, then joins with a room token. Failures show on the kiosk as a stuck "calling the warmline…" screen, or "agent not available" after a reject.

On the agent console, press **answer call** for the listed session. The page joins that session id. Heroku logs for app `prayphone` are where room-token and call-command errors land. The exact SignalWire project id and token names belong in the server environment, not in this file. Which dashboard fields to open at SignalWire is ________.

## Watchdog

The ceiling defaults to 3600 seconds. The clock starts when the call page posts `sessionId` to loopback `POST /session`. On timeout the device ends that session id with reason `watchdog_timeout` and logs subject `watchdog_timeout`. It does not end some other kiosk's session. Set `kiosk_max_call_seconds` to `0` only when you intend to disable the ceiling. The config key is read by `src/config_loader.py`.

## OTA reset surprises

`scripts/ota_update.sh` runs `git reset --hard` to `origin/<channel>` (default `main`). Uncommitted edits under `/home/ppadmin/live/prayphone-device` are discarded, and the kiosk plus camera services restart. That can interrupt a call. Clips in `~/Videos/mp4s/` are outside the git checkout and are not replaced by this reset.

The timer fires five minutes after every boot, including the midnight reboot. A change merged to `main` can land on the device at the next hourly run without a site visit.

## Wi-Fi skipped during a call

`apply_pending_network` returns without calling `nmcli` while a call session id is set. It runs on a later heartbeat after the session id is cleared. A failed passphrase is stored as result `failed` for that revision and is not retried every minute. Save the fleet form again to create a new revision. `nmcli` missing is logged as `network_apply` with `ok: false` and reason `nmcli missing`.

## Inbound ring table missing

Symptom in the Atlas browser console: a 404 or "Could not find the table in the schema cache" for `prayphone_inbound_rings`. The phone icon will not turn red.

The migration in this repo is `supabase/migrations/20261004200000_prayphone_inbound_rings.sql`. It also adds the table to the `supabase_realtime` publication. The Atlas project ref named in this repo is `qjsaedamqaqxobslboni`. Apply that migration on the project the Atlas app uses, then reload the staff session. Device heartbeats use `prayphone_devices` (`20261009150000_prayphone_devices_realtime.sql`) and are a separate table. A missing devices publication delays the green count until the next poll. It does not by itself block the red ring.

## Replace LOOP.mp4 and clips on the device

Default directory from `config/config.json`:

`~/Videos/mp4s/` which for `ppadmin` is `/home/ppadmin/Videos/mp4s/`.

| File | Key |
| --- | --- |
| `LOOP.mp4` | idle loop, required |
| `1.mp4` … `9.mp4` | keys `1`–`9` |
| `star.mp4` | `*` |
| `hash.mp4` | `#` |

The player serves them from the loopback bridge as `/media/<filename>`. Copy the file into that directory on the Pi. The bridge reads the directory at request time (`kiosk_bridge.py` builds the clip map from the folder). Codec, resolution, and frame rate for those MP4 files are ________. Do not use a guessed export preset.

A remote video-replace service is not built. A future approach would ________. Do not invent a deploy hook for it. Until that exists, replace files on the Pi, in the directory above. OTA git reset will not do it.

## Atlas phone-icon origin

The icon opens `https://prayphone-68d333045316.herokuapp.com/agent` unless `VITE_ATLAS_PRAYPHONE_URL` is set. The Atlas app reads it with `import.meta.env` during `vite build`. Heroku app docs in this repo name the app `atlas-simplified`, and `heroku-postbuild` runs that build. Changing the variable in the Heroku config does nothing until the next build and deploy. The Heroku app name `atlas-simplified-db949a616d2d` does not appear in this repository: ________.

Unset, the built-in origin is already the live conferencer. Set the variable only when that origin moves, then redeploy.
