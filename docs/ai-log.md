# AI usage log

Add an entry whenever AI wrote or changed something meaningful. Keep it short. This feeds
the "how we used AI" part of the report.

| Date | Who | Tool | What we asked for | What happened (worked / broke / what we fixed) |
|---|---|---|---|---|
| 2026-10-27 | Farhan | Claude Code | Scaffold repo structure, data contract, stubs | Starter layout + mock `startTracking` so the app can be built before the brain works |
| 2026-10-31 | Farhan | Claude Code | MediaPipe pose on webcam, skeleton overlay, wire real `startTracking` | Worked first try in the browser. Uses CDN for WASM/model (needs internet). Tested via a temporary Live Set edit, not committed |
| 2026-10-31 | Farhan | Claude Code | Knee angle + torso lean (`angles.js`) | Angles mostly right but jumped ±10° standing still. Corrects for video aspect ratio, since landmark x/y are scaled separately |
| 2026-10-31 | Farhan | Claude Code | Fix jitter; detect body when head is out of frame | Added One Euro filter on landmarks (pulled wk2 smoothing forward), much steadier live. Lowered detection thresholds 0.5→0.3; head-out-of-frame is a model limit, so the real fix is camera setup |
