// js/features.js
import { renderDoughnut, renderBar, renderRadar, renderLine } from "./viz.js";

(function () {
  const report = JSON.parse(localStorage.getItem("ink_report") || "null");
  if (!report) {
    alert("No analysis found. Please analyze a file first.");
    window.location.href = "upload.html";
    return;
  }

  // ===== KEYWORDS =====
  (function fillKeywords() {
    const kw = report.keywords || {};
    const list = kw.list || [];
    const unique = kw.unique || 0;
    const top = kw.top || "—";
    document.getElementById("kw-unique").textContent = unique.toLocaleString();
    document.getElementById("kw-top").textContent = top;

    // frequency chart
    const top10 = list.slice(0, 10);
    renderBar("#kw-frequency", top10.map(x=>x.token), top10.map(x=>x.count), "Top 10 Keywords");

    // n-gram chart (bigrams)
    const bi = ((kw.ngrams||{}).bigrams || []).slice(0, 10);
    renderBar("#kw-ngram", bi.map(x=>x.token), bi.map(x=>x.count), "Top Bigrams");

    // clickable keyword list + highlight preview
    const wl = document.getElementById("kw-list");
    wl.innerHTML = "";
    const previewBase = kw.previewText || "";
    const docDiv = document.getElementById("kw-doc");
    list.slice(0, 40).forEach(item => {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = `${item.token} — ${item.count}`;
      a.addEventListener("click", e => {
        e.preventDefault();
        const re = new RegExp(`\\b(${item.token})\\b`, "gi");
        docDiv.innerHTML = previewBase.replace(re, "<mark>$1</mark>");
      });
      wl.appendChild(a);
    });
  })();

  // ===== THEMES =====
  (function fillThemes() {
    const th = report.themes || {};
    document.getElementById("th-count").textContent = th.clusters || 0;
    document.getElementById("th-top").textContent = Array.isArray(th.top_theme) ? th.top_theme.join(", ") : (th.top_theme || "—");

    // Render a small “cluster density” bar chart from keyword counts
    const kw = report.keywords || {};
    const top10 = (kw.list || []).slice(0, 10);
    renderBar("#th-graph", top10.map(x=>x.token), top10.map(x=>x.count), "Theme Density");

    // Simple description chart: n-gram top 8 as proxy
    const bi = ((kw.ngrams||{}).bigrams || []).slice(0, 8);
    renderBar("#th-desc", bi.map(x=>x.token), bi.map(x=>x.count), "Phrase Salience");
  })();

  // ===== SENTIMENT =====
  (function fillSentiment() {
    const se = report.sentiment || {};
    document.getElementById("se-pos").textContent = (se.pos||0) + "%";
    document.getElementById("se-neu").textContent = (se.neu||0) + "%";
    document.getElementById("se-neg").textContent = (se.neg||0) + "%";

    renderDoughnut("#se-donut", ["Positive","Neutral","Negative"], [se.pos||0, se.neu||0, se.neg||0], "Sentiment Mix");

    // Timeline chart from compound scores
    const xs = (se.timeline||[]).map(p => p.i);
    const ys = (se.timeline||[]).map(p => p.compound);
    renderLine("#se-timeline", xs, ys, "Sentiment Over Time");
  })();

  // ===== EMOTIONS =====
  (function fillEmotions() {
    const em = report.emotions || {};
    document.getElementById("em-dominant").textContent = em.dominant || "—";

    const labels = ["joy","anger","sadness","fear","surprise"];
    const vals = labels.map(l => (em.breakdown||{})[l] || 0);
    renderRadar("#em-graph-1", labels, vals, "Emotion Mix");

    // Emotional arc
    const xs = (em.arc||[]).map(p => p.i);
    const ys = (em.arc||[]).map(p => p.value);
    renderLine("#em-arc", xs, ys, "Emotional Arc");
  })();

  // Back buttons on the page (if present)
  ["backKw","backTh","backSe","backEm"].forEach(id=>{
    const b=document.getElementById(id);
    if (b) b.addEventListener("click", ()=>{
      if (document.referrer && document.referrer.includes("dashboard.html")) history.back();
      else window.location.href = "dashboard.html";
    });
  });

  // Disable the feature-level “EXPORT” buttons in demo (your page shows a demo alert)
  document.querySelectorAll(".btn.export").forEach(b=>b.addEventListener("click",()=>alert("Export is handled on the Dashboard. Use the EXPORT menu there.")));
})();
