// Rep detection state machine.
//   standing -> descending -> bottom -> ascending -> standing  = 1 rep
// Use separate up/down thresholds (hysteresis) so jitter near a cutoff
// doesn't double-count. Starting guesses: standing > 160°, bottom < 100°.

// TODO(farhan): wk2
//   - createRepCounter({ onRep }) with update(kneeAngle, torsoLean, timestamp)
//   - track min knee angle / max lean during each rep for the Rep object
//   - return the current phase for onFrame
