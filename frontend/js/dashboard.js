// js/dashboard.js
import { renderDoughnut, renderBar, renderRadar, renderScatter } from "./viz.js";

(async function () {
  const API = "https://ink-insights-backend.vercel.app/analyze";
  const text = localStorage.getItem("ink_text") || "";
  const metaStr = localStorage.getItem("ink_report_meta") || "{}";
  const meta = JSON.parse(metaStr);

  // Update badges quickly
  const $ = (s) => document.querySelector(s);
  $("#fn").textContent = meta.name || "none";
  $("#wc").textContent = (meta.words || 0).toLocaleString();
  $("#rt").textContent = `${Math.max(1, Math.ceil((meta.words || 0)/200))} min`;

  if (!text) {
    alert("No text found. Please upload a .txt file first.");
    window.location.href = "upload.html";
    return;
  }

  // Call backend
  let resp;
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ text, filename: meta.name || "document.txt" })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `Request failed (${r.status})`);
    }
    resp = await r.json();
  } catch (err) {
    console.error(err);
    alert("Analysis failed. Please try again.");
    return;
  }

  // cache the whole report for features page
  localStorage.setItem("ink_report", JSON.stringify(resp));

  // Summary
  const summaryText = resp.summary || "No summary generated.";
  $("#summaryText").textContent = summaryText;
  $("#summaryEmpty").style.display = "none";

  // Readability note (optional in summary box)
  const rd = resp.readability || {};
  const rdLine = `Readability: ${rd.score ?? "—"} (${rd.level ?? "—"})`;
  const rdEl = document.createElement("div");
  rdEl.style.marginTop = "6px";
  rdEl.style.opacity = "0.8";
  rdEl.textContent = rdLine;
  $("#summaryText").appendChild(rdEl);

  // --- Charts (Chart.js is already included on this page) ---
  const kw = resp.keywords || {};
  const topWords = (kw.list || []).slice(0, 10);
  const kwLabels = topWords.map(x => x.token);
  const kwData = topWords.map(x => x.count);
  renderBar("#keywordsChart", kwLabels, kwData, "Top Keywords");

  const se = resp.sentiment || {};
  renderDoughnut("#sentimentChart", ["Positive", "Neutral", "Negative"], [se.pos||0, se.neu||0, se.neg||0], "Sentiment");

  const em = resp.emotions || {};
  const emoLabels = ["joy","anger","sadness","fear","surprise"];
  const emoVals = emoLabels.map(k => (em.breakdown||{})[k] || 0);
  renderRadar("#emotionsChart", emoLabels, emoVals, "Emotions");

  const th = resp.themes || {};
  // Simple scatter: x=index, y=keyword frequency (fake cluster viz for now)
  const scatterPts = topWords.map((x, i) => ({x: i+1, y: x.count}));
  renderScatter("#themesChart", scatterPts, "Themes (density)");

  // Delete button clears local only (server stores nothing)
  $("#deleteBtn").addEventListener("click", () => {
    if (confirm("Delete your local analysis data now?")) {
      localStorage.removeItem("ink_text");
      localStorage.removeItem("ink_report_meta");
      localStorage.removeItem("ink_report");
      alert("✅ Your data has been deleted.");
      window.location.href = "upload.html";
    }
  });
})();
