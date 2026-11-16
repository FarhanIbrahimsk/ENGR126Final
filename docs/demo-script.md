# Demo script (about 5 minutes)

Draft. Fill in the numbers once real results exist, and rehearse it on the deployed URL, not localhost.

## Before you start
- Open the deployed site on a laptop and a phone. Allow the camera on both.
- Stand so the camera sees you side-on, full body. Do a 10-second test rep to check tracking.
- Have a backup: add `?mock` to the URL for fake reps if the camera or network fails.
- Have the Accuracy page results and the confusion matrix ready to show.

## Flow
1. **The problem (30s).** Lifting alone, nobody tells you if your squat is deep enough or if you're leaning. No extra hardware here: just a camera.
2. **Live Set (90s).** Enter a weight, Start set, do 3 good reps and 1 deliberately shallow rep. Point out the skeleton, the live knee angle and lean, and that the rep count and flags appear as each rep ends. Stop the set; it saves.
3. **Dashboard (45s).** Show the set summary and the per-rep flags and classifier verdict for the shallow rep.
4. **History (30s).** Progress charts across sessions.
5. **How it works (60s).** Pose model finds the joints, angles are computed, a state machine counts reps, rules flag faults, a small trained classifier judges good vs bad. Everything runs in the browser; no video leaves the device.
6. **How well it works (60s).** Rep-count accuracy: __ of __ videos exact. Classifier on a person it never saw: __% (rules alone: __%). Show the confusion matrix and say where it fails.
7. **Wrap (15s).** What we'd do next: more lifts, more people, better camera-angle handling.

## If something breaks
- Camera blocked: use the Labeler or Accuracy page with a recorded video, or `?mock`.
- Tracking is wobbly: check the head and feet are in frame and the light is even.
- Classifier shows "-": the model file is missing from `web/public/models/`; the rules still work.
