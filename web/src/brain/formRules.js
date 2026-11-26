// Rule-based form checks for a finished rep. Flags must match RULE_FLAGS in shared/contract.js.
//   - "shallow":        hip didn't go below knee AND the knee didn't bend far enough
//   - "excessive_lean": max torso lean over a threshold
//   - "no_lockout":     went back down without returning to full standing

// Starting guesses. Tune them on real footage.
export const THRESHOLDS = {
  depthKneeAngle: 100, // a knee bent to this or less counts as deep enough
  maxTorsoLean: 45, // degrees from vertical
};

/**
 * @param {{ hitDepth: boolean, minKneeAngle: number, maxTorsoLean: number }} rep a finished rep
 * @param {{ lockedOut?: boolean|null }} [details] from the rep counter. `lockedOut` is null
 *   when a video ended mid-rep, so there's no way to tell and the rule stays quiet.
 * @returns {string[]} flags in RULE_FLAGS order; empty means a clean rep
 */
export function checkForm(rep, details = {}) {
  const flags = [];
  const deepEnough = rep.hitDepth || rep.minKneeAngle <= THRESHOLDS.depthKneeAngle;
  if (!deepEnough) flags.push("shallow");
  if (rep.maxTorsoLean > THRESHOLDS.maxTorsoLean) flags.push("excessive_lean");
  if (details.lockedOut === false) flags.push("no_lockout");
  return flags;
}
