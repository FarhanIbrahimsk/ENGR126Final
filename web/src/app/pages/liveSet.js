// Live Set page — placeholder that proves the brain -> app connection works.
import { startTracking } from "../../brain/index.js";

export function renderLiveSet(page) {
  page.innerHTML = `
    <h1>Live Set</h1>
    <video id="video" autoplay playsinline muted></video>
    <button id="toggle">Start set</button>
    <ol id="reps"></ol>
  `;

  const video = page.querySelector("#video");
  const button = page.querySelector("#toggle");
  const list = page.querySelector("#reps");
  let stop = null;

  button.onclick = async () => {
    if (stop) {
      stop();
      stop = null;
      button.textContent = "Start set";
      return;
    }
    list.innerHTML = "";
    stop = await startTracking(video, {
      lift: "squat",
      mock: true,
      onRep: (rep) => {
        const li = document.createElement("li");
        li.textContent = rep.ruleFlags.length ? `Rep ${rep.rep}: ${rep.ruleFlags.join(", ")}` : `Rep ${rep.rep}: clean`;
        list.appendChild(li);
      },
    });
    button.textContent = "Stop set";
  };

  return () => stop && stop();
}
