// Dashboard: the latest session, with a summary and per-rep table for each set.
import { getSessions } from "../storage/db.js";

const FLAG_LABELS = {
  shallow: "Shallow",
  excessive_lean: "Too much lean",
  no_lockout: "No lockout",
};

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

function summarize(reps) {
  return {
    count: reps.length,
    avgKnee: Math.round(average(reps.map((r) => r.minKneeAngle))),
    maxLean: Math.max(...reps.map((r) => r.maxTorsoLean)),
    hitDepth: reps.filter((r) => r.hitDepth).length,
    flagged: reps.filter((r) => r.ruleFlags.length).length,
    avgDuration: average(reps.map((r) => r.durationMs)),
  };
}

function stat(label, value) {
  return `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
}

function renderRep(rep, showClassifier) {
  const flags = rep.ruleFlags.map((f) => escapeHtml(FLAG_LABELS[f] ?? f)).join(", ") || "None";
  const classifier = rep.classifier
    ? `${escapeHtml(rep.classifier.label)} (${Math.round(rep.classifier.confidence * 100)}%)`
    : "-";
  return `
    <tr>
      <td>${rep.rep}</td>
      <td>${rep.minKneeAngle}°</td>
      <td>${rep.maxTorsoLean}°</td>
      <td>${rep.hitDepth ? "Yes" : "No"}</td>
      <td>${seconds(rep.durationMs)}</td>
      <td>${flags}</td>
      ${showClassifier ? `<td>${classifier}</td>` : ""}
    </tr>`;
}

function renderSet(set, number) {
  const time = new Date(set.id).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const weight = set.weightLbs ? `${set.weightLbs} lb` : "Bodyweight";
  const heading = `<h2>Set ${number}: ${escapeHtml(weight)}, ${escapeHtml(time)}</h2>`;
  if (!set.reps.length) return `<section class="set">${heading}<p>No reps in this set.</p></section>`;

  const s = summarize(set.reps);
  const showClassifier = set.reps.some((r) => r.classifier);
  return `
    <section class="set">
      ${heading}
      <div class="stats">
        ${stat("Reps", s.count)}
        ${stat("Hit depth", `${s.hitDepth}/${s.count}`)}
        ${stat("Flagged", `${s.flagged}/${s.count}`)}
        ${stat("Avg knee angle", `${s.avgKnee}°`)}
        ${stat("Max lean", `${s.maxLean}°`)}
        ${stat("Avg rep time", seconds(s.avgDuration))}
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rep</th><th>Knee</th><th>Lean</th><th>Depth</th><th>Time</th><th>Flags</th>
              ${showClassifier ? "<th>Classifier</th>" : ""}
            </tr>
          </thead>
          <tbody>${set.reps.map((r) => renderRep(r, showClassifier)).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function sessionHeading(date) {
  // Parse as local time; a bare "YYYY-MM-DD" would be read as UTC and can show the day before.
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function renderDashboard(page) {
  let leftPage = false;
  page.innerHTML = `<h1>Dashboard</h1><p>Loading...</p>`;

  getSessions()
    .then(([latest]) => {
      if (leftPage) return;
      if (!latest) {
        page.innerHTML = `<h1>Dashboard</h1><p>No workouts yet. <a href="#/live">Record a set</a> to see it here.</p>`;
        return;
      }
      // Newest set first, numbered in the order they were lifted.
      const sets = latest.sets.map((set, i) => renderSet(set, i + 1)).reverse();
      page.innerHTML = `<h1>Dashboard</h1><p>${escapeHtml(sessionHeading(latest.date))}</p>${sets.join("")}`;
    })
    .catch((err) => {
      console.error(err);
      if (!leftPage) page.innerHTML = `<h1>Dashboard</h1><p>Couldn't load your workouts: ${escapeHtml(err.message)}</p>`;
    });

  return () => {
    leftPage = true;
  };
}
