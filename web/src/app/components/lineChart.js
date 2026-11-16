// Small single-series line chart with a time axis, hover/keyboard readout and resizing.

const SVG_NS = "http://www.w3.org/2000/svg";
const HEIGHT = 180;
const MARGIN = { top: 12, right: 60, bottom: 24, left: 40 };
const MAX_MARKERS = 20; // past this, only the latest point gets a dot

function svgEl(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}

// Round axis values covering min..max. Steps are whole numbers: every metric here is one.
function niceTicks(min, max) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const scaled = rough / magnitude;
  const step = Math.max(1, (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * magnitude);
  const ticks = [];
  for (let t = Math.floor(min / step) * step; t < max + step; t += step) ticks.push(t);
  return ticks;
}

const shortDate = (ms) => new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
const longDate = (ms) => new Date(ms).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

/**
 * @param {HTMLElement} container empty element to draw into
 * @param {{ points: { x: number, y: number }[], format: (y: number) => string, label: string }} options
 *   points are in time order, x in ms; label describes the chart for screen readers
 * @returns {() => void} call it to stop watching for resizes
 */
export function renderLineChart(container, { points, format, label }) {
  container.classList.add("chart");
  const svg = svgEl("svg", {
    height: HEIGHT,
    role: "img",
    tabindex: 0,
    "aria-label": `${label}. Latest: ${format(points.at(-1).y)} on ${longDate(points.at(-1).x)}. All values are in the session list below.`,
  });
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  const tooltipValue = document.createElement("strong");
  const tooltipDate = document.createElement("span");
  tooltip.append(tooltipValue, tooltipDate);
  container.append(svg, tooltip);

  let scaled = []; // points in pixel coordinates for the current width
  let crosshair = null;
  let activeDot = null;
  let activeIndex = null;

  const show = (i) => {
    activeIndex = i;
    const p = scaled[i];
    crosshair.setAttribute("x1", p.px);
    crosshair.setAttribute("x2", p.px);
    crosshair.style.display = "";
    activeDot.setAttribute("cx", p.px);
    activeDot.setAttribute("cy", p.py);
    activeDot.style.display = "";
    tooltipValue.textContent = format(points[i].y);
    tooltipDate.textContent = longDate(points[i].x);
    tooltip.hidden = false;
    // Keep the readout inside the chart, flipping left of the point near the right edge.
    const width = container.clientWidth;
    const left = p.px + 12 + tooltip.offsetWidth > width ? p.px - 12 - tooltip.offsetWidth : p.px + 12;
    tooltip.style.left = `${Math.max(0, left)}px`;
  };

  const hide = () => {
    activeIndex = null;
    crosshair.style.display = "none";
    activeDot.style.display = "none";
    tooltip.hidden = true;
  };

  const draw = (width) => {
    svg.replaceChildren();
    svg.setAttribute("width", width);
    svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);

    const ys = points.map((p) => p.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
    const yMin = ticks[0];
    const yMax = ticks.at(-1);
    const xMin = points[0].x;
    const xMax = points.at(-1).x;
    const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const px = (x) => MARGIN.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const py = (y) => MARGIN.top + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;
    scaled = points.map((p) => ({ px: px(p.x), py: py(p.y) }));

    for (const tick of ticks) {
      svg.append(
        svgEl("line", { class: "chart-grid", x1: MARGIN.left, x2: width - MARGIN.right, y1: py(tick), y2: py(tick) }),
        svgEl("text", { class: "chart-axis", x: MARGIN.left - 8, y: py(tick) + 4, "text-anchor": "end" }, tick)
      );
    }
    const axisY = HEIGHT - 6;
    svg.append(
      svgEl("text", { class: "chart-axis", x: MARGIN.left, y: axisY, "text-anchor": "start" }, shortDate(xMin)),
      svgEl("text", { class: "chart-axis", x: width - MARGIN.right, y: axisY, "text-anchor": "end" }, shortDate(xMax))
    );

    crosshair = svgEl("line", { class: "chart-crosshair", y1: MARGIN.top, y2: MARGIN.top + plotHeight });
    svg.append(crosshair);

    svg.append(svgEl("path", {
      class: "chart-line",
      d: scaled.map((p, i) => `${i ? "L" : "M"}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(" "),
    }));
    const dots = scaled.length > MAX_MARKERS ? scaled.slice(-1) : scaled;
    for (const p of dots) svg.append(svgEl("circle", { class: "chart-dot", cx: p.px, cy: p.py, r: 4 }));

    const last = scaled.at(-1);
    svg.append(svgEl("text", { class: "chart-end-label", x: last.px + 8, y: last.py + 4 }, format(points.at(-1).y)));

    activeDot = svgEl("circle", { class: "chart-dot", r: 5 });
    svg.append(activeDot);

    if (activeIndex === null) hide();
    else show(activeIndex);
  };

  const nearest = (clientX) => {
    const x = clientX - svg.getBoundingClientRect().left;
    let best = 0;
    scaled.forEach((p, i) => {
      if (Math.abs(p.px - x) < Math.abs(scaled[best].px - x)) best = i;
    });
    return best;
  };

  svg.addEventListener("pointermove", (e) => show(nearest(e.clientX)));
  svg.addEventListener("pointerdown", (e) => show(nearest(e.clientX)));
  svg.addEventListener("pointerleave", () => {
    if (document.activeElement !== svg) hide();
  });
  svg.addEventListener("focus", () => show(activeIndex ?? scaled.length - 1));
  svg.addEventListener("blur", hide);
  svg.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const from = activeIndex ?? scaled.length - 1;
    show(Math.min(scaled.length - 1, Math.max(0, from + step)));
  });

  const observer = new ResizeObserver(([entry]) => {
    const width = Math.floor(entry.contentRect.width);
    if (width > 0 && width !== Number(svg.getAttribute("width"))) draw(width);
  });
  observer.observe(container);
  draw(Math.max(1, container.clientWidth));

  return () => observer.disconnect();
}
