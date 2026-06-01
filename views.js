// ─────────────────────────────────────────────────────────────
//  views.js — Rendering: Abfahrtszeilen + 4 Layouts
// ─────────────────────────────────────────────────────────────

import { MAX_DEPARTURES } from "./config.js";
import { getTimeFormat } from "./store.js";

/* ─── Badge-Farbe ──────────────────────────────────────────── */
export function getBadgeColor(ev) {
  const name = (ev.transportation?.disassembledName || "").toUpperCase();
  const cls = ev.transportation?.product?.class;

  if (name.startsWith("NE")) return "#d24a20";  // Nachtexpress
  if (name.startsWith("SEV")) return "#b13a9e"; // Ersatzverkehr

  switch (cls) {
    case 1:  return "#008238"; // S-Bahn
    case 2:  return "#007cc6"; // U-Bahn / Stadtbahn (z.B. Dortmund U42)
    case 3:  return "#007cc6"; // U-Bahn
    case 4:  return "#148291"; // Straßenbahn
    case 5:  return "#ba5700"; // Bus
    case 13: return "#bd2db0"; // RE / RB / RRX
    default: return "#555555";
  }
}

/* ─── Verspätung / Zeiten ──────────────────────────────────── */
export function parseDepTime(ev) {
  const planned = new Date(ev.departureTimePlanned);
  const estimated = ev.departureTimeEstimated ? new Date(ev.departureTimeEstimated) : null;
  const delayMs = estimated ? estimated - planned : 0;
  const delayed = delayMs > 60_000;

  const fmt = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  const eff = estimated ?? planned;
  const minutes = Math.round((eff.getTime() - Date.now()) / 60000);

  return {
    delayed,
    hasRealtime: Array.isArray(ev.realtimeStatus) && ev.realtimeStatus.includes("MONITORED"),
    plannedStr: fmt(planned),
    estimatedStr: estimated ? fmt(estimated) : null,
    displayTime: fmt(eff),
    minutes,
  };
}

function minLabel(min) {
  if (min <= 0) return "jetzt";
  return min + " min";
}

/* ─── Verkehrsmittel-Kategorien (für Filter pro Haltestelle) ── */
export const CATEGORIES = [
  { id: "sbahn",    label: "S-Bahn" },
  { id: "ubahn",    label: "U-Bahn" },
  { id: "tram",     label: "Tram" },
  { id: "bus",      label: "Bus" },
  { id: "regional", label: "Regional/Zug" },
];

/** Ordnet eine Abfahrt genau einer Filter-Kategorie zu. */
export function categoryOf(ev) {
  const name = (ev.transportation?.disassembledName || "").toUpperCase();
  const cls = ev.transportation?.product?.class;
  if (name.startsWith("NE") || name.startsWith("SEV")) return "bus"; // Nacht-/Ersatzbus
  switch (cls) {
    case 1:  return "sbahn";
    case 2:
    case 3:  return "ubahn";
    case 4:  return "tram";
    case 5:  return "bus";
    case 13: return "regional";
    case 0:  return "regional"; // Fernverkehr → Zug
    default: return "regional";
  }
}

/* ─── DOM-Helfer (textContent → XSS-sicher) ────────────────── */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* ─── Eine Abfahrtszeile ───────────────────────────────────── */
function renderDepRow(ev) {
  const t = parseDepTime(ev);
  const row = el("div", "dep-row" + (t.delayed ? " delayed" : ""));

  // Status-Icon (nur bei Echtzeit)
  const status = el("div", "dep-status");
  if (t.hasRealtime) {
    if (t.delayed) { status.classList.add("delay"); status.textContent = "⏱"; }
    else { status.classList.add("ok"); status.textContent = "✓"; }
  }
  row.appendChild(status);

  // Zeit (Format: Uhrzeit / Minuten / beides)
  const fmt = getTimeFormat();
  const time = el("div", "dep-time");
  if (fmt === "min") {
    const m = el("span", t.delayed ? "new" : null, minLabel(t.minutes));
    time.appendChild(m);
  } else {
    if (t.delayed && t.estimatedStr) {
      time.appendChild(el("span", "old", t.plannedStr));
      time.appendChild(el("span", "new", t.estimatedStr));
    } else {
      time.appendChild(el("span", null, t.displayTime));
    }
    if (fmt === "both") time.appendChild(el("span", "mins", minLabel(t.minutes)));
  }
  row.appendChild(time);

  // Hauptbereich: Badge ▶ Richtung + Steig
  const main = el("div", "dep-main");
  const line = el("div", "dep-line");

  const badge = el("span", "badge", ev.transportation?.disassembledName || "?");
  badge.style.background = getBadgeColor(ev);
  line.appendChild(badge);
  line.appendChild(el("span", "arrow", "▶"));
  line.appendChild(el("span", "direction", ev.transportation?.destination?.name || ""));
  main.appendChild(line);

  const platform = ev.location?.properties?.platformName;
  if (platform) main.appendChild(el("div", "platform", platformLabel(ev, platform)));
  row.appendChild(main);

  // Info-Icon (nur wenn infos[] vorhanden) — Klick zeigt den Text
  if (Array.isArray(ev.infos) && ev.infos.length > 0) {
    const info = el("div", "dep-info", "i");
    info.addEventListener("click", (e) => {
      e.stopPropagation();
      showInfo(ev);
    });
    row.appendChild(info);
  }

  return row;
}

/* ─── Info-Overlay (Störungen/Hinweise) ────────────────────── */
function infoText(ev) {
  return (ev.infos || [])
    .map((i) => {
      const title = i.title || i.subtitle || "";
      const content = (i.content || "").replace(/<[^>]+>/g, "").trim(); // HTML strippen
      return [title, content].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function showInfo(ev) {
  const line = ev.transportation?.disassembledName || "";
  const dest = ev.transportation?.destination?.name || "";
  const overlay = el("div", "info-overlay");
  const box = el("div", "info-box");
  box.appendChild(el("h3", null, `${line} → ${dest}`.trim()));
  const body = el("div", "info-text", infoText(ev) || "Keine Details verfügbar.");
  box.appendChild(body);
  const close = el("button", "btn btn-primary", "Schließen");
  close.addEventListener("click", () => overlay.remove());
  box.appendChild(close);
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function platformLabel(ev, platform) {
  // Züge fahren an "Gleis", alles andere am "Steig".
  const cls = ev.transportation?.product?.class;
  if (/^(gleis|steig|bstg|u-bahn)/i.test(platform)) return platform;
  const prefix = cls === 1 || cls === 13 || cls === 3 ? "Gleis" : "Steig";
  return `${prefix} ${platform}`;
}

/* ─── Filter & Sortierung pro Haltestelle ──────────────────── */
function effTime(ev) {
  return new Date(ev.departureTimeEstimated ?? ev.departureTimePlanned).getTime();
}
function platformName(ev) {
  return ev.location?.properties?.platformName || "";
}
const platCmp = (a, b) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" });

function stopCfg(view, stopId) {
  return {
    cats: view.filters?.[stopId],
    lines: view.lines?.[stopId],
    dir: view.dir?.[stopId],
    sort: view.sort?.[stopId],
  };
}
function hasActiveFilter(cfg) {
  return !!(cfg && (Array.isArray(cfg.cats) || (cfg.lines && cfg.lines.length) || cfg.dir));
}

function applyStopFilters(events, cfg = {}) {
  let out = events;
  if (Array.isArray(cfg.cats)) out = out.filter((ev) => cfg.cats.includes(categoryOf(ev)));
  if (cfg.lines && cfg.lines.length) {
    const set = cfg.lines.map((s) => s.toUpperCase());
    out = out.filter((ev) => set.includes((ev.transportation?.disassembledName || "").toUpperCase()));
  }
  if (cfg.dir) {
    const q = cfg.dir.toLowerCase();
    out = out.filter((ev) => (ev.transportation?.destination?.name || "").toLowerCase().includes(q));
  }
  if (cfg.sort === "platform") {
    out = [...out].sort((a, b) => {
      const c = platCmp(platformName(a), platformName(b));
      return c !== 0 ? c : effTime(a) - effTime(b);
    });
  }
  return out;
}

/* ─── Panel-Bausteine ──────────────────────────────────────── */
function buildPanel({ title, subline, error, events, limit, filtered }) {
  const panel = el("div", "stop-panel");
  const header = el("div", "vrr-header");
  header.appendChild(el("h2", "stop-name", title || "—"));
  header.appendChild(el("div", "last-update", subline || ""));
  panel.appendChild(header);

  if (error) {
    panel.appendChild(panelMessage("⚠️ " + error));
    return panel;
  }
  if (!events || events.length === 0) {
    panel.appendChild(panelMessage(
      filtered ? "Keine passenden Abfahrten (Filter aktiv)." : "Keine Abfahrten in den nächsten 60 Min."
    ));
    return panel;
  }
  const list = el("div", "dep-list");
  events.slice(0, limit).forEach((ev) => list.appendChild(renderDepRow(ev)));
  panel.appendChild(list);
  return panel;
}

function renderPanel(result, limit, cfg) {
  const events = applyStopFilters(result?.events || [], cfg);
  return buildPanel({
    title: result?.stopName || result?.fallbackName || "—",
    subline: result?.updatedLabel || "",
    error: result?.error,
    events,
    limit,
    filtered: hasActiveFilter(cfg),
  });
}

function panelMessage(text) {
  return el("div", "panel-message", text);
}

/* Label einer Steig-Gruppe aus ihren Events ableiten (Steig/Gleis X). */
function groupLabel(events) {
  const labels = [...new Set(
    events
      .filter((ev) => platformName(ev))               // leere Steige ignorieren
      .map((ev) => platformLabel(ev, platformName(ev)))
  )].filter(Boolean);
  return labels.join(", ");
}

/* ─── Steig-Split: eine Haltestelle in 2 Spalten ───────────── */
function renderSteigSplit(view, results, container) {
  const stopId = view.stops[0];
  const result = results[0];
  const name = result?.stopName || result?.fallbackName || "—";
  const updated = result?.updatedLabel || "";

  if (!stopId) { container.appendChild(panelMessage("Dieser View hat keine Haltestelle.")); return; }

  const base = applyStopFilters(result?.events || [], stopCfg(view, stopId));
  const split = view.split?.[stopId];
  let leftEv, rightEv;

  if (split && split.mode === "manual") {
    const match = (ev, tokens) => {
      const raw = platformName(ev).toLowerCase();
      const lab = platformLabel(ev, platformName(ev)).toLowerCase();
      return (tokens || []).some((tk) => {
        const t = tk.toLowerCase().trim();
        return t && (raw === t || raw.includes(t) || lab.includes(t));
      });
    };
    leftEv = base.filter((ev) => match(ev, split.left));
    rightEv = base.filter((ev) => match(ev, split.right));
  } else {
    // Automatisch: Steige sortieren, abwechselnd links/rechts (niedrigster links)
    const plats = [...new Set(base.map(platformName))].sort(platCmp);
    const leftSet = new Set(plats.filter((_, i) => i % 2 === 0));
    leftEv = base.filter((ev) => leftSet.has(platformName(ev)));
    rightEv = base.filter((ev) => !leftSet.has(platformName(ev)));
  }

  const limit = 14;
  const col = (events, fallback) => buildPanel({
    title: groupLabel(events) || fallback,                 // Steig groß als Überschrift
    subline: [name, updated].filter(Boolean).join(" · "),  // Haltestelle klein darunter
    error: result?.error, events, limit, filtered: true,
  });
  container.appendChild(col(leftEv, "Links"));
  container.appendChild(col(rightEv, "Rechts"));
}

/* ─── Layouts ──────────────────────────────────────────────── */
const LAYOUT_LIMITS = {
  single: 14,
  split2: 10,
  triple: 9,
  focusmini: 12, // großes Panel; kleine bekommen eigenes Limit
  steigsplit: 14,
};

/**
 * Rendert den aktiven View in den Container.
 * @param {Object} view     {layout, stops:[stopId], filters?, lines?, dir?, sort?, split?}
 * @param {Array}  results  pro stopId ein Objekt {stopName, events, error?, updatedLabel}
 * @param {HTMLElement} container
 */
export function renderView(view, results, container) {
  const layout = view.layout in LAYOUT_LIMITS ? view.layout : "single";
  container.className = "display-grid layout-" + layout;
  container.replaceChildren();

  const stops = view.stops || [];

  if (layout === "steigsplit") {
    if (view.orient === "rows") container.classList.add("split-rows");
    renderSteigSplit(view, results, container);
    return;
  }

  const baseLimit = LAYOUT_LIMITS[layout] ?? MAX_DEPARTURES;

  stops.forEach((stopId, idx) => {
    const result = results[idx];
    let limit = baseLimit;
    if (layout === "focusmini") limit = idx === 0 ? 7 : 4;
    container.appendChild(renderPanel(result, limit, stopCfg(view, stopId)));
  });

  if (stops.length === 0) {
    container.appendChild(panelMessage("Dieser View hat keine Haltestellen."));
  }
}
