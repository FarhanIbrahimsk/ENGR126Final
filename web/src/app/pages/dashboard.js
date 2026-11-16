// Dashboard: the latest session, with a summary and per-rep table for each set.
import { getSessions } from "../storage/db.js";
import { escapeHtml, formatSessionDate, renderSets } from "../components/setDetails.js";

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
      page.innerHTML = `<h1>Dashboard</h1><p class="eyebrow">${escapeHtml(formatSessionDate(latest.date))}</p>${renderSets(latest)}`;
    })
    .catch((err) => {
      console.error(err);
      if (!leftPage) page.innerHTML = `<h1>Dashboard</h1><p>Couldn't load your workouts: ${escapeHtml(err.message)}</p>`;
    });

  return () => {
    leftPage = true;
  };
}
