# VRR CORS-Proxy (Cloudflare Worker)

Winziger Proxy, der VRR-EFA-Requests durchreicht und CORS-Header setzt.
Ohne ihn blockiert der Browser jeden `fetch` auf die VRR-API.

## Deploy (du hast einen Cloudflare-Account)

### Variante A — Dashboard (kein Tooling nötig)
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Namen vergeben (z.B. `vrr-proxy`) → **Deploy**.
3. **Edit code** → den kompletten Inhalt von [`worker.js`](worker.js) einfügen → **Deploy**.
4. Die URL kopieren, z.B. `https://vrr-proxy.deinname.workers.dev`.

### Variante B — Wrangler CLI
```bash
npm install -g wrangler
cd worker
wrangler login
wrangler deploy
```
Am Ende gibt Wrangler die Worker-URL aus.

## Danach
Die Worker-URL **in der App** eintragen: ⚙ Einstellungen → Abschnitt
**Verbindung** → URL einfügen → „Speichern & testen". Sie wird in
`localStorage` gespeichert — keine Datei bearbeiten nötig.

## Test
```
https://vrr-proxy.deinname.workers.dev/XML_STOPFINDER_REQUEST?outputFormat=rapidJSON&version=10.4.18.18&type_sf=any&name_sf=Gelsenkirchen+Hbf&locationServerActive=1
```
Sollte JSON mit `locations[]` liefern — jetzt mit `Access-Control-Allow-Origin: *`.
