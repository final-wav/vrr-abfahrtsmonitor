// ─────────────────────────────────────────────────────────────
//  views.js — Rendering: Abfahrtszeilen + 4 Layouts
// ─────────────────────────────────────────────────────────────

import { MAX_DEPARTURES } from "./config.js";

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

  return {
    delayed,
    hasRealtime: Array.isArray(ev.realtimeStatus) && ev.realtimeStatus.includes("MONITORED"),
    plannedStr: fmt(planned),
    estimatedStr: estimated ? fmt(estimated) : null,
    displayTime: fmt(estimated ?? planned),
  };
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

  // Zeit
  const time = el("div", "dep-time");
  if (t.delayed && t.estimatedStr) {
    time.appendChild(el("span", "old", t.plannedStr));
    time.appendChild(el("span", "new", t.estimatedStr));
  } else {
    time.textContent = t.displayTime;
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

  // Info-Icon (nur wenn infos[] vorhanden)
  if (Array.isArray(ev.infos) && ev.infos.length > 0) {
    row.appendChild(el("div", "dep-info", "i"));
  }

  return row;
}

function platformLabel(ev, platform) {
  // Züge fahren an "Gleis", alles andere am "Steig".
  const cls = ev.transportation?.product?.class;
  if (/^(gleis|steig|bstg|u-bahn)/i.test(platform)) return platform;
  const prefix = cls === 1 || cls === 13 || cls === 3 ? "Gleis" : "Steig";
  return `${prefix} ${platform}`;
}

/* ─── Panel für eine Haltestelle ───────────────────────────── */
function renderPanel(result, limit) {
  const panel = el("div", "stop-panel");

  const header = el("div", "vrr-header");
  header.appendChild(el("h2", "stop-name", result?.stopName || result?.fallbackName || "—"));
  header.appendChild(el("div", "last-update", result?.updatedLabel || ""));
  panel.appendChild(header);

  if (result?.error) {
    panel.appendChild(panelMessage("⚠️ " + result.error));
    return panel;
  }

  const events = result?.events || [];
  if (events.length === 0) {
    panel.appendChild(panelMessage("Keine Abfahrten in den nächsten 60 Min."));
    return panel;
  }

  const list = el("div", "dep-list");
  events.slice(0, limit).forEach((ev) => list.appendChild(renderDepRow(ev)));
  panel.appendChild(list);
  return panel;
}

function panelMessage(text) {
  return el("div", "panel-message", text);
}

/* ─── Layouts ──────────────────────────────────────────────── */
const LAYOUT_LIMITS = {
  single: 14,
  split2: 10,
  triple: 9,
  focusmini: 12, // großes Panel; kleine bekommen eigenes Limit
};

/**
 * Rendert den aktiven View in den Container.
 * @param {Object} view     {layout, stops:[stopId]}
 * @param {Array}  results  pro stopId ein Objekt {stopName, events, error?, updatedLabel}
 * @param {HTMLElement} container
 */
export function renderView(view, results, container) {
  const layout = view.layout in LAYOUT_LIMITS ? view.layout : "single";
  container.className = "display-grid layout-" + layout;
  container.replaceChildren();

  const stops = view.stops || [];
  const baseLimit = LAYOUT_LIMITS[layout] ?? MAX_DEPARTURES;

  stops.forEach((stopId, idx) => {
    const result = results[idx];
    // focusmini: erstes Panel groß, restliche kompakt
    let limit = baseLimit;
    if (layout === "focusmini") limit = idx === 0 ? 7 : 4;
    container.appendChild(renderPanel(result, limit));
  });

  if (stops.length === 0) {
    container.appendChild(panelMessage("Dieser View hat keine Haltestellen."));
  }
}
