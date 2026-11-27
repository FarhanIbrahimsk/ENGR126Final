# Task list

Mirror of the GitHub Issues. Labels: `brain` (Farhan), `app` (Jacob), `shared` (both), `ml` (Farhan).

## Week 1 — Oct 26 to Nov 1
- [x] `shared` Lock the data contract together (`docs/data-contract.md`)
- [x] `shared` Repo setup — both can run `npm run dev`
- [x] `brain` MediaPipe Pose running on the webcam (`pose.js`)
- [x] `brain` Skeleton overlay helper (`drawSkeleton`)
- [x] `brain` Knee angle + torso lean readout (`angles.js`)
- [x] `app` App shell + page navigation
- [x] `app` Live Set page layout using mock reps

## Week 2 — Nov 2 to Nov 8
- [x] `brain` Smoothing (`smoothing.js`)
- [x] `brain` Rep counter state machine (`repCounter.js`)
- [x] `brain` `startTracking()` sends real reps
- [x] `brain` Video-file mode
- [x] `app` Start/stop set flow, live rep count
- [x] `app` Save sets/sessions to IndexedDB

## Week 3 — Nov 9 to Nov 15
- [x] `brain` Form rules: depth, lean, lockout (`formRules.js`)
- [x] `app` Dashboard v1: set summary, per-rep flags
- [ ] `shared` Recording session #1 — see `docs/recording-guide.md`

## Week 4 — Nov 16 to Nov 22
- [x] `app` Labeling page: upload video, label reps good/bad + fault, export
- [ ] `ml` Label session #1 videos, build dataset
- [ ] `ml` Train classifier v1 + cross-person test — `python ml/train.py` is ready, waits on labeled reps
- [x] `app` History view + progress charts
- [ ] `shared` Recording session #2

## Week 5 — Nov 23 to Nov 29 (Thanksgiving, keep it light)
- [x] `brain` Run classifier in browser (`classifier.js`) — code done and tested with an invented model; needs a real one
- [x] `app` Show classifier results in UI, mobile layout fixes
- [ ] `shared` Accuracy testing: rep counts vs. video, confusion matrix — Accuracy page is built, waits on footage
- [x] `brain` Drop false reps (under 0.5s, or over 75° lean, e.g. walking back from the phone); loosen squat depth
- [x] `brain` Pushups: elbow angle and body bend, rep counting, form rules (shallow, hips sagging or piked, no lockout)
- [x] `app` Exercise switch on Live Set, History progress per exercise, tidier set summaries
- [x] `app` Spoken feedback on Live Set
- [x] `brain` Pushup fixes from phone testing: stricter pushup position, Get in position / Straighten arms hints. Works with the phone upright on the floor

## Week 6 — Nov 30 to Dec 4
- [ ] `shared` Buffer + bug fixes
- [ ] `shared` Retest the false-rep filter on a phone with squats
- [x] `shared` Deploy — GitHub Pages, publishes on every push to `main`
- [ ] `shared` Demo run-through + report — drafts in `docs/demo-script.md` and `docs/report-outline.md`
