// js/viz.js

// 🧩 Centralized Chart.js base options
export const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "bottom" },
  },
  layout: { padding: 10 },
};

// 🧹 Utility: Get or create a canvas inside selector
function getCanvas(selector) {
  const host = document.querySelector(selector);
  if (!host) return null;
  // Clear any placeholder background (like diagonal stripes)
  host.classList.remove("chart-loading");
  if (host.tagName.toLowerCase() === "canvas") return host;
  host.innerHTML = "";
  const c = document.createElement("canvas");
  c.setAttribute("role", "img");
  host.appendChild(c);
  return c;
}

// 🧯 Destroy chart utility (to avoid duplicates on re-render)
export function destroyCharts(charts) {
  if (!charts) return;
  charts.forEach((ch) => {
    if (ch && ch.destroy) ch.destroy();
  });
}

// 🟦 Bar chart (Keywords / N-grams)
export function renderBar(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  return new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title || "",
          data,
          backgroundColor: "#6ca0dc",
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        ...BASE_OPTS.plugins,
        title: { display: !!title, text: title },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// 🍩 Doughnut chart (Sentiments)
export function renderDoughnut(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  return new Chart(el, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ["#517A06", "#DBDBDB", "#E03131"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        ...BASE_OPTS.plugins,
        title: { display: !!title, text: title },
      },
    },
  });
}

// 🌈 Radar chart (Emotions)
export function renderRadar(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  return new Chart(el, {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: title || "",
          data,
          fill: true,
          backgroundColor: "rgba(81,122,6,.20)",
          borderColor: "#517A06",
          pointBackgroundColor: "#517A06",
        },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        ...BASE_OPTS.plugins,
        legend: { display: false },
        title: { display: !!title, text: title },
      },
      scales: { r: { beginAtZero: true } },
    },
  });
}

// 🫧 Bubble/Scatter chart (Themes)
export function renderBubble(selector, points, title) {
  const el = getCanvas(selector);
  if (!el) return;
  return new Chart(el, {
    type: "bubble",
    data: {
      datasets: [
        {
          label: title || "",
          data: points.map((p) => ({
            x: p.x,
            y: p.y,
            r: p.r || 6,
            label: p.label,
          })),
          backgroundColor: "rgba(108,160,220,0.4)",
          borderColor: "#6ca0dc",
        },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        ...BASE_OPTS.plugins,
        title: { display: !!title, text: title },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.raw.label || `(${ctx.raw.x}, ${ctx.raw.y})`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true },
        y: { beginAtZero: true },
      },
    },
  });
}

// 📈 Line chart (Sentiment / Emotion timelines)
export function renderLine(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  return new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: title || "",
          data,
          tension: 0.25,
          borderWidth: 2,
          fill: false,
          borderColor: "#6ca0dc",
          pointRadius: 3,
        },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        ...BASE_OPTS.plugins,
        title: { display: !!title, text: title },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}
