// ─────────────────────────────────────────────────────────────
//  store.js — localStorage-Persistenz
// ─────────────────────────────────────────────────────────────

const KEYS = {
  stops: "vrr_stops",
  views: "vrr_views",
  activeView: "vrr_activeView",
  rotation: "vrr_rotationInterval",
  refresh: "vrr_refreshInterval",
  theme: "vrr_theme",
  timeFormat: "vrr_timeFormat",
  loadCount: "vrr_loadCount",
};

export const THEMES = ["light", "dark", "amoled"];
export const TIME_FORMATS = ["clock", "min", "both"];

const DEFAULT_REFRESH_SEC = 30;
const DEFAULT_LOAD_COUNT = 15;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ─── Haltestellen ─────────────────────────────────────────── */
export function getStops() {
  return read(KEYS.stops, []);
}
export function saveStop(stop) {
  const stops = getStops();
  if (stops.some((s) => s.stopId === stop.stopId)) return false;
  stops.push({ stopId: stop.stopId, name: stop.name });
  write(KEYS.stops, stops);
  return true;
}
export function removeStop(stopId) {
  write(KEYS.stops, getStops().filter((s) => s.stopId !== stopId));
  // Haltestelle auch aus allen Views entfernen
  const views = getViews().map((v) => ({
    ...v,
    stops: v.stops.filter((id) => id !== stopId),
  }));
  write(KEYS.views, views);
}
export function getStopName(stopId) {
  return getStops().find((s) => s.stopId === stopId)?.name ?? stopId;
}

/* ─── Views ────────────────────────────────────────────────── */
export function getViews() {
  return read(KEYS.views, []);
}
export function saveView(view) {
  const views = getViews();
  const idx = views.findIndex((v) => v.id === view.id);
  if (idx >= 0) views[idx] = view;
  else views.push(view);
  write(KEYS.views, views);
}
export function removeView(id) {
  write(KEYS.views, getViews().filter((v) => v.id !== id));
  if (getActiveViewId() === id) {
    const first = getViews()[0];
    setActiveViewId(first ? first.id : null);
  }
}
export function newViewId() {
  return "v" + Date.now().toString(36);
}

/* ─── Aktiver View ─────────────────────────────────────────── */
export function getActiveViewId() {
  return read(KEYS.activeView, null);
}
export function setActiveViewId(id) {
  write(KEYS.activeView, id);
}
export function getActiveView() {
  const views = getViews();
  if (views.length === 0) return null;
  const id = getActiveViewId();
  return views.find((v) => v.id === id) || views[0];
}

/* ─── Auto-Rotation (Sekunden, 0 = aus) ────────────────────── */
export function getRotationInterval() {
  return Number(read(KEYS.rotation, 0)) || 0;
}
export function setRotationInterval(seconds) {
  write(KEYS.rotation, Number(seconds) || 0);
}

/* ─── Aktualisierungs-Intervall der Abfahrten (Sekunden) ───── */
export function getRefreshInterval() {
  const v = Number(read(KEYS.refresh, DEFAULT_REFRESH_SEC));
  return v > 0 ? v : DEFAULT_REFRESH_SEC;
}
export function setRefreshInterval(seconds) {
  write(KEYS.refresh, Number(seconds) || DEFAULT_REFRESH_SEC);
}

/* ─── Theme ────────────────────────────────────────────────── */
export function getTheme() {
  const t = read(KEYS.theme, "light");
  return THEMES.includes(t) ? t : "light";
}
export function setTheme(theme) {
  write(KEYS.theme, THEMES.includes(theme) ? theme : "light");
}
/** Theme aufs <html>-Element anwenden (light = ohne Attribut). */
export function applyTheme(theme = getTheme()) {
  const el = document.documentElement;
  if (theme === "light") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

/* ─── Zeitformat (clock | min | both) ──────────────────────── */
export function getTimeFormat() {
  const t = read(KEYS.timeFormat, "clock");
  return TIME_FORMATS.includes(t) ? t : "clock";
}
export function setTimeFormat(fmt) {
  write(KEYS.timeFormat, TIME_FORMATS.includes(fmt) ? fmt : "clock");
}

/* ─── Anzahl zu ladender Abfahrten pro Haltestelle ─────────── */
export function getLoadCount() {
  const n = Number(read(KEYS.loadCount, DEFAULT_LOAD_COUNT));
  return n >= 5 && n <= 40 ? n : DEFAULT_LOAD_COUNT;
}
export function setLoadCount(n) {
  const v = Math.max(5, Math.min(40, Number(n) || DEFAULT_LOAD_COUNT));
  write(KEYS.loadCount, v);
}
