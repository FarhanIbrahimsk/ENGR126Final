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
 * Squat depth check: is the hip lower than the knee? (Image y grows downward.)
 * @param {object[]} landmarks 33 MediaPipe landmarks
 */
export function hipBelowKnee(landmarks) {
  const s = SIDES[pickSide(landmarks)];
  return landmarks[s.hip].y > landmarks[s.knee].y;
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

// Pushups use the arm and the whole body line. Elbows are 13/14 and wrists 15/16.
const PUSHUP_SIDES = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

// What counts as being in the pushup position. Loose enough for sagging or piked reps,
// which still count and get flagged.
const PUSHUP_POSITION = {
  minVisibility: 0.5, // below this the model is guessing where the point is
  maxFromLevel: 50, // torso and thigh each within this many degrees of horizontal
  maxHipBend: 60, // degrees away from a straight shoulder-hip-knee line
  handsBelow: 0.1, // wrist at least this far below the shoulder, as a share of torso length
};

function pushupSide(landmarks) {
  const score = (side) =>
    Object.values(PUSHUP_SIDES[side]).reduce((sum, i) => sum + (landmarks[i].visibility ?? 0), 0);
  return PUSHUP_SIDES[score("left") >= score("right") ? "left" : "right"];
}

/**
 * Elbow angle (shoulder-elbow-wrist). About 180 with straight arms, smaller as you lower.
 * @param {object[]} landmarks 33 MediaPipe landmarks
 * @param {number} [aspect] videoWidth / videoHeight
 */
export function elbowAngle(landmarks, aspect = 1) {
  const s = pushupSide(landmarks);
  return angleAt(
    toPixels(landmarks[s.shoulder], aspect),
    toPixels(landmarks[s.elbow], aspect),
    toPixels(landmarks[s.wrist], aspect)
  );
}

/**
 * How far shoulder-hip-ankle is from a straight line, in degrees. 0 is straight; sagging and
 * piked hips both give larger numbers.
 * @param {object[]} landmarks 33 MediaPipe landmarks
 * @param {number} [aspect] videoWidth / videoHeight
 */
export function bodyBend(landmarks, aspect = 1) {
  const s = pushupSide(landmarks);
  const angle = angleAt(
    toPixels(landmarks[s.shoulder], aspect),
    toPixels(landmarks[s.hip], aspect),
    toPixels(landmarks[s.ankle], aspect)
  );
  return angle === null ? null : 180 - angle;
}

/**
 * Is this the pushup position: torso and legs near level, body near straight, hands under the
 * shoulders, and those points clearly visible? Rules out standing, bending over the phone, and
 * kneeling. Needs an upright picture: a standing person in a sideways picture looks lying down.
 * @param {object[]} landmarks 33 MediaPipe landmarks
 * @param {number} [aspect] videoWidth / videoHeight
 */
export function pushupPosition(landmarks, aspect = 1) {
  const s = pushupSide(landmarks);
  const keys = ["shoulder", "elbow", "wrist", "hip", "knee"];
  if (keys.some((k) => (landmarks[s[k]].visibility ?? 0) < PUSHUP_POSITION.minVisibility)) return false;
  const [shoulder, wrist, hip, knee] = [s.shoulder, s.wrist, s.hip, s.knee].map((i) => toPixels(landmarks[i], aspect));
  const fromLevel = (a, b) => {
    const deg = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
    return Math.min(deg, 180 - deg);
  };
  const hipAngle = angleAt(shoulder, hip, knee);
  const torsoLength = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y);
  return (
    hipAngle !== null &&
    180 - hipAngle <= PUSHUP_POSITION.maxHipBend &&
    fromLevel(hip, shoulder) <= PUSHUP_POSITION.maxFromLevel &&
    fromLevel(hip, knee) <= PUSHUP_POSITION.maxFromLevel &&
    wrist.y - shoulder.y >= PUSHUP_POSITION.handsBelow * torsoLength // image y grows downward
  );
}
