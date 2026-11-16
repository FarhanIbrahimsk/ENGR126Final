// Trained form classifier, run in the browser.
// ml/train.py trains it and writes web/public/models/form-classifier.json. The JSON holds plain
// numbers (logistic regression weights or random forest trees), so there is no ML library to load.
// Until that file exists, classify() returns null and rep.classifier stays null.

const MODEL_PATH = "models/form-classifier.json";
const BASE_URL = import.meta.env?.BASE_URL ?? "/";

const isNumbers = (list, length) =>
  Array.isArray(list) && list.length === length && list.every((n) => Number.isFinite(n));

function checkTree(tree, features) {
  const size = tree?.value?.length;
  const sameSize = ["feature", "threshold", "left", "right"].every((k) => tree[k]?.length === size);
  if (!size || !sameSize) throw new Error("tree arrays differ in length");
  for (let i = 0; i < size; i++) {
    const isLeaf = tree.left[i] === -1;
    const pointers = [tree.left[i], tree.right[i]];
    if (!isLeaf && (!(tree.feature[i] >= 0 && tree.feature[i] < features) || pointers.some((p) => !(p > i && p < size)))) {
      throw new Error("tree points outside itself");
    }
  }
  if (!tree.value.every((v) => v >= 0 && v <= 1)) throw new Error("tree leaf values should be probabilities");
}

/**
 * Check a parsed model file. Throws if it isn't one this code can run.
 * Both types give the probability the rep is "bad". See ml/train.py for how they are made.
 */
export function checkModel(model) {
  const n = model?.features?.length;
  if (!Array.isArray(model?.features) || !n || model.features.some((f) => typeof f !== "string")) {
    throw new Error("model needs a list of feature names");
  }
  if (model.type === "logistic") {
    if (!isNumbers(model.mean, n) || !isNumbers(model.scale, n) || !isNumbers(model.coef, n) || !Number.isFinite(model.intercept)) {
      throw new Error("logistic model has bad numbers");
    }
  } else if (model.type === "forest") {
    if (!Array.isArray(model.trees) || !model.trees.length) throw new Error("forest has no trees");
    model.trees.forEach((tree) => checkTree(tree, n));
  } else {
    throw new Error(`unknown model type: ${model.type}`);
  }
  return model;
}

function featureVector(model, rep) {
  const x = model.features.map((name) => Number(rep[name]));
  return x.every(Number.isFinite) ? x : null;
}

function probabilityBad(model, x) {
  if (model.type === "logistic") {
    const z = x.reduce((sum, v, i) => sum + (model.coef[i] * (v - model.mean[i])) / model.scale[i], model.intercept);
    return 1 / (1 + Math.exp(-z));
  }
  let total = 0;
  for (const tree of model.trees) {
    let node = 0;
    while (tree.left[node] !== -1) node = x[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
    total += tree.value[node];
  }
  return total / model.trees.length;
}

/**
 * @param {object} model a checked model
 * @param {object} rep a contract Rep (booleans like hitDepth count as 0 or 1)
 * @returns {{ label: "good"|"bad", confidence: number } | null} null if the rep lacks a feature
 */
export function predict(model, rep) {
  const x = featureVector(model, rep);
  if (!x) return null;
  const bad = probabilityBad(model, x);
  return bad >= 0.5
    ? { label: "bad", confidence: Math.round(bad * 100) / 100 }
    : { label: "good", confidence: Math.round((1 - bad) * 100) / 100 };
}

/**
 * Load the trained model once.
 * @param {string} [url] where the model file is served
 * @returns {Promise<(rep: object) => ({ label: string, confidence: number } | null)>}
 *   a classify function; it always returns null if there is no usable model
 */
export async function loadClassifier(url = `${BASE_URL}${MODEL_PATH}`) {
  const none = () => null;
  let model;
  try {
    const response = await fetch(url);
    if (!response.ok) return none;
    // The dev server answers a missing file with the home page, which won't parse: also "no model".
    model = JSON.parse(await response.text());
  } catch {
    return none;
  }
  try {
    checkModel(model);
  } catch (err) {
    console.warn(`Ignoring ${url}: ${err.message}`);
    return none;
  }
  return (rep) => predict(model, rep);
}
