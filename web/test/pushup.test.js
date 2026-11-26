import { test } from "node:test";
import assert from "node:assert/strict";

import { createRepCounter } from "../src/brain/repCounter.js";
import { checkForm } from "../src/brain/formRules.js";
import { elbowAngle, bodyBend } from "../src/brain/angles.js";
import { validateRep } from "../src/shared/contract.js";
import { mockPushupReps } from "../src/shared/mockReps.js";

// Feeds the pushup counter 200ms frames and collects the checked reps.
function session() {
  const reps = [];
  const counter = createRepCounter({
    lift: "pushup",
    onRep: (rep, details) => reps.push({ ...rep, ruleFlags: checkForm(rep, details) }),
  });
  let time = 0;
  const feed = (angles, { torsoLean = 90, bodyBend: bend = 5 } = {}) =>
    angles.forEach((angle) => counter.update({ elbowAngle: angle, torsoLean, bodyBend: bend, timestamp: (time += 200) }));
  return { reps, feed };
}

const TOP = [170, 170];
const REP = [130, 100, 80, 100, 130, 170];

test("a full pushup counts once and is clean", () => {
  const { reps, feed } = session();
  feed([...TOP, ...REP]);
  assert.equal(reps.length, 1);
  assert.equal(reps[0].lift, "pushup");
  assert.equal(reps[0].minElbowAngle, 80);
  assert.equal(reps[0].hitDepth, true);
  assert.deepEqual(reps[0].ruleFlags, []);
  assert.deepEqual(validateRep(reps[0]), []);
});

test("shallow, sagging and no-lockout pushups are flagged", () => {
  const shallow = session();
  shallow.feed([...TOP, 130, 125, 120, 135, 170]);
  assert.deepEqual(shallow.reps[0].ruleFlags, ["shallow"]);

  const sagging = session();
  sagging.feed(TOP);
  sagging.feed(REP, { bodyBend: 45 });
  assert.deepEqual(sagging.reps[0].ruleFlags, ["body_bend"]);

  const noLockout = session();
  noLockout.feed([...TOP, 130, 90, 80, 110, 130, 100, 80, 110, 170]);
  assert.equal(noLockout.reps.length, 2);
  assert.deepEqual(noLockout.reps[0].ruleFlags, ["no_lockout"]);
});

test("a pushup with soft lockout and a tilted body still counts", () => {
  const { reps, feed } = session();
  feed([143, 130, 108, 125, 143], { torsoLean: 50, bodyBend: 30 });
  assert.equal(reps.length, 1);
  assert.deepEqual(reps[0].ruleFlags, []);
});

test("arm bends while upright are not pushups", () => {
  const { reps, feed } = session();
  feed([...TOP, ...REP, ...REP], { torsoLean: 10 });
  assert.equal(reps.length, 0);
});

test("lowering into position doesn't count; arms have to be straight first", () => {
  const { reps, feed } = session();
  feed([90, 80, 100, 130, 145]);
  assert.equal(reps.length, 0);
  feed([...TOP, ...REP]);
  assert.equal(reps.length, 1);
  assert.equal(reps[0].rep, 1);
});

test("getting up mid-rep drops it, but a single bad frame doesn't", () => {
  const left = session();
  left.feed([...TOP, 130, 90]);
  left.feed([90, 90, 90, 90], { torsoLean: 20 });
  left.feed([130, 170]);
  assert.equal(left.reps.length, 0);

  const blip = session();
  blip.feed([...TOP, 130, 90]);
  blip.feed([90], { torsoLean: 20 });
  blip.feed([80, 110, 170]);
  assert.equal(blip.reps.length, 1);
});

test("elbow angle and body bend come from the visible side", () => {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const set = (i, x, y) => (landmarks[i] = { x, y, visibility: 1 });
  set(11, 0.2, 0.5); // shoulder
  set(13, 0.2, 0.7); // elbow
  set(15, 0.4, 0.7); // wrist: right angle at the elbow
  set(23, 0.5, 0.5); // hip
  set(27, 0.8, 0.5); // ankle: straight body
  assert.equal(Math.round(elbowAngle(landmarks)), 90);
  assert.equal(Math.round(bodyBend(landmarks)), 0);
  set(23, 0.5, 0.65); // sagging hips
  assert.ok(bodyBend(landmarks) > 35);
});

test("mock pushup reps match the contract", () => {
  mockPushupReps.forEach((rep) => assert.deepEqual(validateRep({ ...rep, startTime: 0 }), []));
});
