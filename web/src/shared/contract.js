// The rep format both halves agree on. See docs/data-contract.md.
// Change this only together, in the same PR as the doc.

export const LIFTS = ["squat"];
export const RULE_FLAGS = ["shallow", "excessive_lean", "no_lockout"];
export const PHASES = ["standing", "descending", "bottom", "ascending"];

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
  num("minKneeAngle");
  num("maxTorsoLean");
  if (!LIFTS.includes(rep.lift)) problems.push(`unknown lift: ${rep.lift}`);
  if (typeof rep.hitDepth !== "boolean") problems.push("hitDepth should be a boolean");
  if (!Array.isArray(rep.ruleFlags)) problems.push("ruleFlags should be an array");
  else rep.ruleFlags.filter((f) => !RULE_FLAGS.includes(f)).forEach((f) => problems.push(`unknown flag: ${f}`));
  if (rep.classifier !== null && typeof rep.classifier !== "object") problems.push("classifier should be an object or null");
  return problems;
}
