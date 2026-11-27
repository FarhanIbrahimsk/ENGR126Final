import { test } from "node:test";
import assert from "node:assert/strict";

import { createRepCounter } from "../src/brain/repCounter.js";
import { checkForm } from "../src/brain/formRules.js";
import { elbowAngle, bodyBend, pushupPosition } from "../src/brain/angles.js";
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
  const phases = [];
  const feed = (angles, { inPosition = true, bodyBend: bend = 5 } = {}) =>
    angles.forEach((angle) =>
      phases.push(counter.update({ elbowAngle: angle, pushupPosition: inPosition, bodyBend: bend, timestamp: (time += 200) }))
    );
  return { reps, feed, phases };
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

test("a pushup with soft lockout and some body bend still counts", () => {
  const { reps, feed } = session();
  feed([143, 130, 108, 125, 143], { bodyBend: 30 });
  assert.equal(reps.length, 1);
  assert.deepEqual(reps[0].ruleFlags, []);
});

test("arm bends out of the pushup position are not pushups, and the phase says so", () => {
  const { reps, feed, phases } = session();
  feed([...TOP, ...REP, ...REP], { inPosition: false });
  assert.equal(reps.length, 0);
  assert.ok(phases.every((p) => p === "away"));
});

test("in position with bent arms waits for straight arms first", () => {
  const { feed, phases } = session();
  feed([100, 120]);
  assert.deepEqual(phases, ["setup", "setup"]);
  feed([170]);
  assert.equal(phases.at(-1), "standing");
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
  left.feed([90, 90, 90, 90], { inPosition: false });
  left.feed([130, 170]);
  assert.equal(left.reps.length, 0);

  const blip = session();
  blip.feed([...TOP, 130, 90]);
  blip.feed([90], { inPosition: false });
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

// Side view, facing right, image y grows downward. Points not given are hidden.
function pose(points, visibility = 1) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const index = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
  for (const [name, [x, y]] of Object.entries(points)) landmarks[index[name]] = { x, y, visibility };
  return landmarks;
}

const PLANK_TOP = { shoulder: [0.7, 0.4], elbow: [0.69, 0.55], wrist: [0.7, 0.7], hip: [0.45, 0.52], knee: [0.3, 0.6], ankle: [0.15, 0.68] };
const PLANK_BOTTOM = { shoulder: [0.7, 0.62], elbow: [0.6, 0.58], wrist: [0.68, 0.7], hip: [0.45, 0.64], knee: [0.3, 0.66], ankle: [0.15, 0.68] };

test("pushup position: the top and bottom of a pushup", () => {
  assert.equal(pushupPosition(pose(PLANK_TOP)), true);
  assert.equal(pushupPosition(pose(PLANK_BOTTOM)), true);
  const sagging = { ...PLANK_BOTTOM, hip: [0.45, 0.72] };
  assert.equal(pushupPosition(pose(sagging)), true); // still counts; body_bend flags it
});

test("pushup position: standing, bending over the phone and kneeling are not", () => {
  const standing = { shoulder: [0.5, 0.3], elbow: [0.55, 0.42], wrist: [0.62, 0.36], hip: [0.5, 0.55], knee: [0.5, 0.75], ankle: [0.5, 0.95] };
  const bentOver = { shoulder: [0.72, 0.5], elbow: [0.73, 0.62], wrist: [0.78, 0.72], hip: [0.5, 0.52], knee: [0.5, 0.75], ankle: [0.5, 0.95] };
  const allFours = { shoulder: [0.7, 0.45], elbow: [0.7, 0.58], wrist: [0.7, 0.7], hip: [0.4, 0.45], knee: [0.4, 0.7], ankle: [0.2, 0.7] };
  assert.equal(pushupPosition(pose(standing)), false);
  assert.equal(pushupPosition(pose(bentOver)), false);
  assert.equal(pushupPosition(pose(allFours)), false);
});

test("pushup position: lying with hands by the sides, or hidden arms, is not", () => {
  // Also what standing with arms down looks like in a sideways picture.
  const lying = { shoulder: [0.7, 0.6], elbow: [0.56, 0.61], wrist: [0.43, 0.6], hip: [0.45, 0.6], knee: [0.3, 0.6], ankle: [0.15, 0.6] };
  assert.equal(pushupPosition(pose(lying)), false);
  assert.equal(pushupPosition(pose(PLANK_TOP, 0.3)), false);
  const { wrist, ...noWrist } = PLANK_TOP;
  assert.equal(pushupPosition(pose(noWrist)), false);
});

test("mock pushup reps match the contract", () => {
  mockPushupReps.forEach((rep) => assert.deepEqual(validateRep({ ...rep, startTime: 0 }), []));
});
