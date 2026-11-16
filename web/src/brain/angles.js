// Joint angles from pose landmarks.
// MediaPipe indices (side view, pick the side facing the camera):
//   left:  shoulder 11, hip 23, knee 25, ankle 27
//   right: shoulder 12, hip 24, knee 26, ankle 28

const SIDES = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28 },
};

// Landmark x/y are each 0-1 across the video, so on a non-square video one unit of x is a
// different distance than one unit of y. `aspect` (videoWidth / videoHeight) fixes that;
// without it every angle is slightly wrong.
const toPixels = (p, aspect) => ({ x: p.x * aspect, y: p.y });

/**
 * Angle at point b formed by a-b-c, in degrees (0 to 180).
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {{x:number,y:number}} c
 */
export function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (len === 0) return null;
  const cos = (v1.x * v2.x + v1.y * v2.y) / len;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/**
 * Use whichever side of the body the camera sees better.
 * @returns {"left"|"right"}
 */
export function pickSide(landmarks) {
  const score = (side) =>
    Object.values(SIDES[side]).reduce((sum, i) => sum + (landmarks[i].visibility ?? 0), 0);
  return score("left") >= score("right") ? "left" : "right";
}

/**
 * Knee angle (hip-knee-ankle). About 180 standing, smaller as you squat deeper.
 * @param {object[]} landmarks 33 MediaPipe landmarks
 * @param {number} [aspect] videoWidth / videoHeight
 */
export function kneeAngle(landmarks, aspect = 1) {
  const s = SIDES[pickSide(landmarks)];
  return angleAt(
    toPixels(landmarks[s.hip], aspect),
    toPixels(landmarks[s.knee], aspect),
    toPixels(landmarks[s.ankle], aspect)
  );
}

/**
 * Torso lean: angle of the hip-to-shoulder line from vertical. 0 is upright,
 * larger is more forward lean.
 * @param {object[]} landmarks 33 MediaPipe landmarks
 * @param {number} [aspect] videoWidth / videoHeight
 */
export function torsoLean(landmarks, aspect = 1) {
  const s = SIDES[pickSide(landmarks)];
  const hip = toPixels(landmarks[s.hip], aspect);
  const shoulder = toPixels(landmarks[s.shoulder], aspect);
  // Compare against a point straight above the hip (image y grows downward).
  return angleAt(shoulder, hip, { x: hip.x, y: hip.y - 1 });
}
