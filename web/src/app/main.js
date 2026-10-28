// App entry: simple hash router. Jacob owns everything in app/.
import { renderLiveSet } from "./pages/liveSet.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderHistory } from "./pages/history.js";
import { renderLabeler } from "./pages/labeler.js";

const routes = {
  "#/live": renderLiveSet,
  "#/dashboard": renderDashboard,
  "#/history": renderHistory,
  "#/labeler": renderLabeler,
};

let cleanup = null;

function route() {
  if (cleanup) cleanup();
  const render = routes[location.hash] || renderLiveSet;
  const page = document.getElementById("page");
  page.innerHTML = "";
  cleanup = render(page) || null;
}

window.addEventListener("hashchange", route);
route();
