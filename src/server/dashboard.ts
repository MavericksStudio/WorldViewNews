/**
 * Inline HTML dashboard for WorldViewNews.
 * Returns a single self-contained HTML string — no build step required.
 * globe.gl and three.js are loaded from CDN.
 */

export function getDashboardHTML(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorldViewNews — Global Intelligence Monitor</title>

  <!-- three.js (required by globe.gl) -->
  <script src="https://unpkg.com/three@0.167.1/build/three.min.js"></script>
  <!-- globe.gl -->
  <script src="https://unpkg.com/globe.gl@2.31.1/dist/globe.gl.min.js"></script>

  <style>
    /* ── Reset & Variables ────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-deep:    #040410;
      --bg-panel:   #0a0a1e;
      --bg-card:    #0f0f2a;
      --bg-hover:   #141435;
      --border:     #1e1e4a;
      --border-glow:#2a2a6a;
      --text-prim:  #e2e8f0;
      --text-sec:   #8892a4;
      --text-dim:   #4a5568;

      --cyan:       #00d4ff;
      --cyan-dim:   #007a99;
      --green:      #00ff88;
      --green-dim:  #007a44;
      --yellow:     #ffd600;
      --orange:     #ff8800;
      --red:        #ff2244;
      --purple:     #b44aff;

      --sev-info:     var(--cyan);
      --sev-low:      var(--green);
      --sev-medium:   var(--yellow);
      --sev-high:     var(--orange);
      --sev-critical: var(--red);

      --header-h:  52px;
      --footer-h:  40px;
      --sidebar-w: 260px;
    }

    html, body {
      height: 100%;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: var(--bg-deep);
      color: var(--text-prim);
      overflow: hidden;
    }

    /* ── Scrollbars ───────────────────────────────────────────────────── */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: var(--bg-panel); }
    ::-webkit-scrollbar-thumb { background: var(--border-glow); border-radius: 2px; }

    /* ── Layout ───────────────────────────────────────────────────────── */
    #app {
      display: grid;
      grid-template-rows: var(--header-h) 1fr var(--footer-h);
      grid-template-columns: var(--sidebar-w) 1fr var(--sidebar-w);
      grid-template-areas:
        "header  header  header"
        "left    globe   right"
        "footer  footer  footer";
      height: 100vh;
    }

    /* ── Header ───────────────────────────────────────────────────────── */
    #header {
      grid-area: header;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 20px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
      z-index: 100;
    }

    .logo {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--cyan);
      text-shadow: 0 0 20px rgba(0,212,255,0.6);
      white-space: nowrap;
    }
    .logo span { color: var(--text-prim); }

    .header-divider { flex: 1; }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-sec);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 10px;
    }

    .dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--text-dim);
    }
    .dot.online  { background: var(--green);  box-shadow: 0 0 6px var(--green); animation: pulse 2s infinite; }
    .dot.warning { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
    .dot.offline { background: var(--red);    box-shadow: 0 0 6px var(--red); }

    @keyframes pulse {
      0%,100% { opacity:1; } 50% { opacity:0.4; }
    }

    /* ── Left Sidebar ─────────────────────────────────────────────────── */
    #left-sidebar {
      grid-area: left;
      background: var(--bg-panel);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    /* ── Right Sidebar ────────────────────────────────────────────────── */
    #right-sidebar {
      grid-area: right;
      background: var(--bg-panel);
      border-left: 1px solid var(--border);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    /* ── Globe container ──────────────────────────────────────────────── */
    #globe-container {
      grid-area: globe;
      background: radial-gradient(ellipse at center, #050520 0%, var(--bg-deep) 100%);
      position: relative;
      overflow: hidden;
    }

    #globe-el {
      width: 100%;
      height: 100%;
    }

    .globe-overlay {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.65rem;
      color: var(--text-dim);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      pointer-events: none;
    }

    /* ── Tooltip ──────────────────────────────────────────────────────── */
    #tooltip {
      position: fixed;
      display: none;
      background: rgba(10,10,30,0.97);
      border: 1px solid var(--border-glow);
      border-radius: 8px;
      padding: 10px 14px;
      max-width: 280px;
      z-index: 999;
      pointer-events: none;
      box-shadow: 0 0 20px rgba(0,100,200,0.3);
    }
    #tooltip .tt-title { font-size: 0.8rem; font-weight: 700; color: var(--text-prim); margin-bottom: 4px; }
    #tooltip .tt-meta  { font-size: 0.68rem; color: var(--text-sec); margin-bottom: 6px; }
    #tooltip .tt-desc  { font-size: 0.72rem; color: var(--text-sec); line-height: 1.45; }

    /* ── Panel headers ────────────────────────────────────────────────── */
    .panel-header {
      padding: 10px 14px 8px;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--cyan);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    /* ── Source list ──────────────────────────────────────────────────── */
    #sources-list {
      flex-shrink: 0;
    }
    .source-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      border-bottom: 1px solid var(--border);
      font-size: 0.7rem;
    }
    .source-name { flex: 1; color: var(--text-sec); }
    .source-cat  { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; }
    .src-dot     { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .src-dot.ok  { background: var(--green); box-shadow: 0 0 4px var(--green); }
    .src-dot.off { background: var(--text-dim); }

    /* ── Category filters ─────────────────────────────────────────────── */
    #filters {
      flex-shrink: 0;
    }
    .filter-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      padding: 10px 14px;
    }
    .filter-btn {
      font-size: 0.62rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text-sec);
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-btn:hover { border-color: var(--cyan-dim); color: var(--cyan); }
    .filter-btn.active { background: rgba(0,212,255,0.12); border-color: var(--cyan); color: var(--cyan); }

    /* ── Severity filter ──────────────────────────────────────────────── */
    #sev-filters {
      flex-shrink: 0;
    }
    .sev-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      padding: 8px 14px 12px;
    }
    .sev-btn {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
      opacity: 0.5;
    }
    .sev-btn.active { opacity: 1; }
    .sev-btn[data-sev="info"]     { color: var(--cyan);   border-color: var(--cyan-dim);  background: rgba(0,212,255,0.08); }
    .sev-btn[data-sev="low"]      { color: var(--green);  border-color: var(--green-dim); background: rgba(0,255,136,0.08); }
    .sev-btn[data-sev="medium"]   { color: var(--yellow); border-color: #665800;          background: rgba(255,214,0,0.08); }
    .sev-btn[data-sev="high"]     { color: var(--orange); border-color: #663500;          background: rgba(255,136,0,0.08); }
    .sev-btn[data-sev="critical"] { color: var(--red);    border-color: #660011;          background: rgba(255,34,68,0.08); }

    /* ── Live feed ────────────────────────────────────────────────────── */
    #feed-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px 8px;
      border-bottom: 1px solid var(--border);
    }
    #feed-header .ph { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cyan); }
    #feed-count { font-size: 0.62rem; color: var(--text-dim); font-variant-numeric: tabular-nums; }

    #feed-list {
      flex: 1;
      overflow-y: auto;
    }

    .feed-item {
      padding: 9px 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.12s;
    }
    .feed-item:hover { background: var(--bg-hover); }
    .feed-item.expanded .fi-body { display: block; }

    .fi-top {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .sev-badge {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 1px 5px;
      border-radius: 3px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .sev-badge.info     { background: rgba(0,212,255,0.15); color: var(--cyan);   border: 1px solid var(--cyan-dim); }
    .sev-badge.low      { background: rgba(0,255,136,0.12); color: var(--green);  border: 1px solid var(--green-dim); }
    .sev-badge.medium   { background: rgba(255,214,0,0.12); color: var(--yellow); border: 1px solid #665800; }
    .sev-badge.high     { background: rgba(255,136,0,0.12); color: var(--orange); border: 1px solid #663500; }
    .sev-badge.critical { background: rgba(255,34,68,0.15); color: var(--red);    border: 1px solid #660011; animation: blink 1.2s infinite; }

    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

    .fi-content { flex: 1; min-width: 0; }
    .fi-title { font-size: 0.73rem; font-weight: 600; color: var(--text-prim); line-height: 1.35; margin-bottom: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fi-meta  { display: flex; gap: 6px; font-size: 0.62rem; color: var(--text-dim); flex-wrap: wrap; }
    .fi-source { color: var(--cyan-dim); }
    .fi-cat    { text-transform: uppercase; letter-spacing: 0.04em; }

    .fi-body {
      display: none;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      font-size: 0.7rem;
      color: var(--text-sec);
      line-height: 1.55;
    }
    .fi-body a { color: var(--cyan); text-decoration: none; }
    .fi-body a:hover { text-decoration: underline; }
    .fi-tags { margin-top: 5px; display: flex; gap: 4px; flex-wrap: wrap; }
    .fi-tag  { font-size: 0.6rem; padding: 1px 5px; border-radius: 3px; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-dim); }

    /* ── Footer ───────────────────────────────────────────────────────── */
    #footer {
      grid-area: footer;
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 0 20px;
      background: var(--bg-panel);
      border-top: 1px solid var(--border);
      font-size: 0.67rem;
      color: var(--text-dim);
      font-variant-numeric: tabular-nums;
    }
    .footer-stat { display: flex; align-items: center; gap: 6px; }
    .footer-label { text-transform: uppercase; letter-spacing: 0.07em; font-size: 0.6rem; }
    .footer-value { color: var(--text-sec); font-weight: 600; }
    #sweep-progress {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .spinner {
      display: none;
      width: 10px; height: 10px;
      border: 1.5px solid var(--border-glow);
      border-top-color: var(--cyan);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner.active { display: block; }

    /* ── Empty state ──────────────────────────────────────────────────── */
    .empty-state {
      padding: 20px 14px;
      font-size: 0.7rem;
      color: var(--text-dim);
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>
<div id="app">

  <!-- ── Header ─────────────────────────────────────────────────────── -->
  <header id="header">
    <div class="logo">WorldView<span>News</span></div>
    <div class="status-pill">
      <div class="dot" id="conn-dot"></div>
      <span id="conn-label">Connecting…</span>
    </div>
    <div class="status-pill">
      <div class="dot online"></div>
      <span id="hdr-sources">0 Sources</span>
    </div>
    <div class="header-divider"></div>
    <div class="status-pill">
      <span id="hdr-items">0 Items</span>
    </div>
    <div class="status-pill">
      <span>Last sweep: <strong id="hdr-sweep">—</strong></span>
    </div>
  </header>

  <!-- ── Left Sidebar ───────────────────────────────────────────────── -->
  <aside id="left-sidebar">
    <div id="sources-list">
      <div class="panel-header">Data Sources</div>
      <div id="sources-inner"><div class="empty-state">Loading…</div></div>
    </div>
    <div id="filters">
      <div class="panel-header" style="margin-top:1px">Category Filter</div>
      <div class="filter-grid" id="cat-filters">
        <button class="filter-btn active" data-cat="all">All</button>
        <button class="filter-btn" data-cat="conflict">Conflict</button>
        <button class="filter-btn" data-cat="aviation">Aviation</button>
        <button class="filter-btn" data-cat="maritime">Maritime</button>
        <button class="filter-btn" data-cat="environment">Environ.</button>
        <button class="filter-btn" data-cat="economic">Economic</button>
        <button class="filter-btn" data-cat="market">Market</button>
        <button class="filter-btn" data-cat="space">Space</button>
        <button class="filter-btn" data-cat="news">News</button>
        <button class="filter-btn" data-cat="weather">Weather</button>
      </div>
    </div>
    <div id="sev-filters">
      <div class="panel-header">Severity Filter</div>
      <div class="sev-grid" id="sev-filter-grid">
        <button class="sev-btn active" data-sev="info">Info</button>
        <button class="sev-btn active" data-sev="low">Low</button>
        <button class="sev-btn active" data-sev="medium">Medium</button>
        <button class="sev-btn active" data-sev="high">High</button>
        <button class="sev-btn active" data-sev="critical">Critical</button>
      </div>
    </div>
  </aside>

  <!-- ── Globe ──────────────────────────────────────────────────────── -->
  <main id="globe-container">
    <div id="globe-el"></div>
    <div class="globe-overlay">Drag to rotate · Scroll to zoom</div>
    <div id="tooltip">
      <div class="tt-title" id="tt-title"></div>
      <div class="tt-meta" id="tt-meta"></div>
      <div class="tt-desc" id="tt-desc"></div>
    </div>
  </main>

  <!-- ── Right Sidebar ──────────────────────────────────────────────── -->
  <aside id="right-sidebar">
    <div id="feed-header">
      <span class="ph">Live Intelligence Feed</span>
      <span id="feed-count">0 items</span>
    </div>
    <div id="feed-list">
      <div class="empty-state">Waiting for first sweep…</div>
    </div>
  </aside>

  <!-- ── Footer ─────────────────────────────────────────────────────── -->
  <footer id="footer">
    <div class="footer-stat">
      <span class="footer-label">Sweeps</span>
      <span class="footer-value" id="ft-sweeps">0</span>
    </div>
    <div class="footer-stat">
      <span class="footer-label">Items</span>
      <span class="footer-value" id="ft-items">0</span>
    </div>
    <div class="footer-stat">
      <span class="footer-label">Sources</span>
      <span class="footer-value" id="ft-sources">0 / 0</span>
    </div>
    <div class="footer-stat">
      <span class="footer-label">SSE Clients</span>
      <span class="footer-value" id="ft-clients">—</span>
    </div>
    <div id="sweep-progress">
      <span id="ft-status">Initialising…</span>
      <div class="spinner" id="spinner"></div>
    </div>
  </footer>

</div>

<!-- ── Application Script ────────────────────────────────────────────── -->
<script>
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────
  let allItems    = [];
  let allSources  = [];
  let activeCategory = 'all';
  let activeSeverities = new Set(['info','low','medium','high','critical']);
  let globe       = null;
  let globeReady  = false;
  let userInteracting = false;
  let idleTimer   = null;

  const SEV_COLOR = {
    info:     '#00d4ff',
    low:      '#00ff88',
    medium:   '#ffd600',
    high:     '#ff8800',
    critical: '#ff2244',
  };
  const SEV_SIZE = { info: 0.35, low: 0.4, medium: 0.55, high: 0.7, critical: 0.9 };

  // ── DOM refs ─────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const connDot   = $('conn-dot');
  const connLabel = $('conn-label');

  // ── Helpers ──────────────────────────────────────────────────────────
  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)   return diff + 's ago';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }

  function filteredItems() {
    return allItems.filter(it =>
      (activeCategory === 'all' || it.category === activeCategory) &&
      activeSeverities.has(it.severity)
    );
  }

  // ── Globe setup ───────────────────────────────────────────────────────
  function initGlobe() {
    if (typeof Globe === 'undefined') {
      console.warn('globe.gl not loaded — retrying in 500ms');
      setTimeout(initGlobe, 500);
      return;
    }

    const container = $('globe-el');
    const w = container.clientWidth;
    const h = container.clientHeight;

    globe = Globe({ animateIn: true })(container);
    globe
      .width(w)
      .height(h)
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .atmosphereColor('#1a4a8a')
      .atmosphereAltitude(0.15)
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointColor('color')
      .pointRadius('radius')
      .pointAltitude(0.01)
      .pointResolution(6)
      .onPointHover(handlePointHover)
      .pointLabel(() => '');

    // Auto-rotate when user is not interacting
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableDamping = true;

    globe.controls().addEventListener('start', () => {
      userInteracting = true;
      globe.controls().autoRotate = false;
      clearTimeout(idleTimer);
    });
    globe.controls().addEventListener('end', () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        globe.controls().autoRotate = true;
        userInteracting = false;
      }, 4000);
    });

    window.addEventListener('resize', () => {
      globe.width(container.clientWidth).height(container.clientHeight);
    });

    globeReady = true;
    updateGlobe();
  }

  function updateGlobe() {
    if (!globeReady) return;
    const items = filteredItems().filter(it => it.location);
    const points = items.map(it => ({
      lat:    it.location.lat,
      lng:    it.location.lon,
      color:  SEV_COLOR[it.severity] || '#ffffff',
      radius: SEV_SIZE[it.severity]  || 0.4,
      item:   it,
    }));
    globe.pointsData(points);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────
  const tooltip = $('tooltip');
  document.addEventListener('mousemove', e => {
    if (tooltip.style.display === 'block') {
      const x = e.clientX + 14;
      const y = e.clientY - 10;
      tooltip.style.left = Math.min(x, window.innerWidth  - 300) + 'px';
      tooltip.style.top  = Math.min(y, window.innerHeight - 120) + 'px';
    }
  });

  function handlePointHover(pt) {
    if (!pt) { tooltip.style.display = 'none'; return; }
    const it = pt.item;
    $('tt-title').textContent = it.title;
    $('tt-meta').textContent  = [it.source, it.category.toUpperCase(), timeAgo(it.timestamp)].join(' · ');
    $('tt-desc').textContent  = it.description.slice(0, 180) + (it.description.length > 180 ? '…' : '');
    tooltip.style.display = 'block';
  }

  // ── Sources list ─────────────────────────────────────────────────────
  function renderSources() {
    const el = $('sources-inner');
    if (!allSources.length) { el.innerHTML = '<div class="empty-state">No sources registered.</div>'; return; }
    el.innerHTML = allSources.map(s => \`
      <div class="source-item">
        <div class="src-dot \${s.available ? 'ok' : 'off'}"></div>
        <span class="source-name">\${s.name}</span>
        <span class="source-cat">\${s.category}</span>
      </div>
    \`).join('');
  }

  // ── Feed ──────────────────────────────────────────────────────────────
  function renderFeed() {
    const items = filteredItems().slice().reverse();
    const el    = $('feed-list');
    $('feed-count').textContent = items.length + ' item' + (items.length !== 1 ? 's' : '');

    if (!items.length) {
      el.innerHTML = '<div class="empty-state">No items matching current filters.</div>';
      return;
    }

    el.innerHTML = items.slice(0, 200).map(it => {
      const tags = (it.tags||[]).slice(0,4).map(t => \`<span class="fi-tag">\${t}</span>\`).join('');
      const url  = it.url ? \`<a href="\${it.url}" target="_blank" rel="noopener">View source ↗</a>\` : '';
      const loc  = it.location ? \`<br><small>📍 \${it.location.name}\${it.location.country ? ', '+it.location.country : ''}</small>\` : '';
      return \`
        <div class="feed-item" onclick="this.classList.toggle('expanded')">
          <div class="fi-top">
            <span class="sev-badge \${it.severity}">\${it.severity}</span>
            <div class="fi-content">
              <div class="fi-title">\${it.title}</div>
              <div class="fi-meta">
                <span class="fi-source">\${it.source}</span>
                <span class="fi-cat">\${it.category}</span>
                <span>\${timeAgo(it.timestamp)}</span>
              </div>
            </div>
          </div>
          <div class="fi-body">
            \${it.description}\${loc}
            \${url ? '<br><br>' + url : ''}
            \${tags ? '<div class="fi-tags">' + tags + '</div>' : ''}
          </div>
        </div>
      \`;
    }).join('');
  }

  // ── Status bar ────────────────────────────────────────────────────────
  function updateStatus(data) {
    if (data.sweepCount  !== undefined) $('ft-sweeps').textContent  = data.sweepCount;
    if (data.itemCount   !== undefined) {
      $('ft-items').textContent   = data.itemCount;
      $('hdr-items').textContent  = data.itemCount + ' Items';
    }
    if (data.sourceCount !== undefined) {
      $('hdr-sources').textContent = data.sourceCount + ' Sources';
    }
    if (data.lastSweepAt !== undefined) {
      const t = data.lastSweepAt ? fmtDate(data.lastSweepAt) : '—';
      $('hdr-sweep').textContent = t;
    }
    if (data.uptime !== undefined) {
      $('ft-status').textContent = 'Uptime: ' + formatUptime(data.uptime);
    }
  }

  function formatUptime(secs) {
    if (secs < 60)   return secs + 's';
    if (secs < 3600) return Math.floor(secs/60) + 'm ' + (secs%60) + 's';
    return Math.floor(secs/3600) + 'h ' + Math.floor((secs%3600)/60) + 'm';
  }

  // ── Data fetching ─────────────────────────────────────────────────────
  async function fetchAll() {
    try {
      const [itemsRes, sourcesRes, statusRes] = await Promise.all([
        fetch('/api/v1/items'),
        fetch('/api/v1/sources'),
        fetch('/api/v1/status'),
      ]);
      allItems   = await itemsRes.json();
      allSources = await sourcesRes.json();
      const status = await statusRes.json();

      updateStatus(status);
      renderSources();
      renderFeed();
      updateGlobe();

      const avail = allSources.filter(s => s.available).length;
      $('ft-sources').textContent = avail + ' / ' + allSources.length;
    } catch (e) {
      console.error('fetch error', e);
    }
  }

  // ── SSE ───────────────────────────────────────────────────────────────
  let evtSource = null;
  let reconnectDelay = 1000;

  function connectSSE() {
    if (evtSource) { evtSource.close(); evtSource = null; }

    evtSource = new EventSource('/api/v1/stream');

    evtSource.addEventListener('open', () => {
      connDot.className   = 'dot online';
      connLabel.textContent = 'Live';
      reconnectDelay = 1000;
    });

    evtSource.addEventListener('sweep', e => {
      const result = JSON.parse(e.data);
      // Merge new items (deduplicate by id)
      const existing = new Set(allItems.map(i => i.id));
      const newItems = result.items.filter(i => !existing.has(i.id));
      allItems = [...allItems, ...newItems].slice(-500); // keep last 500

      updateStatus({
        sweepCount: undefined,
        itemCount: allItems.length,
        lastSweepAt: result.completedAt,
      });
      renderFeed();
      updateGlobe();
      $('spinner').classList.remove('active');
    });

    evtSource.addEventListener('status', e => {
      const data = JSON.parse(e.data);
      updateStatus(data);
    });

    evtSource.addEventListener('error', () => {
      connDot.className    = 'dot offline';
      connLabel.textContent = 'Reconnecting…';
      evtSource.close();
      evtSource = null;
      setTimeout(connectSSE, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });
  }

  // ── Filters ───────────────────────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      renderFeed();
      updateGlobe();
    });
  });

  document.querySelectorAll('.sev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sev = btn.dataset.sev;
      if (activeSeverities.has(sev)) {
        if (activeSeverities.size > 1) { // keep at least one
          activeSeverities.delete(sev);
          btn.classList.remove('active');
        }
      } else {
        activeSeverities.add(sev);
        btn.classList.add('active');
      }
      renderFeed();
      updateGlobe();
    });
  });

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    initGlobe();
    await fetchAll();
    connectSSE();

    // Periodic status refresh
    setInterval(async () => {
      try {
        const r = await fetch('/api/v1/status');
        const d = await r.json();
        updateStatus(d);
        const avail = allSources.filter(s => s.available).length;
        $('ft-sources').textContent = avail + ' / ' + allSources.length;
      } catch {}
    }, 15000);
  }

  boot();
})();
</script>
</body>
</html>`;
}
