// Lokaler Test-Proxy — spiegelt worker.js für die Entwicklung (node local-proxy.js).
// NICHT für Produktion; dort läuft der Cloudflare-Worker.
const http = require("http");
const https = require("https");
const VRR = "https://openservice-test.vrr.de/openservice/";
const ALLOWED = new Set(["XML_STOPFINDER_REQUEST", "XML_DM_REQUEST"]);

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.end(); return; }

  const u = new URL(req.url, "http://x");
  const ep = u.pathname.replace(/^\/+/, "");
  if (!ALLOWED.has(ep)) { res.statusCode = 404; res.end('{"error":"not allowed"}'); return; }

  https.get(VRR + ep + u.search, { headers: { Accept: "application/json" } }, (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => { res.setHeader("Content-Type", "application/json"); res.end(d); });
  }).on("error", (e) => { res.statusCode = 502; res.end(JSON.stringify({ error: String(e) })); });
}).listen(8770, () => console.log("local proxy on http://localhost:8770"));
