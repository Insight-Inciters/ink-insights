// js/dashboard.js
import {
  renderDoughnut,
  renderBar,
  renderRadar,
  renderBubble,
  renderLine,
  destroyCharts
} from "./viz.js";

// --- Auto-delete report data when the user starts a NEW visit ---
(() => {
  const REPORT_KEYS = ["ink_text", "ink_report_meta", "ink_report", "ink_results"];

  const fromPreview = sessionStorage.getItem("fromPreview") === "true";
  const sessionActive = sessionStorage.getItem("ink_session_active") === "1";

  // Brand-new visit (no active session) and not coming from a preview tab:
  if (!sessionActive && !fromPreview) {
    REPORT_KEYS.forEach(k => localStorage.removeItem(k));
    // console.log("🧹 Local report data cleared for privacy.");
  }

  // Mark this browser tab's session as active
  sessionStorage.setItem("ink_session_active", "1");
  // Clear the preview flag (only used during exports)
  sessionStorage.removeItem("fromPreview");
})();



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

/* ---------- sentiment % from polarity ---------- */
/* polarity ∈ [-1,1]. Map to Positive/Negative/Neutral % */
function sentimentFromPolarity(polarity) {
  const p = Math.max(0, Number(polarity) || 0);
  const n = Math.max(0, -(Number(polarity) || 0));
  let pos = p * 100;
  let neg = n * 100;
  let neu = Math.max(0, 100 - pos - neg);
  const sum = pos + neg + neu || 1;
  pos = (pos / sum) * 100;
  neg = (neg / sum) * 100;
  neu = (neu / sum) * 100;
  return [Number(pos.toFixed(1)), Number(neu.toFixed(1)), Number(neg.toFixed(1))];
}

(async function () {
  const API = "https://ink-insights-backend.onrender.com/analyze";
  const text = localStorage.getItem("ink_text") || "";
  const meta = JSON.parse(localStorage.getItem("ink_report_meta") || "{}");

  const $ = (s) => document.querySelector(s);
  const charts = [];

  // badges
  $("#fn").textContent = meta.name || "none";
  $("#wc").textContent = (meta.words || 0).toLocaleString();
  $("#rt").textContent = `${Math.max(1, Math.ceil((meta.words || 0) / 200))} min`;

  if (!text) {
    alert("No text found. Please upload a .txt file first.");
    window.location.href = "upload.html";
    return;
  }

  // initial loading visuals
  ["#keywordsChart", "#themesChart", "#sentimentChart", "#emotionsChart"].forEach(sel =>
    setChartStateByCanvas(sel, { loading: true, hasData: false })
  );

  let resp;
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, filename: meta.name || "document.txt" }),
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

  // cache response
  localStorage.setItem("ink_report", JSON.stringify(resp));
  window.inkReport = resp;
  window.inkMeta = meta;

  /* =================== SUMMARY =================== */
  const kwList = resp?.keywords?.list || [];
  const themePoints = resp?.themes?.points || [];

  const [posPct, neuPct, negPct] = sentimentFromPolarity(resp?.sentiment?.polarity ?? 0);

$("#summaryText").innerHTML = `
  <div class="summary-item">
    <span class="info" data-tooltip="Indicates how easy your text is to read and understand. Higher = simpler language.">?</span>
    <span class="label">Readability Score:  </span>
    <span class="value">${Number(resp.readability ?? 0).toFixed(0)}</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Percentage of sentences with positive sentiment.">?</span>
    <span class="label">Positive:  </span>
    <span class="value">${posPct}%</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Percentage of sentences with negative sentiment.">?</span>
    <span class="label">Negative:  </span>
    <span class="value">${negPct}%</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Most frequently used significant words in your text.">?</span>
    <span class="label">Top Keywords:  </span>
    <span class="value">${kwList.slice(0,3).map(x=>x.token).join(", ") || "—"}</span>
  </div>

  <div class="summary-item">
    <span class="info" data-tooltip="Main semantic clusters or recurring ideas detected in your writing.">?</span>
    <span class="label">Top Themes:  </span>
    <span class="value">${themePoints.slice(0,3).map(t => t.label).filter(Boolean).join(", ") || "—"}</span>
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

  // --- Themes / Semantic clusters (bubble)
  {
    const clusters = {};
    (themePoints || []).forEach(p => {
      const cid = Number(p.cluster ?? 0);
      (clusters[cid] ||= []).push({
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        r: Math.max(6, Math.min(18, Number(p.count || 1) * 1.2)),
        label: p.label || "(unknown)"
      });
    });

    const clusterKeys = Object.keys(clusters);
    const ok = clusterKeys.length > 0;

    if (ok) {
      setChartStateByCanvas("#themesChart", { loading: false, hasData: true });
      const el = document.querySelector("#themesChart");
      const datasets = clusterKeys.map(cid => ({
        label: `Cluster ${cid}`,
        data: clusters[cid],
        backgroundColor: `hsl(${(cid * 60) % 360}, 70%, 65%)`,
        borderColor: `hsl(${(cid * 60) % 360}, 70%, 45%)`,
      }));

      const chart = new Chart(el, {
        type: "bubble",
        data: { datasets },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: "Semantic Clusters" },
            tooltip: {
              callbacks: {
                label: ctx => ctx.raw.label || ""
              }
            }
          },
          scales: {
            x: { beginAtZero: true },
            y: { beginAtZero: true }
          }
        }
      });
      charts.push(chart);
    } else {
      setChartStateByCanvas("#themesChart", { loading: true, hasData: false });
    }
  }





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

    // ✅ use the callback if provided, otherwise fallback to default redirect
    setTimeout(() => {
      if (typeof onDone === "function") {
        onDone();
      } else {
        window.location.href = "upload.html";
      }
    }, 900);
  }, 7000); // shorter, smoother animation (optional)
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
  document.querySelector("#exportCSV")?.addEventListener("click", (e) => {
    e.preventDefault();
    const kw = (resp?.keywords?.list || [])
      .map((k) => `${k.token},${k.count}`)
      .join("\n");
    const th = (resp?.themes?.points || [])
      .map((t) => `${t.label},${t.cluster},${t.x},${t.y},${t.count}`)
      .join("\n");
    const csv = [
      "Section,Word,Cluster,X,Y,Count",
      "Keywords",
      kw,
      "",
      "Themes",
      th,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (meta.name?.replace(/\.[^/.]+$/, "") || "report") + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

// Ask user what to do next
  postExportPrompt();

  });



// --- FINAL PDF Export (Optimized & Instant Preview) ---
document.querySelector("#exportPDF")?.addEventListener("click", async (e) => {
  e.preventDefault();

  const { jsPDF } = window.jspdf;
  if (!window.html2canvas) {
    console.error("html2canvas not found — include via CDN before this script.");
    return;
  }

  const meta = JSON.parse(localStorage.getItem("ink_report_meta") || "{}");
  const docTitle = (meta.name?.replace(/\.[^/.]+$/, "") || "Your Text") + " Report";

  const dashboard =
    document.querySelector(".dashboard-container") ||
    document.querySelector("main") ||
    document.body;

  // Hide unnecessary UI elements
  const hiddenEls = [];
  const hideEls = [".export-dropdown", "#deleteBtn", "#summaryText .info"];
  hideEls.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      hiddenEls.push(el);
      el.style.display = "none";
    });
  });

  // Add temporary title
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
      color: #1a1f71;">
      ${docTitle}
    </div>`;
  document.body.appendChild(header);
  await new Promise((r) => setTimeout(r, 200));

  // Capture dashboard
  const canvas = await html2canvas(dashboard, {
    scale: 1.2,                // ↓ reduce resolution
    backgroundColor: "#fff",
    useCORS: true,
    scrollY: -window.scrollY,
  });

  header.remove();
  hiddenEls.forEach((el) => (el.style.display = ""));

  // Convert canvas → compressed JPEG
  const imgData = canvas.toDataURL("image/jpeg", 0.65);

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let y = 0;
  while (y < imgH) {
    pdf.addImage(imgData, "JPEG", 0, -y, imgW, imgH);
    y += pageH;
    if (y < imgH) pdf.addPage();
  }

  // Footer
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(10);
  pdf.setTextColor("#9C9B9B");
  const baseName = meta.name?.replace(/\.[^/.]+$/, "") || "Untitled";
  const footerText = `${baseName} Report — Produced using Ink Insights`;
  pdf.text(footerText, pageW / 2, pageH - 15, { align: "center" });

  // Generate Blob
  const pdfBlob = pdf.output("blob");
  const pdfURL = URL.createObjectURL(pdfBlob);

  // Only preview once
  sessionStorage.setItem("fromPreview", "true");
  
// ✅ Open preview in a single dedicated window (no duplicate tabs)
let previewWin = window.open("", "InkPreview", "width=900,height=800");
previewWin.document.title = "Ink Report Preview";
previewWin.document.body.innerHTML = `
  <iframe src="${pdfURL}" width="100%" height="100%" style="border:none;"></iframe>
`;

// Optional: revoke after preview window closed
previewWin.onbeforeunload = () => URL.revokeObjectURL(pdfURL);

// continue normal post-export behavior
postExportPrompt();


  // Cleanup
  setTimeout(() => URL.revokeObjectURL(pdfURL), 15000);
});


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
