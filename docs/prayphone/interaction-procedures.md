# Pray Phone interaction procedures

Training for Atlas representatives. What the product does is in [system-design.md](./system-design.md). Customer language is in [README.md](./README.md).

Words used here: you are the **agent**. The agent monitors the warm line and only receives calls, on the agent console (`/agent`). The person who pressed `0` is the **caller**, whether they are at a kiosk or on the phone app.

The script to say to the caller, the escalation phone tree, and shift rules are ________.

## Who sees the phone icon and the warm line menu

| Role | Phone icon and warm line menu | Fleet screen |
| --- | --- | --- |
| Administrator | Yes, unless an administrator has denied that person | Yes |
| Supervisor | Yes, unless an administrator has denied that person | Yes |
| Navigator | Only after an allow exception for `warmline_agent.access` | No |
| Partner | No | No |

The icon sits in the top bar, to the left of Account Settings, on every workspace menu for those people, and on the fleet and scribe shells. Pressing it always opens the agent console. The warm line menu opens the same console.

A navigator with the allow exception still does not get the fleet menu. Fleet is `atlas.fn_can_manage_prayphone_fleet()`: administrator and supervisor only.

## Green count

The green number is how many calls are waiting in the conferencer queue. A waiting call has session state initiated, dialing, or ringing. A joined call is not in the number. Zero means those queues are empty. A kiosk can be powered on and checked in while the number stays zero.

## Keys at the kiosk

The person at the kiosk does not sign in.

- Keys `1`–`9` play a clip, then the looping video returns. `*` and `#` do the same when those clip files are on the device. No staff alert. An operator replaces those files by pushing `videos/` in the device repository. Atlas has no clip upload. The commands are in [troubleshooting.md](./troubleshooting.md).
- Key `0` starts the live call. The kiosk screen says "calling the warmline…" and "please stay on the line."
- Lifting the handset restarts the loop from the beginning and opens a handset session.
- Replacing the handset returns the screen to the loop and ends a call if one is open.

A call that starts while the handset is already down is ended by the kiosk, because a down handset with an open call session is treated as hang-up.

## When the call is from the phone app

Key `0` calls the warm line with or without an Atlas account. The call turns this icon red while that class is enabled in `atlas.prayphone_ring_sources`. While that call is waiting, it counts in the green number. On the agent console it sits in its own queue: grey when nobody is signed in, deep green with the person's name when their account matches a person record, or yellow with the account email when they are signed in and have no person record. Answer and end it the same way as a kiosk call. Keys `1`–`9` on the phone do not call.

## When a call starts

1. The conferencer accepts four sources: kiosk (white), anonymous (grey), enrollee (deep green), and prospective (yellow). `atlas.prayphone_ring_sources.enabled` controls which classes ring. All four start enabled. Set `enabled` false in Supabase to silence one class. Each enabled class turns the Atlas phone icon red.
2. This browser plays a calm recorded chime for an enabled source, with three seconds of silence between passes. The clip is `sounds/ringtone.mp3`, stored with Git Large File Storage (LFS). The build copies it to `public/audio/ringtone.mp3`. Heroku app `atlas-simplified` needs the Git LFS buildpack ahead of `heroku/nodejs`, plus `BUILDPACK_GIT_LFS_REPO`, or the copy is a pointer and will not play. The first click or keypress on this Atlas tab arms the chime for as long as that tab stays open, and asks for notification permission. After that, a waiting call plays the chime without another click, including while the tab is in the background. If the clip is blocked and notification permission was allowed, the system notification sound plays instead. An inbound call does not reload the tab, because a reload clears that arming. The icon still turns red when no sound is allowed yet.
3. Press the icon, or open **warm line**. The agent console opens in its own window, named `prayphone-agent`, for the same Atlas user. The address bar does not keep a session token. The X at the top right of the conferencer is the same close control used on Atlas menus. It returns this browser to the Atlas workspace.
4. The console does not ring on its own when it was opened from Atlas; the Atlas tab is already ringing. A console opened by typing `/agent` into the address bar plays its own ringtone (`public/audio/ringtone.mp3` on the conferencer, three seconds of silence between passes) while a call is waiting and you have not pressed **answer call**.
5. The console shows four queues: kiosk (white), anonymous (grey), enrollee (deep green), and prospective (yellow). Each row shows the session state and the caller label (kiosk name, person's name, or account email). Press a row. **answer call** and **reject call** then show for the session you pressed. The console does not answer a session by itself. The list refreshes every three seconds; **refresh** reloads it now.
6. Press **answer call**. The ring stops at once: the console ringtone stops, and the console tells the Atlas tab that opened it (`prayphone-answered`) so the Atlas chime stops too. The Atlas icon stays red until the room is joined. Your browser asks for camera and microphone once. The console joins only the session you pressed. If the camera is refused it joins with microphone only; if the microphone is refused too it joins receive-only.
7. The room status moves to joined once both you and the caller are recorded in the room. The kiosk screen changes to "connecting video…" and "someone answered — video is starting." until your picture reaches it.
8. While the caller's camera is not on your screen yet, the console says "waiting for kiosk camera…".
9. The red icon clears once you are recorded in the room with the caller, or when the call ends. A ringing row older than two hours is ignored.

## Reject and clear queue

- **reject call** shows next to **answer call** for the session you pressed. It ends that one waiting call with reason `agent_rejected`. The caller's screen shows "agent not available" and "please try again later," then the kiosk returns to the loop.
- **clear queue** is at the bottom of the console. It asks you to confirm, then rejects every call that is still waiting in the four queues with reason `queue_cleared`. A connected call stays.

## During the call

You and the caller are in one SignalWire video room.

What you see: the main pane is the caller's picture only. Your own camera is a small picture in the bottom-right corner. The console never shows your own camera in the main pane, and it never shows a second agent.

What the caller sees: the main pane is your picture only. The kiosk's own camera is a small picture in the bottom-right corner, from the moment the call page opened. Until your picture arrives the caller sees "calling the warmline…" with "please stay on the line," then "connecting video…" once you have answered.

The kiosk publishes the Pi camera and microphone. You publish the computer camera and microphone. The caller's picture is the view you should see; your picture is what the caller should see.

The console shows session state `Connected` when the room is joined.

There is no second product inside Atlas for the video. Stay on the agent console until the call ends.

## If the icon never turns red

1. Confirm this account can see the phone icon at all. A partner never will. A navigator will not until the allow exception is saved.
2. Confirm someone at the kiosk pressed `0`, not a clip key. Clip keys do not ring Atlas.
3. Confirm the handset is up. A down handset ends a new call session.
4. Ask an operator to check the inbound-ring table. A missing table shows up in the browser as a missing `prayphone_inbound_rings` relation ("Could not find the table in the schema cache"). Steps are in [troubleshooting.md](./troubleshooting.md).
5. Click or tap the Atlas page once so a later ring is allowed to play. The icon should still have turned red.

What to tell the person at the kiosk while you wait is ________.

## If the green count stays 0

Zero means no call is waiting in the conferencer. A kiosk that is online still shows zero until someone is in that queue. The number rises for a session in initiated, dialing, or ringing, and returns to zero when that session is answered, ended, rejected, or fails. Fleet (administrator or supervisor) is the screen for which phones are online. A navigator does not open fleet to read this number.

## If the person at the kiosk cannot hear you

1. Confirm you pressed **answer call** and the room says joined, not only that the icon turned red.
2. Confirm your browser allowed the microphone. The console shows a mic line when it has one.
3. On the kiosk, the camera device is `/dev/video8`. If that device is missing, the caller may not see you and you may not see the caller. Hearing depends on the handset audio device the browser selected. The exact handset sound card name is ________.
4. Ask the caller to stay off-hook. Replacing the handset ends the call.
5. End the call and have the caller press `0` again if the main pane never shows the caller. If the console says the room is joined but the main pane stays on "waiting for kiosk camera…", the operator steps are in [troubleshooting.md](./troubleshooting.md) under "Kiosk rings in but no video".

Do not send them to a phone number that is not in your local staff instructions. That number is ________.

## Ending a call

End it in one of these ways. Each one is what the software already does.

- The agent presses **end call** on the agent console. It shows only after you have answered. That sends end for this session, then the console leaves the room. The caller's kiosk returns to the loop.
- The agent presses **reject call** before answering. The kiosk shows "agent not available" and "please try again later," then returns to the loop.
- The agent presses **clear queue**. Every waiting call is rejected the same way. The call you are on stays.
- The person at the kiosk replaces the handset. The screen returns to LOOP immediately. The hook-to-hook record is still saved in the background, and the kiosk ends this session.
- A clip key, key `0`, or the on-hook signal during the call also leaves the call page and ends this session, then the local loop plays.
- If the call is still open after the device ceiling (one hour unless that setting was changed), the kiosk ends the session it created.

After the call, the kiosk loop is on screen again. The Atlas icon returns to the white phone with the green count. You can close the agent window or leave it open. The next kiosk `0` rings the Atlas icon again, and the agent window rings only if it was not opened from Atlas.
