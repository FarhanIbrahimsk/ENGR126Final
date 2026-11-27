// The rep format both halves agree on. See docs/data-contract.md.
// Change this only together, in the same PR as the doc.

export const LIFTS = ["squat", "pushup"];
export const RULE_FLAGS = ["shallow", "excessive_lean", "body_bend", "no_lockout"];
// "away" and "setup" are pushup only: not in the pushup position, and waiting for straight arms.
export const PHASES = ["standing", "descending", "bottom", "ascending", "away", "setup"];

/**
 * Returns a list of problems with a rep object. Empty list = valid.
 * Use it in dev to catch format drift early.
 */
export function validateRep(rep) {
  const problems = [];
  const num = (k) => typeof rep[k] === "number" || problems.push(`${k} should be a number`);
  num("rep");
  num("startTime");
  num("durationMs");
  if (rep.lift === "pushup") {
    num("minElbowAngle");
    num("maxBodyBend");
  } else {
    num("minKneeAngle");
    num("maxTorsoLean");
  }
  if (!LIFTS.includes(rep.lift)) problems.push(`unknown lift: ${rep.lift}`);
  if (typeof rep.hitDepth !== "boolean") problems.push("hitDepth should be a boolean");
  if (!Array.isArray(rep.ruleFlags)) problems.push("ruleFlags should be an array");
  else rep.ruleFlags.filter((f) => !RULE_FLAGS.includes(f)).forEach((f) => problems.push(`unknown flag: ${f}`));
  if (rep.classifier !== null && typeof rep.classifier !== "object") problems.push("classifier should be an object or null");
  return problems;
}
