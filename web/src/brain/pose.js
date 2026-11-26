// Camera / video input + MediaPipe Pose Landmarker.
// Docs: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
// Model: pose_landmarker_lite (fastest, good enough for phones).
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

// Keep the WASM version in step with @mediapipe/tasks-vision in package.json.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/**
 * Load the WASM runtime and the lite pose model. Slow (a few seconds), so call it once
 * and reuse the result.
 * @returns {Promise<PoseLandmarker>}
 */
export async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
    // Defaults are 0.5. Lower helps it find a body that's partly out of frame
    // (e.g. head cut off), at the cost of occasional false detections.
    minPoseDetectionConfidence: 0.3,
    minPosePresenceConfidence: 0.3,
  });
}

/**
 * Ask for the webcam and attach the stream to the <video>.
 * @param {HTMLVideoElement} video
 * @returns {Promise<() => void>} call it to release the camera
 */
export async function openCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return () => {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };
}

let lastTimestamp = -1;
let flipCanvas = null;

// A copy of the current frame turned 180 degrees.
function turnedFrame(video) {
  flipCanvas ??= document.createElement("canvas");
  flipCanvas.width = video.videoWidth; // setting the size also clears the last rotation
  flipCanvas.height = video.videoHeight;
  const ctx = flipCanvas.getContext("2d");
  ctx.translate(flipCanvas.width, flipCanvas.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(video, 0, 0);
  return flipCanvas;
}

/**
 * Run pose detection on the current video frame.
 * @param {PoseLandmarker} landmarker
 * @param {HTMLVideoElement} video
 * @param {number} timestampMs e.g. performance.now()
 * @param {boolean} [flipped] the video is upside down, so turn it before detecting. Landmarks
 *   then match the turned picture.
 * @returns {{x:number,y:number,z:number,visibility:number}[] | null}
 *   33 landmarks, or null if no person (or no new frame yet)
 */
export function detect(landmarker, video, timestampMs, flipped = false) {
  if (video.readyState < 2) return null;
  // MediaPipe requires strictly increasing timestamps.
  if (timestampMs <= lastTimestamp) return null;
  lastTimestamp = timestampMs;
  const result = landmarker.detectForVideo(flipped ? turnedFrame(video) : video, timestampMs);
  return result.landmarks[0] ?? null;
}

/**
 * Draw the skeleton overlay on a canvas sized to match the video.
 * @param {HTMLCanvasElement} canvas
 * @param {{x:number,y:number,visibility:number}[]} landmarks
 */
export function drawSkeleton(canvas, landmarks) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  const utils = new DrawingUtils(ctx);
  // Telemetry cyan at 40% opacity, so the body stays visible under the overlay.
  utils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "rgba(0, 229, 255, 0.4)", lineWidth: 3 });
  utils.drawLandmarks(landmarks, { color: "rgba(0, 229, 255, 0.4)", fillColor: "rgba(0, 229, 255, 0.4)", radius: 3 });
}
