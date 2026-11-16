import { test } from "node:test";
import assert from "node:assert/strict";
import { confusionMatrix, countAccuracy } from "../src/app/components/metrics.js";

test("confusion matrix counts each true/predicted pair", () => {
  const pairs = [
    { truth: "good", predicted: "good" },
    { truth: "good", predicted: "good" },
    { truth: "good", predicted: "bad" },
    { truth: "bad", predicted: "bad" },
  ];
  const result = confusionMatrix(pairs);
  assert.deepEqual(result.matrix, [[2, 1], [0, 1]]);
  assert.equal(result.accuracy, 0.75);
  assert.equal(result.goodRecall, 2 / 3);
  assert.equal(result.badRecall, 1);
});

test("an empty or one-sided matrix gives null instead of dividing by zero", () => {
  const empty = confusionMatrix([]);
  assert.equal(empty.accuracy, null);
  const onlyGood = confusionMatrix([{ truth: "good", predicted: "good" }]);
  assert.equal(onlyGood.badRecall, null);
  assert.equal(onlyGood.goodRecall, 1);
});

test("count accuracy reports exact, within one, and average miss", () => {
  const a = countAccuracy([
    { expected: 5, counted: 5 },
    { expected: 5, counted: 6 },
    { expected: 8, counted: 5 },
  ]);
  assert.equal(a.videos, 3);
  assert.equal(a.exact, 1);
  assert.equal(a.withinOne, 2);
  assert.equal(a.meanAbsError, 4 / 3);
  assert.equal(a.expected, 18);
  assert.equal(a.counted, 16);
  assert.equal(countAccuracy([]).meanAbsError, null);
});
