# Report outline

Draft skeleton. Each section says where its material comes from. Numbers marked __ need real results.

1. **Problem and goal.** Squat form feedback without extra hardware. (README)
2. **System overview.** Camera, MediaPipe Pose, angles, rep counter, form rules, classifier, dashboard. Diagram of the pipeline and the split between `brain/` and `app/`. (README, `docs/data-contract.md`)
3. **Rep counting.** The state machine, the thresholds and why there are separate up and down ones, the jitter bug found by simulation (see `docs/ai-log.md`, 2026-11-05). Results: __ of __ videos exact, average miss __ reps. (Accuracy page, `accuracy.csv`)
4. **Form rules.** Shallow, lean, lockout; how the 45° lean limit was chosen and changed. (`formRules.js`, labeled reps)
5. **Classifier.** Data: __ reps from __ people, __% bad. Features. Logistic regression vs random forest. Cross-person test against the rules baseline and the majority baseline, with the confusion matrix. Why JSON weights instead of TensorFlow.js. (`ml/results.json`, `ml/train.py`)
6. **The app.** Live Set, Dashboard, History, Labeler, Accuracy; storage in IndexedDB; works on a phone. (screenshots)
7. **Limits and what failed.** Camera angle sensitivity, head out of frame, one lift only, small dataset, lockout isn't in the labels, no testing on very different body types or lighting.
8. **How we used AI.** What it wrote, what we checked, what it got wrong and how it was caught. Table from `docs/ai-log.md`.
9. **Division of work and timeline.**
10. **Next steps.**
