# Demo script (about 5 minutes)

Draft. Fill in the numbers once real results exist, and rehearse it on the deployed URL, not localhost.

## Before you start
- Open the deployed site on a laptop and a phone. Allow the camera on both.
- Squats: stand so the camera sees you side-on, full body. Do a 10-second test rep to check tracking.
- Pushups: stand the phone upright (portrait) on the floor, side-on, with your whole body in frame. Check the
  phase label says "top" once you're in a plank with straight arms.
- Turn the volume up and check Voice is on, so the room hears the spoken feedback.
- Have a backup: add `?mock` to the URL for fake reps if the camera or network fails.
- Have the Accuracy page results and the confusion matrix ready to show.

## Flow
1. **The problem (20s).** Training alone, nobody tells you if your squat is deep enough, if you're leaning, or if your hips sag in a pushup. No extra hardware here: just a camera.
2. **Live Set, squats (70s).** Enter a weight, Start set, do 3 good reps and 1 deliberately shallow rep. Point out the skeleton, the live knee angle and lean, and that the rep count and flags appear, and are spoken, as each rep ends. Stop the set; it saves.
3. **Live Set, pushups (45s).** Switch Exercise to Pushup. While you get down the label says "Get in position"; nothing counts until you're in a plank with straight arms. Do 2 good pushups and 1 with sagging hips; the voice says "Keep your body straight". Stop the set.
4. **Dashboard (30s).** Show both set summaries, the per-rep flags, and the classifier verdict for the shallow squat.
5. **History (20s).** Progress charts across sessions, per exercise.
6. **How it works (45s).** Pose model finds the joints, angles are computed (knee for squats, elbow and body line for pushups), a state machine counts reps, rules flag faults, a small trained classifier judges squats good vs bad. Everything runs in the browser; no video leaves the device.
7. **How well it works (55s).** Rep-count accuracy: squats __ of __ videos exact, pushups __ of __. Classifier on a person it never saw: __% (rules alone: __%). Show the confusion matrix and say where it fails.
8. **Wrap (15s).** What we'd do next: more lifts, more people, a classifier for pushups, better camera-angle handling.

## If something breaks
- Camera blocked: use the Labeler or Accuracy page with a recorded video, or `?mock`.
- Tracking is wobbly: check the head and feet are in frame and the light is even.
- Pushups stuck on "Get in position": the phone must be upright on the floor, side-on, with your whole body in frame.
- Classifier shows "-": the model file is missing from `web/public/models/`; the rules still work.
