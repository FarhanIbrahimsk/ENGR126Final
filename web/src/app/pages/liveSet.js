// Live Set page: run a set with real tracking and save it when it ends.
// Add ?mock to the URL for fake reps with no camera, e.g. http://localhost:5173/?mock#/live
import { startTracking, drawSkeleton } from "../../brain/index.js";
import { saveSet } from "../storage/db.js";

const useMock = new URLSearchParams(location.search).has("mock");

function repText(rep) {
  const stats = `knee ${rep.minKneeAngle}°, lean ${rep.maxTorsoLean}°, depth ${rep.hitDepth ? "yes" : "no"}, ${(rep.durationMs / 1000).toFixed(1)}s`;
  const flags = rep.ruleFlags.length ? ` (${rep.ruleFlags.join(", ")})` : "";
  return `Rep ${rep.rep}: ${stats}${flags}`;
}

export function renderLiveSet(page) {
  page.innerHTML = `
    <h1>Live Set</h1>
    <div class="stage">
      <video id="video" autoplay playsinline muted></video>
      <canvas id="overlay"></canvas>
    </div>
    <div id="readout" class="readout"></div>
    <div class="controls">
      <label>Weight (lb) <input id="weight" type="number" min="0" step="any" inputmode="decimal" required /></label>
      <button id="toggle">Start set</button>
      <span>Reps: <strong id="count">0</strong></span>
    </div>
    <p id="status" role="status"></p>
    <ol id="reps"></ol>
  `;

  const $ = (selector) => page.querySelector(selector);
  const video = $("#video");
  const canvas = $("#overlay");
  const readout = $("#readout");
  const weight = $("#weight");
  const button = $("#toggle");
  const count = $("#count");
  const status = $("#status");
  const list = $("#reps");

  let stopTracking = null;
  let currentSet = null;
  let leftPage = false;

  const onFrame = (frame) => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    drawSkeleton(canvas, frame.landmarks);
    readout.textContent = `knee ${Math.round(frame.kneeAngle)}°  lean ${Math.round(frame.torsoLean)}°  ${frame.phase}`;
  };

  const startSet = async () => {
    if (!weight.reportValidity()) return;
    const set = { id: new Date().toISOString(), lift: "squat", weightLbs: Number(weight.value), reps: [] };

    button.disabled = true;
    weight.disabled = true;
    status.textContent = "Starting...";
    list.innerHTML = "";
    count.textContent = "0";

    const onRep = (rep) => {
      set.reps.push(rep);
      count.textContent = set.reps.length;
      const li = document.createElement("li");
      li.textContent = repText(rep);
      list.appendChild(li);
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
      status.textContent = "";
    } catch (err) {
      console.error(err);
      status.textContent = `Couldn't start tracking: ${err.message}`;
      weight.disabled = false;
    }
    button.disabled = false;
  };

  const finishSet = async () => {
    const set = currentSet;
    stopTracking();
    stopTracking = null;
    currentSet = null;

    button.textContent = "Start set";
    weight.disabled = false;
    readout.textContent = "";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    if (!set.reps.length) {
      status.textContent = "No reps counted, so nothing was saved.";
      return;
    }
    try {
      await saveSet(set);
      status.textContent = `Saved ${set.reps.length} reps at ${set.weightLbs} lb.`;
    } catch (err) {
      console.error(err);
      status.textContent = `Couldn't save this set: ${err.message}`;
    }
  };

  button.onclick = () => (currentSet ? finishSet() : startSet());

  return () => {
    leftPage = true;
    if (currentSet) finishSet();
  };
}
