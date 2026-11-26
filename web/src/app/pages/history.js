// History: progress charts per exercise, then every past session, newest first.
import { getSessions } from "../storage/db.js";
import { renderLineChart } from "../components/lineChart.js";
import { escapeHtml, formatSessionDate, liftInfo, renderSets, sessionDay } from "../components/setDetails.js";

// Totals for one exercise within one session. Squat and pushup numbers are never mixed.
function summarize(session, lift) {
  const info = liftInfo(lift);
  const sets = session.sets.filter((s) => s.reps.length && (s.lift ?? "squat") === lift);
  const reps = sets.flatMap((s) => s.reps);
  return {
    x: sessionDay(session.date).getTime(),
    sets: sets.length,
    reps: reps.length,
    topWeight: sets.length ? Math.max(...sets.map((s) => s.weightLbs)) : 0,
    avgAngle: reps.length ? Math.round(reps.reduce((sum, r) => sum + r[info.angleKey], 0) / reps.length) : null,
    hitDepth: reps.filter((r) => r.hitDepth).length,
  };
}

const repsChart = { title: "Reps", note: "Total reps each session", value: (s) => s.reps || null, format: (y) => `${y}` };
const angleChart = (name) => ({
  title: `Average ${name} angle`,
  note: "Lower is deeper",
  value: (s) => s.avgAngle,
  format: (y) => `${y}°`,
});

const PROGRESS = [
  {
    lift: "squat",
    charts: [
      { title: "Top weight", note: "Heaviest set each session", value: (s) => s.topWeight || null, format: (y) => `${y} lb` },
      repsChart,
      angleChart("knee"),
    ],
  },
  { lift: "pushup", charts: [repsChart, angleChart("elbow")] },
];

function summaryText(session) {
  return PROGRESS.map(({ lift }) => {
    const s = summarize(session, lift);
    if (!s.sets) return null;
    const info = liftInfo(lift);
    const parts = [info.name, `${s.sets} ${s.sets === 1 ? "set" : "sets"}`, `${s.reps} ${s.reps === 1 ? "rep" : "reps"}`];
    if (lift === "squat") parts.push(s.topWeight ? `top ${s.topWeight} lb` : "bodyweight");
    parts.push(`avg ${info.angle.toLowerCase()} ${s.avgAngle}°`, `depth ${s.hitDepth}/${s.reps}`);
    return parts.join(" · ");
  })
    .filter(Boolean)
    .map((text) => `<span>${escapeHtml(text)}</span>`)
    .join("");
}

export function renderHistory(page) {
  let leftPage = false;
  const stopCharts = [];
  page.innerHTML = `<h1>History</h1><p>Loading...</p>`;

  // One chart per measure that has at least two sessions to compare.
  const drawCharts = (container, charts, oldestFirst, name) =>
    charts.forEach((chart) => {
      const points = oldestFirst.map((s) => ({ x: s.x, y: chart.value(s) })).filter((p) => p.y !== null);
      if (points.length < 2) return;

      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = chart.title;
      const note = document.createElement("p");
      note.className = "chart-note";
      note.textContent = chart.note;
      const body = document.createElement("div");
      section.append(heading, note, body);
      container.append(section);
      stopCharts.push(renderLineChart(body, { points, format: chart.format, label: `${name} ${chart.title} over time` }));
    });

  getSessions()
    .then((sessions) => {
      if (leftPage) return;
      if (!sessions.length) {
        page.innerHTML = `<h1>History</h1><p>No workouts yet. <a href="#/live">Record a set</a> to start tracking progress.</p>`;
        return;
      }

      page.innerHTML = `
        <h1>History</h1>
        <div id="progress-charts"></div>
        <h2 class="section-title">Sessions</h2>
        <div class="sessions">
          ${sessions.map((session) => `
            <details class="session">
              <summary>
                <strong>${escapeHtml(formatSessionDate(session.date))}</strong>
                ${summaryText(session)}
              </summary>
              ${renderSets(session)}
            </details>`).join("")}
        </div>`;

      const progress = page.querySelector("#progress-charts");
      for (const { lift, charts } of PROGRESS) {
        const { name } = liftInfo(lift);
        const oldestFirst = sessions.map((s) => summarize(s, lift)).filter((s) => s.sets).reverse();
        if (oldestFirst.length < 2) continue;
        const heading = document.createElement("h2");
        heading.className = "section-title";
        heading.textContent = `${name} progress`;
        const grid = document.createElement("div");
        grid.className = "charts";
        progress.append(heading, grid);
        drawCharts(grid, charts, oldestFirst, name);
      }
      if (!progress.children.length) {
        progress.innerHTML = `<p>Charts appear once an exercise has sessions on two different days.</p>`;
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
