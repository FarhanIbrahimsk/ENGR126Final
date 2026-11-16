// Steadies jittery landmarks before angles and rep counting.
// One Euro filter (Casiez et al. 2012): heavy smoothing when a point is still, light
// smoothing when it moves fast, so standing still is steady but reps don't lag.
// Tuning: lower MIN_CUTOFF = steadier when still; higher BETA = less lag when moving.

const MIN_CUTOFF = 1.0; // Hz
const BETA = 0.5;
const D_CUTOFF = 1.0; // Hz
const RESET_GAP_S = 0.5; // start fresh if the person was lost for this long

const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

function oneEuro() {
  let x = null;
  let dx = 0;
  return (value, dt) => {
    if (x === null) return (x = value);
    dx += alpha(D_CUTOFF, dt) * ((value - x) / dt - dx);
    const cutoff = MIN_CUTOFF + BETA * Math.abs(dx);
    x += alpha(cutoff, dt) * (value - x);
    return x;
  };
}

/**
 * Make a smoother for a stream of 33-landmark frames.
 * @returns {(landmarks: object[], timestampMs: number) => object[]}
 */
export function createLandmarkSmoother() {
  let filters = null;
  let lastMs = null;
  return (landmarks, timestampMs) => {
    const dt = lastMs === null ? null : (timestampMs - lastMs) / 1000;
    lastMs = timestampMs;
    if (filters === null || dt > RESET_GAP_S) {
      filters = landmarks.map(() => ({ x: oneEuro(), y: oneEuro(), z: oneEuro() }));
    }
    return landmarks.map((p, i) => ({
      x: filters[i].x(p.x, dt),
      y: filters[i].y(p.y, dt),
      z: filters[i].z(p.z, dt),
      visibility: p.visibility,
    }));
  };
}
