/* Lumora v0.1.0
 * Schnelle, abhängigkeitsfreie Karte: Startseite mit gefilterten Meldungen + Räume je Etage/Area + Kameras.
 * Einbindung: Ressource /local/lumora/lumora.js (Typ: JavaScript-Modul), Karte: type: custom:lumora-card (Panel-Ansicht). Optional: theme: forest.
 */
const VERSION = '0.1.0';
const KEY = 'lumora_panel';
const DEF = {
  alerts: { door: true, window: true, motion: true, smoke: true, alarm: true, lock: false },
  excludeEntities: [],
  excludeAreas: ['fahrzeug'],
  pinned: [],
  hidden: [],
  hiddenAreas: [],
};
const OUTDOOR = ['garten', 'aussenbereich_vorne', 'fahrzeug', 'system', 'allgemein'];
const DOM_ICON = {
  light: 'mdi:lightbulb', switch: 'mdi:toggle-switch', input_boolean: 'mdi:toggle-switch', cover: 'mdi:window-shutter',
  climate: 'mdi:thermostat', media_player: 'mdi:speaker', camera: 'mdi:cctv', fan: 'mdi:fan', lock: 'mdi:lock',
  vacuum: 'mdi:robot-vacuum', scene: 'mdi:palette', script: 'mdi:script-text', sensor: 'mdi:eye',
  binary_sensor: 'mdi:checkbox-blank-circle-outline', humidifier: 'mdi:air-humidifier',
};
const DC_ICON = {
  door: ['mdi:door-open', 'mdi:door-closed'], garage_door: ['mdi:garage-open', 'mdi:garage'],
  window: ['mdi:window-open-variant', 'mdi:window-closed-variant'], opening: ['mdi:square-outline', 'mdi:square-outline'],
  motion: ['mdi:motion-sensor', 'mdi:motion-sensor-off'], occupancy: ['mdi:motion-sensor', 'mdi:motion-sensor-off'],
  presence: ['mdi:account', 'mdi:account-off'], smoke: ['mdi:smoke-detector-variant-alert', 'mdi:smoke-detector-variant'],
  moisture: ['mdi:water-alert', 'mdi:water-off'], gas: ['mdi:gas-cylinder', 'mdi:gas-cylinder'],
  temperature: 'mdi:thermometer', humidity: 'mdi:water-percent', power: 'mdi:flash', co2: 'mdi:molecule-co2',
  illuminance: 'mdi:brightness-5', energy: 'mdi:lightning-bolt',
};
const INACTIVE = ['off', 'unavailable', 'unknown', 'idle', 'closed', 'locked', 'standby', 'disarmed', 'paused', 'docked', 'not_home', 'none'];
const ROOM_DOMAINS = ['light', 'switch', 'cover', 'climate', 'media_player', 'camera', 'fan', 'lock', 'vacuum', 'humidifier', 'scene', 'binary_sensor', 'sensor'];
const BS_CLASSES = ['door', 'window', 'opening', 'garage_door', 'motion', 'occupancy', 'smoke', 'moisture', 'gas'];
const SENSOR_CLASSES = ['power', 'co2', 'illuminance'];
const FLT = {
  all: null, light: ['light'], switch: ['switch', 'input_boolean', 'fan'], climate: ['climate'],
  camera: ['camera'], scene: ['scene', 'script'], sensor: ['sensor', 'binary_sensor'], media: ['media_player', 'vacuum'],
};
const FLT_LABEL = { all: 'Alle', light: 'Licht', switch: 'Schalter', climate: 'Klima', camera: 'Kamera', scene: 'Szene', sensor: 'Sensor', media: 'Medien' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dom = (id) => id.split('.')[0];
const merge = (v) => ({ ...DEF, ...v, alerts: { ...DEF.alerts, ...(v && v.alerts) } });
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'gerade eben';
  if (m < 60) return `seit ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `seit ${h} h` : `seit ${Math.floor(h / 24)} d`;
};
const cleanName = (n) => {
  let s = String(n || '').replace(/\s*(Motion Detected|Belegung|Bewegung|Person Detection|Motion Alarm)\s*$/i, '').trim();
  const w = s.split(' ');
  const half = w.length / 2;
  if (Number.isInteger(half) && w.slice(0, half).join(' ') === w.slice(half).join(' ')) s = w.slice(0, half).join(' ');
  return s;
};

const CSS = `
:host{display:block;height:calc(100vh - var(--header-height,56px));height:calc(100dvh - var(--header-height,56px));
 --fg:#3b3226;--fg2:rgba(59,50,38,.68);--a:rgba(110,88,56,.11);--b:rgba(255,255,255,.75);--from:#f2eadb;--to:#d6c5a8;
 --sheet:#f6f0e4;--selbg:#4a3c2b;--selfg:#f6f0e4;--accent:#e6b655;--accentfg:#3a2a00;--line:rgba(59,50,38,.12);--nav:rgba(255,255,255,.5);
 --bad:rgba(205,65,50,.25);--badfg:#7d1f16;--warn:rgba(224,160,40,.32);--okbg:rgba(100,150,80,.22);--scrim:rgba(40,30,15,.45);--shadow:0 1px 3px rgba(80,60,30,.14);
 color:var(--fg);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
:host([theme=forest]){--fg:#fff;--fg2:rgba(255,255,255,.72);--a:rgba(255,255,255,.12);--b:rgba(255,255,255,.2);--from:#5b7248;--to:#232f21;
 --sheet:#1f2a1e;--selbg:rgba(255,255,255,.88);--selfg:#223;--line:rgba(255,255,255,.1);--nav:rgba(0,0,0,.18);
 --bad:rgba(244,67,54,.5);--badfg:#fff;--warn:rgba(255,193,7,.28);--okbg:rgba(120,200,120,.25);--scrim:rgba(0,0,0,.55);--shadow:none}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.app{height:100%;display:flex;flex-direction:column;background:linear-gradient(165deg,var(--zp-from,var(--from)) 0%,var(--zp-to,var(--to)) 100%)}
.body{flex:1;overflow:auto;padding:20px 18px 16px}
.top{display:flex;align-items:center;gap:12px}
.logo{width:48px;height:48px;border-radius:14px;background:var(--a);display:grid;place-items:center}
.ttl{font-size:18px;font-weight:600;flex:1}
.pill{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:99px;background:var(--a);cursor:pointer;border:0;color:inherit;font:inherit;font-size:14px}
.pill.warn{background:var(--warn)}.pill.bad{background:var(--bad);color:var(--badfg)}.pill.ok{background:var(--okbg)}
.pill ha-icon{--mdc-icon-size:18px}
.meta{margin:26px 0 6px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg2)}
h1{margin:0 0 14px;font-size:clamp(42px,12vw,64px);line-height:1.05;font-weight:600;letter-spacing:-.02em}
.note{display:flex;gap:10px;align-items:center;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2);margin-bottom:14px;cursor:pointer}
.note ha-icon{--mdc-icon-size:20px;flex:none}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
h3{margin:22px 0 10px;font-size:13px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--fg2);display:flex;justify-content:space-between;align-items:center}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(min-width:760px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.card,.tile{background:var(--a);border-radius:18px;padding:14px;display:flex;gap:12px;align-items:center;min-width:0;position:relative;cursor:pointer}
.card{flex-direction:column;align-items:flex-start;gap:8px;min-height:92px}
.card b,.tile b{display:block;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card span,.tile span{font-size:12.5px;color:var(--fg2)}
.card ha-icon{--mdc-icon-size:24px}
.card.add{border:1.5px dashed var(--fg2);background:transparent;justify-content:center;align-items:center;flex-direction:row;color:var(--fg2)}
.x,.mini{border:0;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}
.card .x{position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff}
.mini{width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.1)}
.mini ha-icon{--mdc-icon-size:16px}
.pill .mini{width:20px;height:20px;margin:0 -6px 0 2px}
.tile .mini,.cam .mini{position:absolute;top:6px;right:6px}
.cam .mini{background:rgba(0,0,0,.55);color:#fff;top:8px;right:8px}
.hid{opacity:.45}
.tile .ic{width:42px;height:42px;border-radius:50%;background:var(--a);display:grid;place-items:center;flex:none}
.tile .tx{min-width:0;flex:1}
.tile.on{background:var(--b);box-shadow:var(--shadow)}.tile.on .ic{background:var(--accent);color:var(--accentfg)}
.tile.sens .ic{background:transparent}
.cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.cam{border-radius:18px;overflow:hidden;background:rgba(0,0,0,.3);position:relative;aspect-ratio:16/9;cursor:pointer}
.cam img{width:100%;height:100%;object-fit:cover;display:block}
.cam span.n{position:absolute;left:10px;bottom:8px;font-size:13px;background:rgba(0,0,0,.5);color:#fff;padding:3px 9px;border-radius:99px}
.tabs{display:flex;gap:8px;overflow:auto;padding-bottom:8px;margin:0 -2px}
.tabs .pill{white-space:nowrap}.pill.sel{background:var(--selbg);color:var(--selfg)}
.rh{display:flex;justify-content:space-between;align-items:center;margin:10px 0 12px;gap:10px}
.rh h2{margin:0;font-size:30px;font-weight:600}.rh .inf{font-size:14px;color:var(--fg2);display:flex;gap:10px;align-items:center}
.empty{color:var(--fg2);font-size:14px;padding:10px 0}
.nav{display:flex;gap:8px;padding:10px 14px calc(12px + env(safe-area-inset-bottom));background:var(--nav)}
.nav button{flex:1;border:0;background:transparent;color:var(--fg2);display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;font-size:12px;padding:6px;border-radius:99px;cursor:pointer}
.nav button.sel{background:var(--b);color:var(--fg)}.nav ha-icon{--mdc-icon-size:22px}
.sbg{position:absolute;inset:0;background:var(--scrim);display:flex;align-items:flex-end;justify-content:center;z-index:5}
.sheet{width:100%;max-width:560px;max-height:82%;overflow:auto;background:var(--sheet);border-radius:24px 24px 0 0;padding:18px 18px 28px}
.sheet h2{margin:0 0 12px;font-size:20px}.sheet h4{margin:18px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg2);font-weight:500}
.row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.row .t{flex:1;min-width:0}.row .t b{display:block;font-size:15px;font-weight:500}.row .t span{font-size:12.5px;color:var(--fg2)}
.row button{border:0;border-radius:99px;padding:7px 12px;background:var(--a);color:inherit;font:inherit;font-size:13px;cursor:pointer}
.row button.sel{background:var(--selbg);color:var(--selfg)}
.srch{width:100%;padding:12px 14px;border-radius:12px;border:0;background:var(--a);color:var(--fg);font:inherit;font-size:15px;margin-bottom:10px;outline:none}
.srch::placeholder{color:var(--fg2)}
`;

class LumoraCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._view = 'home'; this._floor = null; this._area = null; this._sheet = null;
    this._edit = false; this._q = ''; this._flt = 'all'; this._only = false; this._ai = 0;
    this._set = merge({}); this._loaded = false; this._sig = '';
    this.shadowRoot.addEventListener('click', (e) => this._click(e));
    this.shadowRoot.addEventListener('input', (e) => {
      if (e.target.classList.contains('srch')) { this._q = e.target.value; this._fillList(); }
    });
  }
  setConfig(cfg) {
    this._cfg = cfg || {};
    if (cfg && cfg.theme) this.setAttribute('theme', cfg.theme);
    if (cfg && cfg.color_from) this.style.setProperty('--zp-from', cfg.color_from);
    if (cfg && cfg.color_to) this.style.setProperty('--zp-to', cfg.color_to);
  }
  getCardSize() { return 12; }
  connectedCallback() {
    this._tick = setInterval(() => {
      const el = this.shadowRoot.querySelector('.note-t');
      const al = this._hass ? this._alerts() : [];
      if (el && al.length > 1) { this._ai = (this._ai + 1) % al.length; el.textContent = al[this._ai].text; }
    }, 5000);
  }
  disconnectedCallback() { clearInterval(this._tick); }

  set hass(h) {
    const first = !this._hass;
    this._hass = h;
    if (first) this._load();
    if (!this._loaded || this._sheet === 'add') return;
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      clearTimeout(this._rt);
      this._rt = setTimeout(() => this._render(), 200);
    }
  }
  _signature() {
    const h = this._hass; const parts = [this._view, this._floor, this._area, this._sheet, this._edit, Math.floor(Date.now() / 60000), this._set.pinned.length, this._set.hidden.length, this._set.hiddenAreas.length];
    const doms = ['light', 'media_player', 'vacuum', 'person', 'alarm_control_panel', 'lock', 'binary_sensor', 'camera', 'switch', 'cover', 'climate', 'fan'];
    for (const id in h.states) {
      const d = dom(id);
      if (doms.includes(d)) { const s = h.states[id]; parts.push(id + s.state + (d === 'climate' ? s.attributes.current_temperature : '')); }
      else if (this._view === 'rooms' && d === 'sensor') parts.push(id + h.states[id].state);
      else if (this._set.pinned.some((p) => p.entity === id)) parts.push(id + h.states[id].state);
    }
    return parts.join('|');
  }

  async _load() {
    try {
      const r = await this._hass.callWS({ type: 'frontend/get_user_data', key: KEY });
      if (r && r.value) this._set = merge(r.value);
    } catch (e) {
      try { const j = localStorage.getItem(KEY); if (j) this._set = merge(JSON.parse(j)); } catch (_) { /* ignore */ }
    }
    this._loaded = true; this._sig = this._signature(); this._render();
  }
  async _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this._set)); } catch (_) { /* ignore */ }
    try { await this._hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: this._set }); } catch (_) { /* ignore */ }
  }

  /* ---------- Daten ---------- */
  _areaOf(id) {
    const h = this._hass; const r = h.entities && h.entities[id];
    if (!r) return null;
    return r.area_id || (r.device_id && h.devices && h.devices[r.device_id] && h.devices[r.device_id].area_id) || null;
  }
  _aname(id) { const a = this._hass.areas && this._hass.areas[id]; return a ? a.name : ''; }
  _state(st) { try { return this._hass.formatEntityState ? this._hass.formatEntityState(st) : st.state; } catch (e) { return st.state; } }
  _icon(st) {
    const a = st.attributes; const d = dom(st.entity_id); const on = !INACTIVE.includes(st.state);
    if (a.icon) return a.icon;
    const dc = a.device_class;
    if ((d === 'binary_sensor' || d === 'sensor') && DC_ICON[dc]) return Array.isArray(DC_ICON[dc]) ? DC_ICON[dc][on ? 0 : 1] : DC_ICON[dc];
    if (d === 'light') return on ? 'mdi:lightbulb' : 'mdi:lightbulb-outline';
    if (d === 'cover') return st.state === 'open' ? 'mdi:window-shutter-open' : 'mdi:window-shutter';
    if (d === 'lock') return st.state === 'unlocked' ? 'mdi:lock-open' : 'mdi:lock';
    return DOM_ICON[d] || 'mdi:circle-outline';
  }
  _alerts() {
    const h = this._hass; const s = this._set; const out = []; const seen = new Set();
    for (const id in h.states) {
      const st = h.states[id]; const d = dom(id);
      if (d !== 'binary_sensor' && d !== 'alarm_control_panel' && d !== 'lock') continue;
      const reg = h.entities && h.entities[id];
      if (reg && reg.hidden) continue;
      if (s.excludeEntities.includes(id)) continue;
      const area = this._areaOf(id);
      if (area && s.excludeAreas.includes(area)) continue;
      const nm = st.attributes.friendly_name || id;
      const where = area ? this._aname(area) : cleanName(nm);
      let a = null;
      if (d === 'alarm_control_panel') {
        if (s.alerts.alarm && ['triggered', 'pending'].includes(st.state)) a = { sev: 0, text: st.state === 'triggered' ? 'Alarm ausgelöst' : 'Alarm wartet', icon: 'mdi:shield-alert', k: id };
      } else if (d === 'lock') {
        if (s.alerts.lock && st.state === 'unlocked') a = { sev: 1, text: `${nm} entsperrt`, icon: 'mdi:lock-open', k: id };
      } else if (st.state === 'on') {
        const dc = st.attributes.device_class;
        if (['smoke', 'gas', 'carbon_monoxide', 'moisture'].includes(dc) && s.alerts.smoke) a = { sev: 0, text: `${dc === 'smoke' ? 'Rauch' : dc === 'moisture' ? 'Wasser' : 'Gas'}: ${where}`, icon: this._icon(st), k: id };
        else if (['door', 'garage_door', 'opening'].includes(dc) && s.alerts.door) a = { sev: 1, text: `${nm} offen`, icon: this._icon(st), k: id };
        else if (dc === 'window' && s.alerts.window) a = { sev: 1, text: `${nm} offen`, icon: this._icon(st), k: id };
        else if (['motion', 'occupancy', 'moving'].includes(dc) && s.alerts.motion) {
          const key = 'm:' + where; if (seen.has(key)) continue; seen.add(key);
          a = { sev: 2, text: `Bewegung: ${where}`, icon: 'mdi:motion-sensor', k: id };
        }
      }
      if (a) out.push({ ...a, id, since: st.last_changed });
    }
    return out.sort((x, y) => x.sev - y.sev);
  }
  _byDomain() {
    const D = {};
    for (const id in this._hass.states) { const st = this._hass.states[id]; const r = this._hass.entities && this._hass.entities[id]; if (r && r.hidden) continue; (D[dom(id)] || (D[dom(id)] = [])).push(st); }
    return D;
  }

  /* ---------- Rendering ---------- */
  _render() {
    if (!this._hass || !this._loaded) return;
    const body = this._view === 'home' ? this._home() : this._view === 'rooms' ? this._rooms() : this._cams();
    const nav = [['home', 'mdi:home-outline', 'Zuhause'], ['rooms', 'mdi:view-grid-outline', 'Räume'], ['cams', 'mdi:cctv', 'Kameras']]
      .map(([v, i, l]) => `<button class="${this._view === v ? 'sel' : ''}" data-act="nav" data-v="${v}"><ha-icon icon="${i}"></ha-icon>${l}</button>`).join('');
    const scroll = this.shadowRoot.querySelector('.body'); const top = scroll ? scroll.scrollTop : 0;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="app" style="position:relative"><div class="body">${body}</div><div class="nav">${nav}</div>${this._sheetHtml()}</div>`;
    const nb = this.shadowRoot.querySelector('.body'); if (nb) nb.scrollTop = top;
    if (this._sheet === 'add') this._fillList();
  }
  _home() {
    const h = this._hass; const D = this._byDomain(); const al = this._alerts();
    const home = (D.person || []).filter((p) => p.state === 'home').length;
    const alarm = (D.alarm_control_panel || [])[0];
    const AL = { disarmed: 'Aus', armed_home: 'Zuhause', armed_away: 'Scharf', armed_night: 'Nacht', armed_vacation: 'Urlaub', triggered: 'ALARM', pending: 'Wartet', arming: 'Schaltet scharf' };
    const cl = (D.climate || []).map((c) => c.attributes.current_temperature).filter((v) => typeof v === 'number');
    const temp = cl.length ? (cl.reduce((a, b) => a + b, 0) / cl.length).toFixed(1) : null;
    const hu = (D.sensor || []).filter((s) => s.attributes.device_class === 'humidity' && !OUTDOOR.includes(this._areaOf(s.entity_id)) && !isNaN(parseFloat(s.state))).map((s) => parseFloat(s.state));
    const hum = hu.length ? Math.round(hu.reduce((a, b) => a + b, 0) / hu.length) : null;
    const lang = (h.locale && h.locale.language) || 'de';
    const date = new Date().toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
    const hr = new Date().getHours();
    const greet = hr < 5 ? 'Gute Nacht' : hr < 11 ? 'Guten Morgen' : hr < 17 ? 'Guten Tag' : hr < 22 ? 'Guten Abend' : 'Gute Nacht';
    const lights = (D.light || []).filter((l) => l.state === 'on');
    const meta = [date, temp && `${temp}° innen`, hum !== null && `${hum}% Luftfeuchtigkeit`].filter(Boolean).join(' • ');
    const ai = al.length ? this._ai % al.length : 0;
    const note = al.length
      ? `<div class="note" data-act="alerts"><ha-icon icon="${al[ai].icon}"></ha-icon><span class="note-t">${esc(al[ai].text)}</span></div>`
      : `<div class="note" data-act="alerts"><ha-icon icon="mdi:check-circle-outline"></ha-icon><span class="note-t">Alles in Ordnung</span></div>`;
    const apill = alarm ? `<button class="pill ${alarm.state === 'triggered' ? 'bad' : ''}" data-act="info" data-id="${alarm.entity_id}"><ha-icon icon="mdi:shield-home"></ha-icon>${esc(AL[alarm.state] || alarm.state)}</button>` : '';
    const pills = [
      lights.length ? `<button class="pill" data-act="lights"><ha-icon icon="mdi:lamp"></ha-icon>${lights.length} an</button>` : '',
      al.length ? `<button class="pill ${al.some((a) => a.sev === 0) ? 'bad' : 'warn'}" data-act="alerts"><ha-icon icon="mdi:bell-ring-outline"></ha-icon>${al.length} Meldung${al.length > 1 ? 'en' : ''}</button>` : '',
    ].join('');
    const cards = [];
    if (lights.length) {
      const names = [...new Set(lights.map((l) => this._aname(this._areaOf(l.entity_id))).filter(Boolean))].slice(0, 3).join(', ');
      cards.push(`<div class="card" data-act="lights"><ha-icon icon="mdi:lightbulb-group"></ha-icon><div><b>${lights.length} Licht${lights.length > 1 ? 'er' : ''} an</b><span>${esc(names)}</span></div></div>`);
    }
    (D.media_player || []).filter((m) => m.state === 'playing').forEach((m) => cards.push(this._card(m, m.attributes.media_title || 'Läuft')));
    (D.vacuum || []).filter((v) => v.state === 'cleaning').forEach((v) => cards.push(this._card(v, 'Saugt')));
    this._set.pinned.forEach((p) => {
      const st = h.states[p.entity]; if (!st) return;
      if (p.only && INACTIVE.includes(st.state)) return;
      cards.push(this._card(st, this._state(st), p.entity, this._edit));
    });
    cards.push(`<div class="card add" data-act="add"><ha-icon icon="mdi:plus"></ha-icon>Karte hinzufügen</div>`);
    return `<div class="top"><div class="logo"><ha-icon icon="mdi:home-variant"></ha-icon></div><div class="ttl">Lumora.</div>
      <button class="pill" data-act="nav" data-v="cams"><ha-icon icon="mdi:account-multiple"></ha-icon>${home}</button>${apill}</div>
      <div class="meta">${esc(meta)}</div><h1>${greet}</h1>${note}<div class="pills">${pills}</div>
      <h3>Aktiv jetzt<span class="pill" style="padding:5px 10px;font-size:12px" data-act="edit"><ha-icon icon="mdi:pencil"></ha-icon>${this._edit ? 'Fertig' : 'Bearbeiten'}</span></h3>
      <div class="grid">${cards.join('')}</div>`;
  }
  _card(st, sub, pinId, edit) {
    const x = edit && pinId ? `<span class="x" data-act="unpin" data-id="${pinId}"><ha-icon icon="mdi:close"></ha-icon></span>` : '';
    return `<div class="card" data-act="info" data-id="${st.entity_id}">${x}<ha-icon icon="${this._icon(st)}"></ha-icon><div><b>${esc(st.attributes.friendly_name || st.entity_id)}</b><span>${esc(sub)}</span></div></div>`;
  }
  _roomData() {
    const h = this._hass; const areas = {};
    for (const id in h.states) {
      const d = dom(id); if (!ROOM_DOMAINS.includes(d)) continue;
      const r = h.entities && h.entities[id]; if (!r || r.hidden || r.entity_category) continue;
      const a = this._areaOf(id); if (!a) continue;
      if (this._set.hidden.includes(id) && !this._edit) continue;
      const st = h.states[id]; const dc = st.attributes.device_class;
      if (d === 'binary_sensor' && !BS_CLASSES.includes(dc)) continue;
      if (d === 'sensor' && !['temperature', 'humidity', ...SENSOR_CLASSES].includes(dc)) continue;
      (areas[a] || (areas[a] = [])).push(st);
    }
    const floors = {};
    const fl = h.floors || {};
    Object.keys(areas).forEach((aid) => {
      if (this._set.hiddenAreas.includes(aid) && !this._edit) return;
      const fid = (h.areas && h.areas[aid] && h.areas[aid].floor_id) || '_';
      (floors[fid] || (floors[fid] = { id: fid, name: fid === '_' ? 'Sonstige' : (fl[fid] && fl[fid].name) || fid, level: fid === '_' ? 99 : (fl[fid] && fl[fid].level) ?? 50, areas: [] })).areas.push({ id: aid, name: this._aname(aid) || aid, ents: areas[aid] });
    });
    const list = Object.values(floors).sort((a, b) => a.level - b.level);
    list.forEach((f) => f.areas.sort((a, b) => a.name.localeCompare(b.name, 'de')));
    return list;
  }
  _rooms() {
    const floors = this._roomData();
    if (!floors.length) return `<div class="empty">Keine Räume gefunden. Weise Entitäten in Home Assistant Bereichen zu.</div>`;
    let f = floors.find((x) => x.id === this._floor) || floors.find((x) => /eg|erd/i.test(x.id + x.name)) || floors[0];
    this._floor = f.id;
    let a = f.areas.find((x) => x.id === this._area) || f.areas[0]; this._area = a.id;
    const ftabs = floors.map((x) => `<button class="pill ${x.id === f.id ? 'sel' : ''}" data-act="floor" data-id="${x.id}">${esc(x.name)}</button>`).join('');
    const atabs = f.areas.map((x) => { const hd = this._set.hiddenAreas.includes(x.id); return `<button class="pill ${x.id === a.id ? 'sel' : ''} ${hd ? 'hid' : ''}" data-act="area" data-id="${x.id}">${esc(x.name)}${this._edit ? `<span class="mini" data-act="hidearea" data-id="${x.id}"><ha-icon icon="${hd ? 'mdi:eye' : 'mdi:eye-off'}"></ha-icon></span>` : ''}</button>`; }).join('');
    const ents = a.ents; const info = [];
    const t = ents.find((s) => s.attributes.device_class === 'temperature' && !isNaN(parseFloat(s.state)));
    const c = ents.find((s) => dom(s.entity_id) === 'climate' && typeof s.attributes.current_temperature === 'number');
    const hu = ents.find((s) => s.attributes.device_class === 'humidity' && !isNaN(parseFloat(s.state)));
    if (t) info.push(`${parseFloat(t.state).toFixed(1)}°`); else if (c) info.push(`${c.attributes.current_temperature.toFixed(1)}°`);
    if (hu) info.push(`${Math.round(parseFloat(hu.state))}%`);
    const cams = ents.filter((s) => dom(s.entity_id) === 'camera' && s.state !== 'unavailable');
    const tiles = ents.filter((s) => dom(s.entity_id) !== 'camera' && !['temperature', 'humidity'].includes(s.attributes.device_class))
      .sort((x, y) => ROOM_DOMAINS.indexOf(dom(x.entity_id)) - ROOM_DOMAINS.indexOf(dom(y.entity_id)))
      .map((s) => this._tile(s, a.name)).join('');
    return `<div class="tabs">${ftabs}</div><div class="tabs">${atabs}</div>
      <div class="rh"><h2>${esc(a.name)}</h2><div class="inf"><span>${info.join(' · ')}</span>${this._editBtn()}</div></div>
      ${cams.length ? `<div class="cams" style="margin-bottom:10px">${cams.map((s) => this._camHtml(s)).join('')}</div>` : ''}
      <div class="grid">${tiles || '<div class="empty">Keine Geräte in diesem Raum.</div>'}</div>`;
  }
  _editBtn() { return `<button class="pill" data-act="edit"><ha-icon icon="mdi:pencil"></ha-icon>${this._edit ? 'Fertig' : 'Bearbeiten'}</button>`; }
  _hideBtn(id) { const hd = this._set.hidden.includes(id); return this._edit ? `<span class="mini" data-act="hidee" data-id="${id}"><ha-icon icon="${hd ? 'mdi:eye' : 'mdi:eye-off'}"></ha-icon></span>` : ''; }
  _tile(st, area) {
    const d = dom(st.entity_id); const on = !INACTIVE.includes(st.state);
    let n = st.attributes.friendly_name || st.entity_id;
    if (n.toLowerCase().startsWith(area.toLowerCase() + ' ') && n.length > area.length + 1) n = n.slice(area.length + 1);
    const sens = d === 'sensor' ? 'sens' : '';
    const bad = d === 'binary_sensor' && st.state === 'on' && ['door', 'window', 'opening', 'smoke', 'moisture', 'gas'].includes(st.attributes.device_class);
    return `<div class="tile ${on || bad ? 'on' : ''} ${sens} ${this._set.hidden.includes(st.entity_id) ? 'hid' : ''}">${this._hideBtn(st.entity_id)}<div class="ic" data-act="toggle" data-id="${st.entity_id}"><ha-icon icon="${this._icon(st)}"></ha-icon></div>
      <div class="tx" data-act="info" data-id="${st.entity_id}"><b>${esc(n)}</b><span>${esc(this._state(st))}</span></div></div>`;
  }
  _camHtml(st) {
    const src = st.attributes.entity_picture || '';
    return `<div class="cam ${this._set.hidden.includes(st.entity_id) ? 'hid' : ''}" data-act="info" data-id="${st.entity_id}">${src ? `<img loading="lazy" src="${esc(src)}" alt="">` : ''}${this._hideBtn(st.entity_id)}<span class="n">${esc(cleanName(st.attributes.friendly_name))}</span></div>`;
  }
  _cams() {
    const cams = (this._byDomain().camera || []).filter((s) => s.state !== 'unavailable' && (this._edit || !this._set.hidden.includes(s.entity_id)));
    return `<div class="rh"><h2>Kameras</h2><div class="inf"><span>${cams.length}</span>${this._editBtn()}</div></div><div class="cams">${cams.map((s) => this._camHtml(s)).join('') || '<div class="empty">Keine Kameras verfügbar.</div>'}</div>`;
  }

  /* ---------- Sheets ---------- */
  _sheetHtml() {
    if (!this._sheet) return '';
    let c = '';
    if (this._sheet === 'alerts') {
      const al = this._alerts(); const s = this._set;
      const CAT = [['door', 'Türen'], ['window', 'Fenster'], ['motion', 'Bewegung'], ['smoke', 'Rauch / Wasser / Gas'], ['alarm', 'Alarmanlage'], ['lock', 'Schloss entsperrt']];
      c = `<h2>Meldungen</h2>${al.map((a) => `<div class="row"><ha-icon icon="${a.icon}"></ha-icon><div class="t"><b>${esc(a.text)}</b><span>${ago(a.since)}</span></div><button data-act="hide" data-id="${a.id}">Ausblenden</button></div>`).join('') || '<div class="empty">Keine aktiven Meldungen.</div>'}
        <h4>Was gemeldet wird</h4>${CAT.map(([k, l]) => `<div class="row"><div class="t"><b>${l}</b></div><button class="${s.alerts[k] ? 'sel' : ''}" data-act="cat" data-k="${k}">${s.alerts[k] ? 'An' : 'Aus'}</button></div>`).join('')}
        <h4>Räume von Meldungen ausnehmen</h4>${Object.keys(this._hass.areas || {}).sort((x, y) => this._aname(x).localeCompare(this._aname(y), 'de')).map((id) => `<div class="row"><div class="t"><b>${esc(this._aname(id))}</b></div><button class="${s.excludeAreas.includes(id) ? '' : 'sel'}" data-act="exarea" data-id="${id}">${s.excludeAreas.includes(id) ? 'Aus' : 'Gemeldet'}</button></div>`).join('')}
        ${s.excludeEntities.length ? `<h4>Ausgeblendet</h4>${s.excludeEntities.map((id) => `<div class="row"><div class="t"><b>${esc((this._hass.states[id] && this._hass.states[id].attributes.friendly_name) || id)}</b></div><button data-act="unhide" data-id="${id}">Einblenden</button></div>`).join('')}` : ''}`;
    } else if (this._sheet === 'lights') {
      const l = (this._byDomain().light || []).filter((x) => x.state === 'on');
      c = `<h2>Lichter an</h2>${l.map((x) => `<div class="row"><ha-icon icon="mdi:lightbulb"></ha-icon><div class="t"><b>${esc(x.attributes.friendly_name)}</b><span>${esc(this._aname(this._areaOf(x.entity_id)))}</span></div><button data-act="toggle" data-id="${x.entity_id}">Aus</button></div>`).join('') || '<div class="empty">Alle Lichter sind aus.</div>'}
        ${l.length ? '<div class="row" style="border:0"><button class="sel" data-act="lightsoff">Alle ausschalten</button></div>' : ''}`;
    } else if (this._sheet === 'add') {
      c = `<h2>Karte hinzufügen</h2><input class="srch" placeholder="Entität suchen" value="${esc(this._q)}">
        <div class="tabs">${Object.keys(FLT).map((k) => `<button class="pill ${this._flt === k ? 'sel' : ''}" data-act="flt" data-k="${k}">${FLT_LABEL[k]}</button>`).join('')}</div>
        <div class="row"><div class="t"><b>Nur anzeigen, wenn aktiv</b><span>Karte erscheint nur bei Zustand an, offen oder läuft</span></div><button class="${this._only ? 'sel' : ''}" data-act="onlyact">${this._only ? 'An' : 'Aus'}</button></div>
        <div class="list"></div>`;
    }
    return `<div class="sbg" data-act="close"><div class="sheet" data-act="noop">${c}</div></div>`;
  }
  _fillList() {
    const el = this.shadowRoot.querySelector('.list'); if (!el) return;
    const q = this._q.toLowerCase(); const f = FLT[this._flt];
    const pinned = this._set.pinned.map((p) => p.entity);
    const res = Object.values(this._hass.states).filter((s) => {
      const d = dom(s.entity_id); if (f ? !f.includes(d) : !ROOM_DOMAINS.concat(['script', 'input_boolean']).includes(d)) return false;
      const r = this._hass.entities && this._hass.entities[s.entity_id]; if (r && (r.hidden || r.entity_category)) return false;
      return !q || s.entity_id.toLowerCase().includes(q) || (s.attributes.friendly_name || '').toLowerCase().includes(q);
    }).slice(0, 40);
    el.innerHTML = res.map((s) => `<div class="row" data-act="pick" data-id="${s.entity_id}"><ha-icon icon="${this._icon(s)}"></ha-icon><div class="t"><b>${esc(s.attributes.friendly_name || s.entity_id)}</b><span>${esc(s.entity_id)}${pinned.includes(s.entity_id) ? ' · angepinnt' : ''}</span></div></div>`).join('') || '<div class="empty">Nichts gefunden.</div>';
  }

  /* ---------- Aktionen ---------- */
  _click(e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act; const id = t.dataset.id; const h = this._hass; const s = this._set;
    if (act === 'noop') return;
    e.stopPropagation();
    switch (act) {
      case 'nav': this._view = t.dataset.v; this._sheet = null; this._edit = false; break;
      case 'floor': this._floor = id; this._area = null; break;
      case 'area': this._area = id; break;
      case 'info': this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true })); return;
      case 'toggle': {
        const d = dom(id);
        if (['light', 'switch', 'fan', 'input_boolean', 'humidifier'].includes(d)) h.callService('homeassistant', 'toggle', { entity_id: id });
        else if (d === 'cover') h.callService('cover', 'toggle', { entity_id: id });
        else if (d === 'scene' || d === 'script') h.callService(d, 'turn_on', { entity_id: id });
        else this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true }));
        return;
      }
      case 'alerts': this._sheet = 'alerts'; break;
      case 'lights': this._sheet = 'lights'; break;
      case 'lightsoff': h.callService('light', 'turn_off', { entity_id: (this._byDomain().light || []).filter((x) => x.state === 'on').map((x) => x.entity_id) }); this._sheet = null; break;
      case 'close': this._sheet = null; break;
      case 'cat': s.alerts[t.dataset.k] = !s.alerts[t.dataset.k]; this._save(); break;
      case 'hide': if (!s.excludeEntities.includes(id)) s.excludeEntities.push(id); this._save(); break;
      case 'unhide': s.excludeEntities = s.excludeEntities.filter((x) => x !== id); this._save(); break;
      case 'add': this._sheet = 'add'; this._q = ''; this._flt = 'all'; break;
      case 'flt': this._flt = t.dataset.k; this._render(); return;
      case 'onlyact': this._only = !this._only; this._render(); return;
      case 'pick': if (!s.pinned.some((p) => p.entity === id)) s.pinned.push({ entity: id, only: this._only }); this._save(); this._sheet = null; this._only = false; break;
      case 'unpin': s.pinned = s.pinned.filter((p) => p.entity !== id); this._save(); break;
      case 'edit': this._edit = !this._edit; break;
      case 'hidee': s.hidden = s.hidden.includes(id) ? s.hidden.filter((x) => x !== id) : [...s.hidden, id]; this._save(); break;
      case 'hidearea': s.hiddenAreas = s.hiddenAreas.includes(id) ? s.hiddenAreas.filter((x) => x !== id) : [...s.hiddenAreas, id]; this._save(); break;
      case 'exarea': s.excludeAreas = s.excludeAreas.includes(id) ? s.excludeAreas.filter((x) => x !== id) : [...s.excludeAreas, id]; this._save(); break;
      default: return;
    }
    this._sig = ''; this._render();
  }
}

if (!customElements.get('lumora-card')) customElements.define('lumora-card', LumoraCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'lumora-card', name: 'Lumora', description: `Startseite, Räume und Kameras (v${VERSION})` });
