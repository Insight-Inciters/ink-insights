// js/features.js
import {
  renderDoughnut,
  renderBar,
  renderRadar,
  renderBubble,
  renderLine,
  destroyCharts
} from "./viz.js";



/* ---------- Chart helpers (copied from dashboard.js) ---------- */
function setChartStateByCanvas(canvasSelector, { loading, hasData }) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas) return;
  const box = canvas.closest(".chartbox");
  const emptyNote = box?.parentElement?.querySelector(".empty-note");
  if (!box) return;

  const isLoading = !!loading || !hasData;
  box.classList.toggle("chart-loading", isLoading);
  box.style.background = hasData
    ? "#fff"
    : "repeating-linear-gradient(45deg, #f6f6f6 0, #f6f6f6 10px, #eaeaea 10px, #eaeaea 20px)";
  if (emptyNote) emptyNote.style.display = hasData ? "none" : "block";
}

function hasNonZero(arr) {
  return Array.isArray(arr) && arr.some(v => (typeof v === "number" ? v : 0) > 0);
}

function sentimentFromBackend(sentiment = {}) {
  const posRaw = Math.max(0, Number(sentiment.positive ?? 0));
  const negRaw = Math.max(0, Number(sentiment.negative ?? 0));
  const neuRaw = Math.max(0, Number(sentiment.neutral ?? 0));
  let pos = posRaw, neg = negRaw, neu = neuRaw;
  if (!pos && !neg && !neu) {
    const polarity = Number(sentiment.polarity) || 0;
    const subjectivity = Math.min(1, Math.max(0, Number(sentiment.subjectivity) || 0));
    pos = polarity > 0 ? polarity : 0;
    neg = polarity < 0 ? Math.abs(polarity) : 0;
    neu = (1 - subjectivity) * 0.5;
  }
  const adjustedNeu = neu * 0.6;
  const total = pos + neg + adjustedNeu || 1;
  return [
    ((pos / total) * 100).toFixed(1),
    ((adjustedNeu / total) * 100).toFixed(1),
    ((neg / total) * 100).toFixed(1)
  ].map(Number);
}

/* ---------- Helper to render suggestion lists ---------- */
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



/* ---------- Default suggestions ---------- */
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

/* ---------- Main script ---------- */
(function () {
  const report = JSON.parse(
    localStorage.getItem("ink_report") ||
    localStorage.getItem("ink_results") ||
    "null"
  );

  if (!report) {
    alert("No analysis found. Please analyze a file first.");
    window.location.href = "upload.html";
    return;
  }

  const inkText = localStorage.getItem("ink_text") || "";

  /* ========== KEYWORDS ========== */
(function fillKeywords() {
  const kw = report.keywords || {};
  const list = kw.list || [];

  // ✅ Unique words from full document text
  const words = (inkText.match(/\b[\w'-]+\b/gim) || []).map(w => w.toLowerCase());
  const uniqueTokens = new Set(words).size;

  const unique = uniqueTokens || 0;
  const top = list[0]?.token || "—";

  document.getElementById("kw-unique").textContent = unique.toLocaleString();
  document.getElementById("kw-top").textContent = top;

  const top10 = list.slice(0, 10);
  renderBar(
    "#keywordsChart",
    top10.map(x => x.token),
    top10.map(x => x.count),
    "Top 10 Keywords"
  );

  const wl = document.getElementById("kw-list");
  const docDiv = document.getElementById("kw-doc");
  wl.innerHTML = "";
// === Highlighted Words & Document Preview ===

// Default highlight color
let currentColor = "#fdfd96";

// === Render keyword list ===
list.slice(0, 40).forEach((item, index) => {
  const row = document.createElement("div");
  row.className = "kw-item";
  row.innerHTML = `
    <span class="kw-word">${item.token}</span>
    <span class="kw-count">${item.count}</span>
  `;

  row.addEventListener("click", e => {
    e.preventDefault();
    // Remove active states
    document.querySelectorAll(".kw-item").forEach(el => el.classList.remove("active"));
    // Add active to current
    row.classList.add("active");

    // Highlight in document
    const re = new RegExp(`\\b(${item.token})\\b`, "gi");
    docDiv.innerHTML = inkText.replace(
      re,
      `<mark style="background-color:${currentColor}">$1</mark>`
    );
  });

  wl.appendChild(row);
});

// === Description Boxes for Keywords and Keyness ===

// Helper: generate a dynamic descriptive summary
function getKeywordDescription(topKeyword, uniqueCount) {
  return `
    <strong>Understanding Your Keyword Results:</strong><br>
    Your text contains <b>${uniqueCount.toLocaleString()}</b> unique words.
    The most frequent term is <b>"${topKeyword}"</b>, showing a recurring theme or focus area in your writing.
    Higher frequency words highlight core ideas or repeated patterns that define your text's style or topic.
  `;
}


// Insert Keyword description
const kwDesc = document.getElementById("kw-description");
if (kwDesc) {
  kwDesc.innerHTML = getKeywordDescription(top, unique);
}

// Insert Keyness description
const keynessDesc = document.getElementById("keyness-description");
if (keynessDesc) {
  keynessDesc.innerHTML = getKeynessDescription();
}


// === Highlight color selection ===
// Set first color circle as active
const firstCircle = document.querySelector(".color-circle");
if (firstCircle) firstCircle.classList.add("active");

document.querySelectorAll(".color-circle").forEach(circle => {
  circle.style.backgroundColor = circle.dataset.color;
  circle.addEventListener("click", () => {
    document.querySelectorAll(".color-circle").forEach(c => c.classList.remove("active"));
    circle.classList.add("active");
    currentColor = circle.dataset.color;

    // 🔄 If a keyword is already active, reapply highlight immediately
    const activeItem = document.querySelector(".kw-item.active");
    if (activeItem) {
      const token = activeItem.querySelector(".kw-word").textContent;
      const re = new RegExp(`\\b(${token})\\b`, "gi");
      docDiv.innerHTML = inkText.replace(
        re,
        `<mark style="background-color:${currentColor}">$1</mark>`
      );
    }
  });
});

// === Default display: highlight the first keyword ===
if (list.length > 0) {
  const first = wl.querySelector(".kw-item");
  if (first) {
    first.classList.add("active");
    const token = list[0].token;
    const re = new RegExp(`\\b(${token})\\b`, "gi");
    docDiv.innerHTML = inkText.replace(
      re,
      `<mark style="background-color:${currentColor}">$1</mark>`
    );
  }
}
// Highlight color picker logic (applies only to Document box)
document.querySelectorAll('.color-circle').forEach(circle => {
  circle.addEventListener('click', () => {
    const color = circle.dataset.color;
    const docBox = document.querySelector('.highlight-doc');
    if (docBox) {
      docBox.style.setProperty('--highlight-color', color);
      docBox.style.borderColor = color;
      docBox.style.boxShadow = `0 0 14px 3px ${color}66`; // subtle glow with transparency
    }
  });
});



// === Add footer note ===
const note = document.createElement("p");
note.textContent = "💡 Select different words or highlighters to see changes.";
note.style.fontStyle = "italic";
note.style.textAlign = "center";
note.style.color = "#555";
note.style.marginTop = "10px";
note.style.fontSize = "0.9rem";
docDiv.parentElement.appendChild(note);



  renderSuggestions("#kw-suggestions", kw.suggestions || DEFAULT_SUGGESTIONS.keywords);
})();



/* ========== THEMES ========== */
(async function fillThemes() {
  const th = report.themes || {};
  const points = Array.isArray(th.points) ? th.points : [];
  const clusters = Array.isArray(th.clusters) ? th.clusters : [];

  const ok = clusters.length > 0 && points.length > 0;

  // === Update badges ===
  document.getElementById("th-count").textContent = clusters.length || "0";
  document.getElementById("th-top").textContent = points[0]?.label || "—";

  const canvasSelector = "#themesChart";

  /* ---------- BUBBLE CHART ---------- */
if (ok) {
  setChartStateByCanvas(canvasSelector, { loading: false, hasData: true });

  const clusterColors = clusters.map(
    (_, i) => `hsl(${(i * 70) % 360}, 70%, 65%)`
  );

  const datasets = clusters.length
    ? clusters.map((c, i) => ({
        label: `Cluster ${i + 1}`,
        data: points
          .filter(p => String(p.cluster) === String(c.id))
          .map(p => ({
            x: Number(p.x),
            y: Number(p.y),
            r: Math.max(3, Math.min(12, (p.count || 1) * 1.5)),
            label: p.label,
          })),
        backgroundColor: clusterColors[i],
        borderColor: clusterColors[i].replace("65%", "45%"),
        borderWidth: 1,
      }))
    : [
        {
          label: "Semantic Points",
          data: points.map(p => ({
            x: p.x,
            y: p.y,
            r: 6,
            label: p.label,
          })),
          backgroundColor: "rgba(54,162,235,0.5)",
        },
      ];

  // Destroy previous chart
  if (window.themeChart && typeof window.themeChart.destroy === "function") {
    window.themeChart.destroy();
  }

  // Now pass datasets array directly — viz.js detects it
  window.themeChart = renderBubble(canvasSelector, datasets, "Semantic Themes");
} else {
  setChartStateByCanvas(canvasSelector, { loading: true, hasData: false });
}

// === Expandable Popup Chart ===
const expandBtn = document.getElementById("expandThemesBtn");
if (expandBtn) {
  expandBtn.onclick = () => showThemesPopup(clusters, points);
}

function showThemesPopup(clusters, points) {
  document.querySelector(".popup-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup-card">
      <div class="popup-header">
        <h2 id="clusterTitle">Cluster 1</h2>
        <button class="popup-close">&times;</button>
      </div>
      <div class="popup-content">
        <div class="chart-section">
          <h3>Chart</h3>
          <canvas id="popupThemeChart"></canvas>
          <div class="cluster-description"></div>
        </div>
        <div class="table-section">
          <h3>Table</h3>
          <table class="cluster-table">
            <thead><tr><th>Top Themes</th><th>Weight</th></tr></thead>
            <tbody></tbody>
          </table>
          <div class="cluster-selectors"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("blurred-bg");
  setTimeout(() => overlay.classList.add("show"), 50);

  // === Close Button ===
  overlay.querySelector(".popup-close").onclick = () => {
    overlay.classList.remove("show");
    setTimeout(() => {
      overlay.remove();
      document.body.classList.remove("blurred-bg");
    }, 250);
  };

  const ctx = overlay.querySelector("#popupThemeChart").getContext("2d");
  let chart;

  /** === Smart Cluster Description === **/
function getClusterDescription(cluster, idx, clusterPoints) {
  if (!clusterPoints?.length) return "No clear semantic grouping detected.";

  // Sort by frequency
  const sorted = [...clusterPoints].sort((a, b) => (b.count || 0) - (a.count || 0));

  // Extract key words
  const topWords = sorted.slice(0, 6).map(p => p.label).filter(Boolean);
  const main = topWords[0];
  const related = topWords.slice(1, 3).join(", ");
  const extras = topWords.slice(3, 6).join(", ");

  // Combine top words for interpretation
  const allWords = topWords.join(" ").toLowerCase();

  // Identify semantic tone
  let category = "general ideas and expressions";
  if (allWords.match(/emotion|love|feel|happy|sad|anger|joy|fear/))
    category = "emotional and expressive language";
  else if (allWords.match(/character|story|theme|narrative|plot|poem|fiction/))
    category = "storytelling and creative writing";
  else if (allWords.match(/goal|progress|growth|achievement|motivation/))
    category = "personal growth and ambition";
  else if (allWords.match(/data|analysis|system|logic|method/))
    category = "analytical or technical reasoning";
  else if (allWords.match(/nature|world|environment|sky|space|earth/))
    category = "natural and environmental imagery";
  else if (allWords.match(/art|color|music|style|paint/))
    category = "artistic and aesthetic language";

  // Create a richer, narrative-style explanation
  const description = `
    <strong>Cluster ${idx + 1}</strong> reflects <b>${category}</b> found throughout your writing.<br><br>
    This cluster is primarily centered around the word <b>${main}</b>${
      related ? `, and connects with related ideas such as <b>${related}</b>` : ""
    }.
    Together, these words suggest that your text frequently touches on ${
      category.includes("emotional")
        ? "feelings and inner expression"
        : category.includes("story")
        ? "imaginative scenes and narrative flow"
        : category.includes("growth")
        ? "themes of progress and self-reflection"
        : category.includes("nature")
        ? "imagery tied to the natural world"
        : category.includes("art")
        ? "aesthetic choices and visual concepts"
        : "a recurring conceptual focus"
    }.
    ${extras ? `<br><br>Other related terms like <b>${extras}</b> further strengthen this theme.` : ""}
  `;

  return description.trim();
}

  /** === Render One Cluster === **/
function renderCluster(idx = 0) {
  const cluster = clusters[idx];
  const color = `hsl(${(idx * 70) % 360}, 70%, 60%)`;
  document.documentElement.style.setProperty("--cluster-color", color);

  overlay.querySelector("#clusterTitle").textContent = `Cluster ${idx + 1}`;

  // ✅ Filter points only for this cluster & sort
  const clusterPoints = points
    .filter(p => String(p.cluster) === String(cluster.id))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 10) // ✅ Only top 10 themes
    .map(p => ({
      x: Number(p.x),
      y: Number(p.y),
      r: Math.max(10, Math.min(30, (p.count || 1) * 2.5)), // bigger bubbles
      label: p.label,
      count: p.count,
    }));

  // === Chart ===
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bubble",
    data: {
      datasets: [
        {
          label: `Cluster ${idx + 1}`,
          data: clusterPoints,
          backgroundColor: color,
          borderColor: color.replace("60%", "45%"),
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // ✅ Tooltip shows one theme only
            label: ctx => `${ctx.raw.label || "—"} (Weight: ${ctx.raw.count || 0})`,
          },
        },
      },
      scales: {
        x: { min: 0, max: 1 },
        y: { min: 0, max: 1 },
      },
    },
  });

  // === Table ===
  const tbody = overlay.querySelector(".cluster-table tbody");
  tbody.innerHTML = clusterPoints
    .map(p => `<tr><td>${p.label}</td><td>${p.count}</td></tr>`)
    .join("");

  // === Description ===
  overlay.querySelector(".cluster-description").innerHTML =
    getClusterDescription(cluster, idx, clusterPoints);
}

  /** === Cluster Selector Buttons === **/
  const selector = overlay.querySelector(".cluster-selectors");
  selector.innerHTML = "";
  clusters.forEach((c, i) => {
    const color = `hsl(${(i * 70) % 360}, 70%, 60%)`;
    const btn = document.createElement("button");
    btn.className = "cluster-btn" + (i === 0 ? " active" : "");
    btn.textContent = `Cluster ${i + 1}`;
    btn.style.setProperty("--btn-color", color);
    btn.onclick = () => {
      selector.querySelectorAll(".cluster-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderCluster(i);
    };
    selector.appendChild(btn);
  });

  renderCluster(0);

  /** === Download Chart === **/
  overlay.querySelector(".download-icon").onclick = async () => {
    const canvas = await html2canvas(overlay.querySelector("#popupThemeChart"), {
      backgroundColor: "#fff",
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = "cluster_chart.png";
    link.href = canvas.toDataURL();
    link.click();
  };
}

// === Description Box for Themes (Improved Accuracy) ===

// Helper: compute top theme & generate descriptive summary
function getThemesDescription(clusters = [], points = []) {
  const clusterCount = clusters?.length || 0;
  if (!clusterCount) return getEmptyThemesDescription();

  // --- Find the top theme accurately ---
  // Combine word frequency + cluster prominence
  const themeFrequency = {};
  points.forEach(p => {
    const w = p.label?.toLowerCase();
    if (!w || w.length <= 2) return;
    themeFrequency[w] = (themeFrequency[w] || 0) + (p.count || 1);
  });

  // Pick top frequent tokens
  const sortedThemes = Object.entries(themeFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  const topTheme = sortedThemes[0] || "—";
  const dominantThemes = sortedThemes.slice(1, 4).join(", ") || "—";

  // --- Description body ---
  const clusterLabel =
    clusterCount === 1 ? "one theme cluster" : `${clusterCount} theme clusters`;

  return `
    <div class="sentiment-summary-box">
      <strong>Understanding Your Theme Results:</strong><br>
      Your text reveals <b>${clusterLabel}</b>, showing how ideas and motifs group together semantically.
      The most prominent recurring concept is <b>"${topTheme}"</b>, 
      appearing frequently as a central idea. 
      Other dominant themes include <b>${dominantThemes}</b>, 
      which contribute to the emotional and conceptual depth of your writing.
    </div>
  `;
}

// --- Fallback helper ---
function getEmptyThemesDescription() {
  return `
    <div class="sentiment-summary-box">
      <strong>About Theme Analysis:</strong><br>
      Theme clustering identifies recurring ideas, symbols, or topics in your text 
      by measuring how often and closely they co-occur semantically.
      No clear clusters were detected, which may occur when the text is very short 
      or covers a single focused topic.
    </div>
  `;
}

const thDesc = document.getElementById("th-description");
if (thDesc) {
  thDesc.innerHTML = getThemesDescription(clusters, points);
}



/* ---------- CLUSTER TABLES (Top 10 per cluster with Cluster N header + old headings) ---------- */
const clustersGrid = document.getElementById("clustersGrid");
if (!clustersGrid) {
  console.warn("⚠️ #clustersGrid element not found in DOM.");
  return;
}
clustersGrid.innerHTML = "";

if (clusters && clusters.length > 0) {
  clusters.forEach((c, idx) => {
    const related = (points || [])
      .filter(p => String(p.cluster) === String(c.id))
      .sort((a, b) => (b.count || 0) - (a.count || 0));

    if (!related.length) return;

    const color = `hsl(${(idx * 70) % 360}, 70%, 60%)`;
    const shapeClass = ["shape-a", "shape-b", "shape-c", "shape-d"][idx % 4];

    const card = document.createElement("div");
    card.className = `cluster-card ${shapeClass}`;
    card.style.setProperty("--cluster-color", color);

    /* === Header (Cluster N) === */
    const header = document.createElement("h4");
    header.className = "cluster-title";
    header.textContent = `Cluster ${idx + 1}`;
    card.appendChild(header);

    /* === Table === */
    const tbl = document.createElement("table");
    tbl.className = "cluster-table";

    const limited = related.slice(0, 10);
    const renderRows = items =>
      items
        .map(
          p => `
            <tr>
              <td>${p.label || "(no label)"}</td>
              <td>${p.count || 0}</td>
            </tr>`
        )
        .join("");

    tbl.innerHTML = `
      <thead>
        <tr><th>Top Themes</th><th>Weight</th></tr>
      </thead>
      <tbody>${renderRows(limited)}</tbody>
    `;
    card.appendChild(tbl);

    /* === Show more/less toggle === */
    if (related.length > 10) {
      const btn = document.createElement("button");
      btn.className = "btn small-toggle";
      btn.textContent = "Show more";
      btn.style.display = "block";
      btn.style.margin = "6px auto 0";
      btn.style.fontSize = "0.8rem";

      let expanded = false;
      btn.addEventListener("click", () => {
        expanded = !expanded;
        const tbody = tbl.querySelector("tbody");
        tbody.innerHTML = expanded ? renderRows(related) : renderRows(limited);
        btn.textContent = expanded ? "Show less" : "Show more";
      });

      card.appendChild(btn);
    }

    clustersGrid.appendChild(card);
  });

  if (!clustersGrid.children.length)
    clustersGrid.innerHTML = `<p>No clusters found.</p>`;

  requestAnimationFrame(() => {
    document.querySelectorAll(".cluster-card").forEach(el =>
      el.classList.add("visible")
    );
  });
} else {
  clustersGrid.innerHTML = `<p>No clusters found.</p>`;
}

function getThemesInterpretation(clusters, points) {
  if (!clusters?.length) {
    return `
      <div class="sentiment-summary-box">
        <strong>About Theme Interpretation:</strong><br>
        Theme clustering identifies recurring ideas or motifs within your writing. 
        It visualizes how related words group together conceptually.
      </div>
    `;
  }

  const examples = clusters
    .map((c, i) => {
      const words = c.label.split(", ").slice(0, 4).join(", ");
      return `Cluster ${i + 1} (<i>${words}</i>)`;
    })
    .join("; ");

  const mainThemes = points
    .slice(0, 5)
    .map(p => p.label)
    .filter(Boolean)
    .join(", ");

  return `
    <div class="sentiment-summary-box">
      <strong>Thematic Interpretation:</strong><br>
      Example clusters of semantically related words from your writing were identified using PCA on word embeddings.
      These <b>${clusters.length}</b> clusters reveal conceptual groupings such as ${examples}.
      <br><br>
      Overall, your text appears to emphasize <b>${mainThemes}</b> — 
      indicating recurring ideas or emotional motifs that characterize your writing voice.
    </div>
  `;
}

const interpretationBox = document.getElementById("themesInterpretation");
if (interpretationBox) {
  interpretationBox.innerHTML = getThemesInterpretation(clusters, points);
}



/* Suggestions always visible */
renderSuggestions("#th-suggestions", th.suggestions || DEFAULT_SUGGESTIONS.themes);

})();




/* ========== SENTIMENT ========== */
(function fillSentiment() {
  const se = report.sentiment || {};
  const [posPct, neuPct, negPct] = sentimentFromBackend(se);
  const ok = hasNonZero([posPct, neuPct, negPct]);

  // === Update Percentage Badges ===
  document.getElementById("se-pos").textContent = `${posPct}%`;
  document.getElementById("se-neu").textContent = `${neuPct}%`;
  document.getElementById("se-neg").textContent = `${negPct}%`;

  // === Doughnut Chart ===
  if (ok) {
    setChartStateByCanvas("#sentimentChart", { loading: false, hasData: true });

    renderDoughnut(
      "#sentimentChart",
      ["Positive", "Neutral", "Negative"],
      [posPct, neuPct, negPct],
      "Sentiment Mix"
    );
  } else {
    setChartStateByCanvas("#sentimentChart", { loading: true, hasData: false });
  }

  // === Explanation of Results (Cluster-style Cards) ===
  const grid = document.getElementById("sentimentClustersGrid");
  grid.innerHTML = "";

  const sentiments = [
    {
      label: "Positive",
      color: "#2e8b57",
      shape: "shape-pos",
      tone:
        "Represents optimism, confidence, and uplifting tone — often found in encouraging or pleasant expressions.",
      words: se.positive_words || ["joyful", "hope", "great", "love", "bright", "excellent"],
    },
    {
      label: "Neutral",
      color: "#888888",
      shape: "shape-neu",
      tone:
        "Shows objective, factual, or balanced tone — typical of informative or descriptive writing.",
      words: se.neutral_words || ["said", "told", "stated", "noted", "reported", "observed"],
    },
    {
      label: "Negative",
      color: "#c62828",
      shape: "shape-neg",
      tone:
        "Conveys critique, emotional tension, or stress — often expressing dissatisfaction or concern.",
      words: se.negative_words || ["sad", "angry", "bad", "frustrated", "upset", "unhappy"],
    },
  ];

  sentiments.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = `sentiment-card ${s.shape}`;
    card.style.setProperty("--sentiment-color", s.color);
    card.style.animationDelay = `${i * 0.15}s`;

    const title = document.createElement("h4");
    title.textContent = s.label;
    card.appendChild(title);

    const tone = document.createElement("p");
    tone.className = "sentiment-tone";
    tone.textContent = s.tone;
    card.appendChild(tone);

    const words = document.createElement("div");
    words.className = "sentiment-words";
    words.innerHTML = s.words
      .slice(0, 6)
      .map(
        w =>
          `<span class="word-pill" style="border-color:${s.color};color:${s.color}">${w}</span>`
      )
      .join("");
    card.appendChild(words);

    // Animate visibility like theme clusters
    setTimeout(() => card.classList.add("visible"), i * 100 + 200);

    grid.appendChild(card);
  });

// === Sentiment Description Box (dynamic) ===
const sentimentDescBox = document.getElementById("sentimentDescText");
if (sentimentDescBox) {
  let dominantType = "Neutral";
  let dominantValue = neuPct;

  if (posPct > neuPct && posPct > negPct) {
    dominantType = "Positive";
    dominantValue = posPct;
  } else if (negPct > posPct && negPct > neuPct) {
    dominantType = "Negative";
    dominantValue = negPct;
  }

  let description = "";
  switch (dominantType) {
    case "Positive":
      description = `
        Your text carries a <b>positive tone</b> (${dominantValue}%), reflecting optimism,
        enthusiasm, and confidence. Such sentiment often encourages readers and builds connection.`;
      break;
    case "Neutral":
      description = `
        Your text maintains a <b>neutral tone</b> (${dominantValue}%), focusing on objectivity
        and clarity. This balance helps readers focus on facts and structure rather than emotions.`;
      break;
    case "Negative":
      description = `
        Your text exhibits a <b>negative tone</b> (${dominantValue}%), conveying emotion, tension,
        or critique. This can be effective for storytelling contrast or expressing realism.`;
      break;
  }

  sentimentDescBox.innerHTML = description;
}


  // === Sentiment Timeline Chart (3-Line Smooth Trend) ===
  const timeline = se.timeline && Array.isArray(se.timeline) && se.timeline.length
    ? se.timeline
    : [
        { idx: 1, pos: 45, neu: 40, neg: 15 },
        { idx: 2, pos: 35, neu: 50, neg: 15 },
        { idx: 3, pos: 25, neu: 60, neg: 15 },
        { idx: 4, pos: 50, neu: 40, neg: 10 },
      ];

  const labels = timeline.map((_, i) => `Section ${i + 1}`);
  const pos = timeline.map(x => x.pos);
  const neu = timeline.map(x => x.neu);
  const neg = timeline.map(x => x.neg);

  const ctx = document.querySelector("#se-timeline");
  if (ctx) {
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Positive",
            data: pos,
            borderColor: "#2e8b57",
            backgroundColor: "rgba(46,139,87,0.08)",
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
          },
          {
            label: "Neutral",
            data: neu,
            borderColor: "#888888",
            backgroundColor: "rgba(136,136,136,0.1)",
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
          },
          {
            label: "Negative",
            data: neg,
            borderColor: "#c62828",
            backgroundColor: "rgba(198,40,40,0.08)",
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              font: { size: 13, family: "Rockwell, serif" },
              color: "#003a3a",
            },
          },
          title: {
            display: true,
            text: "Sentiment Timeline (Positive–Neutral–Negative)",
            font: { size: 16, family: "Rockwell, serif" },
            color: "#003a3a",
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.75)",
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
            },
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            title: { display: true, text: "Text Sections" },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: v => `${v}%`,
            },
            grid: { color: "rgba(0,0,0,0.1)" },
            title: { display: true, text: "Sentiment (%)" },
          },
        },
        animation: {
          duration: 1000,
          easing: "easeOutQuart",
        },
      },
    });
  }

  // === Explanation of Results Summary Box ===
  const explanationSummary = document.getElementById("sentimentExplanationSummary");
  if (explanationSummary) {
    explanationSummary.innerHTML = `
      <h4>Understanding the Sentiment Distribution</h4>
      <p>
        The sentiment distribution highlights the balance of emotions expressed throughout your text.
        Positive scores indicate uplifting or motivating language that energizes the reader.
        Neutral sections offer objective or descriptive context that grounds your content in clarity.
        Negative scores signal emotional contrast, criticism, or tension that adds depth and realism when used purposefully.
      </p>
    `;
  }

  // === Timeline Summary Box ===
  const timelineSummary = document.getElementById("sentimentTimelineSummary");
  if (timelineSummary) {
    timelineSummary.innerHTML = `
      <h4>Interpreting the Emotional Timeline</h4>
      <p>
        The sentiment timeline shows how your emotional tone evolves across the text.
        Peaks indicate engaging or joyful passages, while valleys reveal points of reflection or intensity.
        Tracking these shifts helps ensure that the emotional rhythm of your writing feels deliberate and cohesive,
        guiding readers through your intended tone transitions smoothly.
      </p>
    `;
  }

  renderSuggestions("#se-suggestions", se.suggestions || DEFAULT_SUGGESTIONS.sentiment);
})();


/* ========== EMOTIONS ========== */
(function fillEmotions() {
  const em = report.emotions || {};
  const breakdown = { ...em.breakdown };

  const labels = Object.keys(breakdown);
  const data = labels.map(k => Number(breakdown[k]) || 0);
  const ok = labels.length > 0 && hasNonZero(data);

  const dominantEl = document.getElementById("em-dominant");
  if (dominantEl) dominantEl.textContent = em.dominant || "—";

// === Emotion Radar Chart ===
if (ok && labels.length >= 3) {
  setChartStateByCanvas("#emotionsChart", { loading: false, hasData: true });
  renderRadar("#emotionsChart", labels, data, "Emotion Mix");
} else {
  setChartStateByCanvas("#emotionsChart", { loading: true, hasData: false });

  const chartBox = document.querySelector("#emotionsChart")?.closest(".chartbox");
  if (chartBox) {
    let msg = chartBox.querySelector(".empty-note");
    if (!msg) {
      msg = document.createElement("p");
      msg.className = "empty-note";
      chartBox.appendChild(msg);
    }
    msg.textContent = "No radar chart available — text sample is too short for emotional analysis.";
    msg.style.display = "block";
    msg.style.textAlign = "center";
    msg.style.color = "#666";
    msg.style.fontStyle = "italic";
    msg.style.padding = "10px";
  }
}

  // === Infer Dominant Emotion if missing ===
  if (!em.dominant && ok) {
    const maxIndex = data.indexOf(Math.max(...data));
    const inferred = labels[maxIndex];
    if (dominantEl)
      dominantEl.textContent =
        inferred.charAt(0).toUpperCase() + inferred.slice(1);
  }


  // === Emotion Explanation Cards (like Sentiment) ===
  const grid = document.getElementById("emotionsExplanationGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const EMOTION_INFO = [
    {
      label: "Joy",
      color: "#fbc02d",
      tone:
        "Reflects optimism, satisfaction, and warmth — associated with uplifting or rewarding experiences.",
      words: ["happy", "pleased", "joyful", "excited", "delighted", "bright"],
    },
    {
      label: "Sadness",
      color: "#1565c0",
      tone:
        "Captures themes of loss, longing, or empathy — often adding emotional depth and introspection.",
      words: ["sad", "lonely", "blue", "melancholy", "tearful", "disappointed"],
    },
    {
      label: "Anger",
      color: "#c62828",
      tone:
        "Shows frustration or moral outrage — useful for expressing urgency, conflict, or injustice.",
      words: ["angry", "furious", "resentful", "annoyed", "bitter", "hostile"],
    },
    {
      label: "Fear",
      color: "#6a1b9a",
      tone:
        "Conveys anxiety, anticipation, or threat — heightens tension or warns of potential harm.",
      words: ["afraid", "worried", "nervous", "terrified", "scared", "anxious"],
    },
    {
      label: "Surprise",
      color: "#00838f",
      tone:
        "Represents curiosity or amazement — signals shifts in tone or unexpected discoveries.",
      words: ["amazed", "astonished", "shocked", "startled", "wondered", "unexpected"],
    },
    {
      label: "Disgust",
      color: "#33691e",
      tone:
        "Indicates repulsion or moral rejection — commonly tied to critique or ethical boundaries.",
      words: ["disgusted", "repelled", "offended", "gross", "nauseated", "sickened"],
    },
  ];

EMOTION_INFO.forEach((emotion, i) => {
  const card = document.createElement("div");
  card.className = "sentiment-card emotion-card";
  card.style.setProperty("--sentiment-color", emotion.color);
  card.style.animationDelay = `${i * 0.1}s`;

  const title = document.createElement("h4");
  title.textContent = emotion.label;
  card.appendChild(title);

  const tone = document.createElement("p");
  tone.className = "sentiment-tone";
  tone.textContent = emotion.tone;
  card.appendChild(tone);

  const words = document.createElement("div");
  words.className = "sentiment-words";
  words.innerHTML = emotion.words
    .map(
      w =>
        `<span class="word-pill" style="border-color:${emotion.color};color:${emotion.color}">${w}</span>`
    )
    .join("");
  card.appendChild(words);

  setTimeout(() => card.classList.add("visible"), i * 100 + 200);
  grid.appendChild(card);
});


  // === Emotional Highlights Box ===
  const highlightsBox = document.getElementById("sentimentHighlightsText");
  if (highlightsBox) {
    if (report.summary && report.summary.trim().length > 0) {
      highlightsBox.textContent = report.summary;
    } else {
      highlightsBox.textContent =
        "No particularly strong emotional highlights were detected in this text.";
    }
  }

// === Emotional Pattern Summary (UPDATED) ===
const summary = document.getElementById("emotionsExplanationSummary");
if (summary) {
  if (ok && labels.length > 0) {
    const maxIndex = data.indexOf(Math.max(...data));
    const dominantEmotion = labels[maxIndex] || "—";
    const dominantValue = data[maxIndex] || 0;
    const total = data.reduce((a, b) => a + b, 0);
    const percent = total > 0 ? (dominantValue / total) * 100 : 0; // ✅ correct %
    const activeCount = data.filter(v => v > 0).length;
    const diversityScore = total > 0 ? Math.round((activeCount / 6) * 100) : 0;

    // Determine tone text & color (used for border + visual cue)
    let toneDescription = "";
    let color = "#999"; // default neutral

    switch (dominantEmotion.toLowerCase()) {
      case "joy":
        toneDescription =
          "The text carries a predominantly <b>joyful and optimistic</b> tone, centered on warmth and satisfaction.";
        color = "#fbc02d";
        break;
      case "sadness":
        toneDescription =
          "The writing reflects a <b>somber and introspective</b> tone, emphasizing empathy, longing, or melancholy.";
        color = "#1565c0";
        break;
      case "anger":
        toneDescription =
          "The piece expresses <b>anger or moral urgency</b>, giving strength, confrontation, or a call for change.";
        color = "#c62828";
        break;
      case "fear":
        toneDescription =
          "The text conveys <b>tension, caution, or anxiety</b>, revealing vulnerability or uncertainty.";
        color = "#6a1b9a";
        break;
      case "surprise":
        toneDescription =
          "An <b>inquisitive and curious</b> tone dominates, with elements of wonder or unexpected discovery.";
        color = "#00838f";
        break;
      case "disgust":
        toneDescription =
          "The text reveals a <b>critical or rejecting</b> tone, expressing moral judgment or disapproval.";
        color = "#33691e";
        break;
      default:
        toneDescription =
          "The emotional tone appears <b>balanced</b>, without one emotion clearly dominating.";
    }

    summary.innerHTML = `
      <h4>Understanding the Emotional Pattern</h4>
      <p>
        ${toneDescription} The analysis indicates that 
        <b>${dominantEmotion}</b> is the most prominent emotion,
        representing approximately <b>${percent.toFixed(1)}%</b> of the total emotional intensity.
      </p>
      <p>
        The text’s emotional diversity score is <b>${diversityScore}%</b>, 
        suggesting ${
          diversityScore > 65
            ? "a rich variety of emotional tones, indicating expressive and dynamic writing."
            : "a more focused emotional tone that maintains clarity and coherence."
        }
      </p>
    `;

    // 🎨 Use emotion color for border
    summary.style.borderLeft = `4px solid ${color}`;
  } else {
    summary.innerHTML = `
      <h4>Understanding the Emotional Pattern</h4>
      <p>
        No significant emotional signals were detected. 
        This can occur when the writing maintains a neutral tone or is too short 
        for emotion analysis.
      </p>
    `;
    summary.style.borderLeft = "4px solid #ccc";
  }
}

  // === Suggestions ===
  renderSuggestions("#em-suggestions", em.suggestions || DEFAULT_SUGGESTIONS.emotions);
})();

/* ========== KEYNESS ========== */
(function fillKeyness() {
  const keyness = report.keyness || {};
  const list = Array.isArray(keyness.list) ? keyness.list : [];
  const ok = list.length > 0;
  const canvasSelector = "#keynessChart";

  // === Chart Rendering ===
  if (ok) {
    setChartStateByCanvas(canvasSelector, { loading: false, hasData: true });

    const top10 = list.slice(0, 10);
    renderBar(
      canvasSelector,
      top10.map(x => x.token),
      top10.map(x => x.score || x.keyness || x.count || 0),
      "Top 10 Distinctive Words"
    );
  } else {
    setChartStateByCanvas(canvasSelector, { loading: true, hasData: false });
  }

  // === Description Rendering ===
  const keynessBox = document.getElementById("keynessDescription");
  if (keynessBox) {
    keynessBox.innerHTML = getKeynessDescription(list);
    keynessBox.style.opacity = 0;
    keynessBox.style.transition = "opacity 0.6s ease";
    requestAnimationFrame(() => (keynessBox.style.opacity = 1));
  } else {
    console.warn("⚠️ Missing #keynessDescription element in DOM.");
  }
})();

/* ---------- DESCRIPTION: Keyness Analysis ---------- */
function getKeynessDescription(keywords = []) {
  if (!keywords || !keywords.length) {
    return `
      <div class="sentiment-summary-box">
        <strong>About Keyness Analysis:</strong><br>
        Keyness identifies the words that make your writing statistically distinctive 
        when compared with general language use. These distinctive words highlight 
        what makes your text unique — stylistically, thematically, or emotionally.
      </div>
    `;
  }

  const topWords = keywords.slice(0, 5).map(w => `<b>${w.token}</b>`).join(", ");
  return `
    <div class="sentiment-summary-box">
      <strong>Understanding Your Keyness Results:</strong><br>
      The analysis found several words that stand out as unusually frequent in your text 
      compared to common English usage.  
      These include ${topWords}, among others.<br><br>
      Such words often reveal your personal focus or distinctive tone — 
      for example, emotional emphasis, recurring imagery, or preferred expressions 
      that characterize your unique writing style.
    </div>
  `;
}





document.querySelectorAll(".export-success, .export-prompt").forEach(el => el.remove());





// ========== UNIVERSAL EXPORT HELPERS ==========

// ✅ CSV Export
function exportToCSV(filename, headers, rows) {
  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.map(v => `"${v ?? ""}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.click();
  URL.revokeObjectURL(url);
}

// ✅ JSON Export
function exportToJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.click();
  URL.revokeObjectURL(url);
}

function showExportSuccess(filename) {
  // cleanup first
  document.querySelectorAll(".export-prompt, .prompt-overlay").forEach(el => el.remove());

  const box = document.createElement("div");
  box.className = "export-success";
  box.innerHTML = `
    <div class="prompt-overlay"></div>
    <div class="prompt-card success" role="dialog" aria-modal="true">
      <h3>✅ Export Successful</h3>
      <p>Your file <strong>${filename}</strong> has been downloaded successfully!</p>
      <div class="prompt-actions">
        <button id="okExport" class="btn keep">Continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);

  setTimeout(() => box.classList.add("show"), 50);

  const close = () => {
    box.classList.remove("show");
    setTimeout(() => box.remove(), 300);
  };

  box.querySelector("#okExport").addEventListener("click", close);
  box.querySelector(".prompt-overlay").addEventListener("click", close);

  // Auto-close after 2s
  setTimeout(() => {
    if (document.body.contains(box)) close();
  }, 2000);
}


// ====== EXPORT LISTENERS ======
document.addEventListener("DOMContentLoaded", () => {
  const report = JSON.parse(localStorage.getItem("ink_results") || "{}");

  /* ===== KEYWORDS ===== */
  document.getElementById("exportKwCSV")?.addEventListener("click", () => {
    showExportSuccess("keywords_analysis.csv");
    const kw = report.keywords || {};
    const keyness = report.keyness?.list || [];
    const headers = ["Keyword", "Frequency", "Keyness Score"];
    const rows = (kw.list || []).map(k => {
      const score = keyness.find(x => x.token === k.word)?.score || "";
      return [k.word, k.count, score];
    });
    exportToCSV("keywords_analysis.csv", headers, rows);
  });

  document.getElementById("exportKwJSON")?.addEventListener("click", () => {
    showExportSuccess("keywords_analysis.json");
    const data = { ...report.keywords, keyness: report.keyness };
    exportToJSON("keywords_analysis.json", data);
  });

  /* ===== THEMES ===== */
  document.getElementById("exportThCSV")?.addEventListener("click", () => {
    showExportSuccess("themes_clusters.csv");
    const th = report.themes || {};
    const headers = ["Theme", "Size", "Top Keywords"];
    const rows = (th.clusters || []).map(c => [
      c.label,
      c.size || c.count || 0,
      (c.keywords || []).join(" | ")
    ]);
    exportToCSV("themes_clusters.csv", headers, rows);
  });

  document.getElementById("exportThJSON")?.addEventListener("click", () => {
    showExportSuccess("themes_clusters.json");
    exportToJSON("themes_clusters.json", report.themes || {});
  });

  /* ===== SENTIMENT ===== */
  document.getElementById("exportSeCSV")?.addEventListener("click", () => {
    showExportSuccess("sentiment_analysis.csv");
    const se = report.sentiment || {};
    const headers = ["Section", "Positive %", "Neutral %", "Negative %"];
    const rows = (se.timeline || []).map((t, i) => [
      `Section ${i + 1}`,
      t.pos,
      t.neu,
      t.neg
    ]);
    exportToCSV("sentiment_analysis.csv", headers, rows);
  });

  document.getElementById("exportSeJSON")?.addEventListener("click", () => {
    showExportSuccess("sentiment_analysis.json");
    exportToJSON("sentiment_analysis.json", report.sentiment || {});
  });

  /* ===== EMOTIONS ===== */
  document.getElementById("exportEmCSV")?.addEventListener("click", () => {
    showExportSuccess("emotions_analysis.csv");
    const em = report.emotions || {};
    const headers = ["Emotion", "Percentage"];
    const rows = Object.entries(em.breakdown || {});
    rows.unshift(["Dominant Emotion", em.dominant || "—"]);
    exportToCSV("emotions_analysis.csv", headers, rows);
  });

  document.getElementById("exportEmJSON")?.addEventListener("click", () => {
    showExportSuccess("emotions_analysis.json");
    exportToJSON("emotions_analysis.json", report.emotions || {});
  });

  // === Dropdown toggle ===
  document.querySelectorAll(".export-dropdown").forEach(drop => {
    const toggle = drop.querySelector(".btn.export");
    toggle.addEventListener("click", e => {
      e.stopPropagation();
      drop.classList.toggle("open");
    });
    document.addEventListener("click", e => {
      if (!drop.contains(e.target)) drop.classList.remove("open");
    });
  });
});


function showDeleteOverlay() {
  // ✅ Only remove previous export modals (don’t touch new overlays)
  document.querySelectorAll(".export-success, .export-prompt").forEach(el => el.remove());

  // ✅ Create delete overlay with its own background layer
  const box = document.createElement("div");
  box.className = "delete-overlay";
  box.innerHTML = `
    <div class="delete-overlay-bg"></div>
    <div class="prompt-card delete" role="dialog" aria-modal="true">
      <h3>🗑️ Deleting Report...</h3>
      <div class="loading-bar"></div>
    </div>
  `;
  document.body.appendChild(box);

  // Small delay to trigger CSS transitions
  setTimeout(() => box.classList.add("show"), 50);

  // 🕒 Simulate short loading animation, then show success
  setTimeout(() => {
    box.classList.remove("show");
    setTimeout(() => {
      box.remove();
      showDeleteSuccess();
    }, 300);
  }, 1500);
}

function showDeleteSuccess() {
  // ✅ Clean up leftover overlays just in case
  document.querySelectorAll(".delete-overlay, .delete-overlay-bg").forEach(el => el.remove());

  const box = document.createElement("div");
  box.className = "delete-success";
  box.innerHTML = `
    <div class="delete-overlay-bg"></div>
    <div class="prompt-card success" role="dialog" aria-modal="true">
      <h3>✅ Report Deleted</h3>
      <p>Your analysis report has been successfully removed.</p>
      <div class="prompt-actions">
        <button id="okDelete" class="btn keep">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);

  setTimeout(() => box.classList.add("show"), 50);

  const close = () => {
    box.classList.remove("show");
    setTimeout(() => box.remove(), 300);
  };

  box.querySelector("#okDelete").addEventListener("click", close);
  box.querySelector(".delete-overlay-bg").addEventListener("click", close);

  // Auto-close after 2 s (optional)
  setTimeout(() => {
    if (document.body.contains(box)) close();
  }, 2000);
}

document.querySelector('.btn.delete').addEventListener('click', () => {
  // hide export prompt first
  document.querySelector('.export-prompt').classList.remove('show');

  // show delete overlay
  const del = document.querySelector('.delete-overlay');
  del.classList.add('show');

  // simulate loading bar
  setTimeout(() => {
    del.classList.remove('show');
    document.querySelector('.delete-success').classList.add('show');
  }, 1500);
});





  /* ========== Cleanup visuals once charts load ========== */
  setTimeout(() => {
    document.querySelectorAll(".chartbox canvas").forEach(canvas => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        const pixels = ctx.getImageData(0, 0, 5, 5).data;
        const hasData = Array.from(pixels).some(v => v !== 0);
        if (hasData) {
          const box = canvas.closest(".chartbox");
          if (box) {
            box.style.background = "none";
            box.style.border = "2px solid transparent";
          }
        }
      } catch (e) {}
    });
  }, 800);
})();
