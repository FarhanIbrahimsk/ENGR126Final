# ml/ — form classifier training (Farhan)

Training only. Features come from the **browser brain** run in video-file mode, so training
and live use compute angles the exact same way.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Steps

1. Run recorded videos through the **Labeler** page, label each rep good/bad, export `labels.csv`
   and save it as `data/labels.csv`.
2. From the repo root: `python ml/train.py`
   - Cross-person test: trains on everyone except one person and tests on that person. Prints a
     confusion matrix for logistic regression, a random forest, the hand-written form rules and
     "always guess the majority". Needs reps from at least two people.
   - Exports the better model to `web/public/models/form-classifier.json` and writes the numbers to
     `ml/results.json` (git-ignored) for the report.
3. Refresh the app. Reps now show a classifier verdict on Live Set and Dashboard, and the
   **Accuracy** page can score it against your labels.

`train.py` is a plain script with `# %%` cells, so it also runs cell by cell in VS Code or Jupyter.
`--model logistic` or `--model forest` forces one; `--labels` and `--out` change the paths.

## Model format

The model is a small JSON file of plain numbers (logistic regression weights or random forest
trees), run by `web/src/brain/classifier.js`. There's no TensorFlow.js: with four features it
would add megabytes for nothing. `web/test/brain.test.js` covers the browser side.

## Trying the pipeline before there's real data

```bash
python ml/fake_labels.py                                              # invented reps, git-ignored
python ml/train.py --labels ml/fake_labels.csv --out ml/fake_model.json
```

Never save that data as `data/labels.csv` or that model into `web/public/models/`. It means nothing.
