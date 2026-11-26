// Labeler: run a recorded video through the brain, label each rep, export data/labels.csv.
// Labels save as you go, so re-selecting a video picks up where you left off.
import { startTracking, drawSkeleton } from "../../brain/index.js";
import { getLabeledReps, saveLabeledRep, saveLabeledReps } from "../storage/db.js";
import { FLAG_LABELS } from "../components/setDetails.js";

const CSV_COLUMNS = ["video", "rep", "person", "label", "fault", "minKneeAngle", "maxTorsoLean", "hitDepth", "durationMs"];
const WATCH_PADDING_SEC = 0.5; // show a little either side of each rep

// The Labeler is for squats only, so leave out the pushup fault.
const SQUAT_FAULTS = Object.entries(FLAG_LABELS).filter(([flag]) => flag !== "body_bend");
const FAULT_OPTIONS = [...SQUAT_FAULTS, ["other", "Other"]];

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(records) {
  const rows = records.map((r) =>
    CSV_COLUMNS.map((column) => csvCell(column === "hitDepth" ? Number(r.hitDepth) : r[column])).join(",")
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n") + "\n";
}

function repRow(r, i) {
  const faults = FAULT_OPTIONS.map(
    ([value, text]) => `<option value="${value}" ${r.fault === value ? "selected" : ""}>${text}</option>`
  ).join("");
  return `
    <tr data-index="${i}">
      <td>${r.rep}</td>
      <td><button type="button" class="watch">Watch</button></td>
      <td>${r.minKneeAngle}°</td>
      <td>${r.maxTorsoLean}°</td>
      <td>${r.hitDepth ? "Yes" : "No"}</td>
      <td>${(r.durationMs / 1000).toFixed(1)}s</td>
      <td class="label-choice">
        <label><input type="radio" name="label-${i}" value="good" ${r.label === "good" ? "checked" : ""} /> Good</label>
        <label><input type="radio" name="label-${i}" value="bad" ${r.label === "bad" ? "checked" : ""} /> Bad</label>
      </td>
      <td>
        <select class="fault" aria-label="Fault for rep ${r.rep}" ${r.label === "bad" ? "" : "disabled"}>
          <option value="">Not sure</option>${faults}
        </select>
      </td>
    </tr>`;
}

export function renderLabeler(page) {
  page.innerHTML = `
    <h1>Labeler</h1>
    <div class="controls">
      <label>Video <input id="file" type="file" accept="video/*" required /></label>
      <label>Person <input id="person" type="text" autocomplete="off" required /></label>
      <button id="analyze" type="button">Analyze</button>
    </div>
    <p id="status" role="status"></p>
    <div class="stage">
      <video id="video" playsinline muted></video>
      <canvas id="overlay"></canvas>
    </div>
    <div id="review"></div>
    <p id="totals"></p>
    <button id="export" type="button" disabled>Export labels.csv</button>
  `;

  const $ = (selector) => page.querySelector(selector);
  const fileInput = $("#file");
  const personInput = $("#person");
  const analyzeButton = $("#analyze");
  const status = $("#status");
  const video = $("#video");
  const canvas = $("#overlay");
  const review = $("#review");
  const totals = $("#totals");
  const exportButton = $("#export");

  let videoName = null;
  let videoUrl = null;
  let reps = []; // records for the current video
  let stopTracking = null;
  let starting = false;
  let pausedWhileHidden = false;
  let watchUntil = null;
  let leftPage = false;

  const showError = (prefix, err) => {
    console.error(err);
    status.textContent = `${prefix}: ${err.message}`;
  };

  const clearOverlay = () => canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

  const updateTotals = async () => {
    const all = await getLabeledReps();
    if (leftPage) return;
    const labeled = all.filter((r) => r.label);
    const videos = new Set(labeled.map((r) => r.video)).size;
    totals.textContent = `Labeled so far: ${labeled.length} ${labeled.length === 1 ? "rep" : "reps"} across ${videos} ${videos === 1 ? "video" : "videos"}.`;
    exportButton.disabled = !labeled.length;
  };

  const renderReview = () => {
    if (!reps.length) {
      review.innerHTML = "";
      return;
    }
    const done = reps.filter((r) => r.label).length;
    review.innerHTML = `
      <h2 class="section-title">Label reps</h2>
      <p id="progress">${done} of ${reps.length} labeled</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Rep</th><th></th><th>Knee</th><th>Lean</th><th>Depth</th><th>Time</th><th>Label</th><th>Fault</th></tr>
          </thead>
          <tbody>${reps.map(repRow).join("")}</tbody>
        </table>
      </div>
      <p><button id="remove" type="button">Remove this video's reps</button></p>`;
  };

  const setBusy = (busy) => {
    fileInput.disabled = busy;
    personInput.disabled = busy;
    video.controls = !busy && Boolean(videoName);
    exportButton.disabled = busy || exportButton.disabled;
  };

  const loadVideo = async (file) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoName = file.name;
    videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.controls = true;
    watchUntil = null;
    clearOverlay();
    try {
      reps = await getLabeledReps(file.name);
    } catch (err) {
      showError("Couldn't load saved labels", err);
      reps = [];
    }
    if (leftPage) return;
    if (reps.length) {
      personInput.value = reps[0].person;
      status.textContent = `Loaded ${reps.length} saved reps for this video.`;
    } else {
      status.textContent = "";
    }
    analyzeButton.textContent = reps.length ? "Analyze again" : "Analyze";
    renderReview();
  };

  const finishAnalysis = async () => {
    if (!stopTracking) return;
    stopTracking();
    stopTracking = null;
    pausedWhileHidden = false;
    clearOverlay();
    setBusy(false);
    analyzeButton.textContent = "Analyze again";
    renderReview();
    try {
      await saveLabeledReps(videoName, reps);
      await updateTotals();
      status.textContent = reps.length
        ? `Found ${reps.length} ${reps.length === 1 ? "rep" : "reps"}. Watch each one and label it.`
        : "No reps found in this video.";
    } catch (err) {
      showError("Couldn't save these reps", err);
    }
  };

  const analyze = async () => {
    if (!fileInput.reportValidity() && !videoName) return;
    if (!personInput.reportValidity()) return;
    if (reps.some((r) => r.label) && !confirm("Analyzing again replaces this video's labels. Continue?")) return;

    const person = personInput.value.trim();
    const previousReps = reps;
    reps = [];
    review.innerHTML = "";
    watchUntil = null;
    video.pause();
    video.currentTime = 0;
    starting = true;
    analyzeButton.disabled = true;
    setBusy(true);
    status.textContent = "Starting... keep this tab visible while the video plays.";

    try {
      const stop = await startTracking(video, {
        mode: "file",
        mock: false,
        onFrame: (frame) => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          drawSkeleton(canvas, frame.landmarks);
        },
        onRep: (rep) => {
          reps.push({
            video: videoName,
            rep: rep.rep,
            person,
            label: "",
            fault: "",
            minKneeAngle: rep.minKneeAngle,
            maxTorsoLean: rep.maxTorsoLean,
            hitDepth: rep.hitDepth,
            durationMs: rep.durationMs,
            endSec: video.currentTime,
          });
          status.textContent = `Analyzing... ${reps.length} ${reps.length === 1 ? "rep" : "reps"} so far. Keep this tab visible.`;
        },
        onEnd: finishAnalysis,
      });
      if (leftPage) {
        stop();
        return;
      }
      stopTracking = stop;
      analyzeButton.textContent = "Stop";
      status.textContent = "Analyzing... keep this tab visible.";
    } catch (err) {
      showError("Couldn't analyze this video. An MP4 (H.264) is the safest format to try", err);
      // Nothing was replaced, so put the saved reps back on screen.
      reps = previousReps;
      setBusy(false);
      analyzeButton.textContent = reps.length ? "Analyze again" : "Analyze";
      renderReview();
      updateTotals().catch((e) => showError("Couldn't load saved labels", e));
    }
    starting = false;
    analyzeButton.disabled = false;
  };

  const watchRep = (record) => {
    const start = record.endSec - record.durationMs / 1000 - WATCH_PADDING_SEC;
    watchUntil = record.endSec + WATCH_PADDING_SEC;
    video.currentTime = Math.max(0, start);
    video.play().catch((err) => showError("Couldn't play this video", err));
  };

  const saveRecord = (record) =>
    saveLabeledRep(record)
      .then(updateTotals)
      .catch((err) => showError("Couldn't save that label", err));

  // Tracking runs on animation frames, which stop in a hidden tab while the video keeps going.
  // Pausing with it means no reps get skipped.
  const handleVisibility = () => {
    if (!stopTracking) return;
    if (document.hidden) {
      pausedWhileHidden = true;
      video.pause();
    } else if (pausedWhileHidden) {
      pausedWhileHidden = false;
      video.play().catch((err) => showError("Couldn't resume this video", err));
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  video.addEventListener("timeupdate", () => {
    if (watchUntil !== null && video.currentTime >= watchUntil) {
      video.pause();
      watchUntil = null;
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) loadVideo(fileInput.files[0]);
  });

  personInput.addEventListener("change", () => {
    const person = personInput.value.trim();
    if (!person || !reps.length || stopTracking || starting) return;
    reps.forEach((r) => {
      r.person = person;
    });
    saveLabeledReps(videoName, reps).catch((err) => showError("Couldn't update the person", err));
  });

  analyzeButton.addEventListener("click", () => (stopTracking ? finishAnalysis() : analyze()));

  review.addEventListener("click", async (e) => {
    if (e.target.classList.contains("watch")) {
      watchRep(reps[e.target.closest("tr").dataset.index]);
    } else if (e.target.id === "remove") {
      if (!confirm("Remove this video's reps and labels?")) return;
      reps = [];
      renderReview();
      analyzeButton.textContent = "Analyze";
      status.textContent = "Removed.";
      saveLabeledReps(videoName, [])
        .then(updateTotals)
        .catch((err) => showError("Couldn't remove these reps", err));
    }
  });

  review.addEventListener("change", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const record = reps[row.dataset.index];
    const fault = row.querySelector(".fault");
    if (e.target.type === "radio") {
      record.label = e.target.value;
      if (record.label === "good") {
        record.fault = "";
        fault.value = "";
      }
      fault.disabled = record.label !== "bad";
      page.querySelector("#progress").textContent = `${reps.filter((r) => r.label).length} of ${reps.length} labeled`;
    } else {
      record.fault = e.target.value;
    }
    saveRecord(record);
  });

  exportButton.addEventListener("click", async () => {
    try {
      const labeled = (await getLabeledReps()).filter((r) => r.label);
      const url = URL.createObjectURL(new Blob([toCsv(labeled)], { type: "text/csv" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: "labels.csv" });
      link.click();
      URL.revokeObjectURL(url);
      status.textContent = `Exported ${labeled.length} labeled ${labeled.length === 1 ? "rep" : "reps"}. Save it as data/labels.csv.`;
    } catch (err) {
      showError("Couldn't export", err);
    }
  });

  updateTotals().catch((err) => showError("Couldn't load saved labels", err));

  return () => {
    leftPage = true;
    document.removeEventListener("visibilitychange", handleVisibility);
    if (stopTracking) stopTracking();
    stopTracking = null;
    video.pause();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  };
}
