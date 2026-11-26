// Live Set page: run a set with real tracking and save it when it ends.
// Add ?mock to the URL for fake reps with no camera, e.g. http://localhost:5173/?mock#/live
import { startTracking, drawSkeleton } from "../../brain/index.js";
import { saveSet } from "../storage/db.js";
import { FLAG_LABELS, escapeHtml } from "../components/setDetails.js";

const useMock = new URLSearchParams(location.search).has("mock");
const BANNER_SECONDS = 4;
const TRACKING_LOST_MS = 1500; // no pose for this long while a set is running

const isSuccessful = (rep) => !rep.ruleFlags.length && rep.classifier?.label !== "bad";

function repItem(rep) {
  const flagged = !isSuccessful(rep);
  const tags = rep.ruleFlags.map((f) => FLAG_LABELS[f] ?? f);
  if (rep.classifier) tags.push(`Model: ${rep.classifier.label} ${Math.round(rep.classifier.confidence * 100)}%`);
  const li = document.createElement("li");
  li.className = flagged ? "rep-item flagged" : "rep-item";
  li.innerHTML = `
    <span class="rep-num">${String(rep.rep).padStart(2, "0")}</span>
    <span class="rep-stats">KNEE ${rep.minKneeAngle}° · LEAN ${rep.maxTorsoLean}° · ${(rep.durationMs / 1000).toFixed(1)}s</span>
    <span class="rep-tags">${tags.length ? tags.map((t) => `<span class="chip bad">${escapeHtml(t)}</span>`).join("") : `<span class="chip good">Clean</span>`}</span>`;
  return li;
}

function bannerFor(rep) {
  const faults = rep.ruleFlags.map((f) => FLAG_LABELS[f] ?? f);
  if (rep.classifier?.label === "bad") faults.push("Model flags form");
  return faults.length
    ? { kind: "bad", text: `Rep ${rep.rep}: ${faults.join(", ")}` }
    : { kind: "good", text: `Rep ${rep.rep}: Clean` };
}

export function renderLiveSet(page) {
  page.innerHTML = `
    <h1 class="sr-only">Live Set</h1>
    <div class="stage viewfinder">
      <video id="video" autoplay playsinline muted></video>
      <canvas id="overlay"></canvas>
      <div class="hud-counter" aria-live="polite">
        <span class="hud-label">Successful<br /><span id="attempts">of 0</span></span>
        <strong id="count" class="num">0</strong>
      </div>
      <div class="hud-phase" id="phase">Idle</div>
    </div>

    <div class="telemetry" aria-label="Live angles">
      <div class="tile"><span class="tile-label">Knee</span><span id="knee" class="tile-value num">--</span></div>
      <div class="tile"><span class="tile-label">Lean</span><span id="lean" class="tile-value num">--</span></div>
    </div>

    <ol id="reps" class="rep-list"></ol>

    <div class="dock">
      <div id="banner" class="banner" role="status" hidden></div>
      <p id="status" role="status" class="dock-status"></p>
      <div class="action-bar">
        <label class="weight-field">
          <span>Weight (lb)</span>
          <input id="weight" type="number" min="0" step="any" inputmode="decimal" required />
        </label>
        <button id="toggle" type="button" class="primary">Start set</button>
      </div>
    </div>
  `;

  const $ = (selector) => page.querySelector(selector);
  const video = $("#video");
  const canvas = $("#overlay");
  const weight = $("#weight");
  const button = $("#toggle");
  const count = $("#count");
  const attempts = $("#attempts");
  const status = $("#status");
  const list = $("#reps");
  const banner = $("#banner");
  const phase = $("#phase");
  const knee = $("#knee");
  const lean = $("#lean");

  let stopTracking = null;
  let currentSet = null;
  let leftPage = false;
  let lastFrameAt = 0;
  let bannerTimer = null;
  let lostTimer = null;
  let trackingLost = false;

  const showBanner = (kind, text, seconds = BANNER_SECONDS) => {
    clearTimeout(bannerTimer);
    banner.className = `banner ${kind}`;
    banner.textContent = text;
    banner.hidden = false;
    if (seconds) bannerTimer = setTimeout(() => (banner.hidden = true), seconds * 1000);
  };

  const resetReadout = () => {
    knee.textContent = "--";
    lean.textContent = "--";
    phase.textContent = "Idle";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  const onFrame = (frame) => {
    lastFrameAt = performance.now();
    if (trackingLost) {
      trackingLost = false;
      banner.hidden = true;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    drawSkeleton(canvas, frame.landmarks);
    knee.textContent = `${Math.round(frame.kneeAngle)}°`;
    lean.textContent = `${Math.round(frame.torsoLean)}°`;
    phase.textContent = frame.phase;
  };

  const startSet = async () => {
    if (!weight.reportValidity()) return;
    const set = { id: new Date().toISOString(), lift: "squat", weightLbs: Number(weight.value), reps: [] };

    button.disabled = true;
    weight.disabled = true;
    status.textContent = "Starting tracker...";
    list.innerHTML = "";
    count.textContent = "0";
    attempts.textContent = "of 0";
    banner.hidden = true;

    const onRep = (rep) => {
      set.reps.push(rep);
      count.textContent = set.reps.filter(isSuccessful).length;
      attempts.textContent = `of ${set.reps.length}`;
      list.prepend(repItem(rep));
      const { kind, text } = bannerFor(rep);
      showBanner(kind, text);
    };

    try {
      const stop = await startTracking(video, { lift: set.lift, mock: useMock, onFrame, onRep });
      if (leftPage) {
        stop(); // Left while the model was loading; don't keep the camera on.
        return;
      }
      stopTracking = stop;
      currentSet = set;
      button.textContent = "Stop set";
      button.classList.remove("primary");
      button.classList.add("stop");
      status.textContent = "";
      lastFrameAt = performance.now();
      if (!useMock) {
        lostTimer = setInterval(() => {
          if (performance.now() - lastFrameAt > TRACKING_LOST_MS && !trackingLost) {
            trackingLost = true;
            showBanner("bad", "Tracking lost: re-enter camera frame", 0);
          }
        }, 500);
      }
    } catch (err) {
      console.error(err);
      status.textContent = `Tracker failed to start: ${err.message}`;
      weight.disabled = false;
    }
    button.disabled = false;
  };

  const finishSet = async () => {
    const set = currentSet;
    stopTracking();
    stopTracking = null;
    currentSet = null;
    clearInterval(lostTimer);
    clearTimeout(bannerTimer);
    trackingLost = false;
    banner.hidden = true;

    button.textContent = "Start set";
    button.classList.remove("stop");
    button.classList.add("primary");
    weight.disabled = false;
    resetReadout();

    if (!set.reps.length) {
      status.textContent = "No reps counted. Set not saved.";
      return;
    }
    try {
      await saveSet(set);
      const weightText = set.weightLbs ? `${set.weightLbs} lb` : "bodyweight";
      status.textContent = `Saved: ${set.reps.filter(isSuccessful).length} of ${set.reps.length} reps successful, ${weightText}.`;
    } catch (err) {
      console.error(err);
      status.textContent = `Save failed: ${err.message}`;
    }
  };

  button.onclick = () => (currentSet ? finishSet() : startSet());

  return () => {
    leftPage = true;
    clearInterval(lostTimer);
    clearTimeout(bannerTimer);
    if (currentSet) finishSet();
  };
}
