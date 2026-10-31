// The one entry point the app uses. See docs/data-contract.md.
import { mockReps } from "../shared/mockReps.js";
import { validateRep } from "../shared/contract.js";

import { createPoseLandmarker, openCamera, detect } from "./pose.js";

import { kneeAngle, torsoLean } from "./angles.js";
import { createLandmarkSmoother } from "./smoothing.js";

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
  return startReal(video, options);
}

// Real pipeline. Steps 1 and 6 (onFrame) are done; the rest are still TODO.
async function startReal(video, { mode = "live", onFrame = () => {} }) {
  const landmarker = await createPoseLandmarker();
  const releaseCamera = mode === "live" ? await openCamera(video) : null;
  if (mode === "file") await video.play();

  const smooth = createLandmarkSmoother();
  let running = true;
  let lastVideoTime = -1;

  const loop = () => {
    if (!running) return;
    // Only run the model when the video has a new frame.
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const raw = detect(landmarker, video, now);
      if (raw) {
        // TODO(farhan): repCounter.js -> formRules.js -> onRep
        const landmarks = smooth(raw, now);
        const aspect = video.videoWidth / video.videoHeight;
        onFrame({
          timestamp: Date.now(),
          landmarks,
          kneeAngle: kneeAngle(landmarks, aspect),
          torsoLean: torsoLean(landmarks, aspect),
          phase: null,
        });
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return () => {
    running = false;
    if (releaseCamera) releaseCamera();
    landmarker.close();
  };
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
