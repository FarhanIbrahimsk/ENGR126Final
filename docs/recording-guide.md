# Recording guide (sessions #1 and #2)

Goal: enough labeled reps from **at least two people** to train and honestly test the classifier,
plus videos with a known rep count for the Accuracy page.

## Camera setup
- Film from the **side**, phone in landscape, on a stand or propped up. Don't hold it.
- Camera at about hip height, 2 to 3 m away. The whole body, head to feet, stays in frame for the whole set.
  The pose model struggles when the head is cut off.
- Even light, a plain background, nobody walking through. Close-fitting clothes so the knees and hips are visible.
- Use the same setup for both people if you can, then change it once (different room or phone) so the test isn't only on one angle.

## What to record
- Sets of 5 to 8 reps. Aim for **at least 100 reps per person**, about 40% of them bad.
- Bad reps on purpose, a few of each fault: shallow (hips stay above the knees), too much forward lean, bouncing
  back down without standing up. Mix them into sets with good reps; don't only film all-good and all-bad sets.
- A couple of sets with a pause at the bottom, and one slow set and one fast set, since the counter has to cope with both.
- Say the rep count out loud or write it down right after each set. You need the true count for every video.

## Files
- MP4 (H.264). Name them `person-set-N.mp4`, e.g. `alex-set-3.mp4`. The Labeler keys its saved labels on the file name,
  so keep names unique and don't rename a video after labeling it.
- Videos go in the shared Google Drive folder, **not** git.
- Keep a list of true rep counts per video; you'll type them into the Accuracy page.

## After recording
1. Labeler: pick a video, enter the person's name, Analyze, watch each rep and mark it good or bad (and the fault).
   Use the same standard for both people: bad means one of the three flags, or form you'd correct in a gym.
2. Export `labels.csv` and save it as `data/labels.csv`. Commit it.
3. `python ml/train.py` (see `ml/README.md`).
4. Accuracy page: add the videos and true counts for rep-count accuracy.
5. If lean or depth flags disagree with what you labeled, look at the numbers in the Labeler and adjust
   `THRESHOLDS` in `web/src/brain/formRules.js`.
