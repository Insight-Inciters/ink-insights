// js/dashboard.js
import {
  renderDoughnut,
  renderBar,
  renderRadar,
  renderBubble,
  renderLine,
  destroyCharts
} from "./viz.js";


/* ---------- helpers for empty/loading state per chart ---------- */
function setChartStateByCanvas(canvasSelector, { loading, hasData }) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas) return;
  const box = canvas.closest(".chartbox");
  const emptyNote = box?.parentElement?.querySelector(".empty-note");
  if (!box) return;

  // toggle loading/empty background (diagonal stripes)
  const isLoading = !!loading || !hasData;
  box.classList.toggle("chart-loading", isLoading);

  // ✅ dynamic background color
  if (hasData) {
    box.style.background = "#fff"; // plain white when chart visible
  } else {
    box.style.background =
      "repeating-linear-gradient(45deg, #f6f6f6 0, #f6f6f6 10px, #eaeaea 10px, #eaeaea 20px)";
  }

  // show/hide the "No chart available" note
  if (emptyNote) emptyNote.style.display = hasData ? "none" : "block";
}

function hasNonZero(arr) {
  return Array.isArray(arr) && arr.some(v => (typeof v === "number" ? v : 0) > 0);
}


/* ---------- sentiment % from backend data (improved & backend-aware) ---------- */
function sentimentFromBackend(sentiment = {}) {
  const posRaw = Math.max(0, Number(sentiment.positive ?? 0));
  const negRaw = Math.max(0, Number(sentiment.negative ?? 0));
  const neuRaw = Math.max(0, Number(sentiment.neutral ?? 0));

  // Fallback from polarity if missing
  let pos = posRaw, neg = negRaw, neu = neuRaw;
  if (!pos && !neg && !neu) {
    const polarity = Number(sentiment.polarity) || 0;
    const subjectivity = Math.min(1, Math.max(0, Number(sentiment.subjectivity) || 0));
    pos = polarity > 0 ? polarity : 0;
    neg = polarity < 0 ? Math.abs(polarity) : 0;
    neu = (1 - subjectivity) * 0.5;
  }

  // Weighted smoothing: reduce neutral dominance
  const adjustedNeu = neu * 0.6; // 👈 make neutral less dominant
  const total = pos + neg + adjustedNeu || 1;

  const posPct = ((pos / total) * 100).toFixed(1);
  const negPct = ((neg / total) * 100).toFixed(1);
  const neuPct = ((adjustedNeu / total) * 100).toFixed(1);

  return [Number(posPct), Number(neuPct), Number(negPct)];
}



(async function () {
// 🕒 Let DOM paint before running all chart render logic
await new Promise(r => requestAnimationFrame(() => r()));
console.log("✅ Dashboard DOM ready — rendering charts...");


  const API = "http://127.0.0.1:8000/analyze";
  const text = localStorage.getItem("ink_text") || "";
  const meta = JSON.parse(localStorage.getItem("ink_report_meta") || "{}");

  const $ = (s) => document.querySelector(s);
  const charts = [];

  // badges
  $("#fn").textContent = meta.name || "none";
  $("#wc").textContent = (meta.words || 0).toLocaleString();
  $("#rt").textContent = `${Math.max(1, Math.ceil((meta.words || 0) / 200))} min`;

if (!text) {
  showSuccessPrompt(
    "Please upload a .txt file first to see results.",
    () => { window.location.href = "upload.html"; },
    "No Text Found"
  );
  return;
}



  // initial loading visuals
  ["#keywordsChart", "#themesChart", "#sentimentChart", "#emotionsChart"].forEach(sel =>
    setChartStateByCanvas(sel, { loading: true, hasData: false })
  );


let resp;

// ⚡ Try load cached report instantly
const cached = localStorage.getItem("ink_report");
if (cached) {
  try {
    const cachedData = JSON.parse(cached);
    console.log("⚡ Loaded from cache instantly:", cachedData);
    resp = cachedData; // use cached first for fast render
  } catch (e) {
    console.warn("Invalid cached report, ignoring.");
  }
}

// 🌀 In background, try refreshing backend (non-blocking)
(async () => {
  try {
    console.log("🔄 Checking backend for fresher analysis...");
    const r = await fetch("http://127.0.0.1:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: localStorage.getItem("ink_text") || "",
        filename: (JSON.parse(localStorage.getItem("ink_report_meta") || "{}").name) || "document.txt"
      })
    });
    if (r.ok) {
      const newData = await r.json();
      console.log("✅ Updated backend analysis received:", newData);
      localStorage.setItem("ink_report", JSON.stringify(newData));
    }
  } catch (err) {
    console.log("⚠️ Backend not reachable, using cached report only.");
  }
})();


// ✅ Safe cluster regeneration
if (!resp) {
  console.warn("⚠️ No report data found, skipping cluster generation.");
  return;
}

if (!resp.themes) resp.themes = { clusters: [], points: [] };
if (!Array.isArray(resp.themes.points)) resp.themes.points = [];
if (!Array.isArray(resp.themes.clusters)) resp.themes.clusters = [];

if (resp.themes.clusters.length === 0 && resp.themes.points.length > 0) {
  const uniqueClusters = [...new Set(resp.themes.points.map(p => p.cluster))];
  resp.themes.clusters = uniqueClusters.map((id, i) => ({
    id,
    label: `Cluster ${i + 1}`
  }));
  console.log("🌀 Regenerated missing theme clusters:", resp.themes.clusters);
}


// ✅ Normalize emotions
resp.emotions = resp.emotions?.breakdown
  ? resp.emotions
  : { breakdown: resp.emotions || {} };

console.log("✅ Loaded & normalized cached report:", resp);


  
  // cache response
  localStorage.setItem("ink_report", JSON.stringify(resp));
  window.inkReport = resp;
  window.inkMeta = meta;

  /* =================== SUMMARY =================== */
  const kwList = resp?.keywords?.list || [];
  const themePoints = resp?.themes?.points || [];

  const [posPct, neuPct, negPct] = sentimentFromBackend(resp?.sentiment ?? {});


$("#summaryText").innerHTML = `
  <div class="summary-item">
    <span class="info" data-tooltip="Indicates how easy your text is to read and understand. Higher = simpler language.">?</span>
    <span class="label">Readability Score: </span>
    <span class="value">${Number(resp.readability ?? 0).toFixed(0)}</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Percentage of sentences with positive sentiment.">?</span>
    <span class="label">Positive: </span>
    <span class="value">${posPct}%</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Percentage of sentences that are neutral in tone.">?</span>
    <span class="label">Neutral: </span>
    <span class="value">${neuPct}%</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Percentage of sentences with negative sentiment.">?</span>
    <span class="label">Negative: </span>
    <span class="value">${negPct}%</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Most frequently used significant words in your text.">?</span>
    <span class="label">Top Keywords: </span>
    <span class="value">${kwList.slice(0, 3).map(x => x.token).join(", ") || "—"}</span>
  </div>

<div class="summary-item">
  <span class="info" data-tooltip="Main semantic cluster or recurring idea detected in your writing.">?</span>
  <span class="label">Top Theme: </span>
<span class="value">${
  (resp?.themes?.points?.[0]?.label) || "—"
}</span>

</div>

`;


  $("#summaryEmpty").style.display = "none";

  /* =================== CHARTS =================== */
  // --- Keywords (bar)
  {
    const labels = kwList.slice(0,10).map(x=>x.token);
    const data = kwList.slice(0,10).map(x=>x.count);
    const ok = labels.length > 0 && hasNonZero(data);
    if (ok) {
      setChartStateByCanvas("#keywordsChart", { loading: false, hasData: true });
      charts.push(renderBar("#keywordsChart", labels, data, "Top Keywords"));
    } else {
      setChartStateByCanvas("#keywordsChart", { loading: true, hasData: false });
    }
  }

  // --- Sentiment (doughnut)
  {
    const data = [posPct, neuPct, negPct];
    const ok = hasNonZero(data);
    if (ok) {
      setChartStateByCanvas("#sentimentChart", { loading: false, hasData: true });
      charts.push(renderDoughnut("#sentimentChart", ["Positive", "Neutral", "Negative"], data, "Sentiment"));
    } else {
      setChartStateByCanvas("#sentimentChart", { loading: true, hasData: false });
    }
  }

  // --- Emotions (radar)
  {
    const breakdown = resp?.emotions?.breakdown || {};
    const labels = Object.keys(breakdown);
    const data = labels.map(k => Number(breakdown[k]) || 0);
    const ok = labels.length > 0 && hasNonZero(data);
    if (ok) {
      setChartStateByCanvas("#emotionsChart", { loading: false, hasData: true });
      charts.push(renderRadar("#emotionsChart", labels, data, "Emotions"));
    } else {
      setChartStateByCanvas("#emotionsChart", { loading: true, hasData: false });
    }
  }


// --- Themes / Semantic Clusters ---
{
  const clusters = resp?.themes?.clusters || [];
  const points = resp?.themes?.points || [];
  const ok = Array.isArray(points) && points.length > 0;

  if (ok) {
    setChartStateByCanvas("#themesChart", { loading: false, hasData: true });

    const el = document.querySelector("#themesChart");
    const clusterColors = clusters.map((_, i) => `hsl(${(i * 70) % 360}, 70%, 65%)`);

    const datasets = clusters.length
      ? clusters.map((c, i) => ({
          label: `Cluster ${i + 1}`,
          data: points.filter(p => p.cluster === c.id)
            .map(p => ({
              x: Number(p.x),
              y: Number(p.y),
              r: Math.max(3, Math.min(12, p.count * 1.5)),
              label: p.label
            })),
          backgroundColor: clusterColors[i],
          borderColor: clusterColors[i].replace("65%", "45%"),
          borderWidth: 1
        }))
      : [{
          label: "Semantic Points",
          data: points.map(p => ({
            x: p.x, y: p.y, r: 6, label: p.label
          })),
          backgroundColor: "rgba(54,162,235,0.5)"
        }];

    charts.push(new Chart(el, {
      type: "bubble",
      data: { datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          title: { display: true, text: "Semantic Themes" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = ctx.raw;
                return `${ctx.dataset.label}: ${d.label} (count: ${d.r})`;
              }
            }
          }
        },
        scales: {
          x: { beginAtZero: true, min: 0, max: 1 },
          y: { beginAtZero: true, min: 0, max: 1 }
        },
        onClick: (e, elements) => {
          if (!elements.length) return;
          const dsIndex = elements[0].datasetIndex;
          const cluster = clusters[dsIndex];
          showSuccessPrompt(`Cluster ${dsIndex + 1}: ${cluster?.label || "(no label)"}`);
        }
      }
    }));
  } else {
    setChartStateByCanvas("#themesChart", { loading: true, hasData: false });
  }
}


// ✅ this line comes after everything is closed properly
window.charts = charts;


/* ============== DELETE (Confirmation + Loading Overlay) ============== */
$("#deleteBtn").addEventListener("click", () => {
  // remove any existing prompt
  document.querySelector(".confirm-delete")?.remove();

  // create confirmation prompt
  const confirmBox = document.createElement("div");
  confirmBox.className = "confirm-delete";
  confirmBox.innerHTML = `
    <div class="prompt-overlay"></div>
    <div class="prompt-card">
      <h3>Delete Report?</h3>
      <p>This will permanently remove your analysis data from this device. Are you sure you want to continue?</p>
      <div class="prompt-actions">
        <button id="cancelDelete" class="btn keep">Cancel</button>
        <button id="confirmDeleteNow" class="btn delete">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmBox);
  setTimeout(() => confirmBox.classList.add("show"), 30);

  // cancel
  confirmBox.querySelector("#cancelDelete").addEventListener("click", () => {
    confirmBox.classList.remove("show");
    setTimeout(() => confirmBox.remove(), 300);
  });

  // click outside to close
  confirmBox.querySelector(".prompt-overlay").addEventListener("click", () => {
    confirmBox.classList.remove("show");
    setTimeout(() => confirmBox.remove(), 300);
  });

  // confirm deletion
  confirmBox.querySelector("#confirmDeleteNow").addEventListener("click", () => {
    confirmBox.classList.remove("show");
    setTimeout(() => {
      confirmBox.remove();
      showDeleteOverlay();
    }, 300);
  });
});

function showDeleteOverlay(onDone) {
  // remove any existing overlay
  document.querySelector(".delete-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "delete-overlay";
  overlay.innerHTML = `
    <div class="delete-box">
      <h3>Your data is being deleted...</h3>
      <div class="progress-bar"><div class="bar-fill"></div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // start progress animation
  const fill = overlay.querySelector(".bar-fill");
  setTimeout(() => (fill.style.width = "100%"), 100);

  // clear storage after a short delay
  setTimeout(() => {
    ["ink_text", "ink_report_meta", "ink_report", "ink_results"].forEach(k =>
      localStorage.removeItem(k)
    );

    destroyCharts?.(window.charts || []);
    ["#keywordsChart", "#themesChart", "#sentimentChart", "#emotionsChart"].forEach(sel => {
      const c = document.querySelector(sel);
      if (c) c.replaceWith(c.cloneNode(false));
      setChartStateByCanvas(sel, { loading: true, hasData: false });
    });

    $("#summaryText").textContent = "";
    $("#summaryEmpty").style.display = "block";
    $("#fn").textContent = "none";
    $("#wc").textContent = "0000";
    $("#rt").textContent = "00 min";

    overlay.classList.add("fade-out");

// ✅ use the callback if provided, otherwise show success box first
setTimeout(() => {
  if (typeof onDone === "function") {
    onDone();
  } else {
    // show success message before redirect
    showSuccessPrompt(
      "Your report was successfully deleted.",
      () => {
        window.location.href = "upload.html";
      },
      "Success"
    );
  }
}, 900);

}, 7000); // shorter, smoother animation (optional)
}



function showSuccessPrompt(message = "Action completed successfully.", onClose, title = "Success") {
  document.querySelector(".export-prompt")?.remove();

  const box = document.createElement("div");
  box.className = "export-prompt";
  box.innerHTML = `
    <div class="prompt-overlay"></div>
    <div class="prompt-card">
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="prompt-actions">
        <button id="okSuccess" class="btn keep">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);
  setTimeout(() => box.classList.add("show"), 50);

  // OK closes box and optionally redirects or triggers callback
  document.querySelector("#okSuccess").onclick = () => {
    box.classList.remove("show");
    setTimeout(() => {
      box.remove();
      if (typeof onClose === "function") onClose();
    }, 300);
  };

  // Clicking overlay also closes it
  box.querySelector(".prompt-overlay").addEventListener("click", () => {
    document.querySelector("#okSuccess").click();
  });
}





  /* =================== EXPORT HANDLERS =================== */
  const { jsPDF } = window.jspdf;

  // --- JSON export
  document.querySelector("#exportJSON")?.addEventListener("click", (e) => {
    e.preventDefault();
    const data = resp;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (meta.name?.replace(/\.[^/.]+$/, "") || "report") + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

// Ask user what to do next
  postExportPrompt();

  });

  // --- CSV export
// --- Unified CSV export (with summary + all features)
document.querySelector("#exportCSV")?.addEventListener("click", (e) => {
  e.preventDefault();

  const baseName = (meta.name?.replace(/\.[^/.]+$/, "") || "report");

  // --- Prepare key data ---
  const kwList = resp?.keywords?.list || [];
  const themePoints = resp?.themes?.points || [];
  const s = resp?.sentiment || {};
  const [posPct, neuPct, negPct] = [
    s.positive ?? 0,
    s.neutral ?? 0,
    s.negative ?? 0
  ];

  const readability = Number(resp.readability ?? 0).toFixed(0);
  const topKeywords = kwList.slice(0, 3).map(k => k.token).join(", ") || "—";
  const topThemes = themePoints.slice(0, 3).map(t => t.label).filter(Boolean).join(", ") || "—";

  // --- 1️⃣ Summary
  const csvSummary = [
    "[SUMMARY]",
    "Metric,Value",
    `File Name,${meta.name || "none"}`,
    `Word Count,${meta.words || 0}`,
    `Reading Time,${Math.max(1, Math.ceil((meta.words || 0) / 200))} min`,
    `Readability Score,${readability}`,
    `Positive %,${posPct}`,
    `Neutral %,${neuPct}`,
    `Negative %,${negPct}`,
    `Top Keywords,${topKeywords}`,
    `Top Themes,${topThemes}`,
    ""
  ].join("\n");

  // --- 2️⃣ Keywords
  const keywords = kwList.map(k => `${k.token},${k.count}`).join("\n");
  const csvKeywords = ["[KEYWORDS]", "Token,Count", keywords, ""].join("\n");

  // --- 3️⃣ Themes
  const themes = (resp?.themes?.points || [])
    .map(t => `${t.label},${t.cluster},${t.x},${t.y},${t.count}`)
    .join("\n");
  const csvThemes = ["[THEMES]", "Label,Cluster,X,Y,Count", themes, ""].join("\n");

  // --- 4️⃣ Sentiment
  const csvSentiment = [
    "[SENTIMENT]",
    "Positive,Neutral,Negative,Polarity,Subjectivity",
    `${s.positive ?? ""},${s.neutral ?? ""},${s.negative ?? ""},${s.polarity ?? ""},${s.subjectivity ?? ""}`,
    ""
  ].join("\n");

  // --- 5️⃣ Emotions
  const breakdown = resp?.emotions?.breakdown || {};
  const emotions = Object.entries(breakdown)
    .map(([emo, val]) => `${emo},${val}`)
    .join("\n");
  const csvEmotions = ["[EMOTIONS]", "Emotion,Score", emotions].join("\n");

  // --- Combine everything into one file
  const csv = [
    csvSummary,
    csvKeywords,
    csvThemes,
    csvSentiment,
    csvEmotions
  ].join("\n");

  // --- Trigger download
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = baseName + "_report.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Ask user what to do next
  postExportPrompt();
});



// --- FINAL PDF Export: Dashboard layout (direct download only, optimized for A4) ---
document.querySelector("#exportPDF")?.addEventListener("click", async (e) => {
  e.preventDefault();

  // Ensure dependencies exist
  const { jsPDF } = window.jspdf;
  if (!window.html2canvas) {
    console.error("html2canvas not found — include via CDN before this script.");
    return;
  }

  // Get metadata for title
  const meta = JSON.parse(localStorage.getItem("ink_report_meta") || "{}");
  const docTitle = (meta.name?.replace(/\.[^/.]+$/, "") || "Your Text") + " Report";

  // Target main dashboard
  const dashboard =
    document.querySelector(".dashboard-container") ||
    document.querySelector("main") ||
    document.body;

  // Hide unwanted UI before capture
  const hiddenEls = [];
  const exportMenu = document.querySelector(".export-dropdown");
  const deleteBtn = document.querySelector("#deleteBtn");
  const footerNote = Array.from(document.querySelectorAll("p, div, span"))
    .find((el) => el.textContent?.includes("We automatically remove your report"));

  // Hide toolkits near summary ("?" info icons)
  const toolkits = document.querySelectorAll("#summaryText .info");
  toolkits.forEach((el) => {
    hiddenEls.push(el);
    el.style.display = "none";
  });

  if (exportMenu) { hiddenEls.push(exportMenu); exportMenu.style.display = "none"; }
  if (deleteBtn) { hiddenEls.push(deleteBtn); deleteBtn.style.display = "none"; }
  if (footerNote) { hiddenEls.push(footerNote); footerNote.style.display = "none"; }

  // Add temporary top title for export
  const header = document.createElement("div");
  header.innerHTML = `
    <div style="
      position: fixed;
      top: 25px;
      left: 0;
      width: 100%;
      text-align: center;
      font-family: 'Helvetica Neue', sans-serif;
      font-weight: 700;
      font-size: 22px;
      color: #1a1f71;
      letter-spacing: 0.5px;">
      ${docTitle}
    </div>
  `;
  document.body.appendChild(header);

  // Small delay to ensure rendering
  await new Promise((r) => setTimeout(r, 100));

  // 📄 Force A4-like layout width (≈1123px) for desktop layout
  const originalWidth = document.body.style.width;
  const originalTransform = dashboard.style.transform;
  const originalTransformOrigin = dashboard.style.transformOrigin;

  document.body.style.width = "1123px";
  dashboard.style.transform = "scale(0.9)";
  dashboard.style.transformOrigin = "top center";

  await new Promise((r) => setTimeout(r, 100));

  // Capture screenshot quickly with crisp quality
  const canvas = await html2canvas(dashboard, {
    scale: 1.5, // ✅ faster and still sharp
    backgroundColor: "#ffffff",
    useCORS: true,
    scrollY: -window.scrollY,
    windowWidth: 1123,
    logging: false
  });

  // Restore layout
  document.body.style.width = originalWidth;
  dashboard.style.transform = originalTransform;
  dashboard.style.transformOrigin = originalTransformOrigin;

  // Remove header and restore elements
  header.remove();
  hiddenEls.forEach((el) => (el.style.display = ""));

  // Generate PDF
  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  // Add pages
  let y = 0;
  while (y < imgH) {
    pdf.addImage(imgData, "PNG", 0, -y, imgW, imgH);
    y += pageH;
    if (y < imgH) pdf.addPage();
  }

  // ✨ Branded footer only once on last page (dynamic filename)
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(10);
  pdf.setTextColor("#9C9B9B");

  const baseName = (meta.name?.replace(/\.[^/.]+$/, "") || "Untitled");
  const footerText = `${baseName} Report — Produced using Ink Insights`;
  pdf.text(footerText, pageW / 2, pageH - 15, { align: "center" });

  // ✅ Direct download (no preview, no extra tab)
  const fileName =
    (meta.name?.replace(/\.[^/.]+$/, "") || "Ink_Report") + ".pdf";
  const pdfBlob = pdf.output("blob");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(pdfBlob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up + small memory release
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);

  // Optional: show export prompt if you use one
  postExportPrompt?.();
});





// --- Post Export Prompt ---
function postExportPrompt() {
  const box = document.createElement("div");
  box.className = "export-prompt";
  box.innerHTML = `
    <div class="prompt-overlay"></div>
    <div class="prompt-card">
      <h3>What would you like to do next?</h3>
      <p>Your export is ready. Would you like to delete this report or continue exploring your results?</p>
      <div class="prompt-actions">
        <button id="keepReport" class="btn keep">Continue Exploring</button>
        <button id="deleteReportNow" class="btn delete">Delete Report</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);

  // Fade in
  setTimeout(() => box.classList.add("show"), 50);

  // Actions
  document.querySelector("#keepReport").onclick = () => {
    box.classList.remove("show");
    setTimeout(() => box.remove(), 400);
  };

  // ✅ FIXED: directly show delete animation (no second confirm)
  document.querySelector("#deleteReportNow").onclick = () => {
    box.classList.remove("show");
    setTimeout(() => {
      box.remove();
      showDeleteOverlay(); // direct deletion + animation
    }, 400);
  };
}



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
// clear storage + show success then redirect
setTimeout(() => {
  ["ink_text", "ink_report_meta", "ink_report", "ink_results"].forEach(k =>
    localStorage.removeItem(k)
  );

  overlay.classList.add("fade-out");

  // ✨ success box after deletion
  setTimeout(() => {
    overlay.remove();

    showSuccessPrompt(
      "Your previous report has been cleared. Ready for a fresh analysis!",
      () => { window.location.href = "upload.html"; },
      "Data Reset Successful"
    );
  }, 1000);
}, 7000);

          }, 300);
        });
      } else {
        window.location.href = "upload.html";
      }
    });
  });
});

