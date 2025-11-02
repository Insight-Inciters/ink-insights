// js/viz.js
function getCanvas(selector) {
  const host = document.querySelector(selector);
  if (!host) return null;
  // If the host is a canvas already, use it; else create one inside
  if (host.tagName.toLowerCase() === "canvas") return host;
  host.innerHTML = "";
  const c = document.createElement("canvas");
  c.setAttribute("role", "img");
  host.appendChild(c);
  return c;
}

export function renderBar(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  new Chart(el, {
    type: "bar",
    data: { labels, datasets: [{ label: title, data }] },
    options: { responsive: true, plugins: { legend: { display: false }, title: { display: !!title, text: title } } }
  });
}

export function renderDoughnut(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  new Chart(el, {
    type: "doughnut",
    data: { labels, datasets: [{ data }] },
    options: { responsive: true, plugins: { title: { display: !!title, text: title } } }
  });
}

export function renderRadar(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  new Chart(el, {
    type: "radar",
    data: { labels, datasets: [{ label: title || "", data }] },
    options: { responsive: true, plugins: { legend: { display: false }, title: { display: !!title, text: title } } }
  });
}

export function renderScatter(selector, points, title) {
  const el = getCanvas(selector);
  if (!el) return;
  new Chart(el, {
    type: "scatter",
    data: { datasets: [{ label: title || "", data: points }] },
    options: { responsive: true, plugins: { legend: { display: false }, title: { display: !!title, text: title } } }
  });
}

export function renderLine(selector, labels, data, title) {
  const el = getCanvas(selector);
  if (!el) return;
  new Chart(el, {
    type: "line",
    data: { labels, datasets: [{ label: title || "", data, tension: 0.25 }] },
    options: { responsive: true, plugins: { legend: { display: false }, title: { display: !!title, text: title } } }
  });
}
