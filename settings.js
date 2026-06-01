// ─────────────────────────────────────────────────────────────
//  settings.js — Settings-UI (Haltestellen + Views konfigurieren)
// ─────────────────────────────────────────────────────────────

import { searchStops, NotConfiguredError } from "./api.js";
import { isConfigured, getApiBase, setApiBase } from "./config.js";
import { CATEGORIES } from "./views.js";
import * as store from "./store.js";

/* Filter-Helfer: view.filters[stopId] = erlaubte Kategorien (fehlt = alle) */
function getStopCats(view, stopId) {
  const f = view.filters && view.filters[stopId];
  return Array.isArray(f) ? f : null;
}
function setStopCats(view, stopId, enabled) {
  const allIds = CATEGORIES.map((c) => c.id);
  if (!view.filters) view.filters = {};
  if (enabled.length >= allIds.length) {
    delete view.filters[stopId];
    if (Object.keys(view.filters).length === 0) delete view.filters;
  } else {
    view.filters[stopId] = enabled;
  }
}

const LAYOUTS = [
  { id: "single",    label: "Single — 1 Haltestelle groß",        count: 1 },
  { id: "split2",    label: "Split — 2 nebeneinander",            count: 2 },
  { id: "triple",    label: "Triple — 3 nebeneinander",           count: 3 },
  { id: "focusmini", label: "Focus — 1 groß oben, 2 klein unten", count: 3 },
];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = el("div", "toast"); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/**
 * Baut die komplette Settings-UI in `root`.
 * @param {HTMLElement} root
 * @param {{onClose:Function, onChange:Function}} hooks
 */
export function renderSettings(root, { onClose, onChange }) {
  const notify = () => onChange?.();
  root.replaceChildren();

  // Header
  const header = el("div", "settings-header");
  header.appendChild(el("h1", null, "Einstellungen"));
  const done = el("button", "icon-btn", "Fertig ✓");
  done.addEventListener("click", () => onClose?.());
  header.appendChild(done);
  root.appendChild(header);

  const body = el("div", "settings-body");
  root.appendChild(body);

  body.appendChild(buildThemeSection());
  body.appendChild(buildConnectionSection(() => renderSettings(root, { onClose, onChange })));
  body.appendChild(buildSearchSection(notify));
  body.appendChild(buildStopsSection(notify));
  body.appendChild(buildViewsSection(notify));
  body.appendChild(buildRefreshSection());
  body.appendChild(buildRotationSection());
}

/* ─── Abschnitt: Erscheinungsbild (Theme) ──────────────────── */
function buildThemeSection() {
  const sec = el("div", "settings-section");
  sec.appendChild(el("h2", null, "Erscheinungsbild"));

  const field = el("div", "field");
  const sel = el("select");
  const options = [
    { v: "light",  t: "Hell (Standard)" },
    { v: "dark",   t: "Dunkelgrau" },
    { v: "amoled", t: "Schwarz (AMOLED)" },
  ];
  const current = store.getTheme();
  options.forEach((o) => {
    const opt = el("option", null, o.t);
    opt.value = o.v;
    if (o.v === current) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => {
    store.setTheme(sel.value);
    store.applyTheme(sel.value); // sofort sichtbar
  });
  field.appendChild(sel);
  sec.appendChild(field);
  return sec;
}

/* ─── Abschnitt: Verbindung (Worker-URL) ───────────────────── */
function buildConnectionSection(rerender) {
  const sec = el("div", "settings-section");
  sec.appendChild(el("h2", null, "Verbindung"));

  if (!isConfigured()) {
    const warn = el("div", "search-status");
    warn.style.color = "#b00020";
    warn.textContent = "⚠️ Noch keine Worker-URL gesetzt — ohne sie lädt nichts.";
    sec.appendChild(warn);
  }

  const desc = el("div", "item-sub");
  desc.style.marginBottom = "8px";
  desc.textContent = "Cloudflare-Worker-URL (siehe worker/README.md zum Deployen).";
  sec.appendChild(desc);

  const field = el("div", "field");
  const input = el("input");
  input.type = "text";
  input.placeholder = "https://vrr-proxy.dein-name.workers.dev";
  input.value = getApiBase();
  field.appendChild(input);
  sec.appendChild(field);

  const status = el("div", "search-status");
  sec.appendChild(status);

  const row = el("div", "field");
  const saveBtn = el("button", "btn btn-primary", "Speichern & testen");
  const clearBtn = el("button", "btn btn-ghost", "Löschen");
  row.appendChild(saveBtn);
  row.appendChild(clearBtn);
  sec.appendChild(row);

  saveBtn.addEventListener("click", async () => {
    const saved = setApiBase(input.value);
    if (!saved) { rerender(); return; }
    input.value = saved;
    status.style.color = "var(--text-secondary)";
    status.textContent = "Teste Verbindung …";
    saveBtn.disabled = true;
    try {
      const found = await searchStops("Essen Hbf");
      status.style.color = "var(--color-ok)";
      status.textContent = `✓ Verbindung OK (${found.length} Testtreffer). Gespeichert.`;
      toast("Verbunden");
      setTimeout(rerender, 900); // Warnungen/Abschnitte aktualisieren
    } catch (err) {
      status.style.color = "#b00020";
      status.textContent =
        "✗ Verbindung fehlgeschlagen — URL prüfen (Worker deployed? CORS?).";
    } finally {
      saveBtn.disabled = false;
    }
  });

  clearBtn.addEventListener("click", () => {
    setApiBase("");
    rerender();
  });

  return sec;
}

/* ─── Abschnitt: Haltestelle suchen ────────────────────────── */
function buildSearchSection(notify) {
  const sec = el("div", "settings-section");
  sec.appendChild(el("h2", null, "Haltestelle suchen"));

  const field = el("div", "field");
  const input = el("input");
  input.type = "text";
  input.placeholder = "z.B. Gelsenkirchen Hbf";
  field.appendChild(input);
  sec.appendChild(field);

  const status = el("div", "search-status");
  sec.appendChild(status);
  const results = el("ul", "result-list");
  sec.appendChild(results);

  let debounce = null;
  let reqToken = 0;

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    results.replaceChildren();
    if (q.length < 2) { status.textContent = ""; return; }
    status.textContent = "Suche …";
    debounce = setTimeout(() => runSearch(q), 350);
  });

  async function runSearch(q) {
    const token = ++reqToken;
    try {
      const found = await searchStops(q);
      if (token !== reqToken) return; // veraltete Antwort verwerfen
      results.replaceChildren();
      if (found.length === 0) { status.textContent = "Nichts gefunden."; return; }
      status.textContent = found.length + " Treffer";
      found.slice(0, 12).forEach((s) => results.appendChild(resultRow(s, notify)));
    } catch (err) {
      if (token !== reqToken) return;
      status.textContent =
        err instanceof NotConfiguredError
          ? "Worker-URL fehlt (config.js)."
          : "Suche fehlgeschlagen.";
    }
  }

  function resultRow(stop, notify) {
    const li = el("li");
    const grow = el("div", "grow");
    grow.appendChild(el("div", "item-title", stop.name));
    grow.appendChild(el("div", "item-sub", "ID " + stop.stopId));
    li.appendChild(grow);

    const already = store.getStops().some((s) => s.stopId === stop.stopId);
    const btn = el("button", "btn btn-primary", already ? "Gespeichert" : "+ Speichern");
    btn.disabled = already;
    btn.addEventListener("click", () => {
      if (store.saveStop(stop)) {
        btn.textContent = "Gespeichert";
        btn.disabled = true;
        toast("Haltestelle gespeichert");
        refreshStopsAndViews();
        notify();
      }
    });
    li.appendChild(btn);
    return li;
  }

  return sec;
}

/* ─── Abschnitt: gespeicherte Haltestellen ─────────────────── */
function buildStopsSection(notify) {
  const sec = el("div", "settings-section");
  sec.id = "stops-section";
  sec.appendChild(el("h2", null, "Gespeicherte Haltestellen"));
  sec.appendChild(renderStopList(notify));
  return sec;
}

function renderStopList(notify) {
  const list = el("ul", "item-list");
  const stops = store.getStops();
  if (stops.length === 0) {
    const empty = el("div", "search-status", "Noch keine Haltestellen gespeichert.");
    list.appendChild(empty);
    return list;
  }
  stops.forEach((s) => {
    const li = el("li");
    const grow = el("div", "grow");
    grow.appendChild(el("div", "item-title", s.name));
    grow.appendChild(el("div", "item-sub", "ID " + s.stopId));
    li.appendChild(grow);

    const del = el("button", "btn btn-danger", "Entfernen");
    del.addEventListener("click", () => {
      store.removeStop(s.stopId);
      toast("Haltestelle entfernt");
      refreshStopsAndViews();
      notify();
    });
    li.appendChild(del);
    list.appendChild(li);
  });
  return list;
}

/* ─── Abschnitt: Views ─────────────────────────────────────── */
function buildViewsSection(notify) {
  const sec = el("div", "settings-section");
  sec.id = "views-section";
  sec.appendChild(el("h2", null, "Views"));
  sec.appendChild(renderViewsBody(notify));
  return sec;
}

function renderViewsBody(notify) {
  const wrap = el("div");
  const stops = store.getStops();

  if (stops.length === 0) {
    wrap.appendChild(el("div", "search-status",
      "Erst Haltestellen speichern, dann Views anlegen."));
    return wrap;
  }

  store.getViews().forEach((v) => wrap.appendChild(viewCard(v, notify)));

  const add = el("button", "btn btn-ghost", "+ Neuen View anlegen");
  add.addEventListener("click", () => {
    const view = { id: store.newViewId(), layout: "single", stops: [], label: "Neuer View" };
    store.saveView(view);
    if (store.getViews().length === 1) store.setActiveViewId(view.id);
    refreshViews();
    notify();
  });
  wrap.appendChild(add);
  return wrap;
}

function viewCard(view, notify) {
  const card = el("div", "view-card");
  const stops = store.getStops();
  const layoutDef = LAYOUTS.find((l) => l.id === view.layout) || LAYOUTS[0];

  // Zeile 1: Label
  const r1 = el("div", "row");
  const label = el("input");
  label.type = "text";
  label.value = view.label || "";
  label.placeholder = "Bezeichnung (Tab-Name)";
  label.addEventListener("change", () => { view.label = label.value.trim() || "View"; store.saveView(view); notify(); });
  r1.appendChild(label);
  card.appendChild(r1);

  // Zeile 2: Layout-Auswahl
  const r2 = el("div", "row");
  const sel = el("select");
  LAYOUTS.forEach((l) => {
    const opt = el("option", null, l.label);
    opt.value = l.id;
    if (l.id === view.layout) opt.selected = true;
    sel.appendChild(opt);
  });
  r2.appendChild(sel);
  card.appendChild(r2);

  // Hinweis zur Anzahl
  const hint = el("div", "item-sub");
  const updateHint = () => {
    const def = LAYOUTS.find((l) => l.id === view.layout);
    hint.textContent = `${view.stops.length}/${def.count} Haltestellen gewählt`;
  };
  card.appendChild(hint);

  // Checkbox-Liste der Haltestellen
  const checks = el("div", "checks");
  const renderChecks = () => {
    checks.replaceChildren();
    const def = LAYOUTS.find((l) => l.id === view.layout);
    stops.forEach((s) => {
      const selected = view.stops.includes(s.stopId);
      const wrap = el("div", "stop-pick");

      const lab = el("label");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = selected;
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (view.stops.length >= def.count) {
            cb.checked = false;
            toast(`Layout erlaubt nur ${def.count} Haltestelle(n)`);
            return;
          }
          if (!view.stops.includes(s.stopId)) view.stops.push(s.stopId);
        } else {
          view.stops = view.stops.filter((id) => id !== s.stopId);
        }
        store.saveView(view);
        updateHint();
        renderChecks(); // Filter-Zeile ein-/ausblenden
        notify();
      });
      lab.appendChild(cb);
      lab.appendChild(el("span", null, s.name));
      wrap.appendChild(lab);

      // Verkehrsmittel-Filter — nur wenn Haltestelle gewählt
      if (selected) {
        const current = getStopCats(view, s.stopId); // null = alle
        const catRow = el("div", "cat-row");
        CATEGORIES.forEach((c) => {
          const chip = el("label", "cat-chip");
          const ccb = el("input");
          ccb.type = "checkbox";
          ccb.checked = !current || current.includes(c.id);
          ccb.addEventListener("change", () => {
            const boxes = [...catRow.querySelectorAll("input")];
            const enabled = CATEGORIES.map((x) => x.id).filter((_, i) => boxes[i].checked);
            setStopCats(view, s.stopId, enabled);
            store.saveView(view);
            notify();
          });
          chip.appendChild(ccb);
          chip.appendChild(el("span", null, c.label));
          catRow.appendChild(chip);
        });
        wrap.appendChild(catRow);
      }

      checks.appendChild(wrap);
    });
  };

  sel.addEventListener("change", () => {
    view.layout = sel.value;
    const def = LAYOUTS.find((l) => l.id === view.layout);
    if (view.stops.length > def.count) view.stops = view.stops.slice(0, def.count);
    store.saveView(view);
    renderChecks();
    updateHint();
    notify();
  });

  card.appendChild(checks);
  renderChecks();
  updateHint();

  // Löschen
  const del = el("button", "btn btn-danger", "View löschen");
  del.style.marginTop = "10px";
  del.addEventListener("click", () => {
    store.removeView(view.id);
    refreshViews();
    notify();
  });
  card.appendChild(del);

  return card;
}

/* ─── Abschnitt: Aktualisierung der Abfahrten ──────────────── */
function buildRefreshSection() {
  const sec = el("div", "settings-section");
  sec.appendChild(el("h2", null, "Aktualisierung"));

  const desc = el("div", "item-sub");
  desc.style.marginBottom = "8px";
  desc.textContent = "Wie oft die Abfahrten neu geladen werden.";
  sec.appendChild(desc);

  const field = el("div", "field");
  const sel = el("select");
  const options = [
    { v: 15, t: "alle 15 Sekunden" },
    { v: 30, t: "alle 30 Sekunden (Standard)" },
    { v: 60, t: "alle 60 Sekunden" },
    { v: 120, t: "alle 2 Minuten" },
    { v: 300, t: "alle 5 Minuten" },
  ];
  const current = store.getRefreshInterval();
  options.forEach((o) => {
    const opt = el("option", null, o.t);
    opt.value = o.v;
    if (o.v === current) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => {
    store.setRefreshInterval(Number(sel.value));
    toast("Aktualisierung gespeichert");
  });
  field.appendChild(sel);
  sec.appendChild(field);
  return sec;
}

/* ─── Abschnitt: Auto-Rotation ─────────────────────────────── */
function buildRotationSection() {
  const sec = el("div", "settings-section");
  sec.appendChild(el("h2", null, "Auto-Rotation"));

  const field = el("div", "field");
  const sel = el("select");
  const options = [
    { v: 0, t: "Aus (nur manuell per Tab)" },
    { v: 10, t: "alle 10 Sekunden" },
    { v: 20, t: "alle 20 Sekunden" },
    { v: 30, t: "alle 30 Sekunden" },
    { v: 60, t: "alle 60 Sekunden" },
  ];
  const current = store.getRotationInterval();
  options.forEach((o) => {
    const opt = el("option", null, o.t);
    opt.value = o.v;
    if (o.v === current) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => {
    store.setRotationInterval(Number(sel.value));
    toast("Rotation gespeichert");
  });
  field.appendChild(sel);
  sec.appendChild(field);
  return sec;
}

/* ─── partielle Re-Renders ─────────────────────────────────── */
function refreshStopsAndViews() {
  refreshStops();
  refreshViews();
}
function refreshStops() {
  const sec = document.getElementById("stops-section");
  if (!sec) return;
  sec.replaceChildren(el("h2", null, "Gespeicherte Haltestellen"), renderStopList(() => {}));
}
function refreshViews() {
  const sec = document.getElementById("views-section");
  if (!sec) return;
  sec.replaceChildren(el("h2", null, "Views"), renderViewsBody(() => {}));
}
