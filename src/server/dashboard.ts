/**
 * Inline HTML dashboard for WorldViewNews.
 * Returns a single self-contained HTML string — no build step required.
 * globe.gl, three.js, and Leaflet are loaded from CDN.
 */

export function getDashboardHTML(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorldViewNews — Global Intelligence Monitor</title>

  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />

  <style>
    /* ── Reset & Variables ─────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-deep:      #0a0a1a;
      --bg-panel:     #111127;
      --bg-card:      #161630;
      --bg-hover:     #1c1c3a;
      --border:       #1e1e4a;
      --border-glow:  #2e2e6a;
      --text-prim:    #e2e8f0;
      --text-sec:     #8892a4;
      --text-dim:     #4a5568;

      --cyan:         #00ffff;
      --cyan-dim:     #006a6a;
      --cyan-glow:    rgba(0,255,255,0.15);
      --purple:       #8b5cf6;
      --purple-dim:   #4c1d95;
      --purple-glow:  rgba(139,92,246,0.15);
      --green:        #00ff00;
      --green-dim:    #004400;
      --yellow:       #ffff00;
      --yellow-dim:   #666600;
      --orange:       #ff8800;
      --orange-dim:   #663500;
      --red:          #ff0000;
      --red-dim:      #660000;
      --blue:         #4488ff;

      /* Category colours */
      --cat-conflict:    #ef4444;
      --cat-aviation:    #3b82f6;
      --cat-maritime:    #06b6d4;
      --cat-environment: #22c55e;
      --cat-economic:    #f59e0b;
      --cat-market:      #a855f7;
      --cat-space:       #6366f1;
      --cat-news:        #64748b;
      --cat-weather:     #0ea5e9;

      /* Severity colours */
      --sev-info:     #00ffff;
      --sev-low:      #00ff00;
      --sev-medium:   #ffff00;
      --sev-high:     #ff8800;
      --sev-critical: #ff0000;

      --header-h:   52px;
      --footer-h:   40px;
      --left-w:     280px;
      --right-w:    320px;
    }

    html, body {
      height: 100%;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: var(--bg-deep);
      color: var(--text-prim);
      overflow: hidden;
    }

    /* ── Custom Scrollbars ─────────────────────────────────────────────── */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-glow); border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--cyan-dim); }

    /* ── Layout Grid ───────────────────────────────────────────────────── */
    #app {
      display: grid;
      grid-template-rows: var(--header-h) 28px 1fr var(--footer-h);
      grid-template-columns: var(--left-w) 1fr var(--right-w);
      grid-template-areas:
        "header  header  header"
        "ticker  ticker  ticker"
        "left    center  right"
        "footer  footer  footer";
      height: 100vh;
      min-width: 1280px;
    }

    /* ── Header ────────────────────────────────────────────────────────── */
    #header {
      grid-area: header;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
      z-index: 200;
      backdrop-filter: blur(8px);
    }

    .logo {
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--cyan);
      text-shadow: 0 0 24px rgba(0,255,255,0.7), 0 0 48px rgba(0,255,255,0.3);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .logo span { color: var(--text-prim); text-shadow: none; }

    .hdr-sep {
      width: 1px;
      height: 24px;
      background: var(--border);
      flex-shrink: 0;
    }

    .hdr-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--text-sec);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 3px 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .hdr-pill .label { color: var(--text-dim); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .hdr-pill .value { color: var(--text-prim); font-weight: 700; font-variant-numeric: tabular-nums; }
    .hdr-pill .value.cyan   { color: var(--cyan); }
    .hdr-pill .value.orange { color: var(--orange); }
    .hdr-pill .value.red    { color: var(--red); }

    .hdr-spacer { flex: 1; }

    /* ── Status Dot ────────────────────────────────────────────────────── */
    .dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--text-dim);
      flex-shrink: 0;
    }
    .dot.online   { background: var(--green);  box-shadow: 0 0 8px var(--green); animation: pulse-dot 2s infinite; }
    .dot.warning  { background: var(--yellow); box-shadow: 0 0 8px var(--yellow); }
    .dot.offline  { background: var(--red);    box-shadow: 0 0 8px var(--red); animation: pulse-dot 1s infinite; }

    @keyframes pulse-dot {
      0%,100% { opacity:1; } 50% { opacity:0.35; }
    }

    /* ── Sweep spinner ─────────────────────────────────────────────────── */
    .spinner {
      width: 12px; height: 12px;
      border: 1.5px solid var(--border-glow);
      border-top-color: var(--cyan);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: none;
      flex-shrink: 0;
    }
    .spinner.active { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Left Panel ────────────────────────────────────────────────────── */
    #left-panel {
      grid-area: left;
      background: var(--bg-panel);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Panel Section ─────────────────────────────────────────────────── */
    .panel-section {
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .panel-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 12px 7px;
      cursor: pointer;
      user-select: none;
      transition: background 0.12s;
    }
    .panel-section-header:hover { background: var(--bg-hover); }

    .panel-section-title {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--cyan);
    }

    .panel-section-title.purple { color: var(--purple); }

    .panel-chevron {
      font-size: 0.6rem;
      color: var(--text-dim);
      transition: transform 0.2s;
    }
    .panel-section.collapsed .panel-chevron { transform: rotate(-90deg); }

    .panel-section-body {
      overflow: hidden;
      transition: max-height 0.25s ease;
    }
    .panel-section.collapsed .panel-section-body { max-height: 0 !important; }

    /* ── Source list ───────────────────────────────────────────────────── */
    .source-item {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 0.68rem;
      cursor: pointer;
      transition: opacity 0.15s, background 0.12s;
      user-select: none;
    }
    .source-item:hover { background: var(--bg-hover); }
    .source-item:last-child { border-bottom: none; }
    .source-item.disabled { opacity: 0.35; }
    .source-item.disabled .src-dot.ok { background: var(--text-dim); box-shadow: none; }
    .src-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
    .src-dot.ok  { background: var(--green); box-shadow: 0 0 4px var(--green); }
    .src-dot.off { background: var(--text-dim); }
    .source-name { flex: 1; color: var(--text-sec); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .src-toggle { font-size: 0.6rem; color: var(--text-dim); flex-shrink: 0; }
    .source-cat  {
      font-size: 0.58rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 4px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    /* ── Filter grids ──────────────────────────────────────────────────── */
    .filter-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 8px 12px 10px;
    }

    .filter-btn {
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text-dim);
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-btn:hover { border-color: var(--cyan-dim); color: var(--text-sec); }
    .filter-btn.active {
      background: var(--cyan-glow);
      border-color: var(--cyan-dim);
      color: var(--cyan);
    }

    /* Category-specific active colours */
    .filter-btn[data-cat="conflict"].active  { background: rgba(239,68,68,0.12);  border-color: #7f1d1d; color: var(--cat-conflict); }
    .filter-btn[data-cat="aviation"].active  { background: rgba(59,130,246,0.12); border-color: #1e3a5f; color: var(--cat-aviation); }
    .filter-btn[data-cat="maritime"].active  { background: rgba(6,182,212,0.12);  border-color: #164e57; color: var(--cat-maritime); }
    .filter-btn[data-cat="environment"].active { background: rgba(34,197,94,0.12); border-color: #14532d; color: var(--cat-environment); }
    .filter-btn[data-cat="economic"].active  { background: rgba(245,158,11,0.12); border-color: #78350f; color: var(--cat-economic); }
    .filter-btn[data-cat="market"].active    { background: rgba(168,85,247,0.12); border-color: #4c1d95; color: var(--cat-market); }
    .filter-btn[data-cat="space"].active     { background: rgba(99,102,241,0.12); border-color: #312e81; color: var(--cat-space); }
    .filter-btn[data-cat="news"].active      { background: rgba(100,116,139,0.12);border-color: #334155; color: var(--cat-news); }
    .filter-btn[data-cat="weather"].active   { background: rgba(14,165,233,0.12); border-color: #0c4a6e; color: var(--cat-weather); }

    /* ── Severity buttons ──────────────────────────────────────────────── */
    .sev-btn {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
      opacity: 0.4;
    }
    .sev-btn.active { opacity: 1; }
    .sev-btn[data-sev="info"]     { color: var(--sev-info);     border-color: var(--cyan-dim);    background: rgba(0,255,255,0.08); }
    .sev-btn[data-sev="low"]      { color: var(--sev-low);      border-color: var(--green-dim);   background: rgba(0,255,0,0.08); }
    .sev-btn[data-sev="medium"]   { color: var(--sev-medium);   border-color: var(--yellow-dim);  background: rgba(255,255,0,0.08); }
    .sev-btn[data-sev="high"]     { color: var(--sev-high);     border-color: var(--orange-dim);  background: rgba(255,136,0,0.08); }
    .sev-btn[data-sev="critical"] { color: var(--sev-critical); border-color: var(--red-dim);     background: rgba(255,0,0,0.08); }

    /* ── Time period filter ───────────────────────────────────────────── */
    .time-btn {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text-dim);
      cursor: pointer;
      transition: all 0.15s;
    }
    .time-btn:hover { color: var(--text-sec); border-color: var(--cyan-dim); }
    .time-btn.active {
      color: var(--cyan);
      border-color: var(--cyan);
      background: rgba(0,255,255,0.08);
    }

    /* ── Sweep control ─────────────────────────────────────────────────── */
    .sweep-body {
      padding: 8px 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .sweep-info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.65rem;
      color: var(--text-sec);
    }
    .sweep-info-row .key  { color: var(--text-dim); text-transform: uppercase; font-size: 0.58rem; letter-spacing: 0.05em; }
    .sweep-info-row .val  { color: var(--text-sec); font-variant-numeric: tabular-nums; }
    .sweep-info-row .val.active { color: var(--cyan); }

    .btn-trigger {
      width: 100%;
      padding: 6px 12px;
      background: linear-gradient(135deg, rgba(0,255,255,0.1), rgba(139,92,246,0.1));
      border: 1px solid var(--cyan-dim);
      border-radius: 5px;
      color: var(--cyan);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-trigger:hover {
      background: linear-gradient(135deg, rgba(0,255,255,0.2), rgba(139,92,246,0.2));
      border-color: var(--cyan);
      box-shadow: 0 0 12px rgba(0,255,255,0.2);
    }
    .btn-trigger:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Center (Map area) ─────────────────────────────────────────────── */
    #center {
      grid-area: center;
      position: relative;
      display: flex;
      flex-direction: column;
      background: radial-gradient(ellipse at center, #060620 0%, var(--bg-deep) 100%);
      overflow: hidden;
    }

    /* ── Map tab bar ───────────────────────────────────────────────────── */
    #map-tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--border);
      background: rgba(10,10,26,0.85);
      backdrop-filter: blur(8px);
      z-index: 50;
      flex-shrink: 0;
    }
    .map-tab {
      padding: 7px 16px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-dim);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
      user-select: none;
    }
    .map-tab:hover { color: var(--text-sec); }
    .map-tab.active {
      color: var(--cyan);
      border-bottom-color: var(--cyan);
    }

    /* ── Leaflet map container ─────────────────────────────────────────── */
    #map-wrap {
      flex: 1;
      position: relative;
    }
    #leaflet-map {
      width: 100%;
      height: 100%;
    }

    /* ── Live News panel ───────────────────────────────────────────────── */
    #livenews-wrap {
      flex: 1;
      display: none;
      flex-direction: column;
      background: var(--bg-deep);
    }

    .ln-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-panel);
    }

    .ln-ch-btn {
      padding: 4px 10px;
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--text-sec);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .ln-ch-btn:hover { color: var(--text-prim); border-color: var(--cyan-dim); }
    .ln-ch-btn.active { color: var(--cyan); border-color: var(--cyan); background: rgba(0,255,255,0.08); }

    .ln-player {
      flex: 1;
      position: relative;
      min-height: 0;
      overflow: hidden;
    }
    .ln-player iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
    }
    .ln-no-stream {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-sec);
      font-size: 0.8rem;
    }

    /* ── Webcams panel ──────────────────────────────────────────────────── */
    #webcams-wrap {
      flex: 1;
      display: none;
      flex-direction: column;
      background: var(--bg-deep);
    }

    .wc-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-panel);
    }

    .wc-regions {
      display: flex;
      gap: 4px;
      flex: 1;
      flex-wrap: wrap;
    }

    .wc-region-btn {
      padding: 4px 10px;
      font-size: 0.62rem;
      font-weight: 600;
      color: var(--text-sec);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .wc-region-btn:hover { color: var(--text-prim); border-color: var(--cyan-dim); }
    .wc-region-btn.active { color: var(--cyan); border-color: var(--cyan); background: rgba(0,255,255,0.08); }

    .wc-view-btns {
      display: flex;
      gap: 4px;
    }
    .wc-view-btn {
      padding: 4px 8px;
      font-size: 0.62rem;
      font-weight: 600;
      color: var(--text-sec);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
    }
    .wc-view-btn.active { color: var(--cyan); border-color: var(--cyan); }

    .wc-content {
      flex: 1;
      position: relative;
    }

    .wc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 2px;
      height: 100%;
    }

    .wc-cell {
      position: relative;
      overflow: hidden;
      background: #000;
    }
    .wc-cell iframe {
      width: 100%; height: 100%;
      border: none;
    }
    .wc-cell-label {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 4px 8px;
      font-size: 0.62rem;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(transparent, rgba(0,0,0,0.8));
      text-transform: uppercase;
      letter-spacing: 0.06em;
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
      z-index: 5;
    }
    .wc-live-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #ff0000;
      animation: pulse-dot 2s infinite;
    }

    .wc-single {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .wc-single-player {
      flex: 1;
      position: relative;
    }
    .wc-single-player iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
    }
    .wc-switcher {
      display: flex;
      gap: 4px;
      padding: 6px 8px;
      overflow-x: auto;
      background: var(--bg-panel);
      border-top: 1px solid var(--border);
    }
    .wc-feed-btn {
      padding: 3px 8px;
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--text-sec);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 3px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .wc-feed-btn:hover { color: var(--text-prim); }
    .wc-feed-btn.active { color: var(--cyan); border-color: var(--cyan); }

    /* ── News Digest panel ─────────────────────────────────────────────── */
    #digest-wrap {
      flex: 1;
      display: none;
      flex-direction: column;
      background: var(--bg-deep);
    }
    .digest-toolbar {
      display: flex;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-panel);
    }
    .digest-regions { display: flex; gap: 4px; flex-wrap: wrap; }
    .digest-region-btn {
      padding: 4px 10px;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--text-sec);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .digest-region-btn:hover { color: var(--text-prim); border-color: var(--cyan-dim); }
    .digest-region-btn.active { color: var(--cyan); border-color: var(--cyan); background: rgba(0,255,255,0.08); }
    .digest-content {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }
    .digest-continent {
      margin-bottom: 16px;
    }
    .digest-continent-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      margin-bottom: 6px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--cyan);
      background: linear-gradient(90deg, rgba(0,255,255,0.08), transparent);
      border-left: 3px solid var(--cyan);
      border-radius: 0 4px 4px 0;
    }
    .digest-continent-header .digest-count {
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--text-dim);
    }
    .digest-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 7px 10px;
      border-bottom: 1px solid var(--border);
      transition: background 0.12s;
    }
    .digest-item:hover { background: var(--bg-hover); }
    .digest-item:last-child { border-bottom: none; }
    .digest-sev {
      width: 6px; height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 5px;
    }
    .digest-sev.info     { background: var(--sev-info); box-shadow: 0 0 4px var(--sev-info); }
    .digest-sev.low      { background: var(--sev-low); box-shadow: 0 0 4px var(--sev-low); }
    .digest-sev.medium   { background: var(--sev-medium); box-shadow: 0 0 4px var(--sev-medium); }
    .digest-sev.high     { background: var(--sev-high); box-shadow: 0 0 4px var(--sev-high); }
    .digest-sev.critical { background: var(--sev-critical); box-shadow: 0 0 4px var(--sev-critical); }
    .digest-body { flex: 1; min-width: 0; }
    .digest-title {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-prim);
      line-height: 1.3;
    }
    .digest-title a {
      color: inherit;
      text-decoration: none;
      transition: color 0.12s;
    }
    .digest-title a:hover { color: var(--cyan); }
    .digest-meta {
      display: flex;
      gap: 8px;
      margin-top: 3px;
      font-size: 0.6rem;
      color: var(--text-dim);
    }
    .digest-meta .digest-source { color: var(--text-sec); font-weight: 600; }
    .digest-meta .digest-country { color: var(--purple); }

    /* ── Floating mini-stats overlay ───────────────────────────────────── */
    #map-stats {
      position: absolute;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 12px;
      background: rgba(10,10,26,0.75);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border-glow);
      border-radius: 20px;
      padding: 5px 16px;
      z-index: 50;
      pointer-events: none;
    }
    .map-stat {
      font-size: 0.62rem;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .map-stat .ms-val {
      font-weight: 700;
      color: var(--text-sec);
      font-variant-numeric: tabular-nums;
    }
    .map-stat .ms-val.cyan { color: var(--cyan); }

    #map-hint {
      position: absolute;
      bottom: 44px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.6rem;
      color: var(--text-dim);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      pointer-events: none;
      z-index: 50;
      white-space: nowrap;
    }

    /* ── Tooltip ───────────────────────────────────────────────────────── */
    #tooltip {
      position: fixed;
      display: none;
      background: rgba(10,10,30,0.97);
      border: 1px solid var(--border-glow);
      border-radius: 8px;
      padding: 10px 14px;
      max-width: 300px;
      z-index: 1000;
      pointer-events: none;
      box-shadow: 0 0 24px rgba(0,100,200,0.25), 0 4px 16px rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
    }
    #tooltip .tt-sev   { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
    #tooltip .tt-title { font-size: 0.8rem; font-weight: 700; color: var(--text-prim); margin-bottom: 4px; line-height: 1.3; }
    #tooltip .tt-meta  { font-size: 0.66rem; color: var(--text-sec); margin-bottom: 6px; }
    #tooltip .tt-desc  { font-size: 0.7rem; color: var(--text-sec); line-height: 1.5; }

    /* ── Right Panel ───────────────────────────────────────────────────── */
    #right-panel {
      grid-area: right;
      background: var(--bg-panel);
      border-left: 1px solid var(--border);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Alerts section ────────────────────────────────────────────────── */
    #alerts-section {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid var(--border);
      max-height: 240px;
    }

    .right-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px 6px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .right-section-title {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .right-section-title.alerts { color: var(--red); }
    .right-section-title.feed   { color: var(--cyan); }
    .right-section-title.summary{ color: var(--purple); }
    .right-section-count { font-size: 0.6rem; color: var(--text-dim); font-variant-numeric: tabular-nums; }

    #alerts-list {
      overflow-y: auto;
      flex: 1;
    }

    /* ── Alert items ───────────────────────────────────────────────────── */
    .alert-item {
      padding: 6px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 0.67rem;
      cursor: pointer;
      transition: background 0.12s;
      border-left: 3px solid transparent;
    }
    .alert-item:hover { background: var(--bg-hover); }
    .alert-item.flash    { border-left-color: var(--red); }
    .alert-item.priority { border-left-color: var(--orange); }
    .alert-item.routine  { border-left-color: var(--blue); }

    @keyframes flash-glow {
      0%,100% { background: rgba(255,0,0,0.04); }
      50%      { background: rgba(255,0,0,0.16); }
    }
    .alert-item.flash { animation: flash-glow 1.5s ease-in-out 4; }

    .alert-top {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
    }
    .tier-badge {
      font-size: 0.53rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 1px 5px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .tier-badge.flash    { background: rgba(255,0,0,0.18);    color: var(--red);    border: 1px solid var(--red-dim); }
    .tier-badge.priority { background: rgba(255,136,0,0.18);  color: var(--orange); border: 1px solid var(--orange-dim); }
    .tier-badge.routine  { background: rgba(68,136,255,0.15); color: var(--blue);   border: 1px solid #224488; }

    .alert-title  { font-size: 0.68rem; color: var(--text-prim); font-weight: 600;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
    .alert-reason { font-size: 0.61rem; color: var(--text-sec); }
    .alert-time   { font-size: 0.58rem; color: var(--text-dim); }

    /* ── Feed section ──────────────────────────────────────────────────── */
    #feed-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #feed-list {
      flex: 1;
      overflow-y: auto;
    }

    /* ── Feed items ────────────────────────────────────────────────────── */
    .feed-item {
      padding: 7px 12px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.12s;
      border-left: 3px solid transparent;
    }
    .feed-item:hover { background: var(--bg-hover); }
    .feed-item.new-item { animation: slide-in 0.3s ease; }
    .feed-item.expanded .fi-body { display: block; }

    @keyframes slide-in {
      from { opacity: 0; transform: translateX(12px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .fi-top {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .sev-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }
    .sev-dot.info     { background: var(--sev-info);     box-shadow: 0 0 4px var(--sev-info); }
    .sev-dot.low      { background: var(--sev-low);      box-shadow: 0 0 4px var(--sev-low); }
    .sev-dot.medium   { background: var(--sev-medium);   box-shadow: 0 0 4px var(--sev-medium); }
    .sev-dot.high     { background: var(--sev-high);     box-shadow: 0 0 4px var(--sev-high); }
    .sev-dot.critical { background: var(--sev-critical); box-shadow: 0 0 6px var(--sev-critical); animation: pulse-dot 1.2s infinite; }

    .fi-content { flex: 1; min-width: 0; }
    .fi-title {
      font-size: 0.71rem;
      font-weight: 600;
      color: var(--text-prim);
      line-height: 1.35;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .fi-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.6rem;
      color: var(--text-dim);
      flex-wrap: wrap;
    }
    .fi-source { color: var(--cyan-dim); font-weight: 600; }
    .fi-cat-badge {
      font-size: 0.56rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .fi-time { color: var(--text-dim); }

    .fi-body {
      display: none;
      margin-top: 7px;
      padding-top: 7px;
      border-top: 1px solid var(--border);
      font-size: 0.68rem;
      color: var(--text-sec);
      line-height: 1.55;
    }
    .fi-body a { color: var(--cyan); text-decoration: none; }
    .fi-body a:hover { text-decoration: underline; }
    .fi-location {
      font-size: 0.63rem;
      color: var(--text-dim);
      margin-top: 4px;
    }
    .fi-tags { margin-top: 5px; display: flex; gap: 4px; flex-wrap: wrap; }
    .fi-tag  { font-size: 0.58rem; padding: 1px 5px; border-radius: 3px; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-dim); }

    /* ── AI Summary section ────────────────────────────────────────────── */
    #summary-section {
      flex-shrink: 0;
      border-top: 1px solid var(--border);
      max-height: 160px;
      display: flex;
      flex-direction: column;
      transition: max-height 0.25s ease;
    }
    #summary-section.collapsed { max-height: 32px; }
    #summary-body {
      overflow-y: auto;
      flex: 1;
      padding: 8px 12px 10px;
      font-size: 0.68rem;
      color: var(--text-sec);
      line-height: 1.6;
    }
    #summary-section.collapsed #summary-body { display: none; }

    /* ── Footer ────────────────────────────────────────────────────────── */
    #footer {
      grid-area: footer;
      display: flex;
      align-items: center;
      gap: 0;
      padding: 0 16px;
      background: var(--bg-panel);
      border-top: 1px solid var(--border);
      font-size: 0.64rem;
      color: var(--text-dim);
      font-variant-numeric: tabular-nums;
    }

    .ft-stat {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 12px;
      border-right: 1px solid var(--border);
      height: 100%;
    }
    .ft-stat:first-child { padding-left: 0; }
    .ft-label { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.58rem; color: var(--text-dim); }
    .ft-value { color: var(--text-sec); font-weight: 600; }
    .ft-value.cyan   { color: var(--cyan); }
    .ft-value.orange { color: var(--orange); }
    .ft-value.red    { color: var(--red); }

    .ft-alerts-detail {
      display: flex;
      gap: 6px;
    }
    .ft-alert-chip {
      font-size: 0.58rem;
      padding: 0 5px;
      border-radius: 3px;
      font-weight: 700;
    }
    .ft-alert-chip.flash    { color: var(--red);    background: rgba(255,0,0,0.12); }
    .ft-alert-chip.priority { color: var(--orange); background: rgba(255,136,0,0.12); }
    .ft-alert-chip.routine  { color: var(--blue);   background: rgba(68,136,255,0.10); }

    #ft-status-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding-left: 12px;
    }

    /* ── Empty state ───────────────────────────────────────────────────── */
    .empty-state {
      padding: 16px 12px;
      font-size: 0.68rem;
      color: var(--text-dim);
      text-align: center;
      font-style: italic;
    }

    /* ── Glassmorphism panels ──────────────────────────────────────────── */
    .glass {
      background: rgba(17,17,39,0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    /* ── Leaflet dark theme overrides ──────────────────────────────────── */
    .leaflet-container {
      background: #080818 !important;
    }
    .leaflet-popup-content-wrapper {
      background: rgba(10,10,30,0.97) !important;
      border: 1px solid var(--border-glow) !important;
      border-radius: 8px !important;
      color: var(--text-prim) !important;
      box-shadow: 0 0 20px rgba(0,100,200,0.2) !important;
    }
    .leaflet-popup-tip { background: rgba(10,10,30,0.97) !important; }
    .leaflet-popup-close-button { color: var(--text-dim) !important; }
    .leaflet-control-zoom a {
      background: var(--bg-panel) !important;
      color: var(--text-sec) !important;
      border-color: var(--border) !important;
    }
    .leaflet-control-zoom a:hover { background: var(--bg-hover) !important; color: var(--cyan) !important; }

    /* ── Arc animation (fake CSS arcs) ────────────────────────────────── */
    @keyframes arc-pulse {
      0%,100% { opacity: 0.3; }
      50%      { opacity: 0.9; }
    }

    /* ── Live News Ticker ──────────────────────────────────────────────── */
    #ticker-bar {
      grid-area: ticker;
      display: flex;
      align-items: center;
      height: 28px;
      background: linear-gradient(90deg, rgba(0,255,255,0.05) 0%, var(--bg-panel) 10%, var(--bg-panel) 90%, rgba(139,92,246,0.05) 100%);
      border-bottom: 1px solid var(--border);
      overflow: hidden;
      z-index: 100;
    }
    .ticker-label {
      padding: 0 10px;
      font-size: 0.58rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #ff0000;
      background: rgba(255,0,0,0.1);
      border-right: 1px solid var(--border);
      height: 100%;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      animation: pulse-dot 2s infinite;
    }
    .ticker-track {
      flex: 1;
      overflow: hidden;
      position: relative;
      height: 100%;
    }
    .ticker-content {
      display: flex;
      align-items: center;
      gap: 24px;
      white-space: nowrap;
      animation: ticker-scroll 60s linear infinite;
      height: 100%;
      font-size: 0.65rem;
      color: var(--text-sec);
    }
    .ticker-content:hover {
      animation-play-state: paused;
    }
    .ticker-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .ticker-item .ti-sev {
      width: 5px; height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .ticker-item .ti-src {
      color: var(--text-dim);
      font-size: 0.58rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .ticker-item .ti-title {
      color: var(--text-prim);
      font-weight: 500;
    }
    .ticker-item .ti-time {
      color: var(--text-dim);
      font-size: 0.55rem;
    }
    .ticker-sep {
      color: var(--border-glow);
      flex-shrink: 0;
    }
    @keyframes ticker-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* ── Markets & Macro ───────────────────────────────────────────────── */
    .market-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 6px;
    }
    .market-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .market-card .mc-name {
      font-size: 0.58rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .market-card .mc-price {
      font-size: 0.78rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--text-prim);
    }
    .market-card .mc-change {
      font-size: 0.6rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .market-card .mc-change.up { color: #22c55e; }
    .market-card .mc-change.down { color: #ef4444; }
    .market-card .mc-change.flat { color: var(--text-dim); }
    .mc-sparkline {
      width: 100%;
      height: 20px;
      margin-top: 2px;
    }
    .mc-sparkline polyline {
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* ── Risk Gauges ───────────────────────────────────────────────────── */
    .risk-country {
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
    }
    .risk-country:last-child { border-bottom: none; }
    .rc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .rc-name {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--text-prim);
    }
    .rc-score {
      font-size: 0.68rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .rc-bar-bg {
      height: 6px;
      background: rgba(255,255,255,0.06);
      border-radius: 3px;
      overflow: hidden;
    }
    .rc-bar {
      height: 100%;
      border-radius: 3px;
      transition: width 0.8s ease;
    }
    .rc-signals {
      display: flex;
      gap: 6px;
      margin-top: 3px;
      font-size: 0.55rem;
      color: var(--text-dim);
    }
    .rc-trend {
      font-size: 0.6rem;
      font-weight: 600;
    }
    .rc-trend.rising { color: #ef4444; }
    .rc-trend.falling { color: #22c55e; }
    .rc-trend.stable { color: var(--text-dim); }

    /* ── Collapsible sec-body (new-style sections) ─────────────────────── */
    .sec-body {
      overflow: hidden;
      transition: max-height 0.25s ease;
    }
  </style>
</head>
<body>
<div id="app">

  <!-- ══════════════════════════════════════════════════════════════════ -->
  <!--  HEADER                                                           -->
  <!-- ══════════════════════════════════════════════════════════════════ -->
  <header id="header">
    <div class="logo">WorldView<span>News</span></div>
    <div class="hdr-sep"></div>

    <!-- SSE connection -->
    <div class="hdr-pill" id="conn-pill">
      <div class="dot" id="conn-dot"></div>
      <span id="conn-label">Connecting…</span>
    </div>

    <!-- Item count -->
    <div class="hdr-pill">
      <span class="label">Items</span>
      <span class="value cyan" id="hdr-items">0</span>
    </div>

    <!-- Alert count -->
    <div class="hdr-pill">
      <span class="label">Alerts</span>
      <span class="value orange" id="hdr-alerts">0</span>
    </div>

    <!-- Sources -->
    <div class="hdr-pill">
      <span class="label">Sources</span>
      <span class="value" id="hdr-sources">0</span>
    </div>

    <div class="hdr-spacer"></div>

    <!-- Last sweep -->
    <div class="hdr-pill">
      <span class="label">Last Sweep</span>
      <span class="value" id="hdr-sweep">—</span>
    </div>

    <!-- Sweep spinner -->
    <div class="spinner" id="hdr-spinner"></div>
    <span id="hdr-sweep-status" style="font-size:0.64rem;color:var(--text-dim)">Idle</span>
  </header>

  <!-- ══════════════════════════════════════════════════════════════════ -->
  <!--  TICKER BAR                                                       -->
  <!-- ══════════════════════════════════════════════════════════════════ -->
  <div id="ticker-bar">
    <div class="ticker-label">LIVE</div>
    <div class="ticker-track">
      <div class="ticker-content" id="ticker-content">
        Waiting for intelligence data…
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════ -->
  <!--  LEFT PANEL — Intelligence Control                                -->
  <!-- ══════════════════════════════════════════════════════════════════ -->
  <aside id="left-panel">

    <!-- Source Status -->
    <div class="panel-section" id="sec-sources">
      <div class="panel-section-header" onclick="toggleSection('sec-sources')">
        <span class="panel-section-title">Data Sources</span>
        <span class="panel-chevron">▾</span>
      </div>
      <div class="panel-section-body" id="sec-sources-body">
        <div id="sources-inner"><div class="empty-state">Loading…</div></div>
      </div>
    </div>

    <!-- Category Filters -->
    <div class="panel-section" id="sec-cats">
      <div class="panel-section-header" onclick="toggleSection('sec-cats')">
        <span class="panel-section-title">Category Filter</span>
        <span class="panel-chevron">▾</span>
      </div>
      <div class="panel-section-body" id="sec-cats-body">
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
    </div>

    <!-- Severity Filters -->
    <div class="panel-section" id="sec-sev">
      <div class="panel-section-header" onclick="toggleSection('sec-sev')">
        <span class="panel-section-title">Severity Filter</span>
        <span class="panel-chevron">▾</span>
      </div>
      <div class="panel-section-body" id="sec-sev-body">
        <div class="filter-grid" id="sev-filter-grid">
          <button class="sev-btn active" data-sev="info">Info</button>
          <button class="sev-btn active" data-sev="low">Low</button>
          <button class="sev-btn active" data-sev="medium">Medium</button>
          <button class="sev-btn active" data-sev="high">High</button>
          <button class="sev-btn active" data-sev="critical">Critical</button>
        </div>
      </div>
    </div>

    <!-- Time Period Filter -->
    <div class="panel-section" id="sec-time">
      <div class="panel-section-header" onclick="toggleSection('sec-time')">
        <span class="panel-section-title">Time Period</span>
        <span class="panel-chevron">&#9662;</span>
      </div>
      <div class="panel-section-body" id="sec-time-body">
        <div class="filter-grid" id="time-filters">
          <button class="time-btn" data-hours="1">1h</button>
          <button class="time-btn" data-hours="6">6h</button>
          <button class="time-btn" data-hours="24">24h</button>
          <button class="time-btn" data-hours="168">7d</button>
          <button class="time-btn active" data-hours="0">All</button>
        </div>
      </div>
    </div>

    <!-- Sweep Control -->
    <div class="panel-section" id="sec-sweep">
      <div class="panel-section-header" onclick="toggleSection('sec-sweep')">
        <span class="panel-section-title purple">Sweep Control</span>
        <span class="panel-chevron">▾</span>
      </div>
      <div class="panel-section-body" id="sec-sweep-body">
        <div class="sweep-body">
          <div class="sweep-info-row">
            <span class="key">Last Sweep</span>
            <span class="val" id="sweep-last">—</span>
          </div>
          <div class="sweep-info-row">
            <span class="key">Status</span>
            <span class="val" id="sweep-status">Idle</span>
          </div>
          <div class="sweep-info-row">
            <span class="key">Total Sweeps</span>
            <span class="val" id="sweep-count">0</span>
          </div>
          <div class="sweep-info-row">
            <span class="key">Uptime</span>
            <span class="val" id="sweep-uptime">—</span>
          </div>
          <button class="btn-trigger" id="btn-sweep-now" onclick="triggerSweep()">
            <span>&#9654;</span> Trigger Sweep
          </button>
        </div>
      </div>
    </div>

    <!-- Markets & Macro -->
    <div class="panel-section" id="sec-markets">
      <div class="panel-section-header" onclick="toggleSection('sec-markets')">
        <span class="panel-section-title">&#128200; Markets &amp; Macro</span>
        <span class="panel-chevron" id="chev-sec-markets">&#9662;</span>
      </div>
      <div class="panel-section-body" id="sec-markets-body">
        <div id="market-grid" class="market-grid">
          <div class="empty-state" style="font-size:0.6rem">Loading market data…</div>
        </div>
      </div>
    </div>

    <!-- Risk Gauges -->
    <div class="panel-section" id="sec-risk">
      <div class="panel-section-header" onclick="toggleSection('sec-risk')">
        <span class="panel-section-title">&#127919; Risk Gauges</span>
        <span class="panel-chevron" id="chev-sec-risk">&#9662;</span>
      </div>
      <div class="panel-section-body" id="sec-risk-body">
        <div id="risk-gauges">
          <div class="empty-state" style="font-size:0.6rem">Loading risk data…</div>
        </div>
      </div>
    </div>

  </aside>

  <!-- ══════════════════════════════════════════════════════════════════ -->
  <!--  CENTER — Map / Globe                                             -->
  <!-- ══════════════════════════════════════════════════════════════════ -->
  <main id="center">

    <!-- Tab bar -->
    <div id="map-tabs">
      <div class="map-tab active" id="tab-map" onclick="switchMap('map')">&#128507; 2D Map</div>
      <div class="map-tab" id="tab-livenews" onclick="switchMap('livenews')">&#128250; Live News</div>
      <div class="map-tab" id="tab-webcams" onclick="switchMap('webcams')">&#128247; Webcams</div>
      <div class="map-tab" id="tab-digest" onclick="switchMap('digest')">&#128240; News Digest</div>
    </div>

    <!-- Leaflet 2D map -->
    <div id="map-wrap" style="display:flex">
      <div id="leaflet-map"></div>
      <div id="map-hint">Click markers for details</div>
    </div>

    <!-- Live News TV -->
    <div id="livenews-wrap">
      <div class="ln-toolbar" id="ln-toolbar"></div>
      <div class="ln-player" id="ln-player"></div>
    </div>

    <!-- Live Webcams -->
    <div id="webcams-wrap">
      <div class="wc-toolbar">
        <div class="wc-regions">
          <button class="wc-region-btn active" data-region="middle-east">Middle East</button>
          <button class="wc-region-btn" data-region="europe">Europe</button>
          <button class="wc-region-btn" data-region="americas">Americas</button>
          <button class="wc-region-btn" data-region="asia">Asia</button>
          <button class="wc-region-btn" data-region="space">Space</button>
          <button class="wc-region-btn" data-region="all">All</button>
        </div>
        <div class="wc-view-btns">
          <button class="wc-view-btn active" data-view="grid">&#9726; Grid</button>
          <button class="wc-view-btn" data-view="single">&#9654; Single</button>
        </div>
      </div>
      <div class="wc-content" id="wc-content"></div>
    </div>

    <!-- News Digest by Continent -->
    <div id="digest-wrap">
      <div class="digest-toolbar">
        <div class="digest-regions">
          <button class="digest-region-btn active" data-region="all">All</button>
          <button class="digest-region-btn" data-region="africa">Africa</button>
          <button class="digest-region-btn" data-region="americas">Americas</button>
          <button class="digest-region-btn" data-region="asia">Asia</button>
          <button class="digest-region-btn" data-region="europe">Europe</button>
          <button class="digest-region-btn" data-region="middle-east">Middle East</button>
          <button class="digest-region-btn" data-region="oceania">Oceania</button>
          <button class="digest-region-btn" data-region="global">Global / Other</button>
        </div>
      </div>
      <div class="digest-content" id="digest-content"></div>
    </div>

    <!-- Floating stats overlay -->
    <div id="map-stats">
      <div class="map-stat">
        <span>Points</span>
        <span class="ms-val cyan" id="ms-points">0</span>
      </div>
      <div class="map-stat">
        <span>Sources</span>
        <span class="ms-val" id="ms-sources">0</span>
      </div>
      <div class="map-stat">
        <div class="dot" id="ms-conn-dot"></div>
        <span id="ms-conn-label">Connecting</span>
      </div>
    </div>

  </main>

  <!-- ══════════════════════════════════════════════════════════════════ -->
  <!--  RIGHT PANEL — Intelligence Feed                                  -->
  <!-- ══════════════════════════════════════════════════════════════════ -->
  <aside id="right-panel">

    <!-- Alerts -->
    <div id="alerts-section">
      <div class="right-section-header">
        <span class="right-section-title alerts">&#9888; Alerts</span>
        <span class="right-section-count" id="alert-count">0</span>
      </div>
      <div id="alerts-list">
        <div class="empty-state">No alerts yet.</div>
      </div>
    </div>

    <!-- Live Feed -->
    <div id="feed-section">
      <div class="right-section-header">
        <span class="right-section-title feed">Live Intelligence Feed</span>
        <span class="right-section-count" id="feed-count">0 items</span>
      </div>
      <div id="feed-list">
        <div class="empty-state">Waiting for first sweep…</div>
      </div>
    </div>

    <!-- AI Summary -->
    <div id="summary-section">
      <div class="right-section-header" style="cursor:pointer" onclick="toggleSummary()">
        <span class="right-section-title summary">&#129302; AI Summary</span>
        <span class="panel-chevron" id="summary-chevron">▾</span>
      </div>
      <div id="summary-body">
        <div class="empty-state">No summary yet — LLM analysis required.</div>
      </div>
      <button id="generate-summary-btn" onclick="generateSummary()" style="
        width:100%;padding:6px;margin-top:4px;font-size:0.65rem;font-weight:700;
        letter-spacing:0.05em;color:var(--purple);background:rgba(139,92,246,0.08);
        border:1px solid var(--purple-dim);border-radius:4px;cursor:pointer;
        transition:all 0.15s;
      ">GENERATE SUMMARY</button>
    </div>

  </aside>

  <!-- ══════════════════════════════════════════════════════════════════ -->
  <!--  FOOTER — Stats Bar                                               -->
  <!-- ══════════════════════════════════════════════════════════════════ -->
  <footer id="footer">
    <div class="ft-stat">
      <span class="ft-label">Items</span>
      <span class="ft-value cyan" id="ft-items">0</span>
    </div>
    <div class="ft-stat">
      <span class="ft-label">Sources</span>
      <span class="ft-value" id="ft-sources">0 / 0</span>
    </div>
    <div class="ft-stat">
      <span class="ft-label">Alerts</span>
      <div class="ft-alerts-detail">
        <span class="ft-alert-chip flash"  id="ft-flash">F:0</span>
        <span class="ft-alert-chip priority" id="ft-priority">P:0</span>
        <span class="ft-alert-chip routine"  id="ft-routine">R:0</span>
      </div>
    </div>
    <div class="ft-stat">
      <span class="ft-label">Last Sweep</span>
      <span class="ft-value" id="ft-sweep">—</span>
    </div>
    <div class="ft-stat">
      <span class="ft-label">Sweeps</span>
      <span class="ft-value" id="ft-sweeps">0</span>
    </div>
    <div class="ft-stat">
      <span class="ft-label">SSE</span>
      <span class="ft-value" id="ft-clients">—</span>
    </div>
    <div id="ft-status-area">
      <span id="ft-status">Initialising…</span>
      <div class="spinner" id="ft-spinner"></div>
    </div>
  </footer>

</div>

<!-- ── Tooltip (shared for globe and map) ─────────────────────────────── -->
<div id="tooltip">
  <div class="tt-sev" id="tt-sev"></div>
  <div class="tt-title" id="tt-title"></div>
  <div class="tt-meta" id="tt-meta"></div>
  <div class="tt-desc" id="tt-desc"></div>
</div>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!--  CDN Libraries                                                        -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!--  APPLICATION SCRIPT                                                   -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<script>
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  Constants & Config
  // ═══════════════════════════════════════════════════════════════════

  const SEV_COLOR = {
    info:     '#00ffff',
    low:      '#00ff00',
    medium:   '#ffff00',
    high:     '#ff8800',
    critical: '#ff0000',
  };

  const SEV_HEIGHT = { info: 0.02, low: 0.03, medium: 0.05, high: 0.07, critical: 0.10 };
  const SEV_RADIUS = { info: 0.3,  low: 0.35, medium: 0.45, high: 0.6,  critical: 0.8  };

  const CAT_COLOR = {
    conflict:    '#ef4444',
    aviation:    '#3b82f6',
    maritime:    '#06b6d4',
    environment: '#22c55e',
    economic:    '#f59e0b',
    market:      '#a855f7',
    space:       '#6366f1',
    news:        '#64748b',
    weather:     '#0ea5e9',
  };

  const MAX_FEED_ITEMS   = 200;
  const MAX_ALERT_ITEMS  = 50;
  const MAX_MEMORY_ITEMS = 500;

  // ═══════════════════════════════════════════════════════════════════
  //  Live News Channels
  // ═══════════════════════════════════════════════════════════════════

  const LIVE_CHANNELS = [
    { id: 'bloomberg', name: 'Bloomberg', handle: '@markets', videoId: 'iEpJwprxDdk' },
    { id: 'sky', name: 'Sky News', handle: '@SkyNews', videoId: 'uvviIF4725I' },
    { id: 'euronews', name: 'Euronews', handle: '@euronews', videoId: 'pykpO5kQJ98' },
    { id: 'dw', name: 'DW News', handle: '@DWNews', videoId: 'LuKwFajn37U' },
    { id: 'cnbc', name: 'CNBC', handle: '@CNBC', videoId: '9NyxcX3rhQs' },
    { id: 'cnn', name: 'CNN', handle: '@CNN', videoId: 'w_Ma8oQLmSM' },
    { id: 'france24', name: 'France 24', handle: '@FRANCE24', videoId: 'u9foWyMSETk' },
    { id: 'alarabiya', name: 'Al Arabiya', handle: '@AlArabiya', videoId: 'n7eQejkXbnM' },
    { id: 'aljazeera', name: 'Al Jazeera', handle: '@AlJazeeraEnglish', videoId: 'gCNeDWCI0vo' },
    { id: 'bbc', name: 'BBC News', handle: '@BBCNews', videoId: 'bjgQzJzCZKs' },
    { id: 'fox', name: 'Fox News', handle: '@FoxNews', videoId: 'QaftgYkG-ek' },
    { id: 'abc', name: 'ABC News', handle: '@ABCNews', videoId: 'R9L8sDK8iEc' },
    { id: 'nbc', name: 'NBC News', handle: '@NBCNews', videoId: 'yMr0neQhu6c' },
    { id: 'wion', name: 'WION', handle: '@WION', videoId: '' },
    { id: 'ndtv', name: 'NDTV', handle: '@NDTV', videoId: '' },
    { id: 'nhk', name: 'NHK World', handle: '@NHKWORLDJAPAN', videoId: 'f0lYfG_vY_U' },
    { id: 'trt', name: 'TRT World', handle: '@TRTWorld', videoId: 'ABfFhWzWs0s' },
    { id: 'india-today', name: 'India Today', handle: '@indiatoday', videoId: 'sYZtOFzM78M' },
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  Webcam Feeds
  // ═══════════════════════════════════════════════════════════════════

  const WEBCAM_FEEDS = [
    // Middle East
    { id: 'tehran', city: 'Tehran', country: 'Iran', region: 'middle-east', videoId: '-zGuR1qVKrU' },
    { id: 'tel-aviv', city: 'Tel Aviv', country: 'Israel', region: 'middle-east', videoId: 'gmtlJ_m2r5A' },
    { id: 'jerusalem', city: 'Jerusalem', country: 'Israel', region: 'middle-east', videoId: 'UyduhBUpO7Q' },
    { id: 'mecca', city: 'Mecca', country: 'Saudi Arabia', region: 'middle-east', videoId: 'Cm1v4bteXbI' },
    { id: 'beirut', city: 'Beirut', country: 'Lebanon', region: 'middle-east', videoId: 'djF-Lkgfp6k' },
    // Europe
    { id: 'kyiv', city: 'Kyiv', country: 'Ukraine', region: 'europe', videoId: '-Q7FuPINDjA' },
    { id: 'odessa', city: 'Odessa', country: 'Ukraine', region: 'europe', videoId: 'e2gC37ILQmk' },
    { id: 'paris', city: 'Paris', country: 'France', region: 'europe', videoId: 'OzYp4NRZlwQ' },
    { id: 'st-petersburg', city: 'St. Petersburg', country: 'Russia', region: 'europe', videoId: 'CjtIYbmVfck' },
    { id: 'london', city: 'London', country: 'UK', region: 'europe', videoId: 'Lxqcg1qt0XU' },
    // Americas
    { id: 'washington', city: 'Washington DC', country: 'USA', region: 'americas', videoId: '1wV9lLe14aU' },
    { id: 'new-york', city: 'New York', country: 'USA', region: 'americas', videoId: '4qyZLflp-sI' },
    { id: 'los-angeles', city: 'Los Angeles', country: 'USA', region: 'americas', videoId: 'EO_1LWqsCNE' },
    { id: 'miami', city: 'Miami', country: 'USA', region: 'americas', videoId: '5YCajRjvWCg' },
    // Asia
    { id: 'taipei', city: 'Taipei', country: 'Taiwan', region: 'asia', videoId: 'z_fY1pj1VBw' },
    { id: 'shanghai', city: 'Shanghai', country: 'China', region: 'asia', videoId: '76EwqI5XZIc' },
    { id: 'tokyo', city: 'Tokyo', country: 'Japan', region: 'asia', videoId: '4pu9sF5Qssw' },
    { id: 'seoul', city: 'Seoul', country: 'South Korea', region: 'asia', videoId: '-JhoMGoAfFc' },
    { id: 'sydney', city: 'Sydney', country: 'Australia', region: 'asia', videoId: '7pcL-0Wo77U' },
    // Space
    { id: 'iss', city: 'ISS Earth View', country: 'Space', region: 'space', videoId: 'vytmBNhc9ig' },
    { id: 'nasa-tv', city: 'NASA TV', country: 'Space', region: 'space', videoId: 'zPH5KtjJFaQ' },
    { id: 'spacex', city: 'SpaceX', country: 'Space', region: 'space', videoId: 'fO9e9jnhYK8' },
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  State
  // ═══════════════════════════════════════════════════════════════════

  let allItems         = [];
  let allSources       = [];
  let allAlerts        = [];
  let activeCategory   = 'all';
  let activeSeverities = new Set(['info', 'low', 'medium', 'high', 'critical']);
  let disabledSources  = new Set();  // source IDs toggled off
  let activeTimeHours  = 0;          // 0 = all, else filter to last N hours
  let currentMapMode   = 'map';      // 'map' | 'livenews' | 'webcams' | 'digest'
  let summarySectionCollapsed = false;

  // Leaflet state
  let leafletMap     = null;
  let leafletMarkers = null; // L.LayerGroup
  let leafletReady   = false;

  // Live News state
  let liveNewsInited  = false;
  let currentChannel  = null;

  // Webcams state
  let webcamsInited  = false;
  let wcRegion       = 'middle-east';
  let wcView         = 'grid';
  let wcActiveFeed   = null;

  // ═══════════════════════════════════════════════════════════════════
  //  DOM Helpers
  // ═══════════════════════════════════════════════════════════════════

  const $ = (id) => document.getElementById(id);

  // ═══════════════════════════════════════════════════════════════════
  //  Utilities
  // ═══════════════════════════════════════════════════════════════════

  function timeAgo(dateStr) {
    const d    = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)    return diff + 's ago';
    if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function fmtTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  function formatUptime(secs) {
    if (secs < 60)   return secs + 's';
    if (secs < 3600) return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
    return Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm';
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function filteredItems() {
    const cutoff = activeTimeHours > 0
      ? Date.now() - activeTimeHours * 3600_000
      : 0;
    return allItems.filter((it) =>
      (activeCategory === 'all' || it.category === activeCategory) &&
      activeSeverities.has(it.severity) &&
      !disabledSources.has(it.source) &&
      (cutoff === 0 || new Date(it.timestamp).getTime() >= cutoff)
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Collapsible panels (left panel sections)
  // ═══════════════════════════════════════════════════════════════════

  function toggleSection(id) {
    const sec  = $(id);
    const body = sec.querySelector('.panel-section-body');
    const collapsed = sec.classList.toggle('collapsed');
    if (!collapsed) {
      body.style.maxHeight = body.scrollHeight + 'px';
      // Let it be auto after transition
      body.addEventListener('transitionend', () => {
        if (!sec.classList.contains('collapsed')) body.style.maxHeight = '';
      }, { once: true });
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
      // Force reflow
      body.getBoundingClientRect();
      body.style.maxHeight = '0';
    }
  }

  // Set initial max-height for all open sections
  function initSectionHeights() {
    document.querySelectorAll('.panel-section:not(.collapsed) .panel-section-body').forEach((body) => {
      body.style.maxHeight = '';
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI Summary toggle
  // ═══════════════════════════════════════════════════════════════════

  function toggleSummary() {
    summarySectionCollapsed = !summarySectionCollapsed;
    $('summary-section').classList.toggle('collapsed', summarySectionCollapsed);
    $('summary-chevron').style.transform = summarySectionCollapsed ? 'rotate(-90deg)' : '';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Generate AI Summary (manual trigger)
  // ═══════════════════════════════════════════════════════════════════

  async function generateSummary() {
    const btn = $('generate-summary-btn');
    btn.disabled = true;
    btn.textContent = 'GENERATING...';
    $('summary-body').innerHTML = '<div class="empty-state">Generating summary with AI...</div>';

    try {
      const res = await fetch('/api/v1/summary/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.summary) {
        renderSummary(data.summary);
      } else {
        $('summary-body').innerHTML = '<div class="empty-state" style="color:var(--orange)">'
          + 'Error: ' + esc(data.error || 'Unknown error') + '</div>';
      }
    } catch (e) {
      $('summary-body').innerHTML = '<div class="empty-state" style="color:var(--red)">'
        + 'Network error: ' + esc(e.message) + '</div>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'GENERATE SUMMARY';
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Map mode switching
  // ═══════════════════════════════════════════════════════════════════

  function switchMap(view) {
    currentMapMode = view;

    // Show/hide all view containers
    $('map-wrap').style.display        = view === 'map'      ? 'flex' : 'none';
    $('livenews-wrap').style.display   = view === 'livenews' ? 'flex' : 'none';
    $('webcams-wrap').style.display    = view === 'webcams'  ? 'flex' : 'none';
    $('digest-wrap').style.display     = view === 'digest'   ? 'flex' : 'none';

    // Keep map-hint visible only for map view
    if ($('map-hint')) {
      $('map-hint').style.display = view === 'map' ? '' : 'none';
    }

    // Update tab active states
    document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
    $('tab-' + view).classList.add('active');

    // Lazy init for Leaflet
    if (view === 'map') {
      if (!leafletReady) {
        initLeaflet();
      } else {
        leafletMap.invalidateSize();
        updateLeaflet();
      }
    }

    // Lazy init for live panels
    if (view === 'livenews') { initLiveNews(); }
    if (view === 'webcams')  { initWebcams(); }
    if (view === 'digest')   { renderDigest(); }

    // Destroy iframes when leaving live tabs to save bandwidth
    if (view !== 'livenews') { destroyLiveNews(); }
    if (view !== 'webcams')  { destroyWebcams(); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Globe (globe.gl)
  // ═══════════════════════════════════════════════════════════════════

  // Globe removed — 2D map is the primary view
  function initGlobe() { /* no-op */ }
  function updateGlobe() {
    // Update point count in status bar from Leaflet data instead
    const geoItems = filteredItems().filter((it) => it.location);
    $('ms-points').textContent = geoItems.length;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Leaflet 2D Map
  // ═══════════════════════════════════════════════════════════════════

  function initLeaflet() {
    if (typeof L === 'undefined') {
      setTimeout(initLeaflet, 500);
      return;
    }

    leafletMap = L.map('leaflet-map', {
      center: [20, 10],
      zoom:   2,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(leafletMap);

    leafletMarkers = L.layerGroup().addTo(leafletMap);

    leafletReady = true;
    updateLeaflet();
  }

  function updateLeaflet() {
    if (!leafletReady) return;

    leafletMarkers.clearLayers();

    const geoItems = filteredItems().filter((it) => it.location);

    for (const it of geoItems) {
      const col = SEV_COLOR[it.severity] || '#ffffff';
      const r   = { info: 5, low: 6, medium: 7, high: 9, critical: 11 }[it.severity] || 6;

      const circle = L.circleMarker([it.location.lat, it.location.lon], {
        radius:      r,
        fillColor:   col,
        color:       col,
        weight:      1,
        opacity:     0.9,
        fillOpacity: 0.6,
      });

      const popupHtml = \`
        <div style="font-family:'Inter',sans-serif;max-width:220px">
          <div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:\${col};margin-bottom:4px">\${esc(it.severity)} · \${esc(it.category)}</div>
          <div style="font-size:0.78rem;font-weight:700;color:#e2e8f0;margin-bottom:4px;line-height:1.3">\${esc(it.title)}</div>
          <div style="font-size:0.65rem;color:#8892a4;margin-bottom:4px">\${esc(it.source)} · \${timeAgo(it.timestamp)}</div>
          <div style="font-size:0.67rem;color:#8892a4;line-height:1.5">\${esc(it.description.slice(0, 120))}\${it.description.length > 120 ? '…' : ''}</div>
          \${it.url ? \`<div style="margin-top:6px"><a href="\${esc(it.url)}" target="_blank" rel="noopener" style="font-size:0.63rem;color:#00ffff;text-decoration:none">View source &#8599;</a></div>\` : ''}
        </div>
      \`;

      circle.bindPopup(popupHtml);
      leafletMarkers.addLayer(circle);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Live News TV
  // ═══════════════════════════════════════════════════════════════════

  function initLiveNews() {
    if (!liveNewsInited) {
      // Build channel buttons
      const toolbar = $('ln-toolbar');
      toolbar.innerHTML = '';
      LIVE_CHANNELS.forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'ln-ch-btn';
        btn.textContent = ch.name;
        btn.dataset.id = ch.id;
        btn.onclick = () => loadChannel(ch);
        toolbar.appendChild(btn);
      });
    }
    // Load first channel (or reload current)
    loadChannel(currentChannel || LIVE_CHANNELS[0]);
    liveNewsInited = true;
  }

  function loadChannel(ch) {
    currentChannel = ch;
    const player = $('ln-player');
    player.innerHTML = '';

    // Try direct embed with video ID, or fallback to channel live page
    const videoSrc = ch.videoId
      ? 'https://www.youtube.com/embed/' + ch.videoId + '?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0'
      : (ch.handle
        ? 'https://www.youtube.com/embed/live_stream?channel=' + ch.handle.replace('@','') + '&autoplay=1&mute=1'
        : null);

    if (videoSrc) {
      const iframe = document.createElement('iframe');
      iframe.src = videoSrc;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      player.appendChild(iframe);
    } else {
      player.innerHTML = '<div class="ln-no-stream">Stream unavailable</div>';
    }

    // Update active button
    document.querySelectorAll('.ln-ch-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.id === ch.id);
    });
  }

  function destroyLiveNews() {
    const player = $('ln-player');
    if (player) {
      player.querySelectorAll('iframe').forEach(f => { f.src = 'about:blank'; f.remove(); });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Live Webcams
  // ═══════════════════════════════════════════════════════════════════

  function initWebcams() {
    if (!webcamsInited) {
      renderWebcamToolbar();
      webcamsInited = true;
    }
    renderWebcams();
  }

  function renderWebcamToolbar() {
    // Regions already in HTML, bind clicks
    document.querySelectorAll('.wc-region-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wcRegion = btn.dataset.region;
        document.querySelectorAll('.wc-region-btn').forEach(b => b.classList.toggle('active', b.dataset.region === wcRegion));
        wcActiveFeed = null;
        renderWebcams();
      });
    });
    document.querySelectorAll('.wc-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wcView = btn.dataset.view;
        document.querySelectorAll('.wc-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === wcView));
        renderWebcams();
      });
    });
  }

  function getFilteredFeeds() {
    if (wcRegion === 'all') return WEBCAM_FEEDS;
    return WEBCAM_FEEDS.filter(f => f.region === wcRegion);
  }

  function buildYTEmbed(videoId) {
    return 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0';
  }

  function renderWebcams() {
    const content = $('wc-content');
    content.innerHTML = '';
    const feeds = getFilteredFeeds();
    if (feeds.length === 0) {
      content.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-sec)">No webcams for this region</div>';
      return;
    }

    if (wcView === 'grid') {
      const grid = document.createElement('div');
      grid.className = 'wc-grid';
      feeds.slice(0, 4).forEach(feed => {
        const cell = document.createElement('div');
        cell.className = 'wc-cell';
        cell.style.cursor = 'pointer';
        cell.onclick = () => { wcView = 'single'; wcActiveFeed = feed; document.querySelectorAll('.wc-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'single')); renderWebcams(); };
        if (feed.videoId) {
          const iframe = document.createElement('iframe');
          iframe.src = buildYTEmbed(feed.videoId);
          iframe.allow = 'autoplay; encrypted-media';
          cell.appendChild(iframe);
        }
        const label = document.createElement('div');
        label.className = 'wc-cell-label';
        label.innerHTML = '<span class="wc-live-dot"></span>' + esc(feed.city.toUpperCase());
        cell.appendChild(label);
        grid.appendChild(cell);
      });
      content.appendChild(grid);
    } else {
      // Single view
      const active = wcActiveFeed || feeds[0];
      wcActiveFeed = active;
      const single = document.createElement('div');
      single.className = 'wc-single';

      const player = document.createElement('div');
      player.className = 'wc-single-player';
      if (active.videoId) {
        const iframe = document.createElement('iframe');
        iframe.src = buildYTEmbed(active.videoId);
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        player.appendChild(iframe);
      }
      single.appendChild(player);

      const switcher = document.createElement('div');
      switcher.className = 'wc-switcher';
      feeds.forEach(feed => {
        const btn = document.createElement('button');
        btn.className = 'wc-feed-btn' + (feed.id === active.id ? ' active' : '');
        btn.textContent = feed.city;
        btn.onclick = () => { wcActiveFeed = feed; renderWebcams(); };
        switcher.appendChild(btn);
      });
      single.appendChild(switcher);
      content.appendChild(single);
    }
  }

  function destroyWebcams() {
    const content = $('wc-content');
    if (content) {
      content.querySelectorAll('iframe').forEach(f => { f.src = 'about:blank'; f.remove(); });
      content.innerHTML = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Globe Tooltip
  // ═══════════════════════════════════════════════════════════════════

  const tooltip = $('tooltip');

  document.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
      tooltip.style.left = Math.min(e.clientX + 16, window.innerWidth  - 320) + 'px';
      tooltip.style.top  = Math.min(e.clientY - 10, window.innerHeight - 160) + 'px';
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Render: Sources
  // ═══════════════════════════════════════════════════════════════════

  function renderSources() {
    const el = $('sources-inner');
    if (!allSources.length) {
      el.innerHTML = '<div class="empty-state">No sources registered.</div>';
      return;
    }
    el.innerHTML = allSources.map((s) => {
      const col = CAT_COLOR[s.category] || '#64748b';
      const off = disabledSources.has(s.id);
      return \`
        <div class="source-item\${off ? ' disabled' : ''}" data-source-id="\${esc(s.id)}" onclick="toggleSource('\${esc(s.id)}')">
          <div class="src-dot \${s.available ? 'ok' : 'off'}"></div>
          <span class="source-name">\${esc(s.name)}</span>
          <span class="source-cat" style="color:\${col};background:\${col}18;border:1px solid \${col}44">\${esc(s.category)}</span>
          <span class="src-toggle">\${off ? '&#9744;' : '&#9745;'}</span>
        </div>
      \`;
    }).join('');

    const avail = allSources.filter((s) => s.available).length;
    const enabled = allSources.length - disabledSources.size;
    $('ft-sources').textContent = enabled + ' / ' + allSources.length;
    $('hdr-sources').textContent = enabled + ' / ' + allSources.length;
    $('ms-sources').textContent  = enabled;
  }

  function toggleSource(sourceId) {
    if (disabledSources.has(sourceId)) {
      disabledSources.delete(sourceId);
    } else {
      disabledSources.add(sourceId);
    }
    renderSources();
    renderFeed();
    updateGlobe();
    if (leafletReady) updateLeaflet();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Render: Alerts
  // ═══════════════════════════════════════════════════════════════════

  function renderAlerts() {
    const el = $('alerts-list');
    const total = allAlerts.length;

    $('alert-count').textContent = total + ' alert' + (total !== 1 ? 's' : '');
    $('hdr-alerts').textContent  = total;

    if (!total) {
      el.innerHTML = '<div class="empty-state">No alerts yet.</div>';
      updateAlertFooter();
      return;
    }

    el.innerHTML = allAlerts.slice(0, MAX_ALERT_ITEMS).map((alert) => {
      const tier  = alert.tier.toLowerCase();
      const item  = alert.change.item;
      return \`
        <div class="alert-item \${tier}" onclick="this.classList.toggle('expanded')">
          <div class="alert-top">
            <span class="tier-badge \${tier}">\${esc(alert.tier)}</span>
            <span class="alert-title">\${esc(item.title)}</span>
          </div>
          <div class="alert-reason">\${esc(alert.change.reason)}</div>
          <div class="alert-time">\${timeAgo(alert.createdAt)} · \${esc(item.source)}</div>
        </div>
      \`;
    }).join('');

    updateAlertFooter();
  }

  function updateAlertFooter() {
    const flash    = allAlerts.filter((a) => a.tier === 'FLASH').length;
    const priority = allAlerts.filter((a) => a.tier === 'PRIORITY').length;
    const routine  = allAlerts.filter((a) => a.tier === 'ROUTINE').length;
    $('ft-flash').textContent    = 'F:' + flash;
    $('ft-priority').textContent = 'P:' + priority;
    $('ft-routine').textContent  = 'R:' + routine;
  }

  function addAlert(alert) {
    if (allAlerts.some((a) => a.id === alert.id)) return;
    allAlerts.unshift(alert);
    if (allAlerts.length > 200) allAlerts = allAlerts.slice(0, 200);
    renderAlerts();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Render: Feed
  // ═══════════════════════════════════════════════════════════════════

  function renderFeed() {
    const items = filteredItems().slice().reverse(); // newest first
    const el    = $('feed-list');

    $('feed-count').textContent  = items.length + ' item' + (items.length !== 1 ? 's' : '');
    $('hdr-items').textContent   = allItems.length;
    $('ft-items').textContent    = allItems.length;

    if (!items.length) {
      el.innerHTML = '<div class="empty-state">No items match the current filters.</div>';
      return;
    }

    el.innerHTML = items.slice(0, MAX_FEED_ITEMS).map((it) => {
      const catCol = CAT_COLOR[it.category] || '#64748b';
      const tags   = (it.tags || []).slice(0, 4).map((t) => \`<span class="fi-tag">\${esc(t)}</span>\`).join('');
      const locStr = it.location ? \`\${esc(it.location.name)}\${it.location.country ? ', ' + esc(it.location.country) : ''}\` : '';
      const urlEl  = it.url ? \`<br><br><a href="\${esc(it.url)}" target="_blank" rel="noopener">View source &#8599;</a>\` : '';

      return \`
        <div class="feed-item" style="border-left-color:\${catCol}40" onclick="this.classList.toggle('expanded')">
          <div class="fi-top">
            <div class="sev-dot \${it.severity}"></div>
            <div class="fi-content">
              <div class="fi-title">\${esc(it.title)}</div>
              <div class="fi-meta">
                <span class="fi-source">\${esc(it.source)}</span>
                <span class="fi-cat-badge" style="color:\${catCol};background:\${catCol}18;border:1px solid \${catCol}33">\${esc(it.category)}</span>
                <span class="fi-time">\${timeAgo(it.timestamp)}</span>
              </div>
            </div>
          </div>
          <div class="fi-body">
            \${esc(it.description)}
            \${locStr ? \`<div class="fi-location">Location: \${locStr}</div>\` : ''}
            \${urlEl}
            \${tags ? '<div class="fi-tags">' + tags + '</div>' : ''}
          </div>
        </div>
      \`;
    }).join('');

    renderTicker();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Render: News Digest by Continent
  // ═══════════════════════════════════════════════════════════════════

  const CONTINENT_MAP = {
    // Africa
    'Algeria': 'africa', 'Angola': 'africa', 'Benin': 'africa', 'Botswana': 'africa',
    'Burkina Faso': 'africa', 'Burundi': 'africa', 'Cameroon': 'africa', 'Cape Verde': 'africa',
    'Central African Republic': 'africa', 'Chad': 'africa', 'Comoros': 'africa', 'Congo': 'africa',
    'DR Congo': 'africa', 'Djibouti': 'africa', 'Egypt': 'africa', 'Equatorial Guinea': 'africa',
    'Eritrea': 'africa', 'Eswatini': 'africa', 'Ethiopia': 'africa', 'Gabon': 'africa',
    'Gambia': 'africa', 'Ghana': 'africa', 'Guinea': 'africa', 'Guinea-Bissau': 'africa',
    'Ivory Coast': 'africa', 'Kenya': 'africa', 'Lesotho': 'africa', 'Liberia': 'africa',
    'Libya': 'africa', 'Madagascar': 'africa', 'Malawi': 'africa', 'Mali': 'africa',
    'Mauritania': 'africa', 'Mauritius': 'africa', 'Morocco': 'africa', 'Mozambique': 'africa',
    'Namibia': 'africa', 'Niger': 'africa', 'Nigeria': 'africa', 'Rwanda': 'africa',
    'Senegal': 'africa', 'Sierra Leone': 'africa', 'Somalia': 'africa', 'South Africa': 'africa',
    'South Sudan': 'africa', 'Sudan': 'africa', 'Tanzania': 'africa', 'Togo': 'africa',
    'Tunisia': 'africa', 'Uganda': 'africa', 'Zambia': 'africa', 'Zimbabwe': 'africa',
    // Americas
    'Argentina': 'americas', 'Bolivia': 'americas', 'Brazil': 'americas', 'Canada': 'americas',
    'Chile': 'americas', 'Colombia': 'americas', 'Costa Rica': 'americas', 'Cuba': 'americas',
    'Dominican Republic': 'americas', 'Ecuador': 'americas', 'El Salvador': 'americas',
    'Guatemala': 'americas', 'Haiti': 'americas', 'Honduras': 'americas', 'Jamaica': 'americas',
    'Mexico': 'americas', 'Nicaragua': 'americas', 'Panama': 'americas', 'Paraguay': 'americas',
    'Peru': 'americas', 'Puerto Rico': 'americas', 'Trinidad and Tobago': 'americas',
    'United States': 'americas', 'USA': 'americas', 'US': 'americas', 'Uruguay': 'americas',
    'Venezuela': 'americas',
    // Asia
    'Afghanistan': 'asia', 'Bangladesh': 'asia', 'Bhutan': 'asia', 'Brunei': 'asia',
    'Cambodia': 'asia', 'China': 'asia', 'India': 'asia', 'Indonesia': 'asia', 'Japan': 'asia',
    'Kazakhstan': 'asia', 'Kyrgyzstan': 'asia', 'Laos': 'asia', 'Malaysia': 'asia',
    'Maldives': 'asia', 'Mongolia': 'asia', 'Myanmar': 'asia', 'Nepal': 'asia',
    'North Korea': 'asia', 'Pakistan': 'asia', 'Philippines': 'asia', 'Singapore': 'asia',
    'South Korea': 'asia', 'Sri Lanka': 'asia', 'Taiwan': 'asia', 'Tajikistan': 'asia',
    'Thailand': 'asia', 'Timor-Leste': 'asia', 'Turkmenistan': 'asia', 'Uzbekistan': 'asia',
    'Vietnam': 'asia',
    // Europe
    'Albania': 'europe', 'Andorra': 'europe', 'Armenia': 'europe', 'Austria': 'europe',
    'Azerbaijan': 'europe', 'Belarus': 'europe', 'Belgium': 'europe', 'Bosnia and Herzegovina': 'europe',
    'Bulgaria': 'europe', 'Croatia': 'europe', 'Cyprus': 'europe', 'Czech Republic': 'europe',
    'Czechia': 'europe', 'Denmark': 'europe', 'Estonia': 'europe', 'Finland': 'europe',
    'France': 'europe', 'Georgia': 'europe', 'Germany': 'europe', 'Greece': 'europe',
    'Hungary': 'europe', 'Iceland': 'europe', 'Ireland': 'europe', 'Italy': 'europe',
    'Kosovo': 'europe', 'Latvia': 'europe', 'Lithuania': 'europe', 'Luxembourg': 'europe',
    'Malta': 'europe', 'Moldova': 'europe', 'Monaco': 'europe', 'Montenegro': 'europe',
    'Netherlands': 'europe', 'North Macedonia': 'europe', 'Norway': 'europe', 'Poland': 'europe',
    'Portugal': 'europe', 'Romania': 'europe', 'Russia': 'europe', 'Serbia': 'europe',
    'Slovakia': 'europe', 'Slovenia': 'europe', 'Spain': 'europe', 'Sweden': 'europe',
    'Switzerland': 'europe', 'Turkey': 'europe', 'Ukraine': 'europe', 'United Kingdom': 'europe',
    'UK': 'europe',
    // Middle East
    'Bahrain': 'middle-east', 'Iran': 'middle-east', 'Iraq': 'middle-east', 'Israel': 'middle-east',
    'Jordan': 'middle-east', 'Kuwait': 'middle-east', 'Lebanon': 'middle-east', 'Oman': 'middle-east',
    'Palestine': 'middle-east', 'Qatar': 'middle-east', 'Saudi Arabia': 'middle-east',
    'Syria': 'middle-east', 'United Arab Emirates': 'middle-east', 'UAE': 'middle-east',
    'Yemen': 'middle-east',
    // Oceania
    'Australia': 'oceania', 'Fiji': 'oceania', 'New Zealand': 'oceania',
    'Papua New Guinea': 'oceania', 'Samoa': 'oceania', 'Tonga': 'oceania', 'Vanuatu': 'oceania',
  };

  const CONTINENT_LABELS = {
    'africa': 'Africa',
    'americas': 'Americas',
    'asia': 'Asia',
    'europe': 'Europe',
    'middle-east': 'Middle East',
    'oceania': 'Oceania',
    'global': 'Global / Other',
  };

  const CONTINENT_EMOJI = {
    'africa': '\\u{1F30D}',
    'americas': '\\u{1F30E}',
    'asia': '\\u{1F30F}',
    'europe': '\\u{1F30D}',
    'middle-east': '\\u{1F54C}',
    'oceania': '\\u{1F3DD}',
    'global': '\\u{1F310}',
  };

  let digestRegionFilter = 'all';

  // Map feed names to their PRIMARY coverage region (not HQ location)
  // Only include feeds that are clearly country/region-specific
  const FEED_REGION_MAP = {
    // US-focused outlets
    'fox news': 'americas', 'npr': 'americas', 'nbc news': 'americas',
    'abc news': 'americas', 'cbs news': 'americas', 'washington post': 'americas',
    'new york times': 'americas', 'politico': 'americas', 'the hill': 'americas',
    'u.s. department': 'americas', 'u.s. state': 'americas', 'cnn': 'americas',
    // Brazil-focused outlets
    'uol': 'americas', 'folha': 'americas', 'estad': 'americas',
    'g1': 'americas', 'globo': 'americas', 'ag\\u00eancia brasil': 'americas',
    'poder360': 'americas', 'valor econ': 'americas', 'infomoney': 'americas',
    // South Asia
    'ndtv': 'asia', 'dawn': 'asia', 'times of india': 'asia',
    // East Asia
    'xinhua': 'asia', 'cgtn': 'asia', 'nhk': 'asia',
    'straits times': 'asia', 'south china': 'asia',
    // Russia / Eurasia
    'tass': 'europe',
    // Turkey
    'anadolu': 'middle-east',
    // Latin America
    'prensa latina': 'americas',
  };

  function getContinent(item) {
    // 1. Best signal: geotagged country from article text
    if (item.location && item.location.country) {
      const c = CONTINENT_MAP[item.location.country];
      if (c) return c;
    }
    // 2. Feed name pattern matching (country-specific outlets)
    const feedName = (item.raw && item.raw.feed || '').toLowerCase();
    if (feedName) {
      for (const [pattern, region] of Object.entries(FEED_REGION_MAP)) {
        if (feedName.includes(pattern)) return region;
      }
    }
    // 3. Language hint: Portuguese feeds are Brazilian
    const tags = item.tags || [];
    if (tags.includes('pt')) return 'americas';
    // 4. Source-specific defaults for non-RSS sources
    const src = (item.source || '').toLowerCase();
    if (src.includes('fred') || src.includes('eia') || src.includes('usgs')) return 'americas';
    if (src.includes('opensky') || src.includes('finnhub') || src.includes('coingecko')) return 'global';
    // 5. Default: global (honest — we don't know)
    return 'global';
  }

  function getSourceLabel(item) {
    // Use feed name from raw data if available, otherwise source id
    if (item.raw && item.raw.feed) return item.raw.feed;
    return item.source || 'Unknown';
  }

  function renderDigest() {
    const items = filteredItems().slice().reverse();
    const grouped = {};

    for (const it of items) {
      const continent = getContinent(it);
      if (!grouped[continent]) grouped[continent] = [];
      grouped[continent].push(it);
    }

    const el = $('digest-content');
    const order = ['africa', 'americas', 'asia', 'europe', 'middle-east', 'oceania', 'global'];
    const regions = digestRegionFilter === 'all' ? order : [digestRegionFilter];

    let html = '';
    for (const region of regions) {
      const regionItems = grouped[region];
      if (!regionItems || regionItems.length === 0) continue;

      html += '<div class="digest-continent">';
      html += '<div class="digest-continent-header">'
        + CONTINENT_EMOJI[region] + ' ' + CONTINENT_LABELS[region]
        + ' <span class="digest-count">(' + regionItems.length + ')</span>'
        + '</div>';

      for (const it of regionItems.slice(0, 50)) {
        const catCol = CAT_COLOR[it.category] || '#64748b';
        const country = it.location && it.location.country ? it.location.country : '';
        const titleHtml = it.url
          ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title) + ' &#8599;</a>'
          : esc(it.title);

        html += '<div class="digest-item">'
          + '<div class="digest-sev ' + it.severity + '"></div>'
          + '<div class="digest-body">'
          + '<div class="digest-title">' + titleHtml + '</div>'
          + '<div class="digest-meta">'
          + '<span class="digest-source">' + esc(getSourceLabel(it)) + '</span>'
          + (country ? '<span class="digest-country">' + esc(country) + '</span>' : '')
          + '<span style="color:' + catCol + '">' + esc(it.category) + '</span>'
          + '<span>' + timeAgo(it.timestamp) + '</span>'
          + '</div></div></div>';
      }
      html += '</div>';
    }

    if (!html) {
      html = '<div class="empty-state">No news items available yet. Waiting for sweep data.</div>';
    }

    el.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Render: AI Summary
  // ═══════════════════════════════════════════════════════════════════

  function renderSummary(text) {
    $('summary-body').innerHTML = \`<div style="white-space:pre-line">\${esc(text)}</div>\`;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Render: Live News Ticker
  // ═══════════════════════════════════════════════════════════════════

  function renderTicker() {
    const el = $('ticker-content');
    if (!el || allItems.length === 0) return;

    // Take latest 30 items
    const tickerItems = allItems.slice(0, 30);
    const sevColors = {
      info:     'var(--sev-info)',
      low:      'var(--sev-low)',
      medium:   'var(--sev-medium)',
      high:     'var(--sev-high)',
      critical: 'var(--sev-critical)',
    };

    let html = tickerItems.map((item) => {
      const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return '<span class="ticker-item">' +
        '<span class="ti-sev" style="background:' + (sevColors[item.severity] || sevColors.info) + '"></span>' +
        '<span class="ti-src">' + esc(item.source.replace(/-/g, ' ')) + '</span>' +
        '<span class="ti-title">' + esc(item.title.substring(0, 80)) + '</span>' +
        '<span class="ti-time">' + time + '</span>' +
        '</span><span class="ticker-sep">\u2022</span>';
    }).join('');

    // Duplicate for seamless loop
    el.innerHTML = html + html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Markets & Macro
  // ═══════════════════════════════════════════════════════════════════

  function buildMiniSparkline(data, changeClass) {
    if (!data || data.length < 5) return '';
    // Downsample to 20 points
    const step = Math.max(1, Math.floor(data.length / 20));
    const points = [];
    for (let i = 0; i < data.length; i += step) points.push(data[i]);

    const w = 100, h = 20;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const coords = points.map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');

    const color = changeClass === 'up' ? '#22c55e' : changeClass === 'down' ? '#ef4444' : '#666';
    return '<svg class="mc-sparkline" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + coords + '" stroke="' + color + '"/></svg>';
  }

  async function fetchMarketData() {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple&order=market_cap_desc&sparkline=true&price_change_percentage=24h');
      if (!res.ok) return;
      const coins = await res.json();

      const grid = $('market-grid');
      if (!grid) return;

      let html = '';
      for (const coin of coins) {
        const change = coin.price_change_percentage_24h || 0;
        const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
        const changeStr = (change > 0 ? '+' : '') + change.toFixed(2) + '%';
        const sparkData = coin.sparkline_in_7d && coin.sparkline_in_7d.price ? coin.sparkline_in_7d.price : [];

        html += '<div class="market-card">' +
          '<div class="mc-name">' + esc(coin.symbol.toUpperCase()) + '</div>' +
          '<div class="mc-price">$' + Number(coin.current_price).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</div>' +
          '<div class="mc-change ' + changeClass + '">' + changeStr + '</div>' +
          buildMiniSparkline(sparkData, changeClass) +
          '</div>';
      }

      // Add placeholder cards from economic/market sweep items
      const economicItems = allItems.filter((i) => i.category === 'economic' || i.category === 'market');
      for (const item of economicItems.slice(0, 4)) {
        const match = item.title.match(/([\d.]+)/);
        const val = match ? match[1] : '\u2014';
        html += '<div class="market-card">' +
          '<div class="mc-name">' + esc(item.title.substring(0, 20)) + '</div>' +
          '<div class="mc-price">' + val + '</div>' +
          '<div class="mc-change flat">\u2014</div>' +
          '</div>';
      }

      if (html) grid.innerHTML = html;
    } catch (err) {
      console.debug('Market data fetch failed:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Risk Gauges / CII
  // ═══════════════════════════════════════════════════════════════════

  async function fetchRiskData() {
    try {
      const res = await fetch('/api/v1/analysis/cii');
      if (!res.ok) return;
      const countries = await res.json();

      const el = $('risk-gauges');
      if (!el || !Array.isArray(countries) || countries.length === 0) {
        if (el) el.innerHTML = '<div class="empty-state" style="font-size:0.6rem">No risk data \u2014 awaiting sweep</div>';
        return;
      }

      // Sort by score desc, show top 10
      const top = countries.sort((a, b) => b.score - a.score).slice(0, 10);

      function riskColor(score) {
        if (score >= 80) return '#ef4444';
        if (score >= 60) return '#f97316';
        if (score >= 40) return '#eab308';
        if (score >= 20) return '#22c55e';
        return '#64748b';
      }

      function trendIcon(trend) {
        if (trend === 'rising')  return '<span class="rc-trend rising">\u2191 Rising</span>';
        if (trend === 'falling') return '<span class="rc-trend falling">\u2193 Falling</span>';
        return '<span class="rc-trend stable">\u2192 Stable</span>';
      }

      el.innerHTML = top.map((c) => {
        const color = riskColor(c.score);
        const signals = c.signals || {};
        const sigHtml = Object.entries(signals).slice(0, 4).map(([k, v]) =>
          '<span>' + k.charAt(0).toUpperCase() + k.slice(1) + ':' + v + '</span>'
        ).join('');

        return '<div class="risk-country">' +
          '<div class="rc-header">' +
            '<span class="rc-name">' + esc(c.country) + '</span>' +
            '<span class="rc-score" style="color:' + color + '">' + c.score + '</span>' +
          '</div>' +
          '<div class="rc-bar-bg"><div class="rc-bar" style="width:' + c.score + '%;background:' + color + '"></div></div>' +
          '<div class="rc-signals">' + sigHtml + trendIcon(c.trend) + '</div>' +
          '</div>';
      }).join('');
    } catch (err) {
      console.debug('Risk data fetch failed:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Status update
  // ═══════════════════════════════════════════════════════════════════

  function updateStatus(data) {
    if (data.sweepCount !== undefined) {
      $('ft-sweeps').textContent  = data.sweepCount;
      $('sweep-count').textContent = data.sweepCount;
    }
    if (data.uptime !== undefined) {
      $('ft-status').textContent   = 'Uptime: ' + formatUptime(data.uptime);
      $('sweep-uptime').textContent = formatUptime(data.uptime);
    }
    if (data.lastSweepAt !== undefined) {
      const t = data.lastSweepAt ? fmtTime(data.lastSweepAt) : '—';
      $('hdr-sweep').textContent  = t;
      $('ft-sweep').textContent   = t;
      $('sweep-last').textContent = t;
    }
    if (data.sourceCount !== undefined) {
      // Sources info from /status; actual per-source comes from /sources
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Sweep trigger
  // ═══════════════════════════════════════════════════════════════════

  async function triggerSweep() {
    const btn = $('btn-sweep-now');
    btn.disabled = true;
    setSweepRunning(true);
    try {
      const res = await fetch('/api/v1/sweep/trigger', { method: 'POST' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const result = await res.json();
      onSweepResult(result);
    } catch (e) {
      console.error('Sweep trigger failed:', e);
    } finally {
      btn.disabled = false;
      setSweepRunning(false);
    }
  }

  // Expose globally for onclick attributes
  window.triggerSweep    = triggerSweep;
  window.toggleSection   = toggleSection;
  window.toggleSummary   = toggleSummary;
  window.generateSummary = generateSummary;
  window.switchMap       = switchMap;
  window.toggleSource    = toggleSource;

  function setSweepRunning(running) {
    const status = running ? 'Sweeping…' : 'Idle';
    $('sweep-status').textContent       = status;
    $('hdr-sweep-status').textContent   = status;
    $('sweep-status').style.color       = running ? 'var(--cyan)' : '';
    $('hdr-spinner').classList.toggle('active', running);
    $('ft-spinner').classList.toggle('active', running);
  }

  function onSweepResult(result) {
    const existing = new Set(allItems.map((i) => i.id));
    const newItems = (result.items || []).filter((i) => !existing.has(i.id));
    allItems = [...allItems, ...newItems].slice(-MAX_MEMORY_ITEMS);

    updateStatus({
      lastSweepAt: result.completedAt,
    });

    renderFeed();
    updateGlobe();
    if (leafletReady) updateLeaflet();
    setSweepRunning(false);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Data fetching
  // ═══════════════════════════════════════════════════════════════════

  async function fetchAll() {
    try {
      const [itemsRes, sourcesRes, statusRes, alertsRes, summaryRes] = await Promise.allSettled([
        fetch('/api/v1/items?limit=500'),
        fetch('/api/v1/sources'),
        fetch('/api/v1/status'),
        fetch('/api/v1/alerts?limit=50'),
        fetch('/api/v1/summary/latest'),
      ]);

      if (itemsRes.status === 'fulfilled' && itemsRes.value.ok) {
        allItems = await itemsRes.value.json();
      }
      if (sourcesRes.status === 'fulfilled' && sourcesRes.value.ok) {
        allSources = await sourcesRes.value.json();
      }
      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        updateStatus(await statusRes.value.json());
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const raw = await alertsRes.value.json();
        allAlerts = Array.isArray(raw) ? raw : [];
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const s = await summaryRes.value.json();
        if (s && s.summary) renderSummary(s.summary);
      }

      renderSources();
      renderFeed();
      renderAlerts();
      updateGlobe();
      fetchRiskData();

    } catch (e) {
      console.error('fetchAll error', e);
    }
  }

  // Periodic light refresh (status only)
  async function refreshStatus() {
    try {
      const [statusRes, alertsRes] = await Promise.allSettled([
        fetch('/api/v1/status'),
        fetch('/api/v1/alerts?limit=50'),
      ]);
      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        updateStatus(await statusRes.value.json());
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const raw = await alertsRes.value.json();
        if (Array.isArray(raw)) {
          allAlerts = raw;
          renderAlerts();
        }
      }
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SSE
  // ═══════════════════════════════════════════════════════════════════

  let evtSource      = null;
  let reconnectDelay = 1000;

  function setConnState(state) {
    // state: 'connecting' | 'online' | 'offline'
    const dot   = $('conn-dot');
    const label = $('conn-label');
    const msDot = $('ms-conn-dot');
    const msLbl = $('ms-conn-label');

    const map = {
      connecting: { cls: '',       text: 'Connecting…' },
      online:     { cls: 'online', text: 'Live' },
      offline:    { cls: 'offline',text: 'Reconnecting…' },
    };
    const s = map[state] || map.connecting;
    dot.className   = 'dot ' + s.cls;
    label.textContent = s.text;
    msDot.className = 'dot ' + s.cls;
    msLbl.textContent = s.text;
  }

  function connectSSE() {
    if (evtSource) { evtSource.close(); evtSource = null; }
    setConnState('connecting');

    evtSource = new EventSource('/api/v1/stream');

    evtSource.addEventListener('open', () => {
      setConnState('online');
      reconnectDelay = 1000;
    });

    evtSource.addEventListener('sweep', (e) => {
      const result = JSON.parse(e.data);
      onSweepResult(result);
      renderTicker();
      fetchRiskData();
    });

    evtSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      updateStatus(data);
      if (data.sseClients !== undefined) $('ft-clients').textContent = data.sseClients;
    });

    evtSource.addEventListener('alert', (e) => {
      const alert = JSON.parse(e.data);
      addAlert(alert);
    });

    evtSource.addEventListener('summary', (e) => {
      const data = JSON.parse(e.data);
      if (data && data.summary) renderSummary(data.summary);
    });

    evtSource.addEventListener('error', () => {
      setConnState('offline');
      evtSource.close();
      evtSource = null;
      setTimeout(connectSSE, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Filter wiring
  // ═══════════════════════════════════════════════════════════════════

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      renderFeed();
      updateGlobe();
      if (leafletReady) updateLeaflet();
    });
  });

  document.querySelectorAll('.sev-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sev = btn.dataset.sev;
      if (activeSeverities.has(sev)) {
        if (activeSeverities.size > 1) {
          activeSeverities.delete(sev);
          btn.classList.remove('active');
        }
      } else {
        activeSeverities.add(sev);
        btn.classList.add('active');
      }
      renderFeed();
      updateGlobe();
      if (leafletReady) updateLeaflet();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Time Period Filter
  // ═══════════════════════════════════════════════════════════════════

  document.querySelectorAll('.time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTimeHours = parseInt(btn.dataset.hours, 10) || 0;
      document.querySelectorAll('.time-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderFeed();
      updateGlobe();
      if (leafletReady) updateLeaflet();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  News Digest Region Filter
  // ═══════════════════════════════════════════════════════════════════

  document.querySelectorAll('.digest-region-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      digestRegionFilter = btn.dataset.region || 'all';
      document.querySelectorAll('.digest-region-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderDigest();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Boot
  // ═══════════════════════════════════════════════════════════════════

  async function boot() {
    initSectionHeights();

    await fetchAll();
    connectSSE();

    // Init 2D map as primary view
    initLeaflet();

    fetchMarketData();

    // Periodic refresh every 20s
    setInterval(refreshStatus, 20000);
    // Market data refresh every 60s
    setInterval(fetchMarketData, 60000);
  }

  boot().catch((e) => console.error('Boot failed:', e));

})();
</script>
</body>
</html>`;
}
