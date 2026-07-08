# Cadence

A minimal, offline-first task board built for one person's actual workflow:
a queue, a done list, and a place to park ideas until they're ready to
become tasks — nothing more than that.

(Your repo/folder can stay named `board` — this is just the app's display
name and icon, shown on the home screen and in the browser tab.)

## Features

- **Queue** — tasks with a title, date/time, labels, and an optional
  description. Shows a customizable lookahead range (today / 3 / 7 / 14 /
  30 days / everything upcoming), with unscheduled tasks always pinned at
  top and overdue ones called out separately.
- **Calendar view** — toggle the Queue tab from list to a month grid;
  tapping a day shows that day's tasks below it.
- **Done** — completed tasks, either as a plain chronological list or a
  **Summary** view breaking down what got done by label over a chosen
  period (week / month / 3 months), with per-label counts and bars.
- **Ideas** — a timeless holding pen for things you're not ready to
  schedule. Each one shows its age with a fuse bar that warms up as it
  nears 30 days, then flags itself as worth deciding on. One tap converts
  an idea straight into a task.
- **Swipe navigation** — swipe left/right anywhere in the content area to
  move between Queue → Done → Ideas.
- **Edit / delete** — a pencil and a red bin on every card, no menu in
  between. Delete asks for confirmation since it's not reversible from the
  UI (though see Sync below — deletions are soft, not destructive, under
  the hood).
- **Calendar handoff** — a calendar icon on any dated task opens Google
  Calendar pre-filled with the title, time, and description, for a real
  native reminder independent of this app. Manual only, by design.
- **Backup** — Export/Import buttons save/restore everything as a `.json`
  file you control, plus an automatic export to Downloads whenever you
  close or background the app (only if something changed).
- **Sync (optional)** — sign in with Google to sync across devices in real
  time via Firebase, with offline edits queued and flushed once you're
  back online. Off by default; see setup below.
- **Fully offline** — works with the phone in airplane mode, including
  right after first install.

## How it works

- **Storage**: everything lives in the phone's local storage
  (`localStorage`). Nothing leaves the device, nothing needs a server,
  unless you turn on sync. The app also asks the browser not to
  auto-evict this data under disk pressure (`navigator.storage.persist()`).
- **Offline**: a service worker caches the app shell on first visit, so it
  keeps working with no connection from then on.
- **Reminders**: saving a task with a date/time does nothing to your
  calendar automatically — tap the calendar icon on the card when you want
  a real reminder. It opens Google Calendar pre-filled; you tap "Save"
  there once, and from then on it's a real calendar event with its own
  local reminder, independent of this app, firing even if the app's been
  closed for days. (An earlier version tried handing off to the phone's
  Clock app directly via an Android intent link, but Chrome blocks
  browser-triggered intents to activities that aren't explicitly flagged
  "browsable" — which the Clock app's alarm screen isn't. Calendar links
  are plain https:// URLs, so they don't hit that restriction.) This is
  one-way: marking a task done or deleting it here won't touch the
  calendar event.
- **Deletes are soft**: deleting a task or idea marks it rather than
  erasing it, so if sync is on, the deletion actually reaches your other
  device instead of an offline copy quietly bringing it back. Tombstones
  get cleaned up automatically after 30 days, and never appear in exports.
- **Sync conflict resolution**: every change is timestamped. When two
  devices disagree on the same item, whichever edit is newer wins —
  applied automatically, no merge prompts.

## Get it onto your phone (one-time setup)

1. Create a new repo on GitHub (public or private both work), e.g. `board`.
2. Push these files to it, at the repo root:
   ```
   git init
   git add .
   git commit -m "cadence v1"
   git branch -M main
   git remote add origin git@github.com:<you>/board.git
   git push -u origin main
   ```
3. On GitHub: repo → Settings → Pages → Source: "Deploy from a branch" →
   Branch: `main` / root → Save. Wait ~1 minute.
4. Your app is now live at `https://<you>.github.io/board/`.
5. On your phone, open that URL in Chrome → menu (⋮) → **Add to Home screen**.
6. Open it from the home screen icon from now on. After the first load,
   everything works with the phone in airplane mode.

## Updating it later

Edit the files, commit, push — Pages redeploys automatically in under a
minute. The app's service worker caches the previous version for offline
use, so after a real code change you may need to force a refresh once
(pull down to refresh, or fully close and reopen the app) to pick up the
new version.

## Setting up sync (optional)

Skip this section entirely if you don't want cross-device sync — every
feature above works with zero setup.

1. Go to https://console.firebase.google.com and create a new project (any
   name, no need for Google Analytics in it).
2. In the project: click the web icon (`</>`) to register a web app (any
   nickname, skip Firebase Hosting). It'll show you a `firebaseConfig`
   object — copy those values into `firebase-config.js` in place of the
   `REPLACE_ME` placeholders.
3. Sidebar → Build → **Authentication** → Get started → Sign-in method →
   enable **Google** → Save.
4. Sidebar → Build → **Firestore Database** → Create database → any region,
   start in production mode → **Rules** tab → replace the contents with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /boards/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   → Publish. This is what actually enforces "only you can read or write
   your own data" — the config values in step 2 just say which project to
   talk to, they don't grant access by themselves.
5. Authentication → Settings → **Authorized domains** → add your GitHub
   Pages domain (e.g. `hatam-abolghasemi.github.io`) — sign-in won't work
   from a domain that isn't listed here.
6. Commit your edited `firebase-config.js` and push, same as any other
   update. It's fine that this file is public — a Firebase web `apiKey`
   isn't a secret, the security rules above are what actually protect your
   data.
7. On each device: open the app, tap the cloud icon top-left, sign in with
   the same Google account. From then on, changes made on one device show
   up on the other automatically once both are online; if both edited the
   same thing while apart, whichever edit is newer wins.
