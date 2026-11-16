// App entry: simple hash router. Jacob owns everything in app/.
import { renderLiveSet } from "./pages/liveSet.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderHistory } from "./pages/history.js";
import { renderLabeler } from "./pages/labeler.js";
import { renderAccuracy } from "./pages/accuracy.js";

const routes = {
  "#/live": renderLiveSet,
  "#/dashboard": renderDashboard,
  "#/history": renderHistory,
  "#/labeler": renderLabeler,
  "#/accuracy": renderAccuracy,
};

let cleanup = null;

function route() {
  if (cleanup) cleanup();
  const render = routes[location.hash] || renderLiveSet;
  const page = document.getElementById("page");
  page.innerHTML = "";
  cleanup = render(page) || null;
  const current = routes[location.hash] ? location.hash : "#/live";
  document.querySelectorAll("#nav a").forEach((a) => {
    if (a.getAttribute("href") === current) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

window.addEventListener("hashchange", route);
route();
