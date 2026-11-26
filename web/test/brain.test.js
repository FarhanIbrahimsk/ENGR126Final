// Run with: npm test  (Node's built-in test runner, no extra packages)
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkForm } from "../src/brain/formRules.js";
import { checkModel, predict, loadClassifier } from "../src/brain/classifier.js";
import { createRepCounter } from "../src/brain/repCounter.js";
import { RULE_FLAGS } from "../src/shared/contract.js";

const rep = (over = {}) => ({ hitDepth: true, minKneeAngle: 110, maxTorsoLean: 30, ...over });

test("a clean rep has no flags", () => {
  assert.deepEqual(checkForm(rep(), { lockedOut: true }), []);
});

test("each rule flags on its own, in contract order", () => {
  assert.deepEqual(checkForm(rep({ hitDepth: false }), { lockedOut: true }), ["shallow"]);
  assert.deepEqual(checkForm(rep({ maxTorsoLean: 60 }), { lockedOut: true }), ["excessive_lean"]);
  assert.deepEqual(checkForm(rep(), { lockedOut: false }), ["no_lockout"]);
  const all = checkForm(rep({ hitDepth: false, maxTorsoLean: 60 }), { lockedOut: false });
  assert.deepEqual(all, RULE_FLAGS.filter((f) => f !== "body_bend")); // body_bend is pushups only
});

test("lean exactly at the limit is fine, and unknown lockout is not a fault", () => {
  assert.deepEqual(checkForm(rep({ maxTorsoLean: 45 }), { lockedOut: null }), []);
  assert.deepEqual(checkForm(rep()), []);
});

test("a knee bent to 100 degrees is deep enough even if the hip stays above the knee", () => {
  assert.deepEqual(checkForm(rep({ hitDepth: false, minKneeAngle: 100 })), []);
  assert.deepEqual(checkForm(rep({ hitDepth: false, minKneeAngle: 101 })), ["shallow"]);
});

// Drive the rep counter with a knee-angle curve, like the video pipeline does.
function run(kneeAngles, { endAtEnd = false } = {}) {
  const out = [];
  const counter = createRepCounter({ onRep: (r, details) => out.push({ r, details }) });
  kneeAngles.forEach((knee, i) => counter.update({ kneeAngle: knee, torsoLean: 20, hipBelowKnee: knee < 100, timestamp: i * 100 }));
  if (endAtEnd) counter.end(kneeAngles.length * 100);
  return out;
}
const down = [170, 150, 120, 90, 70];
const up = [90, 120, 150, 170];

test("a full rep reports lockout, a rep with no stand-up between does not", () => {
  const full = run([...down, ...up]);
  assert.equal(full.length, 1);
  assert.equal(full[0].details.lockedOut, true);

  const bounce = run([...down, 100, 130, 100, 70, ...up]);
  assert.equal(bounce[0].details.lockedOut, false);
});

test("a video cut mid-ascent counts the rep but leaves lockout unknown", () => {
  const cut = run([...down, 100, 125], { endAtEnd: true });
  assert.equal(cut.length, 1);
  assert.equal(cut[0].details.lockedOut, null);
  assert.deepEqual(checkForm(cut[0].r, cut[0].details).includes("no_lockout"), false);
});

test("movements too quick or too bent over to be a squat are dropped and don't use a rep number", () => {
  const out = [];
  const counter = createRepCounter({ onRep: (r) => out.push(r) });
  let time = 0;
  const move = (step, lean) =>
    [...down, ...up].forEach((knee) => counter.update({ kneeAngle: knee, torsoLean: lean, hipBelowKnee: true, timestamp: (time += step) }));
  move(40, 20); // 0.24s
  move(300, 100); // bent right over, like picking up the phone
  assert.equal(out.length, 0);
  move(300, 30);
  assert.equal(out.length, 1);
  assert.equal(out[0].rep, 1);
});

const logistic = {
  type: "logistic",
  features: ["minKneeAngle", "hitDepth"],
  mean: [90, 0.5],
  scale: [10, 0.5],
  coef: [1, -2],
  intercept: 0,
};

test("logistic model: deep rep is good, shallow rep is bad", () => {
  checkModel(logistic);
  const deep = predict(logistic, { minKneeAngle: 70, hitDepth: true });
  const shallow = predict(logistic, { minKneeAngle: 110, hitDepth: false });
  assert.equal(deep.label, "good");
  assert.equal(shallow.label, "bad");
  assert.ok(deep.confidence > 0.5 && deep.confidence <= 1);
});

test("logistic model matches a hand calculation", () => {
  // z = 1*(100-90)/10 + -2*(0-0.5)/0.5 = 1 + 2 = 3, p(bad) = 1/(1+e^-3)
  const result = predict(logistic, { minKneeAngle: 100, hitDepth: false });
  assert.equal(result.label, "bad");
  assert.equal(result.confidence, Math.round((1 / (1 + Math.exp(-3))) * 100) / 100);
});

const forest = {
  type: "forest",
  features: ["maxTorsoLean"],
  trees: [
    { feature: [0, -2, -2], threshold: [45, -2, -2], left: [1, -1, -1], right: [2, -1, -1], value: [0.5, 0.1, 0.9] },
    { feature: [0, -2, -2], threshold: [40, -2, -2], left: [1, -1, -1], right: [2, -1, -1], value: [0.5, 0.2, 1] },
  ],
};

test("forest model averages its trees", () => {
  checkModel(forest);
  assert.deepEqual(predict(forest, { maxTorsoLean: 30 }), { label: "good", confidence: 0.85 });
  assert.deepEqual(predict(forest, { maxTorsoLean: 42 }), { label: "bad", confidence: 0.55 });
  assert.deepEqual(predict(forest, { maxTorsoLean: 50 }), { label: "bad", confidence: 0.95 });
});

test("a rep missing a feature gets no prediction", () => {
  assert.equal(predict(logistic, { hitDepth: true }), null);
});

test("checkModel rejects broken files", () => {
  assert.throws(() => checkModel(null));
  assert.throws(() => checkModel({ type: "magic", features: ["a"] }));
  assert.throws(() => checkModel({ ...logistic, coef: [1] }));
  assert.throws(() => checkModel({ ...logistic, intercept: NaN }));
  assert.throws(() => checkModel({ ...forest, trees: [] }));
  const loop = { ...forest, trees: [{ ...forest.trees[0], left: [0, -1, -1] }] };
  assert.throws(() => checkModel(loop), /points outside/);
  const badLeaf = { ...forest, trees: [{ ...forest.trees[0], value: [0.5, 2, 0.9] }] };
  assert.throws(() => checkModel(badLeaf), /probabilities/);
});

function fakeFetch(response) {
  globalThis.fetch = async () => response;
}

test("loadClassifier gives a null classifier when there is no usable model", async () => {
  const sample = { minKneeAngle: 70, hitDepth: true };
  fakeFetch({ ok: false });
  assert.equal((await loadClassifier("x"))(sample), null);
  fakeFetch({ ok: true, text: async () => "<!doctype html>" }); // dev server's fallback page
  assert.equal((await loadClassifier("x"))(sample), null);
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  assert.equal((await loadClassifier("x"))(sample), null);

  const warn = console.warn;
  console.warn = () => {};
  fakeFetch({ ok: true, text: async () => JSON.stringify({ type: "logistic", features: ["a"] }) });
  assert.equal((await loadClassifier("x"))(sample), null);
  console.warn = warn;
});

test("loadClassifier returns a working classifier for a good model", async () => {
  fakeFetch({ ok: true, text: async () => JSON.stringify(logistic) });
  const classify = await loadClassifier("x");
  assert.equal(classify({ minKneeAngle: 70, hitDepth: true }).label, "good");
});
