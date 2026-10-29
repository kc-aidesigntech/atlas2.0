# Pray Phone

Pray Phone is a kiosk a person can walk up to, watch a short video, and place a live video call with a staff member who is signed in to Atlas.

This page is for prospective customers, clients, and partners. Staff steps are in [interaction-procedures.md](./interaction-procedures.md). How the pieces are built is in [system-design.md](./system-design.md).

Two words are used throughout: the **agent** is the staff member who monitors the warm line and receives calls. Everyone who places a call is a **caller**: a person at a kiosk, or a person on the phone app.

## Who it is for

A person at the kiosk does not sign in. They use the handset and the keypad.

A staff member uses Atlas. Administrators and supervisors can open the warm line. A navigator can open it only after an allow exception is set for that person. A partner account does not see the Pray Phone controls.

Pricing: ________

How many kiosks are deployed: ________

Support hours: ________

## What a person at the kiosk experiences

The screen shows a looping video named `LOOP.mp4` when the kiosk starts, after every clip, and after every call.

Keys `1` through `9` play a matching clip, then the loop returns. `*` and `#` play their own clips when those files are on the device.

Key `0` is the only key that starts a live call. The kiosk camera opens at once and the caller's own picture appears small in the bottom-right corner. The screen says "calling the warmline…" and "please stay on the line." When the agent answers, it says "connecting video…" and "someone answered — video is starting." Then the main picture becomes the agent's camera, and only the agent's camera. The caller's own camera stays in the corner.

Lifting the handset starts the loop again from the beginning. Replacing the handset returns the screen to the loop. If a call is in progress, replacing the handset ends that call.

If the agent rejects the call, the screen says "agent not available" and "please try again later," then returns to the loop.

The kiosk does not store a staff password or an Atlas login. The call it creates is tied to the kiosk's own registered device id, and the kiosk can only act on that one call.

## What a person with the phone app experiences

The phone app opens on a keypad. Signing in is optional. Keys `1` through `9` mark a topic. Key `0` starts a live video call with staff, the same warm line a kiosk reaches with key `0`. Staff see that call in its own queue, separate from a kiosk. The kiosk itself does not change.

## What a staff member in Atlas experiences

People who may sit the warm line see a phone icon in the top bar, to the left of Account Settings. A green number on that icon is how many calls are waiting in the conferencer queue. Zero means that queue is empty. Pressing the icon opens the agent console in its own window and signs in the same Atlas person.

When a kiosk (white), an anonymous caller (grey), a signed-in enrollee (deep green), or a prospective caller (yellow) presses `0`, the icon turns red and the browser plays a calm recorded chime when that class is enabled. The first click or keypress on the Atlas tab arms that chime until the tab is closed or reloaded. Later calls play it without another click. If the clip is blocked, an allowed notification plays the system alert instead. An inbound call does not reload the tab. `atlas.prayphone_ring_sources.enabled` controls which classes ring. All four start enabled. Set `enabled` false in Supabase to silence one class. The chime file is `sounds/ringtone.mp3`, stored with Git Large File Storage (LFS). Heroku app `atlas-simplified` needs the Git LFS buildpack ahead of `heroku/nodejs`, plus `BUILDPACK_GIT_LFS_REPO`, or the copy is a pointer and will not play. The agent opens the console, presses the waiting call in its queue, then presses **answer call** and joins the same SignalWire video room. Pressing **answer call** stops the ring in Atlas. The console opened from Atlas does not ring on its own; a console opened directly rings until **answer call**. On the console the main picture is the caller's camera only, and the agent's own camera is small in the bottom-right corner. The agent presses **end call** when they are done. They can press **reject call** before they answer, or **clear queue** to reject every waiting call at once.

The words a staff member should say, the escalation phone tree, and shift rules are ________.

## What is monitored

Atlas shows which kiosks have checked in. A kiosk counts as online only after it has checked in, and only while that check-in is still recent. The check-in is sent by the kiosk. Atlas does not search the local network for phones.

A street address and a Wi-Fi network name can be stored for each kiosk by an administrator or a supervisor. The day-to-day navigator does not open that screen.

## What is kept

The system keeps:

- Each keypad press.
- A handset session: when the handset was lifted, when it was replaced, which keys were pressed, and how long that lasted.
- The live call: who joined, when it started and ended, and why it ended.
- Speech matches. While a call is connected, the kiosk browser listens for a fixed list of phrases (for example breath, grief, prayer, fear). A match stores the phrase and the short bit of recognized speech that contained it. The last clip key pressed before the call can be stored the same way.
- After the call, a JavaScript Object Notation (JSON) copy of that session, its events, and those phrase matches.

The phrase list is a fixed vocabulary in the software. It is not a diagnosis and it is not a clinical score.

This software does not write a video file or an audio file of the call. Whether the video provider keeps a recording on its own side is ________.

How long any of this is kept is ________.

Health Insurance Portability and Accountability Act (HIPAA) status is ________.

## Where the work sits

The kiosk is a small computer with a screen, a keypad, a handset, and a camera. The call page and the agent console run as a separate web application. Atlas is where staff sign in and where the phone icon lives. The call itself is not a page inside Atlas.
