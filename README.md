# Ledger — deployment notes

(Your repo/folder can stay named `board` — this is just the app's display
name and icon, shown on the home screen and in the browser tab.)

This is a plain HTML/CSS/JS app, no build step. It needs to be served over
HTTPS for "Add to Home Screen" to install it as a real offline app (Android
won't do this over a local file:// path) — the easiest free way is GitHub
Pages, given you're already on GitHub.

## Get it onto your phone (one-time setup)

1. Create a new repo on GitHub (public or private both work), e.g. `board`.
2. Push these files to it, at the repo root:
   ```
   git init
   git add .
   git commit -m "board v1"
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
minute. The app's service worker caches an old version for offline use, so
after a real code change you may need to force a refresh once (pull down to
refresh, or close and reopen the app) to pick up the new version.

## How the pieces work

- **Storage**: everything lives in the phone's local storage (`localStorage`).
  Nothing leaves the device, nothing needs a server after the first load. The
  app asks the browser not to auto-evict this data under disk pressure
  (`navigator.storage.persist()`), and it automatically downloads a `.json`
  backup whenever you close or background the app (only if something
  changed since the last one) — plus manual Export/Import buttons (the two
  arrows top-right) if you want to trigger it yourself or restore an older
  file.
- **Offline**: a service worker caches the app shell on first visit, so it
  keeps working with no connection.
- **Reminders**: saving a task with a date/time automatically opens Google
  Calendar pre-filled with the title, time, and description — no tap needed
  to trigger it. You tap "Save" there once — from then on it's a real
  calendar event with its own local reminder, independent of this app, so it
  fires even if the app's been closed for days. The calendar icon on each
  card still works too, for re-triggering manually. (An earlier version
  tried handing off to the phone's Clock app directly via an Android intent
  link, but Chrome blocks browser-triggered intents to activities that
  aren't explicitly flagged "browsable" — which the Clock app's alarm screen
  isn't. Calendar links are plain https:// URLs, so they don't hit that
  restriction.) This is one-way: marking the task done or deleting it here
  won't touch the calendar event — real two-way sync needs the Google
  Calendar API with OAuth sign-in, a separate, bigger piece of setup.
- **Editing/deleting**: each task has a pencil (edit) and bin (delete)
  button directly on the card, no menu in between.
- **Swipe**: swipe left/right anywhere in the list to move between
  Queue → Done → Ideas.
- **Ideas**: the "Ideas" tab is a parking lot with no date. Each one shows
  its age with a small fuse bar that goes from cool to warm as it nears 30
  days, at which point the card flags itself with a "worth deciding on a
  deadline?" note. "Give it a deadline" converts it straight into a task.
- **Sync (optional)**: the cloud icon top-left lets you sign in with Google
  and sync tasks/ideas across devices in real time via Firebase. It's off by
  default and the button stays hidden until you set it up (see below). If
  Firebase is ever unreachable — no internet, blocked CDN, whatever — the
  rest of the app keeps working exactly as before; sync failing can't break
  anything else, by design.

## Setting up sync (optional)

Skip this section entirely if you don't want cross-device sync — everything
above works with zero setup.

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
