// Accuracy: how well the app does on recorded videos.
//   1. Rep counts: run videos through the brain and compare with the real number of reps.
//   2. Form checks: compare the form rules and the trained classifier with the labels made in the Labeler.
import { startTracking, drawSkeleton, checkForm, loadClassifier } from "../../brain/index.js";
import { getLabeledReps } from "../storage/db.js";
import { confusionMatrix, countAccuracy } from "../components/metrics.js";
import { escapeHtml } from "../components/setDetails.js";

const percent = (value) => (value === null ? "n/a" : `${Math.round(value * 100)}%`);

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function matrixHtml(title, note, empty, result) {
  if (!result.total) return `<section class="set"><h3>${title}</h3><p>${empty}</p></section>`;
  const [[gg, gb], [bg, bb]] = result.matrix;
  return `
    <section class="set">
      <h3>${title}</h3>
      <p>${note}</p>
      <div class="table-scroll">
        <table class="matrix">
          <thead><tr><th>You labeled</th><th>Predicted good</th><th>Predicted bad</th></tr></thead>
          <tbody>
            <tr><th>Good</th><td>${gg}</td><td>${gb}</td></tr>
            <tr><th>Bad</th><td>${bg}</td><td>${bb}</td></tr>
          </tbody>
        </table>
      </div>
      <p>Accuracy ${percent(result.accuracy)} over ${result.total} reps.
        Good reps passed: ${percent(result.goodRecall)}. Bad reps caught: ${percent(result.badRecall)}.</p>
    </section>`;
}

export function renderAccuracy(page) {
  page.innerHTML = `
    <h1>Accuracy</h1>

    <h2 class="section-title">Rep counts</h2>
    <p>Pick videos, enter how many reps each really has, then run them. Keep this tab visible while they play.</p>
    <div class="controls">
      <label>Exercise <select id="lift"><option value="squat">Squat</option><option value="pushup">Pushup</option></select></label>
      <label>Videos <input id="files" type="file" accept="video/*" multiple /></label>
      <button id="run" type="button" disabled>Run all</button>
      <button id="export" type="button" disabled>Export accuracy.csv</button>
    </div>
    <p id="status" role="status"></p>
    <div class="stage">
      <video id="video" playsinline muted></video>
      <canvas id="overlay"></canvas>
    </div>
    <div class="table-scroll" id="counts"></div>
    <p id="count-summary"></p>

    <h2 class="section-title">Form checks</h2>
    <p>Squats only. Uses the reps you labeled in the Labeler. Nothing is replayed, so this is instant.</p>
    <button id="form" type="button">Check against my labels</button>
    <div id="form-results"></div>
  `;

  const $ = (selector) => page.querySelector(selector);
  const video = $("#video");
  const canvas = $("#overlay");
  const status = $("#status");
  const runButton = $("#run");
  const exportButton = $("#export");

  let rows = []; // { file, expected: number|null, counted: number|null }
  let running = false;
  let abort = null; // stops the video being analyzed right now
  let pausedWhileHidden = false;
  let leftPage = false;

  const showError = (prefix, err) => {
    console.error(err);
    status.textContent = `${prefix}: ${err.message}`;
  };

  const scored = () => rows.filter((r) => r.expected !== null && r.counted !== null);

  const updateSummary = () => {
    const done = scored();
    exportButton.disabled = !done.length;
    const out = $("#count-summary");
    if (!done.length) {
      out.textContent = "";
      return;
    }
    const a = countAccuracy(done);
    out.textContent =
      `${a.exact} of ${a.videos} videos counted exactly, ${a.withinOne} within one rep. ` +
      `Counted ${a.counted} reps where there are ${a.expected} (average miss ${a.meanAbsError.toFixed(2)} reps).`;
  };

  const updateRow = (i) => {
    const r = rows[i];
    const cell = (name) => $(`[data-row="${i}"] .${name}`);
    cell("counted").textContent = r.counted ?? "-";
    const miss = r.counted !== null && r.expected !== null ? r.counted - r.expected : null;
    cell("diff").textContent = miss === null ? "-" : miss === 0 ? "Exact" : `${miss > 0 ? "+" : ""}${miss}`;
    updateSummary();
  };

  const renderRows = () => {
    $("#counts").innerHTML = rows.length
      ? `<table>
          <thead><tr><th>Video</th><th>Actual reps</th><th>Counted</th><th>Off by</th></tr></thead>
          <tbody>${rows
            .map(
              (r, i) => `<tr data-row="${i}">
                <td>${escapeHtml(r.file.name)}</td>
                <td><input class="expected" type="number" min="0" step="1" inputmode="numeric" aria-label="Actual reps in ${escapeHtml(r.file.name)}" /></td>
                <td class="counted">-</td><td class="diff">-</td>
              </tr>`
            )
            .join("")}</tbody>
        </table>`
      : "";
    runButton.disabled = !rows.length;
    updateSummary();
  };

  // Play one video through the brain and resolve with the number of reps, or null if stopped.
  const analyze = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      let stop = null;
      let finished = false;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        abort = null;
        if (stop) stop();
        video.removeAttribute("src");
        URL.revokeObjectURL(url);
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        resolve(result);
      };
      let count = 0;
      video.src = url;
      abort = () => finish(null);
      startTracking(video, {
        lift: $("#lift").value,
        mode: "file",
        mock: false,
        onFrame: (frame) => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          drawSkeleton(canvas, frame.landmarks);
        },
        onRep: () => count++,
        onEnd: () => finish(count),
      }).then(
        (stopTracking) => {
          stop = stopTracking;
          if (finished) stop(); // ended or aborted while the model was loading
        },
        (err) => {
          finished = true;
          abort = null;
          URL.revokeObjectURL(url);
          reject(err);
        }
      );
    });

  const runAll = async () => {
    running = true;
    runButton.textContent = "Stop";
    $("#files").disabled = true;
    $("#lift").disabled = true;
    try {
      for (let i = 0; i < rows.length && !leftPage; i++) {
        rows[i].counted = null;
        updateRow(i);
        status.textContent = `Running ${i + 1} of ${rows.length}: ${rows[i].file.name}`;
        const counted = await analyze(rows[i].file);
        if (counted === null) {
          status.textContent = "Stopped.";
          break;
        }
        rows[i].counted = counted;
        if (!leftPage) updateRow(i);
        if (i === rows.length - 1) status.textContent = "Done.";
      }
    } catch (err) {
      showError("Couldn't analyze this video. An MP4 (H.264) is the safest format to try", err);
    }
    running = false;
    if (leftPage) return;
    runButton.textContent = "Run all";
    $("#files").disabled = false;
    $("#lift").disabled = false;
  };

  $("#files").addEventListener("change", (e) => {
    rows = [...e.target.files].map((file) => ({ file, expected: null, counted: null }));
    status.textContent = "";
    renderRows();
  });

  $("#counts").addEventListener("input", (e) => {
    if (!e.target.classList.contains("expected")) return;
    const i = Number(e.target.closest("tr").dataset.row);
    rows[i].expected = e.target.value === "" ? null : Number(e.target.value);
    updateRow(i);
  });

  runButton.addEventListener("click", () => (running ? abort?.() : runAll()));

  exportButton.addEventListener("click", () => {
    const lines = ["video,actualReps,countedReps", ...scored().map((r) => [r.file.name, r.expected, r.counted].map(csvCell).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "accuracy.csv" }).click();
    URL.revokeObjectURL(url);
  });

  // Tracking runs on animation frames, which stop in a hidden tab while the video keeps going.
  const handleVisibility = () => {
    if (!running) return;
    if (document.hidden) {
      pausedWhileHidden = true;
      video.pause();
    } else if (pausedWhileHidden) {
      pausedWhileHidden = false;
      video.play().catch((err) => showError("Couldn't resume this video", err));
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  $("#form").addEventListener("click", async () => {
    const out = $("#form-results");
    out.innerHTML = "<p>Checking...</p>";
    try {
      const labeled = (await getLabeledReps()).filter((r) => r.label);
      const classify = await loadClassifier();
      if (leftPage) return;
      if (!labeled.length) {
        out.innerHTML = `<p>No labeled reps yet. <a href="#/labeler">Label some</a> first.</p>`;
        return;
      }
      // Lockout isn't saved with labeled reps, so the rules here cover depth and lean only.
      const rules = labeled.map((r) => ({ truth: r.label, predicted: checkForm(r).length ? "bad" : "good" }));
      const withModel = labeled.filter((r) => classify(r));
      const model = withModel.map((r) => ({ truth: r.label, predicted: classify(r).label }));
      out.innerHTML =
        matrixHtml("Form rules", "Flagged = predicted bad. Depth and lean only; lockout isn't saved with labels.", "", confusionMatrix(rules)) +
        matrixHtml(
          "Trained classifier",
          "Predicted from each rep's knee angle, lean, depth and time.",
          "No trained model found. Run <code>python ml/train.py</code> once there are enough labeled reps.",
          confusionMatrix(model)
        ) +
        (withModel.length
          ? `<p>The classifier was trained on these same reps if they're in <code>data/labels.csv</code>, so this overstates how it does on new people.
              The cross-person test in <code>python ml/train.py</code> is the fair number.</p>`
          : "");
    } catch (err) {
      console.error(err);
      if (!leftPage) out.innerHTML = `<p>Couldn't check: ${escapeHtml(err.message)}</p>`;
    }
  });

  return () => {
    leftPage = true;
    document.removeEventListener("visibilitychange", handleVisibility);
    abort?.();
    video.pause();
  };
}
