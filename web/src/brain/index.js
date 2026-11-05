// The one entry point the app uses. See docs/data-contract.md.
import { mockReps } from "../shared/mockReps.js";
import { validateRep } from "../shared/contract.js";

import { createPoseLandmarker, openCamera, detect } from "./pose.js";

import { kneeAngle, torsoLean, hipBelowKnee } from "./angles.js";
import { createLandmarkSmoother } from "./smoothing.js";
import { createRepCounter } from "./repCounter.js";

export { drawSkeleton } from "./pose.js";

/**
 * Start tracking a lifter in a <video> element.
 * @param {HTMLVideoElement} video
 * @param {{ lift?: string, mode?: "live"|"file", mock?: boolean,
 *           onFrame?: (frame: object) => void, onRep?: (rep: object) => void,
 *           onEnd?: () => void }} options  onEnd fires when a video file finishes
 * @returns {Promise<() => void>} call it to stop tracking
 */
export async function startTracking(video, options = {}) {
  const { mock = true } = options;
  if (mock) return startMock(options);
  return startReal(video, options);
}

// Real pipeline. Form rules (wk3) and classifier (wk5) still TODO.
async function startReal(video, { lift = "squat", mode = "live", onFrame = () => {}, onRep = () => {}, onEnd = () => {} }) {
  const isFile = mode === "file";
  const landmarker = await createPoseLandmarker();
  const releaseCamera = isFile ? null : await openCamera(video);
  if (isFile) await video.play();

  // Files run on video time, so rep durations stay right if playback speed changes or stalls.
  const fileStart = Date.now() - video.currentTime * 1000;
  const clock = () => (isFile ? Math.round(fileStart + video.currentTime * 1000) : Date.now());

  const smooth = createLandmarkSmoother();
  // TODO(farhan): wk3 — run formRules.js on (rep, details) to fill rep.ruleFlags
  const counter = createRepCounter({ lift, onRep: (rep) => onRep(rep) });
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
        const landmarks = smooth(raw, now);
        const aspect = video.videoWidth / video.videoHeight;
        const frame = {
          timestamp: clock(),
          landmarks,
          kneeAngle: kneeAngle(landmarks, aspect),
          torsoLean: torsoLean(landmarks, aspect),
        };
        frame.phase = counter.update({ ...frame, hipBelowKnee: hipBelowKnee(landmarks) });
        onFrame(frame);
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const handleEnded = () => {
    counter.end(clock());
    onEnd();
  };
  if (isFile) video.addEventListener("ended", handleEnded, { once: true });

  return () => {
    running = false;
    if (releaseCamera) releaseCamera();
    if (isFile) {
      video.removeEventListener("ended", handleEnded);
      video.pause();
    }
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
