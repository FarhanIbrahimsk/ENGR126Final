// Rep detection state machine.
//   standing -> descending -> bottom -> ascending -> standing  = 1 rep
// "standing" means the top of the rep: legs straight for squats, arms straight for pushups.
// Separate up/down thresholds (hysteresis) so jitter near a cutoff doesn't double-count.
// Shallow reps (never reach BOTTOM) still count, so formRules can flag them.

const REVERSAL = 10; // degrees of change that count as switching direction
const MIN_ASCENT = 25; // must rise this far from the bottom before going back down ends a rep
// Anything outside the limits below isn't a rep (e.g. walking back from setting up the phone).
// It is dropped completely: not counted, not numbered, never saved.
const MIN_REP_MS = 500;
const MAX_SQUAT_LEAN = 75; // degrees from vertical
const PUSHUP_LEAN = { min: 55, max: 125 }; // 90 is a level body
const LEAVE_MS = 500; // out of the pushup position this long ends it; shorter is treated as jitter

// Each lift follows one joint angle through the same up-down-up cycle.
const LIFT_SETTINGS = {
  squat: {
    angle: (f) => f.kneeAngle,
    tilt: (f) => f.torsoLean,
    top: 160, // above this = locked out
    start: 150, // below this = rep has started
    bottom: 100,
    minDepth: 140, // dips that never go below this aren't reps
    deepEnough: (f) => f.hipBelowKnee,
    inPosition: () => true,
    needsTopFirst: false,
    isPlausible: (rep) => rep.maxTilt <= MAX_SQUAT_LEAN,
    fields: (rep) => ({ minKneeAngle: Math.round(rep.minAngle), maxTorsoLean: Math.round(rep.maxTilt) }),
  },
  pushup: {
    angle: (f) => f.elbowAngle,
    tilt: (f) => f.bodyBend,
    top: 150,
    start: 140,
    bottom: 100,
    minDepth: 120,
    deepEnough: (f) => f.elbowAngle <= 100,
    // Arm movements only count with the body close to level, so standing or kneeling upright doesn't.
    inPosition: (f) => f.torsoLean >= PUSHUP_LEAN.min && f.torsoLean <= PUSHUP_LEAN.max,
    // Getting down into position bends the arms too, so wait until they've been straight.
    needsTopFirst: true,
    isPlausible: () => true,
    fields: (rep) => ({ minElbowAngle: Math.round(rep.minAngle), maxBodyBend: Math.round(rep.maxTilt) }),
  },
};

/**
 * @param {{ lift?: "squat"|"pushup", onRep: (rep: object, details: { lockedOut: boolean|null }) => void }} options
 *   onRep gets a contract Rep (ruleFlags empty, classifier null) plus details for formRules.
 * @returns {{ update: (frame: object) => string, end: (timestamp: number) => void }}
 *   update takes { timestamp, torsoLean } plus kneeAngle and hipBelowKnee (squat) or elbowAngle
 *   and bodyBend (pushup), and returns the current phase; end closes out a video that stops mid-rep
 */
export function createRepCounter({ lift = "squat", onRep }) {
  const settings = LIFT_SETTINGS[lift];
  if (!settings) throw new Error(`Unknown lift: ${lift}`);

  let phase = "standing";
  let count = 0;
  let current = null; // stats for the rep in progress
  let peakOnAscent = 0;
  let ready = !settings.needsTopFirst;
  let awaySince = null;

  const reset = () => {
    current = null;
    phase = "standing";
    ready = !settings.needsTopFirst;
  };

  const begin = (f) => {
    current = { startTime: f.timestamp, minAngle: settings.angle(f), maxTilt: settings.tilt(f) ?? 0, hitDepth: false };
  };

  const finish = (f, lockedOut) => {
    const durationMs = f.timestamp - current.startTime;
    if (current.minAngle < settings.minDepth && durationMs >= MIN_REP_MS && settings.isPlausible(current)) {
      count++;
      onRep(
        {
          rep: count,
          lift,
          startTime: current.startTime,
          durationMs,
          ...settings.fields(current),
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
    const angle = settings.angle(f);
    if (angle == null) return phase;
    if (!settings.inPosition(f)) {
      awaySince ??= f.timestamp;
      if (f.timestamp - awaySince >= LEAVE_MS) reset();
      return phase;
    }
    awaySince = null;
    if (!ready) {
      ready = angle > settings.top;
      return phase;
    }
    if (current) {
      current.minAngle = Math.min(current.minAngle, angle);
      current.maxTilt = Math.max(current.maxTilt, settings.tilt(f) ?? 0);
      current.hitDepth ||= settings.deepEnough(f);
    }

    switch (phase) {
      case "standing":
        if (angle < settings.start) {
          begin(f);
          phase = "descending";
        }
        break;
      case "descending":
      case "bottom":
        if (angle < settings.bottom) phase = "bottom";
        if (angle > current.minAngle + REVERSAL) {
          if (current.minAngle < settings.minDepth) {
            phase = "ascending";
            peakOnAscent = angle;
          } else if (angle > settings.top) {
            current = null; // just a small dip, back to the top
            phase = "standing";
          }
        }
        break;
      case "ascending":
        peakOnAscent = Math.max(peakOnAscent, angle);
        if (angle > settings.top) {
          finish(f, true);
          phase = "standing";
        } else if (angle < peakOnAscent - REVERSAL) {
          if (peakOnAscent - current.minAngle < MIN_ASCENT) {
            // Jitter while pausing, not a real rise: still the same rep.
            phase = angle < settings.bottom ? "bottom" : "descending";
          } else {
            // Went back down without reaching the top: close this rep, start the next.
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
    if (phase === "ascending") finish({ timestamp }, null); // unknown: did it reach the top after the cut?
    reset();
  };

  return { update, end };
}
