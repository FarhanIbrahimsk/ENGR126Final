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
- `options.mode`: `"live"` (default) or `"file"`. For `"file"`, set `video.src` first; tracking
  starts the video from its current position. Don't seek while it's running.
- `options.onEnd`: called once when a video file finishes, after any final rep. Still call
  `stop()` afterwards.
- `options.mock`: `true` sends fake reps instead of running the real brain.

The brain also exports `checkForm(rep, details)` and `loadClassifier()`. The Accuracy page uses them
to score saved labeled reps; the app doesn't need them to track a set.

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
| `lift` | string | `"squat"` or `"pushup"` |
| `startTime` | number | When the rep started, ms since epoch |
| `durationMs` | number | How long the rep took |
| `minKneeAngle` | number | Squat only. Smallest knee angle in degrees (lower = deeper) |
| `maxTorsoLean` | number | Squat only. Most forward lean, degrees from vertical |
| `minElbowAngle` | number | Pushup only. Smallest elbow angle in degrees (lower = deeper) |
| `maxBodyBend` | number | Pushup only. Furthest shoulder-hip-ankle got from a straight line, degrees |
| `hitDepth` | boolean | Squat: hip went below knee. Pushup: elbow bent to 110° or less |
| `ruleFlags` | string[] | Any of `"shallow"`, `"excessive_lean"`, `"body_bend"`, `"no_lockout"`. Empty = clean rep |
| `classifier` | object or `null` | `{ label: "good" \| "bad", confidence: 0.5 to 1 }`. `null` if there is no trained model yet |

Movements shorter than 0.5s, or with torso lean over 75°, are not reps (walking, setting up the phone).
The brain drops them, so `onRep` never sees them.

Pushups only count in the pushup position (`pushupPosition` below), and only after the arms have been
straight once, so getting into position isn't a rep.

The classifier is squat only; pushup reps always have `classifier: null`.

Rule flags (`web/src/brain/formRules.js`):

| Flag | Raised when |
|---|---|
| `shallow` | squat: the hip never went below the knee (`hitDepth` is false) **and** `minKneeAngle` is over 100°. Pushup: `hitDepth` is false |
| `body_bend` | pushup only: `maxBodyBend` is over 35° (hips sagging or piked) |
| `excessive_lean` | `maxTorsoLean` is over 45° (a starting guess; tune on real footage) |
| `no_lockout` | the lifter went back down without standing up. Not raised for the last rep of a video that ends mid-rep, since there's no way to tell |

The classifier reads `minKneeAngle`, `maxTorsoLean`, `hitDepth` and `durationMs` from the model file's
feature list, so it can only use fields that are in the Rep.

## Frame (sent to `onFrame`)

```json
{
  "timestamp": 1730000000016,
  "landmarks": [{ "x": 0.51, "y": 0.32, "z": -0.1, "visibility": 0.98 }],
  "kneeAngle": 165,
  "torsoLean": 12,
  "elbowAngle": 172,
  "bodyBend": 6,
  "pushupPosition": true,
  "phase": "standing"
}
```

- `landmarks`: 33 MediaPipe body points, `x`/`y` from 0 to 1 across the video.
  Use `drawSkeleton(canvas, landmarks)` from the brain to draw the overlay.
- `pushupPosition`: the near side's shoulder, elbow, wrist, hip and knee are clearly visible, torso and thigh
  are each within 50° of level, the body is within 60° of straight at the hip, and the wrist is below the
  shoulder. Standing, bending over and kneeling are not. It needs an upright picture: someone standing in a
  sideways picture looks like they're lying down.
- `phase`: one of `"standing"` (the top of a rep, for either lift), `"descending"`, `"bottom"`, `"ascending"`.
  Pushups can also be `"away"` (not in the pushup position) or `"setup"` (in position, arms not yet straight).
- `startTracking` takes `rotation: () => 0 | 90 | 180 | 270` to turn each frame clockwise before reading the
  pose, for a camera whose picture comes in sideways or upside down. Landmarks then match the turned picture.

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
