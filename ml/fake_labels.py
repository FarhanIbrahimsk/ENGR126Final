"""Write a FAKE labels file to test the training pipeline before real footage exists.

    python ml/fake_labels.py                  # writes ml/fake_labels.csv (git-ignored)
    python ml/train.py --labels ml/fake_labels.csv --out ml/fake_model.json

Never save the output as data/labels.csv: it is invented data, and a model trained on it means nothing.
"""
import csv
import random
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "ml/fake_labels.csv"
random.seed(1)
rows = []
for person in ["alex", "sam"]:
    for i in range(40):
        bad = random.random() < 0.4
        depth_ok = random.random() > (0.6 if bad else 0.05)
        knee = random.gauss(82 if depth_ok else 105, 8)
        lean = random.gauss(50 if bad and random.random() < 0.5 else 32, 6)
        duration = random.gauss(2600 if bad else 2300, 300)
        rows.append([f"{person}-{i // 10}.mp4", i % 10 + 1, person, "bad" if bad else "good", "",
                     round(knee), round(lean), int(depth_ok), round(duration)])
with open(path, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["video", "rep", "person", "label", "fault", "minKneeAngle", "maxTorsoLean", "hitDepth", "durationMs"])
    writer.writerows(rows)
print(f"Wrote {len(rows)} fake reps to {path}")
