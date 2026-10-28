// Camera / video input + MediaPipe Pose Landmarker.
// Docs: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
// Model: pose_landmarker_lite (fastest, good enough for phones).

// TODO(farhan): wk1
//   - createPoseLandmarker(): load tasks-vision WASM + lite model, runningMode "VIDEO"
//   - openCamera(video): getUserMedia, attach stream to the <video>
//   - detect(video, timestampMs): returns 33 landmarks or null if no person

/**
 * Draw the skeleton overlay on a canvas sized to match the video.
 * @param {HTMLCanvasElement} canvas
 * @param {{x:number,y:number,visibility:number}[]} landmarks
 */
export function drawSkeleton(canvas, landmarks) {
  // TODO(farhan): wk1 — MediaPipe's DrawingUtils can do most of this
}
