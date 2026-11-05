// HTML for one saved set: a summary plus a per-rep table. Used by Dashboard and History.

const FLAG_LABELS = {
  shallow: "Shallow",
  excessive_lean: "Too much lean",
  no_lockout: "No lockout",
};

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

export function renderSet(set, number) {
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

/** @returns {string} every set in a session, newest first, numbered in the order they were lifted */
export function renderSets(session) {
  return session.sets.map((set, i) => renderSet(set, i + 1)).reverse().join("");
}
