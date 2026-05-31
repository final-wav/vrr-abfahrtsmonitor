/**
 * VRR EFA CORS-Proxy — Cloudflare Worker
 *
 * Reicht Anfragen an den VRR-EFA-OpenService durch und ergänzt die
 * fehlenden CORS-Header, damit die Browser-App (GitHub Pages) die Antwort
 * lesen darf. Der Worker ist KEIN App-Server — nur eine Umleitung.
 *
 * Aufruf vom Frontend:
 *   https://<dein-worker>.workers.dev/XML_DM_REQUEST?outputFormat=rapidJSON&...
 * wird durchgereicht an:
 *   https://openservice-test.vrr.de/openservice/XML_DM_REQUEST?...
 */

const VRR_BASE = "https://openservice-test.vrr.de/openservice/";

// Nur diese EFA-Endpunkte erlauben (kein offener Proxy).
const ALLOWED_ENDPOINTS = new Set([
  "XML_STOPFINDER_REQUEST",
  "XML_DM_REQUEST",
]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request) {
    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const endpoint = url.pathname.replace(/^\/+/, "");

    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return new Response(
        JSON.stringify({ error: "endpoint not allowed", endpoint }),
        { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const target = VRR_BASE + endpoint + url.search;

    try {
      const upstream = await fetch(target, {
        method: "GET",
        headers: { Accept: "application/json" },
        // VRR-Antworten sind nicht personalisiert → kurz cachen entlastet das Free-Tier.
        cf: { cacheTtl: 15, cacheEverything: true },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=15",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "upstream fetch failed", detail: String(err) }),
        { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }
  },
};
