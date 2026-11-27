# AI Rep Tracker

ENGR 126 final project — Farhan Shaik & Jacob Khalatbari.

A browser app that watches you lift through your phone or laptop camera, counts reps,
checks squat and pushup form, and saves your workouts to a dashboard. No extra hardware.
Film from the side; for pushups, put the phone low with your whole body in frame.
If the picture of you is sideways or upside down, press **Rotate** on Live Set until you're upright.

## Who owns what

| Folder | Owner | What it is |
|---|---|---|
| `web/src/brain/` | Farhan | Camera + pose tracking, rep counting, form checks, classifier |
| `web/src/app/` | Jacob | Everything the user sees: pages, dashboard, saving workouts, labeler |
| `web/src/shared/` | Both | The rep data format + mock data. Change only together. |
| `ml/` | Farhan | Python script for training the form classifier |
| `docs/` | Both | Data contract, AI usage log, task list |

The two halves connect through **one function** (`startTracking` in `web/src/brain/index.js`)
and **one data format** (`docs/data-contract.md`). Until the real brain works, `startTracking`
sends fake reps from `shared/mockReps.js`, so the app can be built in parallel.

## Run it

```bash
cd web
npm install
npm run dev
```

Then open the URL it prints. Allow camera access when asked.

```bash
npm test        # unit tests for form rules, classifier loader, rep counter, accuracy math
npm run build   # production build into web/dist
```

Pages: Live Set, Dashboard, History, Labeler (label recorded reps), Accuracy (rep-count and
form-check accuracy on recorded videos). Add `?mock` to the URL to try the app without a camera.

## Deploy

Pushes to `main` build and publish to GitHub Pages (`.github/workflows/deploy.yml`). One-time setup:
repo Settings, Pages, Source: **GitHub Actions**. Camera access needs HTTPS, which Pages provides.

## Workflow

- `main` should always run.
- Work on a branch: `farhan/<thing>` or `jacob/<thing>`.
- Open a pull request; the other person skims it before merging.
- Tasks live in GitHub Issues (labels: `brain`, `app`, `shared`, `ml`). Full list: `docs/issues.md`.
- Training videos go in the shared Google Drive folder, **not** in git. Only `data/labels.csv` is committed.
- Log AI usage as you go in `docs/ai-log.md` — it's material for the report.
- Recording videos: `docs/recording-guide.md`. Demo: `docs/demo-script.md`. Report: `docs/report-outline.md`.
