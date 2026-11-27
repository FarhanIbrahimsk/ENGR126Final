// The one entry point the app uses. See docs/data-contract.md.
import { mockReps, mockPushupReps } from "../shared/mockReps.js";
import { validateRep } from "../shared/contract.js";

import { createPoseLandmarker, openCamera, detect, turnedSize } from "./pose.js";

import { kneeAngle, torsoLean, hipBelowKnee, elbowAngle, bodyBend, pushupPosition } from "./angles.js";
import { createLandmarkSmoother } from "./smoothing.js";
import { createRepCounter } from "./repCounter.js";
import { checkForm } from "./formRules.js";
import { loadClassifier } from "./classifier.js";

export { drawSkeleton, turnedSize } from "./pose.js";
export { checkForm } from "./formRules.js";
export { loadClassifier } from "./classifier.js";

/**
 * Start tracking a lifter in a <video> element.
 * @param {HTMLVideoElement} video
 * @param {{ lift?: "squat"|"pushup", mode?: "live"|"file", mock?: boolean,
 *           onFrame?: (frame: object) => void, onRep?: (rep: object) => void,
 *           onEnd?: () => void, rotation?: () => number }} options  onEnd fires when a video file
 *   finishes; rotation is asked each frame how far to turn the picture (0, 90, 180 or 270
 *   degrees clockwise), and landmarks then match the turned picture
 * @returns {Promise<() => void>} call it to stop tracking
 */
export async function startTracking(video, options = {}) {
  const { mock = true } = options;
  if (mock) return startMock(options);
  return startReal(video, options);
}

// Real pipeline: pose -> angles -> rep counter -> form rules + classifier.
async function startReal(video, { lift = "squat", mode = "live", onFrame = () => {}, onRep = () => {}, onEnd = () => {}, rotation = () => 0 }) {
  const isFile = mode === "file";
  const landmarker = await createPoseLandmarker();
  const classify = await loadClassifier();
  let releaseCamera = null;
  try {
    if (isFile) await video.play();
    else releaseCamera = await openCamera(video);
  } catch (err) {
    landmarker.close();
    throw err;
  }

  // Files run on video time, so rep durations stay right if playback speed changes or stalls.
  const fileStart = Date.now() - video.currentTime * 1000;
  const clock = () => (isFile ? Math.round(fileStart + video.currentTime * 1000) : Date.now());

  let smooth = createLandmarkSmoother();
  let lastRotation = 0;
  const counter = createRepCounter({
    lift,
    onRep: (rep, details) => {
      rep.ruleFlags = checkForm(rep, details);
      // The model is trained on squats only.
      rep.classifier = lift === "squat" ? classify(rep) : null;
      onRep(rep);
    },
  });
  let running = true;
  let lastVideoTime = -1;

  const loop = () => {
    if (!running) return;
    // Only run the model when the video has a new frame.
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const turn = rotation();
      // Landmarks jump when the picture turns; don't smooth them across the jump.
      if (turn !== lastRotation) smooth = createLandmarkSmoother();
      lastRotation = turn;
      const raw = detect(landmarker, video, now, turn);
      if (raw) {
        const landmarks = smooth(raw, now);
        const size = turnedSize(video.videoWidth, video.videoHeight, turn);
        const aspect = size.width / size.height;
        const frame = {
          timestamp: clock(),
          landmarks,
          kneeAngle: kneeAngle(landmarks, aspect),
          torsoLean: torsoLean(landmarks, aspect),
          elbowAngle: elbowAngle(landmarks, aspect),
          bodyBend: bodyBend(landmarks, aspect),
          pushupPosition: pushupPosition(landmarks, aspect),
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
function startMock({ lift = "squat", onRep = () => {} }) {
  const reps = lift === "pushup" ? mockPushupReps : mockReps;
  let i = 0;
  const timer = setInterval(() => {
    const rep = { ...reps[i % reps.length], rep: i + 1, startTime: Date.now() };
    const problems = validateRep(rep);
    if (problems.length) console.warn("Mock rep breaks the contract:", problems);
    onRep(rep);
    i++;
  }, 3000);
  return () => clearInterval(timer);
}
