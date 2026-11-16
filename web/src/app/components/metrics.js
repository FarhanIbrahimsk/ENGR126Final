// Accuracy numbers for the Accuracy page. Pure functions, so they're easy to test.

/**
 * @param {{ truth: "good"|"bad", predicted: "good"|"bad" }[]} pairs
 * @returns {{ matrix: number[][], total: number, accuracy: number|null,
 *   goodRecall: number|null, badRecall: number|null }}
 *   matrix rows are the true label and columns the prediction, good first:
 *   [[good->good, good->bad], [bad->good, bad->bad]]. Recall is the share of that class caught.
 */
export function confusionMatrix(pairs) {
  const matrix = [
    [0, 0],
    [0, 0],
  ];
  for (const { truth, predicted } of pairs) matrix[truth === "bad" ? 1 : 0][predicted === "bad" ? 1 : 0]++;
  const ratio = (hit, all) => (all ? hit / all : null);
  const [[gg, gb], [bg, bb]] = matrix;
  return {
    matrix,
    total: pairs.length,
    accuracy: ratio(gg + bb, pairs.length),
    goodRecall: ratio(gg, gg + gb),
    badRecall: ratio(bb, bg + bb),
  };
}

/**
 * How close the rep counter got to the real number of reps in each video.
 * @param {{ expected: number, counted: number }[]} rows only videos with both numbers
 * @returns {{ videos: number, exact: number, withinOne: number, meanAbsError: number|null,
 *   expected: number, counted: number }}
 */
export function countAccuracy(rows) {
  const error = (r) => Math.abs(r.counted - r.expected);
  const sum = (key) => rows.reduce((total, r) => total + r[key], 0);
  return {
    videos: rows.length,
    exact: rows.filter((r) => error(r) === 0).length,
    withinOne: rows.filter((r) => error(r) <= 1).length,
    meanAbsError: rows.length ? rows.reduce((total, r) => total + error(r), 0) / rows.length : null,
    expected: sum("expected"),
    counted: sum("counted"),
  };
}
