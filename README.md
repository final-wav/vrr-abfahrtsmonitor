# VRR Abfahrtsmonitor

Browser-App (PWA), die Abfahrten an frei konfigurierbaren VRR-Haltestellen
anzeigt. Läuft auf Android-Chrome ohne Installation, optional als Vollbild-PWA.

## Architektur
- **Reines Frontend** (Vanilla JS, ES Modules) — kein Build-Tool.
- **Cloudflare Worker** als CORS-Proxy zur VRR-EFA-API (die API selbst sendet
  keine CORS-Header → direkter Browser-Fetch wäre sonst blockiert).

```
index.html → app.js ─┬─ api.js   → Worker → VRR-EFA
                     ├─ views.js  (Rendering, 4 Layouts)
                     ├─ settings.js (Suche, Views konfigurieren)
                     └─ store.js  (localStorage)
config.js  ← hier die Worker-URL eintragen
worker/    ← Cloudflare-Worker (Deploy-Anleitung darin)
```

## Inbetriebnahme

1. **Worker deployen** — siehe [`worker/README.md`](worker/README.md).
2. **Worker-URL in der App eintragen** — ⚙ Einstellungen → „Verbindung" →
   URL einfügen → „Speichern & testen" (wird in localStorage gespeichert,
   keine Datei bearbeiten).
3. **Hosten** (HTTPS Pflicht für Wake Lock + Service Worker), z.B. GitHub Pages:
   - Repo anlegen, Dateien pushen.
   - Settings → Pages → Branch `main` / root → Save.
   - URL aufrufen → ⚙ → Haltestellen suchen → Views anlegen.
4. Am Handy: Browser-Menü → „Zum Startbildschirm hinzufügen" → startet im Vollbild.

## Bedienung
- **Tab-Leiste unten**: View wechseln. ⚙ = Einstellungen.
- **Einstellungen**: Haltestellen per Live-Suche speichern, Views anlegen
  (Layout + Haltestellen), optional Auto-Rotation.
- Alles wird in `localStorage` gespeichert (gerätelokal).

## Lokal testen
ES Modules brauchen einen HTTP-Server (nicht `file://`):
```bash
npx serve .        # oder: python -m http.server
```
Ohne konfigurierte Worker-URL öffnet die App direkt die Einstellungen mit Hinweis.
