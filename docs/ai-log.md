# AI usage log

Add an entry whenever AI wrote or changed something meaningful. Keep it short. This feeds
the "how we used AI" part of the report.

| Date | Who | Tool | What we asked for | What happened (worked / broke / what we fixed) |
|---|---|---|---|---|
| 2026-10-27 | Farhan | Claude Code | Scaffold repo structure, data contract, stubs | Starter layout + mock `startTracking` so the app can be built before the brain works |
| 2026-10-31 | Farhan | Claude Code | MediaPipe pose on webcam, skeleton overlay, wire real `startTracking` | Worked first try in the browser. Uses CDN for WASM/model (needs internet). Tested via a temporary Live Set edit, not committed |
| 2026-10-31 | Farhan | Claude Code | Knee angle + torso lean (`angles.js`) | Angles mostly right but jumped ±10° standing still. Corrects for video aspect ratio, since landmark x/y are scaled separately |
| 2026-10-31 | Farhan | Claude Code | Fix jitter; detect body when head is out of frame | Added One Euro filter on landmarks (pulled wk2 smoothing forward), much steadier live. Lowered detection thresholds 0.5→0.3; head-out-of-frame is a model limit, so the real fix is camera setup |
| 2026-11-05 | Farhan | Claude Code | Check the rep counter before committing | Simulated knee-angle sequences found over-counting when pausing mid-squat with jitter (6 reps instead of 1). Fixed by requiring a 25° rise before a reversal ends a rep |
| 2026-11-05 | Farhan | Claude Code | IndexedDB storage for sets and sessions (`db.js`) | Passed tests against a simulated IndexedDB in three time zones; not yet tried in a real browser or connected to a page. Sessions use the local date so evening workouts stay on the right day |
| 2026-11-05 | Farhan | Claude Code | Live Set page: real tracking, live rep count, save each set | Passed headless Chromium checks using mock reps and real IndexedDB; real mode only ran with a fake camera, so rep counting on a person is still untested. Also saves if you leave the page mid-set |
| 2026-11-05 | Farhan | Claude Code | Video-file mode for `startTracking` | Rep timing now follows video time, added `onEnd`, and a rep cut off on the way up still counts. Passed browser tests with a generated clip and scripted pose data; not yet run on real squat footage |
| 2026-11-05 | Farhan | Claude Code | Dashboard v1: set summary and per-rep flags | Passed headless browser tests with seeded sets, including phone width. Flags stay empty until form rules exist, so the page shows "None" rather than calling reps clean |
| 2026-11-05 | Farhan | Claude Code | History page: past sessions and progress charts | Hand-built SVG line charts, no chart library. Passed headless browser tests with seeded sessions, checked screenshots at desktop and phone width. Not yet tried with real workout data |
