"""Train the form classifier from data/labels.csv and export it for the browser.

Run from the repo root:
    python ml/train.py                      # compare models, export the better one
    python ml/train.py --model forest       # force one model
Cells marked "# %%" also run one at a time in VS Code / Jupyter.

What it does
  1. Loads data/labels.csv (made by the Labeler page: one row per labeled rep).
  2. Cross-person test: train on everyone except one person, test on that person.
     This is the number that matters, since a new user is a new person.
  3. Compares against two baselines: the hand-written form rules and "always guess the majority".
  4. Fits the chosen model on all the data and writes web/public/models/form-classifier.json,
     which web/src/brain/classifier.js runs with no ML library.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
# Same names as the CSV columns and the contract's Rep fields. The browser reads this list from
# the model file, so adding a feature here needs no change to classifier.js.
FEATURES = ["minKneeAngle", "maxTorsoLean", "hitDepth", "durationMs"]
# Keep these in step with THRESHOLDS in web/src/brain/formRules.js
LEAN_LIMIT = 45
DEPTH_KNEE_ANGLE = 100
CLASSES = ["good", "bad"]  # "bad" is the positive class: models predict P(bad)


# %% Load
def load_labels(path):
    df = pd.read_csv(path)
    missing = [c for c in ["person", "label", *FEATURES] if c not in df.columns]
    if missing:
        raise SystemExit(f"{path} is missing columns: {', '.join(missing)}")
    df = df[df["label"].isin(CLASSES)].copy()
    df["hitDepth"] = df["hitDepth"].astype(int)
    df["person"] = df["person"].astype(str).str.strip().str.lower()
    df = df.dropna(subset=FEATURES)
    if df["label"].nunique() < 2:
        raise SystemExit("Need both good and bad reps to train. Label more reps in the Labeler.")
    return df.reset_index(drop=True)


# %% Models
def make_model(kind):
    if kind == "logistic":
        return LogisticRegression(class_weight="balanced", max_iter=1000)
    return RandomForestClassifier(n_estimators=50, max_depth=4, min_samples_leaf=2, class_weight="balanced", random_state=0)


def fit(kind, X, y):
    """Returns a function giving P(bad) for rows of X, plus the fitted model and scaler."""
    scaler = StandardScaler().fit(X) if kind == "logistic" else None
    model = make_model(kind).fit(scaler.transform(X) if scaler else X, y)
    bad = list(model.classes_).index("bad")

    def predict_bad(rows):
        rows = scaler.transform(rows) if scaler else rows
        return model.predict_proba(rows)[:, bad]

    return predict_bad, model, scaler


def rules_say_bad(df):
    """The hand-written rules, without lockout (labels.csv doesn't record it)."""
    shallow = (df["hitDepth"] == 0) & (df["minKneeAngle"] > DEPTH_KNEE_ANGLE)
    return (shallow | (df["maxTorsoLean"] > LEAN_LIMIT)).to_numpy()


# %% Evaluate
def matrix(truth_bad, pred_bad):
    """Rows are the true label, columns the prediction: [[good->good, good->bad], [bad->good, bad->bad]]."""
    return confusion_matrix(truth_bad, pred_bad, labels=[False, True]).tolist()


def accuracy(m):
    total = sum(map(sum, m))
    return (m[0][0] + m[1][1]) / total if total else float("nan")


def labels_of(y_bad):
    return np.where(y_bad, "bad", "good")


def cross_person(df, kind):
    """Hold out each person in turn. Returns the confusion matrix pooled over all held-out reps."""
    X, y = df[FEATURES].to_numpy(float), (df["label"] == "bad").to_numpy()
    truth, pred = [], []
    for person in sorted(df["person"].unique()):
        test = (df["person"] == person).to_numpy()
        if len(set(y[~test])) < 2:
            print(f"  skipping {person}: the other people's reps are all one label")
            continue
        predict_bad = fit(kind, X[~test], labels_of(y[~test]))[0]
        truth += y[test].tolist()
        pred += (predict_bad(X[test]) >= 0.5).tolist()
    return matrix(truth, pred) if truth else None


def same_person_cv(df, kind):
    """Fallback when there is only one person: k-fold cross-validation (optimistic, see the warning)."""
    X, y = df[FEATURES].to_numpy(float), (df["label"] == "bad").to_numpy()
    folds = min(5, int(min(y.sum(), (~y).sum())))
    if folds < 2:
        return None
    truth, pred = [], []
    for train, test in StratifiedKFold(folds, shuffle=True, random_state=0).split(X, y):
        predict_bad = fit(kind, X[train], labels_of(y[train]))[0]
        truth += y[test].tolist()
        pred += (predict_bad(X[test]) >= 0.5).tolist()
    return matrix(truth, pred)


def show(name, m):
    if m is None:
        print(f"  {name}: not enough data")
        return
    print(f"  {name}: accuracy {accuracy(m):.0%}   {m}")


# %% Export
def export_logistic(model, scaler):
    # The browser wants P(bad). sklearn's positive class is the one sorted last in classes_.
    sign = 1 if list(model.classes_)[1] == "bad" else -1
    return {
        "type": "logistic",
        "features": FEATURES,
        "mean": scaler.mean_.tolist(),
        "scale": [float(s) if s > 0 else 1.0 for s in scaler.scale_],
        "coef": (sign * model.coef_[0]).tolist(),
        "intercept": float(sign * model.intercept_[0]),
    }


def export_forest(model):
    bad = list(model.classes_).index("bad")
    trees = []
    for estimator in model.estimators_:
        t = estimator.tree_
        counts = t.value[:, 0, :]
        trees.append(
            {
                "feature": t.feature.tolist(),
                "threshold": t.threshold.tolist(),
                "left": t.children_left.tolist(),
                "right": t.children_right.tolist(),
                "value": (counts[:, bad] / counts.sum(axis=1)).tolist(),
            }
        )
    return {"type": "forest", "features": FEATURES, "trees": trees}


# %% Run
def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--labels", default=ROOT / "data" / "labels.csv")
    parser.add_argument("--out", default=ROOT / "web" / "public" / "models" / "form-classifier.json")
    parser.add_argument("--results", default=ROOT / "ml" / "results.json", help="metrics for the report")
    parser.add_argument("--model", choices=["auto", "logistic", "forest"], default="auto")
    args = parser.parse_args()

    df = load_labels(args.labels)
    people = sorted(df["person"].unique())
    print(f"{len(df)} labeled reps from {len(people)} people: {', '.join(people)}")
    print(df.groupby(["person", "label"]).size().unstack(fill_value=0).to_string(), "\n")

    use_cross_person = len(people) >= 2
    if not use_cross_person:
        print("WARNING: only one person in the data, so the test below is NOT cross-person and is too optimistic.")
        print("         Record and label a second person before trusting these numbers.\n")
    evaluate = cross_person if use_cross_person else same_person_cv
    print("Cross-person test" if use_cross_person else "Same-person k-fold test")
    print("(matrix rows = true good/bad, columns = predicted good/bad)")

    truth_bad = (df["label"] == "bad").to_numpy()
    baselines = {
        "form rules (shallow / lean)": matrix(truth_bad, rules_say_bad(df)),
        "always guess the majority": matrix(truth_bad, np.full(len(df), truth_bad.mean() >= 0.5)),
    }
    models = {kind: evaluate(df, kind) for kind in ["logistic", "forest"]}
    for name, m in {**baselines, **{f"{k} model": v for k, v in models.items()}}.items():
        show(name, m)

    if args.model == "auto":
        scored = {k: accuracy(m) for k, m in models.items() if m is not None}
        if not scored:
            raise SystemExit("Not enough labeled reps to test a model. Label more reps.")
        kind = max(scored, key=scored.get)
    else:
        kind = args.model
    print(f"\nExporting the {kind} model, trained on all {len(df)} reps")

    _, model, scaler = fit(kind, df[FEATURES].to_numpy(float), labels_of(truth_bad))
    exported = export_logistic(model, scaler) if kind == "logistic" else export_forest(model)
    exported["trainedOn"] = {"reps": len(df), "people": people}

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(exported, separators=(",", ":")) + "\n")
    print(f"Wrote {out}")

    results = {
        "reps": len(df),
        "people": people,
        "test": "cross-person" if use_cross_person else "same-person k-fold",
        "matrixLayout": "rows = true good/bad, columns = predicted good/bad",
        "baselines": baselines,
        "models": models,
        "exported": kind,
    }
    Path(args.results).write_text(json.dumps(results, indent=2) + "\n")
    print(f"Wrote {args.results}")


if __name__ == "__main__":
    main()
