# Pray Phone

Pray Phone is a kiosk a person can walk up to, watch a short video, and place a live video call with a staff member who is signed in to Atlas.

This page is for prospective customers, clients, and partners. Staff steps are in [interaction-procedures.md](./interaction-procedures.md). How the pieces are built is in [system-design.md](./system-design.md).

## Who it is for

A person at the kiosk does not sign in. They use the handset and the keypad.

A staff member uses Atlas. Administrators and supervisors can open the warm line. A navigator can open it only after an allow exception is set for that person. A partner account does not see the Pray Phone controls.

Pricing: ________

How many kiosks are deployed: ________

Support hours: ________

## What a person at the kiosk experiences

The screen shows a looping video named `LOOP.mp4` when the kiosk starts, after every clip, and after every call.

Keys `1` through `9` play a matching clip, then the loop returns. `*` and `#` play their own clips when those files are on the device.

Key `0` is the only key that starts a live call. The screen then says "calling the warmline…" and "please stay on the line." When a staff member answers, it says "connecting video…" and "someone answered — video is starting."

Lifting the handset starts the loop again from the beginning. Replacing the handset returns the screen to the loop. If a call is in progress, replacing the handset ends that call.

If staff reject the call, the screen says "agent not available" and "please try again later," then returns to the loop.

## What a person with the phone app experiences

The phone app opens on a keypad. Signing in is optional. Keys `1` through `9` mark a topic. Key `0` starts a live video call with staff, the same warm line a kiosk reaches with key `0`. Staff see that call in its own queue, separate from a kiosk. The kiosk itself does not change.

## What a staff member in Atlas experiences

People who may sit the warm line see a phone icon in the top bar, to the left of Account Settings. A green number on that icon is how many kiosks have checked in recently. Pressing the icon opens the agent console and signs in the same Atlas person.

When someone at a kiosk presses `0`, the icon turns red and the browser plays a calm recorded chime. Anonymous, enrollee, and prospective calls are present on the agent console and left off, so they do not ring this icon. Staff open the console, press **answer call**, and join the same video room. They press **end call** when they are done. They can press **reject call** before they answer.

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
