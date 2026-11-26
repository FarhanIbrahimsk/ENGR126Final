// HTML for one saved set: a summary plus a collapsible per-rep table. Used by Dashboard and History.
import { THRESHOLDS } from "../../brain/formRules.js";

export const FLAG_LABELS = {
  shallow: "Shallow",
  excessive_lean: "Too much lean",
  body_bend: "Hips sagging or piked",
  no_lockout: "No lockout",
};

// What to show for each exercise: which rep fields hold its two angles, and what to call them.
const LIFT_INFO = {
  squat: { name: "Squat", angleKey: "minKneeAngle", angle: "Knee", tiltKey: "maxTorsoLean", tilt: "Lean" },
  pushup: { name: "Pushup", angleKey: "minElbowAngle", angle: "Elbow", tiltKey: "maxBodyBend", tilt: "Body bend" },
};
export const liftInfo = (lift) => LIFT_INFO[lift] ?? LIFT_INFO.squat;

export const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

// A session's date as local midnight; a bare "YYYY-MM-DD" would be read as UTC and can show
// the day before.
export const sessionDay = (date) => new Date(`${date}T00:00:00`);

export function formatSessionDate(date) {
  return sessionDay(date).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function summarize(reps, info) {
  return {
    count: reps.length,
    avgAngle: Math.round(average(reps.map((r) => r[info.angleKey]))),
    maxTilt: Math.max(...reps.map((r) => r[info.tiltKey])),
    hitDepth: reps.filter((r) => r.hitDepth).length,
    flagged: reps.filter((r) => r.ruleFlags.length).length,
    avgDuration: average(reps.map((r) => r.durationMs)),
  };
}

// rank sets how much room a stat gets: "primary", "secondary" or "minor".
function stat(rank, label, value) {
  return `<div class="stat stat-${rank}"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
}

// Color coding for the rep table. Red limits come from the form rules; the rest only affect color.
const BEST_ANGLE = 90; // knee or elbow bent this far or further is ideal
const TILT_MARGIN = 10; // lean or body bend this close to its limit is only okay
const FAST_MS = 1500;
const SLOW_MS = 3500;

function angleTone(rep, info) {
  if (rep.ruleFlags.includes("shallow")) return "bad";
  return rep[info.angleKey] <= BEST_ANGLE ? "good" : "okay";
}

function tiltTone(rep, info) {
  const limit = rep.lift === "pushup" ? THRESHOLDS.maxBodyBend : THRESHOLDS.maxTorsoLean;
  if (rep[info.tiltKey] > limit) return "bad";
  return rep[info.tiltKey] < limit - TILT_MARGIN ? "good" : "okay";
}

function timeTone(ms) {
  if (ms < FAST_MS) return "fast";
  return ms <= SLOW_MS ? "good" : "okay";
}

function renderRep(rep, info, showClassifier) {
  const flags =
    rep.ruleFlags.map((f) => `<span class="chip bad">${escapeHtml(FLAG_LABELS[f] ?? f)}</span>`).join("") ||
    `<span class="muted">None</span>`;
  const classifier = rep.classifier
    ? `<span class="chip ${rep.classifier.label === "bad" ? "bad" : "good"}">${escapeHtml(rep.classifier.label)} ${Math.round(rep.classifier.confidence * 100)}%</span>`
    : "-";
  return `
    <tr>
      <td class="num">${rep.rep}</td>
      <td class="num tone-${angleTone(rep, info)}">${rep[info.angleKey]}°</td>
      <td class="num tone-${tiltTone(rep, info)}">${rep[info.tiltKey]}°</td>
      <td class="tone-${rep.hitDepth ? "good" : "bad"}">${rep.hitDepth ? "Yes" : "No"}</td>
      <td class="num tone-${timeTone(rep.durationMs)}">${seconds(rep.durationMs)}</td>
      <td>${flags}</td>
      ${showClassifier ? `<td>${classifier}</td>` : ""}
    </tr>`;
}

export function renderSet(set, number) {
  const time = new Date(set.id).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const info = liftInfo(set.lift);
  const weight = set.weightLbs ? `${set.weightLbs} lb` : "Bodyweight";
  const heading = `<h2>Set ${number}: ${info.name}, ${escapeHtml(weight)}, ${escapeHtml(time)}</h2>`;
  if (!set.reps.length) return `<section class="set">${heading}<p>No reps in this set.</p></section>`;

  const s = summarize(set.reps, info);
  const showClassifier = set.reps.some((r) => r.classifier);
  return `
    <section class="set ${s.flagged ? "set-flagged" : "set-clean"}">
      ${heading}
      <div class="stats">
        ${stat("primary", "Total reps", s.count)}
        ${stat("secondary", "Full-depth reps", `${s.hitDepth}/${s.count}`)}
        ${stat("secondary", "Reps with form issues", `${s.flagged}/${s.count}`)}
        ${stat("minor", `Avg ${info.angle.toLowerCase()} angle`, `${s.avgAngle}°`)}
        ${stat("minor", `Max ${info.tilt.toLowerCase()}`, `${s.maxTilt}°`)}
        ${stat("minor", "Avg rep time", seconds(s.avgDuration))}
      </div>
      <details class="reps">
        <summary>
          <span class="when-closed">Show ${s.count === 1 ? "rep" : `all ${s.count} reps`}</span>
          <span class="when-open">Hide ${s.count === 1 ? "rep" : "reps"}</span>
        </summary>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rep</th><th>${info.angle}</th><th>${info.tilt}</th><th>Depth</th><th>Time</th><th>Flags</th>
                ${showClassifier ? "<th>Classifier</th>" : ""}
              </tr>
            </thead>
            <tbody>${set.reps.map((r) => renderRep(r, info, showClassifier)).join("")}</tbody>
          </table>
        </div>
      </details>
    </section>`;
}

/** @returns {string} every set in a session, newest first, numbered in the order they were lifted */
export function renderSets(session) {
  return session.sets.map((set, i) => renderSet(set, i + 1)).reverse().join("");
}
