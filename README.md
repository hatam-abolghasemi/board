# Board — deployment notes

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
