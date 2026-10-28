// The one entry point the app uses. See docs/data-contract.md.
import { mockReps } from "../shared/mockReps.js";
import { validateRep } from "../shared/contract.js";

export { drawSkeleton } from "./pose.js";

/**
 * Start tracking a lifter in a <video> element.
 * @param {HTMLVideoElement} video
 * @param {{ lift?: string, mode?: "live"|"file", mock?: boolean,
 *           onFrame?: (frame: object) => void, onRep?: (rep: object) => void }} options
 * @returns {Promise<() => void>} call it to stop tracking
 */
export async function startTracking(video, options = {}) {
  const { mock = true } = options;
  if (mock) return startMock(options);

  // TODO(farhan): real pipeline, wk1-2
  //   1. pose.js       -> open camera / file, run MediaPipe each frame
  //   2. angles.js     -> knee angle + torso lean from landmarks
  //   3. smoothing.js  -> steady the angles
  //   4. repCounter.js -> detect completed reps
  //   5. formRules.js  -> flags; classifier.js -> label (wk5)
  //   6. call onFrame every frame, onRep per rep
  throw new Error("Real tracking not built yet — pass { mock: true }");
}

// Sends one fake rep every 3 seconds.
function startMock({ onRep = () => {} }) {
  let i = 0;
  const timer = setInterval(() => {
    const rep = { ...mockReps[i % mockReps.length], rep: i + 1, startTime: Date.now() };
    const problems = validateRep(rep);
    if (problems.length) console.warn("Mock rep breaks the contract:", problems);
    onRep(rep);
    i++;
  }, 3000);
  return () => clearInterval(timer);
}
