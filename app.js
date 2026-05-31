// ─────────────────────────────────────────────────────────────
//  app.js — Router, Wake Lock, Refresh-Loop, View-Switcher
// ─────────────────────────────────────────────────────────────

import { isConfigured } from "./config.js";
import { fetchDepartures } from "./api.js";
import { renderView } from "./views.js";
import { renderSettings } from "./settings.js";
import * as store from "./store.js";

const dom = {
  banner:   document.getElementById("conn-banner"),
  display:  document.getElementById("display-view"),
  grid:     document.getElementById("display-grid"),
  tabbar:   document.getElementById("tabbar"),
  settings: document.getElementById("settings-view"),
};

let refreshTimer = null;
let rotationTimer = null;
let wakeLock = null;
let mode = "display"; // "display" | "settings"

// Letzte erfolgreiche Daten pro stopId (für Offline-Fallback)
const cache = new Map();

/* ─── Init ─────────────────────────────────────────────────── */
async function init() {
  document.addEventListener("visibilitychange", onVisibility);
  setupSwipe();

  if (!hasUsableConfig()) {
    openSettings();
    return;
  }
  enterDisplay();
}

function hasUsableConfig() {
  return isConfigured() && store.getStops().length > 0 && store.getViews().length > 0;
}

/* ─── Modus: Display ───────────────────────────────────────── */
function enterDisplay() {
  mode = "display";
  dom.settings.classList.add("hidden");
  dom.display.classList.remove("hidden");

  if (!store.getActiveView()) {
    // keine Views → zurück in Settings
    openSettings();
    return;
  }

  buildTabbar();
  keepScreenAwake();
  refresh();
  startTimers();
}

function startTimers() {
  stopTimers();
  refreshTimer = setInterval(refresh, store.getRefreshInterval() * 1000);

  const sec = store.getRotationInterval();
  if (sec > 0 && store.getViews().length > 1) {
    rotationTimer = setInterval(rotateView, sec * 1000);
  }
}
function stopTimers() {
  clearInterval(refreshTimer); refreshTimer = null;
  clearInterval(rotationTimer); rotationTimer = null;
}

/* ─── Tab-Leiste ───────────────────────────────────────────── */
function buildTabbar() {
  const views = store.getViews();
  const activeId = store.getActiveView()?.id;
  dom.tabbar.replaceChildren();

  views.forEach((v) => {
    const tab = document.createElement("button");
    tab.className = "tab" + (v.id === activeId ? " active" : "");
    tab.textContent = v.label || "View";
    tab.addEventListener("click", () => {
      store.setActiveViewId(v.id);
      buildTabbar();
      refresh();
      startTimers(); // Rotation-Timer zurücksetzen
    });
    dom.tabbar.appendChild(tab);
  });

  const gear = document.createElement("button");
  gear.className = "tab tab-settings";
  gear.id = "tab-settings";
  gear.textContent = "⚙";
  gear.addEventListener("click", openSettings);
  dom.tabbar.appendChild(gear);
}

function rotateView() {
  switchViewByDelta(1, false); // Auto-Rotation: Timer NICHT zurücksetzen
}

/**
 * View um dir (+1 / -1) wechseln (zyklisch).
 * @param {number} dir
 * @param {boolean} resetRotation  Rotations-Timer neu starten (bei manueller Bedienung)
 */
function switchViewByDelta(dir, resetRotation = true) {
  const views = store.getViews();
  if (views.length < 2) return;
  const idx = views.findIndex((v) => v.id === store.getActiveView()?.id);
  const next = views[(idx + dir + views.length) % views.length];
  store.setActiveViewId(next.id);
  buildTabbar();
  refresh();
  if (resetRotation) startTimers();
}

/* ─── Swipe-Gesten (links/rechts zwischen Views) ───────────── */
function setupSwipe() {
  const surface = dom.display;
  let x0 = null, y0 = null, t0 = 0;

  surface.addEventListener("pointerdown", (e) => {
    x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
  });

  surface.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    const dt = Date.now() - t0;
    x0 = null;
    if (mode !== "display") return;
    // Schnelle, überwiegend horizontale Bewegung über Schwellwert
    if (dt < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      switchViewByDelta(dx < 0 ? 1 : -1); // links wischen → nächster View
    }
  });

  surface.addEventListener("pointercancel", () => { x0 = null; });
}

/* ─── Refresh ──────────────────────────────────────────────── */
async function refresh() {
  if (mode !== "display") return;
  const view = store.getActiveView();
  if (!view) return;

  const stopIds = [...new Set(view.stops)];
  const settled = await Promise.allSettled(stopIds.map((id) => fetchDepartures(id)));

  const now = new Date();
  const stamp = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  let anyError = false;

  const byId = new Map();
  stopIds.forEach((id, i) => {
    const res = settled[i];
    if (res.status === "fulfilled") {
      const data = { ...res.value, updatedLabel: "Stand " + stamp };
      cache.set(id, data);
      byId.set(id, data);
    } else {
      anyError = true;
      const cached = cache.get(id);
      if (cached) {
        byId.set(id, { ...cached, updatedLabel: cached.updatedLabel + " (offline)" });
      } else {
        byId.set(id, { error: "Keine Daten", fallbackName: store.getStopName(id) });
      }
    }
  });

  // Reihenfolge gemäß view.stops (inkl. evtl. Duplikate)
  const results = view.stops.map((id) => byId.get(id));
  renderView(view, results, dom.grid);
  setBanner(anyError ? "Keine Verbindung — letzte Daten" : null);
}

function setBanner(text) {
  if (!text) { dom.banner.classList.add("hidden"); return; }
  dom.banner.textContent = text;
  dom.banner.classList.remove("hidden");
}

/* ─── Modus: Settings ──────────────────────────────────────── */
function openSettings() {
  mode = "settings";
  stopTimers();
  releaseWakeLock();
  dom.display.classList.add("hidden");
  dom.settings.classList.remove("hidden");
  setBanner(null);

  renderSettings(dom.settings, {
    onClose: () => {
      if (hasUsableConfig()) enterDisplay();
      else openSettings(); // immer noch nichts konfiguriert → bleiben
    },
    onChange: () => {}, // Display wird beim Schließen ohnehin neu gebaut
  });
}

/* ─── Wake Lock ────────────────────────────────────────────── */
async function keepScreenAwake() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener?.("release", () => { wakeLock = null; });
    }
  } catch { /* z.B. nicht im Vordergrund — egal */ }
}
function releaseWakeLock() {
  try { wakeLock?.release?.(); } catch {}
  wakeLock = null;
}

function onVisibility() {
  if (document.visibilityState === "visible" && mode === "display") {
    keepScreenAwake();
    refresh();
  }
}

init();
