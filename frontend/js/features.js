// js/features.js
import { renderDoughnut, renderBar, renderRadar, renderLine } from "./viz.js";



function renderSuggestions(selector, suggestions) {
  const box = document.querySelector(selector);
  if (!box) return;
  box.innerHTML = "";

  if (!suggestions || !suggestions.length) {
    box.textContent = "No suggestions available.";
    return;
  }

  const list = document.createElement("ul");
  list.className = "suggestion-list";

  suggestions.forEach(s => {
    const li = document.createElement("li");
    li.className = "suggestion-item";
    li.textContent = s;
    list.appendChild(li);
  });

  box.appendChild(list);
}


// ==== Predefined writing suggestions per feature ====
const DEFAULT_SUGGESTIONS = {
  keywords: [
    "Check for overused words and replace them with fresh or vivid alternatives.",
    "Use precise nouns and strong verbs instead of repetitive adjectives or fillers.",
    "Aim for natural repetition — recurring words should enhance rhythm, not redundancy.",
    "Highlight key terms that truly define your piece; trim words that dilute focus."
  ],
  themes: [
    "Identify the core message that ties all ideas together and ensure consistency.",
    "Avoid introducing unrelated topics that distract from your central theme.",
    "Use metaphors or imagery that reinforce your main theme across paragraphs.",
    "Keep transitions smooth so readers can trace how one theme evolves into the next."
  ],
  sentiment: [
    "Check for tone consistency — ensure positive and negative sections balance well.",
    "If tone shifts abruptly, add transitional phrases to ease emotional flow.",
    "Strengthen positive sentiments with sensory language and clarity of intent.",
    "Use negative tones purposefully — to create contrast or emotional depth, not confusion."
  ],
  emotions: [
    "Explore emotional diversity — mix joy, fear, or surprise to add depth.",
    "Use emotional words strategically rather than clustering them in one area.",
    "Balance intense emotions with reflective or neutral passages for pacing.",
    "Let emotions show through actions or descriptions, not just direct statements."
  ]
};




(function () {
const report = JSON.parse(
  localStorage.getItem("ink_report") ||
  localStorage.getItem("ink_results") ||
  "null"
);



document.querySelectorAll('.btn.back').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if (document.referrer && document.referrer.includes('dashboard.html')) {
      history.back();
    } else {
      window.location.href = 'dashboard.html';
    }
  });
});






const inkText = localStorage.getItem("ink_text") || "";


if (report) {
  // Normalize structure from backend
  if (Array.isArray(report.keywords)) {
    report.keywords = { list: report.keywords };
  }
  if (report.sentiment && !report.sentiment.pos) {
    const pol = report.sentiment.polarity || 0;
    report.sentiment = {
      pos: Math.max(0, pol * 100),
      neu: 100 - Math.abs(pol * 100),
      neg: pol < 0 ? Math.abs(pol * 100) : 0,
      mood: report.sentiment.mood
    };
  }
  if (report.emotions && !report.emotions.breakdown) {
    report.emotions = { breakdown: report.emotions };
  }
}


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

    const top10 = list.slice(0, 10);
    renderBar("#kw-frequency", top10.map(x=>x.token), top10.map(x=>x.count), "Top 10 Keywords");

    const bi = ((kw.ngrams||{}).bigrams || []).slice(0, 10);
    renderBar("#kw-ngram", bi.map(x=>x.token), bi.map(x=>x.count), "Top Bigrams");

    const wl = document.getElementById("kw-list");
    wl.innerHTML = "";
    const previewBase = inkText;
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

  renderSuggestions("#kw-suggestions", kw.suggestions || DEFAULT_SUGGESTIONS.keywords);

  

  })();


  // ===== THEMES =====

(function fillThemes() {
  const th = report.themes || {};
  document.getElementById("th-count").textContent = th.clusters || 0;
  document.getElementById("th-top").textContent = Array.isArray(th.top_theme) ? th.top_theme.join(", ") : (th.top_theme || "—");

  // Use real theme data instead of keyword list
  const themeLabels = (th.themes || []).map(t => t.name || t);
  const themeValues = (th.themes || []).map(t => t.weight || Math.random() * 10); // fallback if no numeric weight
  renderBar("#th-graph", themeLabels, themeValues, "Theme Distribution");

  // If clusters or summaries exist, show them in a different chart type
  const clusterLabels = Object.keys(th.cluster_summary || {});
  const clusterVals = Object.values(th.cluster_summary || {});
  if (clusterLabels.length) {
    renderDoughnut("#th-desc", clusterLabels, clusterVals, "Cluster Balance");
  } else {
    renderBar("#th-desc", themeLabels, themeValues, "Theme Relevance");
  }
renderSuggestions("#th-suggestions", th.suggestions || DEFAULT_SUGGESTIONS.keywords);

})();


  // ===== SENTIMENT =====
  (function fillSentiment() {
    const se = report.sentiment || {};
    document.getElementById("se-pos").textContent = (se.pos||0) + "%";
    document.getElementById("se-neu").textContent = (se.neu||0) + "%";
    document.getElementById("se-neg").textContent = (se.neg||0) + "%";

    renderDoughnut("#se-donut", ["Positive","Neutral","Negative"], [se.pos||0, se.neu||0, se.neg||0], "Sentiment Mix");

    const xs = (se.timeline||[]).map(p => p.i);
    const ys = (se.timeline||[]).map(p => p.compound);
    renderLine("#se-timeline", xs, ys, "Sentiment Over Time");

renderSuggestions("#se-suggestions", se.suggestions || DEFAULT_SUGGESTIONS.keywords);

  })();

  // ===== EMOTIONS =====
  (function fillEmotions() {
    const em = report.emotions || {};
    document.getElementById("em-dominant").textContent = em.dominant || "—";

    const labels = ["joy","anger","sadness","fear","surprise"];
    const vals = labels.map(l => (em.breakdown||{})[l] || 0);
    renderRadar("#em-graph-1", labels, vals, "Emotion Mix");

    const xs = (em.arc||[]).map(p => p.i);
    const ys = (em.arc||[]).map(p => p.value);
    renderLine("#em-arc", xs, ys, "Emotional Arc");

renderSuggestions("#em-suggestions", em.suggestions || DEFAULT_SUGGESTIONS.keywords);

  })();

  // Back buttons
  ["backKw","backTh","backSe","backEm"].forEach(id=>{
    const b=document.getElementById(id);
    if (b) b.addEventListener("click", ()=>{
      if (document.referrer && document.referrer.includes("dashboard.html")) history.back();
      else window.location.href = "dashboard.html";
    });
  });

  // Disable export in feature views
  document.querySelectorAll(".btn.export").forEach(b=>b.addEventListener("click",()=>alert("Export is handled on the Dashboard. Use the EXPORT menu there.")));

  // ===== REMOVE PATTERN WHEN CHARTS LOAD =====
  setTimeout(() => {
    document.querySelectorAll(".chartbox canvas").forEach(canvas => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        const pixels = ctx.getImageData(0, 0, 5, 5).data;
        const hasData = Array.from(pixels).some(v => v !== 0);
        if (hasData) {
          const box = canvas.closest(".chartbox");
          box.style.background = "none";
          box.style.border = "2px solid transparent";
        }
      } catch(e) {
        // Ignore security errors if cross-origin canvas (unlikely here)
      }
    });
  }, 800);
})();






/* =================== START ANALYSIS CONFIRMATION =================== */
document.addEventListener("DOMContentLoaded", () => {
  const startBtns = document.querySelectorAll(".nav-cta, .drawer-cta");
  if (!startBtns.length) return;

  startBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const hasOldData =
        localStorage.getItem("ink_text") ||
        localStorage.getItem("ink_report_meta") ||
        localStorage.getItem("ink_report") ||
        localStorage.getItem("ink_results");

      if (hasOldData) {
        const box = document.createElement("div");
        box.className = "confirm-delete";
        box.innerHTML = `
          <div class="prompt-overlay"></div>
          <div class="prompt-card">
            <h3>Start a New Analysis?</h3>
            <p>Starting another analysis will delete your existing report data. Do you wish to continue?</p>
            <div class="prompt-actions">
              <button id="cancelNew" class="btn keep">Cancel</button>
              <button id="confirmNew" class="btn delete">Yes, Start New</button>
            </div>
          </div>
        `;
        document.body.appendChild(box);
        setTimeout(() => box.classList.add("show"), 50);

        // cancel
        box.querySelector("#cancelNew").addEventListener("click", () => {
          box.classList.remove("show");
          setTimeout(() => box.remove(), 300);
        });

        // click outside to close
        box.querySelector(".prompt-overlay").addEventListener("click", () => {
          box.classList.remove("show");
          setTimeout(() => box.remove(), 300);
        });

        // ✅ confirm → show duplicate loading overlay (works independently)
        box.querySelector("#confirmNew").addEventListener("click", () => {
          box.classList.remove("show");
          setTimeout(() => {
            box.remove();

            // duplicate of showDeleteOverlay()
            const overlay = document.createElement("div");
            overlay.className = "delete-overlay";
            overlay.innerHTML = `
              <div class="delete-box">
                <h3>Your data is being deleted...</h3>
                <div class="progress-bar"><div class="bar-fill"></div></div>
              </div>
            `;
            document.body.appendChild(overlay);

            // animate progress
            const fill = overlay.querySelector(".bar-fill");
            setTimeout(() => (fill.style.width = "100%"), 100);

            // clear storage + redirect
            setTimeout(() => {
              ["ink_text", "ink_report_meta", "ink_report", "ink_results"].forEach(k =>
                localStorage.removeItem(k)
              );

              overlay.classList.add("fade-out");
              setTimeout(() => {
                window.location.href = "upload.html";
              }, 900);
            }, 7000);
          }, 300);
        });
      } else {
        window.location.href = "upload.html";
      }
    });
  });
});
