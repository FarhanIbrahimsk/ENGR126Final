# Task list

Mirror of the GitHub Issues. Labels: `brain` (Farhan), `app` (Jacob), `shared` (both), `ml` (Farhan).

## Week 1 — Oct 26 to Nov 1
- [ ] `shared` Lock the data contract together (`docs/data-contract.md`)
- [ ] `shared` Repo setup — both can run `npm run dev`
- [ ] `brain` MediaPipe Pose running on the webcam (`pose.js`)
- [ ] `brain` Skeleton overlay helper (`drawSkeleton`)
- [ ] `brain` Knee angle + torso lean readout (`angles.js`)
- [ ] `app` App shell + page navigation
- [ ] `app` Live Set page layout using mock reps

## Week 2 — Nov 2 to Nov 8
- [ ] `brain` Smoothing (`smoothing.js`)
- [ ] `brain` Rep counter state machine (`repCounter.js`)
- [ ] `brain` `startTracking()` sends real reps
- [ ] `brain` Video-file mode
- [ ] `app` Start/stop set flow, live rep count
- [ ] `app` Save sets/sessions to IndexedDB

## Week 3 — Nov 9 to Nov 15
- [ ] `brain` Form rules: depth, lean, lockout (`formRules.js`)
- [ ] `app` Dashboard v1: set summary, per-rep flags
- [ ] `shared` Recording session #1

## Week 4 — Nov 16 to Nov 22
- [ ] `app` Labeling page: upload video, label reps good/bad + fault, export
- [ ] `ml` Label session #1 videos, build dataset
- [ ] `ml` Train classifier v1 + cross-person test
- [ ] `app` History view + progress charts
- [ ] `shared` Recording session #2

## Week 5 — Nov 23 to Nov 29 (Thanksgiving, keep it light)
- [ ] `brain` Run classifier in browser (`classifier.js`)
- [ ] `app` Show classifier results in UI, mobile layout fixes
- [ ] `shared` Accuracy testing: rep counts vs. video, confusion matrix

## Week 6 — Nov 30 to Dec 4
- [ ] `shared` Buffer + bug fixes
- [ ] `shared` Deploy (GitHub Pages or Vercel)
- [ ] `shared` Demo run-through + report
