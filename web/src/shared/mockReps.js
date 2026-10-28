// Fake reps in the contract format, so the app can be built before the brain works.

export const mockReps = [
  { rep: 1, lift: "squat", durationMs: 2200, minKneeAngle: 78, maxTorsoLean: 28, hitDepth: true, ruleFlags: [], classifier: null },
  { rep: 2, lift: "squat", durationMs: 2350, minKneeAngle: 81, maxTorsoLean: 31, hitDepth: true, ruleFlags: [], classifier: null },
  { rep: 3, lift: "squat", durationMs: 2500, minKneeAngle: 96, maxTorsoLean: 33, hitDepth: false, ruleFlags: ["shallow"], classifier: null },
  { rep: 4, lift: "squat", durationMs: 2700, minKneeAngle: 84, maxTorsoLean: 47, hitDepth: true, ruleFlags: ["excessive_lean"], classifier: { label: "bad", confidence: 0.74 } },
  { rep: 5, lift: "squat", durationMs: 3100, minKneeAngle: 101, maxTorsoLean: 49, hitDepth: false, ruleFlags: ["shallow", "excessive_lean"], classifier: { label: "bad", confidence: 0.88 } },
];
