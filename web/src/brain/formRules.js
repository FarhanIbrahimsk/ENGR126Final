// Rule-based form checks for a finished rep. Flags must match RULE_FLAGS in shared/contract.js.
//   - "shallow":        squat: hip didn't go below knee AND the knee didn't bend far enough
//                       pushup: elbow didn't bend far enough
//   - "excessive_lean": squat: max torso lean over a threshold
//   - "body_bend":      pushup: hips sagged or piked
//   - "no_lockout":     went back down without fully straightening at the top

// Starting guesses. Tune them on real footage.
export const THRESHOLDS = {
  depthKneeAngle: 100, // a knee bent to this or less counts as deep enough
  maxTorsoLean: 45, // degrees from vertical
  maxBodyBend: 25, // degrees away from a straight shoulder-hip-ankle line
};

/**
 * @param {{ lift?: string, hitDepth: boolean, minKneeAngle?: number, maxTorsoLean?: number,
 *   maxBodyBend?: number }} rep a finished rep; no lift means squat
 * @param {{ lockedOut?: boolean|null }} [details] from the rep counter. `lockedOut` is null
 *   when a video ended mid-rep, so there's no way to tell and the rule stays quiet.
 * @returns {string[]} flags in RULE_FLAGS order; empty means a clean rep
 */
export function checkForm(rep, details = {}) {
  const flags = [];
  if (rep.lift === "pushup") {
    if (!rep.hitDepth) flags.push("shallow");
    if (rep.maxBodyBend > THRESHOLDS.maxBodyBend) flags.push("body_bend");
  } else {
    const deepEnough = rep.hitDepth || rep.minKneeAngle <= THRESHOLDS.depthKneeAngle;
    if (!deepEnough) flags.push("shallow");
    if (rep.maxTorsoLean > THRESHOLDS.maxTorsoLean) flags.push("excessive_lean");
  }
  if (details.lockedOut === false) flags.push("no_lockout");
  return flags;
}
