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

// 🟦 Bar chart (Keywords / N-grams / Keyness)
export function renderBar(selector, labels, data, title, options = {}) {
  const el = getCanvas(selector);
  if (!el) return;

  const indexAxis = options.indexAxis || "x"; // 👈 default vertical, can override to 'y'

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
      indexAxis, // 👈 enables horizontal chart if 'y'
      plugins: {
        ...BASE_OPTS.plugins,
        title: { display: !!title, text: title },
      },
      scales: {
        x: { beginAtZero: true },
        y: { beginAtZero: true },
      },
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
export function renderBubble(selector, input, title) {
  const el = getCanvas(selector);
  if (!el) return;

  // Detect if we're given full datasets or just points
  const isDatasetArray =
    Array.isArray(input) && input.length > 0 && input[0]?.data;

  const data = isDatasetArray
    ? { datasets: input }
    : {
        datasets: [
          {
            label: title || "",
            data: (input || []).map(p => ({
              x: p.x,
              y: p.y,
              r: p.r || 6,
              label: p.label,
            })),
            backgroundColor: "rgba(108,160,220,0.4)",
            borderColor: "#6ca0dc",
            borderWidth: 1,
          },
        ],
      };

  return new Chart(el, {
    type: "bubble",
    data,
    options: {
      ...BASE_OPTS,
      plugins: {
        ...BASE_OPTS.plugins,
        title: { display: !!title, text: title },
        tooltip: {
          callbacks: {
            label: ctx => ctx.raw.label || `(${ctx.raw.x}, ${ctx.raw.y})`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true, min: 0, max: 1 },
        y: { beginAtZero: true, min: 0, max: 1 },
      },
    },
  });
}


// 📈 Line chart (supports multiple sentiment/emotion lines)
export function renderLine(selector, labels, xLabels, datasets, title, colors = []) {
  const el = getCanvas(selector);
  if (!el) return;

  // Handle both old (single dataset) and new (multi-dataset) modes
  const isSingleDataset = Array.isArray(datasets) && typeof datasets[0] === "number";
  const finalDatasets = isSingleDataset
    ? [
        {
          label: title || "Data",
          data: datasets,
          borderColor: colors[0] || "#6ca0dc",
          backgroundColor: colors[0] || "#6ca0dc",
          fill: false,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ]
    : datasets.map((data, i) => ({
        label: labels[i] || `Series ${i + 1}`,
        data,
        borderColor: colors[i] || `hsl(${i * 120}, 70%, 50%)`,
        backgroundColor: colors[i] || `hsl(${i * 120}, 70%, 50%)`,
        fill: false,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      }));

  return new Chart(el, {
    type: "line",
    data: {
      labels: isSingleDataset ? labels : xLabels,
      datasets: finalDatasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: "bottom" },
        title: { display: !!title, text: title },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 10 } },
        x: { grid: { color: "rgba(0,0,0,0.05)" } },
      },
      elements: {
        line: { borderJoinStyle: "round" },
        point: { radius: 3, hoverRadius: 6 },
      },
    },
  });
}
