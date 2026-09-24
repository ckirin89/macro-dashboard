const fmtNum = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v)) ? "—" : v.toFixed(digits);
const fmtDate = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const scoreColor = (v) => (v >= 0 ? "var(--blue)" : "var(--red)");
const scoreLabel = (v) => {
  if (v === null || v === undefined) return "데이터 없음";
  if (v >= 1.0) return "매우 우호적";
  if (v >= 0.3) return "우호적";
  if (v > -0.3) return "중립";
  if (v > -1.0) return "비우호적";
  return "매우 비우호적";
};

function buildPath(values, w, h, pad = 4) {
  const nums = values.map((p) => p.value).filter((v) => v !== null && v !== undefined);
  if (nums.length < 2) return null;
  const min = Math.min(...nums), max = Math.max(...nums);
  const range = max - min || 1;
  const n = values.length;
  const stepX = (w - pad * 2) / (n - 1);
  let d = "";
  let started = false;
  const pts = [];
  values.forEach((p, i) => {
    const x = pad + i * stepX;
    if (p.value === null || p.value === undefined) { started = false; return; }
    const y = pad + (h - pad * 2) * (1 - (p.value - min) / range);
    d += (started ? "L" : "M") + x.toFixed(2) + "," + y.toFixed(2) + " ";
    started = true;
    pts.push({ x, y, date: p.date, value: p.value });
  });
  return { d, pts, min, max, zeroY: pad + (h - pad * 2) * (1 - (0 - min) / range) };
}

function sparkline(container, series, color) {
  const w = 120, h = 32;
  const built = buildPath(series, w, h, 2);
  if (!built) { container.innerHTML = ""; return; }
  const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${built.d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  container.innerHTML = svg;
}

function lineChart(wrapEl, series, opts = {}) {
  const w = 320, h = 140, pad = 10;
  const axisW = 34; // y축 라벨 공간
  const built = buildPath(series, w, h, pad);
  wrapEl.innerHTML = "";
  if (!built) { wrapEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:20px 0;text-align:center;">데이터 부족</div>'; return; }
  const color = opts.color || "var(--blue)";
  const showZero = opts.showZero !== false;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w + axisW} ${h}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const addLabel = (y, text) => {
    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", w + axisW - 4);
    t.setAttribute("y", Math.min(Math.max(y, 9), h - 3));
    t.setAttribute("text-anchor", "end");
    t.setAttribute("font-size", "10");
    t.setAttribute("fill", "var(--text-muted)");
    t.textContent = text;
    svg.appendChild(t);
  };
  addLabel(pad, fmtNum(built.max, opts.digits ?? 2) + (opts.unit || ""));
  addLabel(h - pad, fmtNum(built.min, opts.digits ?? 2) + (opts.unit || ""));

  if (showZero && built.zeroY >= pad && built.zeroY <= h - pad) {
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", pad); line.setAttribute("x2", w - pad);
    line.setAttribute("y1", built.zeroY); line.setAttribute("y2", built.zeroY);
    line.setAttribute("stroke", "var(--gridline)");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
    addLabel(built.zeroY, "0");
  }

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", built.d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  const last = built.pts[built.pts.length - 1];
  if (last) {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", last.x); dot.setAttribute("cy", last.y);
    dot.setAttribute("r", 4);
    dot.setAttribute("fill", color);
    dot.setAttribute("stroke", "var(--surface)");
    dot.setAttribute("stroke-width", "2");
    svg.appendChild(dot);
  }

  const crosshair = document.createElementNS(svgNS, "line");
  crosshair.setAttribute("y1", 0); crosshair.setAttribute("y2", h);
  crosshair.setAttribute("stroke", "var(--text-muted)");
  crosshair.setAttribute("stroke-width", "1");
  crosshair.style.opacity = "0";
  svg.appendChild(crosshair);

  wrapEl.appendChild(svg);
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  wrapEl.appendChild(tooltip);

  const viewBoxW = w + axisW;

  function nearestPoint(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * viewBoxW;
    let best = built.pts[0], bestDist = Infinity;
    for (const p of built.pts) {
      const dist = Math.abs(p.x - x);
      if (dist < bestDist) { bestDist = dist; best = p; }
    }
    return { best, rect };
  }

  function moveHandler(clientX) {
    const { best, rect } = nearestPoint(clientX);
    crosshair.setAttribute("x1", best.x); crosshair.setAttribute("x2", best.x);
    crosshair.style.opacity = "1";
    tooltip.style.opacity = "1";
    tooltip.textContent = `${fmtDate(best.date)} · ${fmtNum(best.value, opts.digits ?? 2)}${opts.unit || ""}`;
    const px = (best.x / viewBoxW) * rect.width;
    tooltip.style.left = Math.min(Math.max(px - 40, 0), rect.width - 90) + "px";
    tooltip.style.top = "-4px";
  }
  function leaveHandler() { crosshair.style.opacity = "0"; tooltip.style.opacity = "0"; }

  svg.addEventListener("mousemove", (e) => moveHandler(e.clientX));
  svg.addEventListener("mouseleave", leaveHandler);
  svg.addEventListener("touchstart", (e) => moveHandler(e.touches[0].clientX), { passive: true });
  svg.addEventListener("touchmove", (e) => moveHandler(e.touches[0].clientX), { passive: true });
  svg.addEventListener("touchend", leaveHandler);
}

function riskColorForPercentile(pct) {
  if (pct >= 90) return "var(--critical)";
  if (pct >= 75) return "var(--serious)";
  if (pct >= 50) return "var(--warning)";
  return "var(--good)";
}

async function main() {
  const res = await fetch("data.json", { cache: "no-store" });
  const data = await res.json();

  document.getElementById("updated").textContent =
    "업데이트: " + new Date(data.generated_at).toLocaleString("ko-KR", { dateStyle: "medium" });

  const hero = data.composite_latest;
  const heroValueEl = document.getElementById("hero-value");
  heroValueEl.textContent = (hero === null ? "—" : (hero > 0 ? "+" : "") + hero.toFixed(2));
  heroValueEl.style.color = hero === null ? "var(--text-primary)" : scoreColor(hero);
  document.getElementById("hero-label-desc").textContent = scoreLabel(hero);

  // 그룹 카드: 복합 지표(2개 이상)와 개별 지표(1개)를 구분해서 렌더링
  const compositeEl = document.getElementById("groups-composite");
  const singleEl = document.getElementById("groups-single");
  const groupOrder = Object.entries(data.groups).sort((a, b) => (b[1].members.length - a[1].members.length));
  groupOrder.forEach(([gid, g]) => {
    const isComposite = g.members.length > 1;
    const targetEl = isComposite ? compositeEl : singleEl;
    const card = document.createElement("div");
    card.className = "card group-card";
    const color = g.latest_score === null ? "var(--text-muted)" : scoreColor(g.latest_score);
    const membersHtml = isComposite ? '<div data-members></div>' : '';
    card.innerHTML = `
      <div class="group-row">
        <div>
          <div class="group-name">${g.name_kr}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${scoreLabel(g.latest_score)}</div>
        </div>
        <div class="group-spark" data-spark></div>
        <div class="group-score" style="color:${color}">${g.latest_score === null ? "—" : (g.latest_score > 0 ? "+" : "") + g.latest_score.toFixed(2)}</div>
      </div>
      <div class="group-detail" data-detail>
        ${membersHtml}
        <div class="chart-wrap" data-chart></div>
      </div>
    `;
    targetEl.appendChild(card);
    sparkline(card.querySelector("[data-spark]"), g.history.slice(-24), color);

    if (isComposite) {
      const membersEl = card.querySelector("[data-members]");
      g.members.forEach((m) => {
        const row = document.createElement("div");
        row.className = "member-row";
        const zColor = m.latest_z === null ? "var(--text-muted)" : scoreColor(m.latest_z);
        row.innerHTML = `<span>${m.name_kr}</span><span class="z" style="color:${zColor}">${m.latest_z === null ? "—" : (m.latest_z > 0 ? "+" : "") + m.latest_z.toFixed(2)}</span>`;
        membersEl.appendChild(row);
      });
    }

    let opened = false;
    card.addEventListener("click", () => {
      opened = !opened;
      const detail = card.querySelector("[data-detail]");
      detail.classList.toggle("open", opened);
      if (opened) lineChart(card.querySelector("[data-chart]"), g.history, { color, digits: 2 });
    });
  });

  // 밸류에이션
  const valEl = document.getElementById("valuation");
  Object.entries(data.valuation).forEach(([id, v]) => {
    const risk = v.sign < 0 ? v.percentile : 100 - v.percentile;
    const color = riskColorForPercentile(risk);
    const row = document.createElement("div");
    row.className = "valuation-row";
    const riskRankPct = (100 - risk).toFixed(0); // "부담 상위 N%" - risk가 높을수록 상위
    row.innerHTML = `
      <div class="valuation-head">
        <span class="name">${v.name_kr}</span>
        <span class="pct">부담 상위 ${riskRankPct}% (${v.latest_value})</span>
      </div>
      <div class="meter-track"><div class="meter-fill" style="width:${risk}%;background:${color}"></div></div>
    `;
    valEl.appendChild(row);
  });

  // 타겟 지수
  const targetsEl = document.getElementById("targets");
  Object.entries(data.targets).forEach(([id, t]) => {
    const card = document.createElement("div");
    card.className = "card target-card";
    const chg = (v) => {
      if (v === null || v === undefined) return '<span class="chg flat">—</span>';
      const cls = v > 0.05 ? "up" : v < -0.05 ? "down" : "flat";
      const sign = v > 0 ? "+" : "";
      return `<span class="chg ${cls}">${sign}${v.toFixed(1)}%</span>`;
    };
    card.innerHTML = `
      <div class="target-head">
        <span class="target-name">${t.name_kr}</span>
        <span class="target-value">${t.latest_value.toLocaleString()}</span>
      </div>
      <div class="target-changes">
        <div>1개월 ${chg(t.chg_1m)}</div>
        <div>3개월 ${chg(t.chg_3m)}</div>
        <div>1년 ${chg(t.chg_1y)}</div>
      </div>
      <div class="chart-wrap" data-chart></div>
    `;
    targetsEl.appendChild(card);
    lineChart(card.querySelector("[data-chart]"), t.history, { color: "var(--blue)", showZero: false, digits: 0 });
  });

  // 참고 지표
  const contextEl = document.getElementById("context-list");
  Object.entries(data.context).forEach(([id, c]) => {
    const row = document.createElement("div");
    row.className = "context-row";
    row.innerHTML = `<span class="context-name">${c.name_kr}</span><span class="context-value">${c.latest_value.toLocaleString()} <span style="color:var(--text-muted);font-weight:400;">(${c.latest_date.slice(0, 7)})</span></span>`;
    contextEl.appendChild(row);
  });
  document.getElementById("context-toggle").addEventListener("click", () => {
    contextEl.classList.toggle("open");
    document.getElementById("context-toggle").textContent =
      contextEl.classList.contains("open") ? "참고 지표 접기 ▲" : "참고 지표 더보기 ▼";
  });
}

// 다크모드 토글
const themeToggle = document.getElementById("theme-toggle");
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function applyThemeLabel() {
  themeToggle.textContent = currentTheme() === "dark" ? "☀️ 라이트" : "🌙 다크";
}
themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch (e) {}
  applyThemeLabel();
});
try {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
} catch (e) {}
applyThemeLabel();

main();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
