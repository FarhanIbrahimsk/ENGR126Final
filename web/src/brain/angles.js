// Joint angles from pose landmarks.
// MediaPipe indices (side view, pick the side facing the camera):
//   left:  shoulder 11, hip 23, knee 25, ankle 27
//   right: shoulder 12, hip 24, knee 26, ankle 28

// TODO(farhan): wk1
//   - angleAt(a, b, c): angle at point b, in degrees
//   - kneeAngle(landmarks): hip-knee-ankle
//   - torsoLean(landmarks): shoulder-hip line vs. vertical
//   - pickSide(landmarks): use whichever side has higher visibility
