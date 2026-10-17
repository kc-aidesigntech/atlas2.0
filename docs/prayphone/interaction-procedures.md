# Pray Phone interaction procedures

Training for Atlas representatives. What the product does is in [system-design.md](./system-design.md). Customer language is in [README.md](./README.md).

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

The green number is how many kiosks have a `last_seen` time inside three minutes. The kiosk posts about once a minute. A kiosk that has never checked in is not in the count. Zero is a real reading when no phone has posted inside that window. It is not a network search.

The count can stay up for about three minutes after a phone stops posting.

## Keys at the kiosk

The person at the kiosk does not sign in.

- Keys `1`–`9` play a clip, then the looping video returns. `*` and `#` do the same when those clip files are on the device. No staff alert. An operator replaces those files by pushing `videos/` in the device repository. Atlas has no clip upload. The commands are in [troubleshooting.md](./troubleshooting.md).
- Key `0` starts the live call. The kiosk screen says "calling the warmline…" and "please stay on the line."
- Lifting the handset restarts the loop from the beginning and opens a handset session.
- Replacing the handset returns the screen to the loop and ends a call if one is open.

A call that starts while the handset is already down is ended by the kiosk, because a down handset with an open call session is treated as hang-up.

## When the call is from the phone app

Key `0` calls the warm line with or without an Atlas account. The call does not turn this icon red and does not count as an online kiosk. On the agent console it sits in its own queue: grey when nobody is signed in, deep green with the person's name when their account matches a person record, or yellow with the account email when they are signed in and have no person record. Answer and end it the same way as a kiosk call. Keys `1`–`9` on the phone do not call.

## When a call starts

1. For a kiosk call, the Atlas phone icon turns red and pulses. A phone-app call does not change the icon.
2. This browser plays a ring. The sound starts only after the person has clicked or tapped the Atlas page at least once. The icon still turns red if the sound is blocked.
3. Press the icon, or open **warm line**. The agent console opens for the same Atlas user. The address bar does not keep a session token.
4. The console shows four queues: kiosk, anonymous, enrollee, and prospective. Press a session in one of them. **answer call** and **reject call** then show for the session you pressed. The console does not answer a session by itself.
5. Press **answer call**. The room status moves to joined. The kiosk screen changes to "connecting video…" and "someone answered — video is starting."
6. When the kiosk camera is not on the agent screen yet, the console says "waiting for kiosk camera…".
7. The red icon clears once staff are recorded in the room with the kiosk, or when the call ends. A ringing row older than two hours is ignored.

## During the call

Both sides are in one SignalWire video room. The kiosk publishes its camera and microphone. The agent publishes the computer camera and microphone. The kiosk picture is the remote view the agent should see. The agent's picture is what the kiosk should see.

The console can show session state `Connected` when the room is joined.

There is no second product inside Atlas for the video. Stay on the agent console until the call ends.

## If the icon never turns red

1. Confirm this account can see the phone icon at all. A partner never will. A navigator will not until the allow exception is saved.
2. Confirm someone at the kiosk pressed `0`, not a clip key. Clip keys do not ring Atlas.
3. Confirm the handset is up. A down handset ends a new call session.
4. Ask an operator to check the inbound-ring table. A missing table shows up in the browser as a missing `prayphone_inbound_rings` relation ("Could not find the table in the schema cache"). Steps are in [troubleshooting.md](./troubleshooting.md).
5. Click or tap the Atlas page once so a later ring is allowed to play. The icon should still have turned red.

What to tell the person at the kiosk while you wait is ________.

## If the green count stays 0

The count is check-ins, not a scan. Zero means Atlas has no `last_seen` inside three minutes. The phone may be powered off, the check-in token may be rejected, or no kiosk has posted yet. Fleet (administrator or supervisor) shows the same rule. A navigator does not open fleet to debug this. Ask an operator. Commands are in [troubleshooting.md](./troubleshooting.md).

## If the person at the kiosk cannot hear you

1. Confirm you pressed **answer call** and the room says joined, not only that the icon turned red.
2. Confirm your browser allowed the microphone. The console shows a mic line when it has one.
3. On the kiosk, the camera device is `/dev/video8`. If that device is missing, they may not see you and you may not see them. Hearing depends on the handset audio device the browser selected. The exact handset sound card name is ________.
4. Ask them to stay off-hook. Replacing the handset ends the call.
5. End the call and have them press `0` again if the room never shows the other person.

Do not send them to a phone number that is not in your local staff instructions. That number is ________.

## Ending a call

End it in one of these ways. Each one is what the software already does.

- Staff press **end call** on the agent console. That sends end for this session.
- Staff press **reject call** before answering. The kiosk shows "agent not available" and "please try again later," then returns to the loop.
- The person at the kiosk replaces the handset. The kiosk ends this session and returns to the loop.
- A clip key, key `0`, or the on-hook signal during the call also leaves the call page and ends this session, then the local loop plays.
- If the call is still open after the device ceiling (one hour unless that setting was changed), the kiosk ends the session it created.

After the call, the kiosk loop is on screen again. The Atlas icon returns to the white phone with the green count. You can close the agent tab or leave it. The next kiosk `0` rings the icon again.
