// ─────────────────────────────────────────────────────────────
//  Zentrale Konfiguration
//  Die Worker-URL wird NICHT hier eingetragen, sondern in der App
//  unter ⚙ Einstellungen → "Verbindung" (in localStorage gespeichert).
// ─────────────────────────────────────────────────────────────

const API_BASE_KEY = "vrr_apiBase";

// EFA-API-Version (laut Spec)
export const API_VERSION = "10.4.18.18";

// Refresh-Intervall der Abfahrten
export const REFRESH_MS = 30_000;

// Fetch-Timeout pro Request
export const FETCH_TIMEOUT_MS = 8_000;

// Wieviele Abfahrten max. pro Haltestelle anzeigen (Layout-abhängig überschrieben)
export const MAX_DEPARTURES = 12;

/** Aktuelle Worker-Basis-URL (aus localStorage) oder "" wenn nicht gesetzt. */
export function getApiBase() {
  try {
    const v = localStorage.getItem(API_BASE_KEY);
    return v && v.trim() ? v.trim() : "";
  } catch {
    return "";
  }
}

/** Worker-URL speichern. Normalisiert auf "https://…/" mit Slash am Ende. */
export function setApiBase(url) {
  let v = (url || "").trim();
  if (!v) { localStorage.removeItem(API_BASE_KEY); return ""; }
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  if (!v.endsWith("/")) v += "/";
  localStorage.setItem(API_BASE_KEY, v);
  return v;
}

export function isConfigured() {
  const base = getApiBase();
  return /^https?:\/\/.+/i.test(base);
}
