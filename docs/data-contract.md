# Data contract

The handoff between the brain (Farhan) and the app (Jacob). If either side needs to change
this, agree on it first, then update this file **and** `web/src/shared/contract.js` in the
same pull request.

## `startTracking(source, options)`

```js
import { startTracking } from "../brain";

const stop = await startTracking(videoElement, {
  lift: "squat",
  onFrame: (frame) => {}, // every frame
  onRep: (rep) => {},     // once per completed rep
});

stop(); // ends tracking, releases the camera
```

- `source` is a `<video>` element. For live mode it shows the webcam; for video-file mode it
  plays an uploaded file. The brain handles both the same way.
- `options.mode`: `"live"` (default) or `"file"`.
- `options.mock`: `true` sends fake reps instead of running the real brain.

## Rep (sent to `onRep`)

```json
{
  "rep": 3,
  "lift": "squat",
  "startTime": 1730000000000,
  "durationMs": 2400,
  "minKneeAngle": 82,
  "maxTorsoLean": 38,
  "hitDepth": true,
  "ruleFlags": ["excessive_lean"],
  "classifier": { "label": "bad", "confidence": 0.81 }
}
```

| Field | Type | Meaning |
|---|---|---|
| `rep` | number | Rep number within the set, starting at 1 |
| `lift` | string | `"squat"` for now |
| `startTime` | number | When the rep started, ms since epoch |
| `durationMs` | number | How long the rep took |
| `minKneeAngle` | number | Smallest knee angle in degrees (lower = deeper) |
| `maxTorsoLean` | number | Most forward lean, degrees from vertical |
| `hitDepth` | boolean | Hip went below knee |
| `ruleFlags` | string[] | Any of `"shallow"`, `"excessive_lean"`, `"no_lockout"`. Empty = clean rep |
| `classifier` | object or `null` | `null` until the trained model exists |

## Frame (sent to `onFrame`)

```json
{
  "timestamp": 1730000000016,
  "landmarks": [{ "x": 0.51, "y": 0.32, "z": -0.1, "visibility": 0.98 }],
  "kneeAngle": 165,
  "torsoLean": 12,
  "phase": "standing"
}
```

- `landmarks`: 33 MediaPipe body points, `x`/`y` from 0 to 1 across the video.
  Use `drawSkeleton(canvas, landmarks)` from the brain to draw the overlay.
- `phase`: one of `"standing"`, `"descending"`, `"bottom"`, `"ascending"`.

## Set and session (app side, stored by Jacob)

```json
{
  "id": "2026-11-03T18:05:00Z",
  "lift": "squat",
  "weightLbs": 135,
  "reps": [ /* Rep objects */ ]
}
```

A session is `{ "date": "...", "sets": [ /* Sets */ ] }`.
