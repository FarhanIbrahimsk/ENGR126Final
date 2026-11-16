// History: progress charts across sessions, then every past session, newest first.
import { getSessions } from "../storage/db.js";
import { renderLineChart } from "../components/lineChart.js";
import { escapeHtml, formatSessionDate, renderSets, sessionDay } from "../components/setDetails.js";

function summarize(session) {
  const sets = session.sets.filter((s) => s.reps.length);
  const reps = sets.flatMap((s) => s.reps);
  return {
    x: sessionDay(session.date).getTime(),
    sets: sets.length,
    reps: reps.length,
    topWeight: sets.length ? Math.max(...sets.map((s) => s.weightLbs)) : 0,
    avgKnee: reps.length ? Math.round(reps.reduce((sum, r) => sum + r.minKneeAngle, 0) / reps.length) : null,
    hitDepth: reps.filter((r) => r.hitDepth).length,
  };
}

const CHARTS = [
  { title: "Top weight", note: "Heaviest set each session", value: (s) => s.topWeight || null, format: (y) => `${y} lb` },
  { title: "Reps", note: "Total reps each session", value: (s) => s.reps || null, format: (y) => `${y}` },
  { title: "Average knee angle", note: "Lower is deeper", value: (s) => s.avgKnee, format: (y) => `${y}°` },
];

function summaryText(s) {
  const parts = [
    `${s.sets} ${s.sets === 1 ? "set" : "sets"}`,
    `${s.reps} ${s.reps === 1 ? "rep" : "reps"}`,
    s.topWeight ? `top ${s.topWeight} lb` : "bodyweight",
  ];
  if (s.reps) parts.push(`avg knee ${s.avgKnee}°`, `depth ${s.hitDepth}/${s.reps}`);
  return parts.join(" · ");
}

export function renderHistory(page) {
  let leftPage = false;
  const stopCharts = [];
  page.innerHTML = `<h1>History</h1><p>Loading...</p>`;

  getSessions()
    .then((sessions) => {
      if (leftPage) return;
      if (!sessions.length) {
        page.innerHTML = `<h1>History</h1><p>No workouts yet. <a href="#/live">Record a set</a> to start tracking progress.</p>`;
        return;
      }

      const summaries = new Map(sessions.map((s) => [s, summarize(s)]));
      page.innerHTML = `
        <h1>History</h1>
        <h2 class="section-title">Progress</h2>
        <div id="charts" class="charts"></div>
        <h2 class="section-title">Sessions</h2>
        <div class="sessions">
          ${sessions.map((session) => `
            <details class="session">
              <summary>
                <strong>${escapeHtml(formatSessionDate(session.date))}</strong>
                <span>${escapeHtml(summaryText(summaries.get(session)))}</span>
              </summary>
              ${renderSets(session)}
            </details>`).join("")}
        </div>`;

      const chartsEl = page.querySelector("#charts");
      const oldestFirst = [...summaries.values()].reverse();
      const drawn = CHARTS.map((chart) => {
        const points = oldestFirst
          .map((s) => ({ x: s.x, y: chart.value(s) }))
          .filter((p) => p.y !== null);
        if (points.length < 2) return false;

        const section = document.createElement("section");
        const heading = document.createElement("h3");
        heading.textContent = chart.title;
        const note = document.createElement("p");
        note.className = "chart-note";
        note.textContent = chart.note;
        const body = document.createElement("div");
        section.append(heading, note, body);
        chartsEl.append(section);
        stopCharts.push(renderLineChart(body, { points, format: chart.format, label: `${chart.title} over time` }));
        return true;
      });
      if (!drawn.some(Boolean)) {
        chartsEl.innerHTML = `<p>Charts appear once you have two sessions on different days.</p>`;
      }
    })
    .catch((err) => {
      console.error(err);
      if (!leftPage) page.innerHTML = `<h1>History</h1><p>Couldn't load your workouts: ${escapeHtml(err.message)}</p>`;
    });

  return () => {
    leftPage = true;
    stopCharts.forEach((stop) => stop());
  };
}
