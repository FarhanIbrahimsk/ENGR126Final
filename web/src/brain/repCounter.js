// Rep detection state machine.
//   standing -> descending -> bottom -> ascending -> standing  = 1 rep
// Separate up/down thresholds (hysteresis) so jitter near a cutoff doesn't double-count.
// Shallow reps (never reach BOTTOM) still count, so formRules can flag them.

const STANDING = 160; // knee above this = standing / locked out
const DESCEND_START = 150; // knee below this = rep has started
const BOTTOM = 100; // knee below this = at the bottom
const MIN_REP_DEPTH = 140; // dips that never go below this aren't reps
const REVERSAL = 10; // degrees of change that count as switching direction
const MIN_ASCENT = 25; // must rise this far from the bottom before going back down ends a rep
// Anything outside these isn't a squat (e.g. walking back from setting up the phone). It is
// dropped completely: not counted, not numbered, never saved.
const MIN_REP_MS = 500;
const MAX_PLAUSIBLE_LEAN = 75; // degrees from vertical

/**
 * @param {{ lift?: string, onRep: (rep: object, details: { lockedOut: boolean|null }) => void }} options
 *   onRep gets a contract Rep (ruleFlags empty, classifier null) plus details for formRules.
 * @returns {{ update: (frame: { kneeAngle: number, torsoLean: number, hipBelowKnee: boolean,
 *   timestamp: number }) => string, end: (timestamp: number) => void }}
 *   update returns the current phase; end closes out a video that stops mid-rep
 */
export function createRepCounter({ lift = "squat", onRep }) {
  let phase = "standing";
  let count = 0;
  let current = null; // stats for the rep in progress
  let peakOnAscent = 0;

  const begin = (f) => {
    current = { startTime: f.timestamp, minKnee: f.kneeAngle, maxLean: f.torsoLean, hitDepth: false };
  };

  const finish = (f, lockedOut) => {
    const durationMs = f.timestamp - current.startTime;
    const isAttempt = current.minKnee < MIN_REP_DEPTH && durationMs >= MIN_REP_MS && current.maxLean <= MAX_PLAUSIBLE_LEAN;
    if (isAttempt) {
      count++;
      onRep(
        {
          rep: count,
          lift,
          startTime: current.startTime,
          durationMs,
          minKneeAngle: Math.round(current.minKnee),
          maxTorsoLean: Math.round(current.maxLean),
          hitDepth: current.hitDepth,
          ruleFlags: [],
          classifier: null,
        },
        { lockedOut }
      );
    }
    current = null;
  };

  const update = (f) => {
    if (f.kneeAngle == null) return phase;
    const knee = f.kneeAngle;
    if (current) {
      current.minKnee = Math.min(current.minKnee, knee);
      current.maxLean = Math.max(current.maxLean, f.torsoLean ?? 0);
      current.hitDepth ||= f.hipBelowKnee;
    }

    switch (phase) {
      case "standing":
        if (knee < DESCEND_START) {
          begin(f);
          phase = "descending";
        }
        break;
      case "descending":
      case "bottom":
        if (knee < BOTTOM) phase = "bottom";
        if (knee > current.minKnee + REVERSAL) {
          if (current.minKnee < MIN_REP_DEPTH) {
            phase = "ascending";
            peakOnAscent = knee;
          } else if (knee > STANDING) {
            current = null; // just a small dip, back to standing
            phase = "standing";
          }
        }
        break;
      case "ascending":
        peakOnAscent = Math.max(peakOnAscent, knee);
        if (knee > STANDING) {
          finish(f, true);
          phase = "standing";
        } else if (knee < peakOnAscent - REVERSAL) {
          if (peakOnAscent - current.minKnee < MIN_ASCENT) {
            // Jitter while pausing, not a real rise: still the same rep.
            phase = knee < BOTTOM ? "bottom" : "descending";
          } else {
            // Went back down without standing up: close this rep, start the next.
            finish(f, false);
            begin(f);
            phase = "descending";
          }
        }
        break;
    }
    return phase;
  };

  // Count a rep the video cut off on the way up; one still going down isn't a rep yet.
  const end = (timestamp) => {
    if (phase === "ascending") finish({ timestamp }, null); // unknown: did it stand up after the cut?
    current = null;
    phase = "standing";
  };

  return { update, end };
}
