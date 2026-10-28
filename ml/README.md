# ml/ — form classifier training (Farhan)

Training only. Features come from the **browser brain** run in video-file mode, so training
and live use compute angles the exact same way.

1. Run recorded videos through the Labeler page → export rep features + labels
2. Train in `train.ipynb` (start with logistic regression / random forest)
3. Test: train on one person's reps, test on the other's
4. Export to TensorFlow.js → `web/public/models/`

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
