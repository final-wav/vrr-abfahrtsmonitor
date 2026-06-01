// ─────────────────────────────────────────────────────────────
//  api.js — VRR EFA OpenService (über Cloudflare-Worker-Proxy)
// ─────────────────────────────────────────────────────────────

import { getApiBase, API_VERSION, FETCH_TIMEOUT_MS, isConfigured } from "./config.js";

export class NotConfiguredError extends Error {
  constructor() {
    super("Worker-URL nicht gesetzt (Einstellungen → Verbindung)");
    this.name = "NotConfiguredError";
  }
}

/**
 * Generischer EFA-Request gegen den Proxy.
 * @param {string} endpoint  z.B. "XML_DM_REQUEST"
 * @param {Object} params    zusätzliche Query-Parameter
 */
async function efaFetch(endpoint, params) {
  if (!isConfigured()) throw new NotConfiguredError();

  const url = new URL(endpoint, getApiBase());
  url.searchParams.set("outputFormat", "rapidJSON");
  url.searchParams.set("version", API_VERSION);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Haltestellen-Suche (Live-Suche im Settings-Modus).
 * @returns {Promise<Array<{stopId, name, quality}>>}
 */
export async function searchStops(query) {
  const q = query.trim();
  if (!q) return [];

  const data = await efaFetch("XML_STOPFINDER_REQUEST", {
    type_sf: "any",
    name_sf: q,
    locationServerActive: "1",
  });

  return (data.locations || [])
    .filter((loc) => loc.type === "stop" && loc.properties?.stopId)
    .map((loc) => ({
      stopId: loc.properties.stopId,
      name: loc.name,
      quality: loc.matchQuality ?? 0,
    }))
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Abfahrten einer Haltestelle laden.
 * @returns {Promise<{stopId, stopName, events: Array}>}
 */
export async function fetchDepartures(stopId, limit = 15) {
  const data = await efaFetch("XML_DM_REQUEST", {
    type_dm: "stopID",
    name_dm: stopId,
    mode: "direct",
    limit: String(limit),
  });

  return {
    stopId,
    stopName: data.locations?.[0]?.name ?? "",
    events: processDepartures(data.stopEvents || []),
  };
}

/**
 * Haltestellen im Umkreis einer Koordinate (GPS).
 * @returns {Promise<Array<{stopId, name, dist}>>}
 */
export async function nearbyStops(lat, lon, radius = 1200) {
  const data = await efaFetch("XML_COORD_REQUEST", {
    coordOutputFormat: "WGS84[DD.DDDDD]",
    coord: `${lon}:${lat}:WGS84[DD.DDDDD]`,
    type_1: "STOP",
    radius_1: String(radius),
    inclFilter: "1",
    max: "25",
  });

  return (data.locations || [])
    .map((loc) => ({
      stopId: loc.properties?.stopId,
      name: loc.name,
      dist: Number(loc.properties?.distance) || null,
    }))
    .filter((s) => s.stopId)
    .sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
}

/**
 * Bereits abgefahrene Abfahrten (> 30 s in der Vergangenheit) entfernen
 * und nach effektiver Abfahrtszeit sortieren.
 */
export function processDepartures(stopEvents) {
  const now = Date.now();
  const effTime = (ev) =>
    new Date(ev.departureTimeEstimated ?? ev.departureTimePlanned).getTime();

  return stopEvents
    .filter((ev) => effTime(ev) >= now - 30_000)
    .sort((a, b) => effTime(a) - effTime(b));
}
