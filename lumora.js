/* Lumora v0.1.0
 * Schnelle, abhängigkeitsfreie Karte: Startseite mit gefilterten Meldungen + Räume je Etage/Area + Kameras.
 * Einbindung: Ressource /local/lumora/lumora.js (Typ: JavaScript-Modul), Karte: type: custom:lumora-card (Panel-Ansicht). Optional: theme: forest.
 */
const VERSION = '0.1.0';
const KEY = 'lumora_panel';
const DEF = {
  alerts: { door: true, window: true, motion: true, smoke: true, alarm: true, lock: false, weather: true },
  excludeEntities: [],
  excludeAreas: ['fahrzeug'],
  pinned: [],
  hidden: [],
  hiddenAreas: [],
  order: {},
  roomSensors: {},
};
const ENERGY = {
  pv: 'sensor.solarwatt_flow_pv_out', consumption: 'sensor.solarwatt_flow_consumption_in',
  grid_in: 'sensor.solarwatt_flow_grid_in', grid_out: 'sensor.solarwatt_flow_grid_out',
  battery_in: 'sensor.solarwatt_flow_battery_in', battery_out: 'sensor.solarwatt_flow_battery_out',
  soc: 'sensor.solarwatt_battery_soc', forecast: 'sensor.solcast_pv_forecast_prognose_spitzenleistung_heute',
};
const APPLIANCES = [
  { base: 'sensor.waschkuche_waschmaschine', title: 'Waschmaschine', icon: 'mdi:washing-machine', hint: 'Wäsche entnehmen' },
  { base: 'sensor.waschkuche_trockner', title: 'Trockner', icon: 'mdi:tumble-dryer', hint: 'Wäsche entnehmen' },
  { base: 'sensor.kuche_spulmaschine', title: 'Spülmaschine', icon: 'mdi:dishwasher', hint: 'Geschirr ausräumen' },
];
const INFO = {
  ice: 'sensor.system_eiswarnung', bike: 'sensor.fahrrad_wetter', pollen: 'sensor.polleninformation_stuttgart_allergy_risk',
  travel: [['Steffen zur Arbeit', 'sensor.system_steffen_heimerdingen_steffen'], ['Katharina zur Arbeit', 'sensor.system_katharina_arbeitsweg_katharina'], ['Katharina nach Hause', 'sensor.katharina_heimweg']],
  trains: [['Korntal → Feuerbach', 'sensor.korntal_to_feuerbach'], ['Feuerbach → Korntal', 'sensor.feuerbach_1_to_korntal_1']],
};
const EXTRA = {
  packages: 'sensor.paket_dashboard', tank: 'sensor.tankzeit',
  pool_temp: 'sensor.layzspa_temp_c', pool_power: 'sensor.layzspa_power', pool_pump: 'switch.layzspa_pump', pool_heat: 'switch.layzspa_heat_regulation',
  printer_status: 'sensor.ender3v3ke_c8c6_print_status', printer_progress: 'sensor.ender3v3ke_c8c6_print_progress', printer_left: 'sensor.ender3v3ke_c8c6_print_time_left',
  printer_nozzle: 'sensor.ender3v3ke_c8c6_nozzle_temperature', printer_bed: 'sensor.ender3v3ke_c8c6_bed_temperature', printer_cam: 'camera.ender3v3ke_c8c6_printer_camera',
  health: 'sensor.system_ha_global_health_score', pihole_ratio: 'sensor.pi_hole_anteil_blockierter_anzeigen', pihole_queries: 'sensor.pi_hole_dns_abfragen',
  pihole_clients: 'sensor.pi_hole_gesehene_clients', pihole_switch: 'switch.pi_hole', lage: 'sensor.deutschland_lage_score',
  gas: 'sensor.gas_value', water: 'sensor.homeassistant_counter_watermeter_value', meter: 'sensor.bitshake_smartmeterreader_mt631_power',
  saving_total: 'sensor.gesamt_pv_ersparnis', saving_year: 'sensor.eedc_zuhause_jahresersparnis',
};
const WXL = { 'clear-night': 'Klare Nacht', sunny: 'Sonnig', cloudy: 'Bewölkt', partlycloudy: 'Teils bewölkt', rainy: 'Regen', pouring: 'Starkregen', snowy: 'Schnee', fog: 'Nebel', windy: 'Windig', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter mit Regen', hail: 'Hagel', exceptional: 'Außergewöhnlich' };
const APL = { wash: 'Wäscht', washing: 'Wäscht', rinse: 'Spült', spin: 'Schleudert', drying: 'Trocknet', run: 'Läuft', running: 'Läuft', finished: 'Fertig', end: 'Fertig', pause: 'Pausiert', paused: 'Pausiert', ready: 'Bereit', idle: 'Bereit', off: 'Aus' };
const DHL = ['Angekündigt', 'Unterwegs', 'In der Region', 'Zustellbasis', 'In Zustellung', 'Zugestellt'];
const WX = {
  'clear-night': 'mdi:weather-night', sunny: 'mdi:weather-sunny', cloudy: 'mdi:weather-cloudy', partlycloudy: 'mdi:weather-partly-cloudy',
  rainy: 'mdi:weather-rainy', pouring: 'mdi:weather-pouring', snowy: 'mdi:weather-snowy', fog: 'mdi:weather-fog', windy: 'mdi:weather-windy',
  lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy', hail: 'mdi:weather-hail',
};
const VAC = { docked: 'In der Station', cleaning: 'Saugt', returning: 'Fährt zur Station', paused: 'Pausiert', idle: 'Bereit', error: 'Fehler', unavailable: 'Nicht verfügbar' };
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
const merge = (v) => {
  v = v || {};
  const arr = (k) => [...(v[k] || DEF[k])];
  return { alerts: { ...DEF.alerts, ...v.alerts }, excludeEntities: arr('excludeEntities'), excludeAreas: arr('excludeAreas'), pinned: arr('pinned'), hidden: arr('hidden'), hiddenAreas: arr('hiddenAreas'), order: { ...v.order }, roomSensors: JSON.parse(JSON.stringify(v.roomSensors || {})) };
};
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
h1{margin:0;font-size:clamp(26px,7.4vw,38px);line-height:1.1;font-weight:600;letter-spacing:-.02em}
.hello{display:flex;gap:14px;align-items:center;margin:14px 0 14px}.hello .sub{font-size:14px;color:var(--fg2);margin-top:4px}
.av{width:42px;height:42px;border-radius:50%;background:var(--b);display:grid;place-items:center;position:relative;font-weight:600;flex:none}
.av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.av i{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#9a9a9a;border:2px solid var(--from)}
.hello .av{width:64px;height:64px;font-size:24px}.pp.home .av i{background:#4caf50}
.pps{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}
.pp{display:flex;align-items:center;gap:10px;background:var(--a);border-radius:99px;padding:5px 16px 5px 5px;cursor:pointer}
.pp b{display:block;font-size:14px;font-weight:600}.pp span{font-size:12px;color:var(--fg2)}
.en{background:var(--a);border-radius:20px;padding:16px;cursor:pointer}
.en .hd{display:flex;align-items:center;gap:12px}.en .ib{width:44px;height:44px;border-radius:14px;background:var(--b);display:grid;place-items:center;flex:none}
.en .hd b{display:block;font-size:16px;font-weight:600}.en .hd span{font-size:12.5px;color:var(--fg2)}
.en .big{margin-left:auto;font-size:30px;font-weight:600;white-space:nowrap}
.en .rw{margin-top:12px}.en .rl{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px}
.en .rl span:last-child{font-weight:600}.en .rl ha-icon{--mdc-icon-size:18px;margin-right:6px}
.bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:6px}.bar i{display:block;height:100%;border-radius:99px;background:var(--accent)}
.bar.g i{background:#8da3b8}.bar.b i{background:#82b06c}
.cl,.vc{background:var(--a);border-radius:20px;padding:14px;display:flex;gap:10px;min-height:156px;position:relative;min-width:0}
.cl.heat{background:rgba(226,140,70,.2)}.cl.hid,.vc.hid{opacity:.45}
.clm,.vm{flex:1;min-width:0;display:flex;flex-direction:column;cursor:pointer}
.clt{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);margin-bottom:auto}
.clt ha-icon{--mdc-icon-size:22px;color:var(--fg)}.clt em{font-style:normal;margin-left:auto}
.cv{font-size:34px;font-weight:600;letter-spacing:-.02em;margin-top:10px}.cn{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cs{font-size:12px;color:var(--fg2);margin-top:2px}
.vs{position:relative;width:46px;flex:none;border-radius:23px;background:var(--line);touch-action:none;cursor:ns-resize;user-select:none}
.vf{position:absolute;left:0;right:0;bottom:0;border-radius:23px;background:var(--b)}
.vt{position:absolute;left:5px;width:36px;height:36px;border-radius:50%;background:#fff;color:#222;display:grid;place-items:center;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.vt i{font-style:normal;font-size:11px;font-weight:600}
.vm ha-icon{--mdc-icon-size:26px;margin-bottom:auto}.vm b{font-size:15px;font-weight:600;display:block;margin-top:10px}.vm span{font-size:12.5px;color:var(--fg2)}
.vc.run{background:rgba(120,170,110,.25)}.vb{display:flex;flex-direction:column;gap:8px;justify-content:center}
.cl .tools{top:8px;right:68px}.cl .x{top:8px;left:8px}

.mw{position:relative;min-width:0}.mw.wide{grid-column:1/-1}.mw.hid{opacity:.45}
.mw .tools{position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:2}
.ap{background:var(--a);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px;cursor:pointer;min-height:92px;min-width:0}
.ap.run{background:rgba(70,170,190,.22)}.ap .h{display:flex;gap:10px;align-items:center}.ap ha-icon{--mdc-icon-size:26px;flex:none}
.ap b{display:block;font-size:15px;font-weight:600}.ap span{font-size:12.5px;color:var(--fg2)}
.pl{background:var(--a);border-radius:20px;padding:14px;min-height:140px;display:flex;flex-direction:column;position:relative;min-width:0}
.pl.on{background:var(--b);box-shadow:var(--shadow)}
.plt{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);cursor:pointer}
.plt ha-icon{--mdc-icon-size:24px;color:var(--fg)}.plt em{font-style:normal;margin-left:auto}
.plv{font-size:30px;font-weight:600;margin-top:auto;cursor:pointer}.plv small{font-size:16px;font-weight:500;color:var(--fg2);margin-left:4px}
.pl .cn{margin-top:2px}.pl .cs{margin-top:8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.pkr{margin-top:12px}.pkr b{display:block;font-size:14px}.pkr span{font-size:12.5px;color:var(--fg2)}
.en img{width:100%;border-radius:12px;display:block;margin-top:12px;aspect-ratio:16/9;object-fit:cover}
.en .pills{margin:12px 0 0}
.sq{width:46px;height:46px;border-radius:14px;border:0;background:var(--b);color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}
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
.x{position:absolute;top:6px;left:6px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;z-index:2}
.mini{width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.1)}
.mini ha-icon{--mdc-icon-size:16px}
.pill .tools{display:inline-flex;gap:3px;margin-left:8px}.pill .tools .mini{width:22px;height:22px}
.hint{font-size:12.5px;color:var(--fg2);background:var(--a);border-radius:12px;padding:8px 12px;margin:0 0 10px}
.tile .tools,.cam .tools,.vc .tools,.cl .tools{position:absolute;top:6px;right:6px;display:flex;gap:4px;z-index:2}
.hid{opacity:.45}
.tools .mini{width:36px;height:36px;background:rgba(40,30,20,.72);color:#fff}.tools .mini ha-icon{--mdc-icon-size:20px}
.pill .tools .mini{width:26px;height:26px}.pill .tools .mini ha-icon{--mdc-icon-size:16px}
:host(.ed) .tile,:host(.ed) .card,:host(.ed) .pl,:host(.ed) .cam,:host(.ed) .pill,:host(.ed) .mw,:host(.ed) .vc,:host(.ed) .cl,:host(.ed) .ap{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;cursor:grab}
:host(.ed) .tile{padding-right:54px}:host(.ed) .plt em{margin-right:42px}
.dgo{z-index:50!important;box-shadow:0 12px 30px rgba(0,0,0,.35)!important;opacity:.92;transition:none!important;pointer-events:none}
.dgt{outline:3px solid var(--fg)!important;outline-offset:-3px}
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
    this.shadowRoot.addEventListener('pointerdown', (e) => {
      this._down = true;
      if (this._edit) { this._dgStart(e); return; }
      const v = e.target.closest && e.target.closest('.vs'); if (!v) return;
      e.preventDefault(); this._drag = { el: v, id: v.dataset.id, min: +v.dataset.min, max: +v.dataset.max, step: +v.dataset.step, val: null };
      try { v.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      this._dragTo(e);
    });
    this.shadowRoot.addEventListener('pointermove', (e) => { if (this._dg) this._dgMove(e); else if (this._drag) this._dragTo(e); });
    this.shadowRoot.addEventListener('touchmove', (e) => { if (this._dg && this._dg.on && e.cancelable) e.preventDefault(); }, { passive: false });
    this.shadowRoot.addEventListener('contextmenu', (e) => { if (this._edit) e.preventDefault(); });
    const end = (e) => {
      this._down = false;
      if (this._dg) { this._dgEnd(e); return; }
      if (this._pend) { this._pend = false; this._sig = ''; this.hass = this._hass; }
      const d = this._drag; if (!d) return; this._drag = null;
      if (d.val !== null) this._hass.callService('climate', 'set_temperature', { entity_id: d.id, temperature: d.val });
      setTimeout(() => this._render(), 400);
    };
    this.shadowRoot.addEventListener('pointerup', end);
    this.shadowRoot.addEventListener('pointercancel', end);
    this.shadowRoot.addEventListener('input', (e) => {
      if (e.target.classList.contains('srch')) { this._q = e.target.value; this._fillList(); }
    });
  }
  setConfig(cfg) {
    this._cfg = cfg || {};
    this._eids = [...Object.values({ ...ENERGY, ...((cfg && cfg.energy) || {}) }), ...Object.values({ ...EXTRA, ...((cfg && cfg.extras) || {}) }),
      ...((cfg && cfg.appliances) || APPLIANCES).flatMap((a) => ['zustand', 'programm', 'fortschritt', 'verbleibende_zeit'].map((k) => `${a.base}_${k}`))];
    const inf = { ...INFO, ...((cfg && cfg.info) || {}) };
    this._eids.push(inf.ice, inf.bike, inf.pollen, ...inf.travel.map((x) => x[1]), ...inf.trains.map((x) => x[1]));
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
    if (!this._loaded || this._sheet === 'add' || this._drag || this._dg) return;
    if (this._down && this._edit) { this._pend = true; return; }
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      clearTimeout(this._rt);
      this._rt = setTimeout(() => this._render(), 200);
    }
  }
  _signature() {
    const h = this._hass; const parts = [this._view, this._floor, this._area, this._sheet, this._edit, Math.floor(Date.now() / 60000), this._set.pinned.length, this._set.hidden.length, this._set.hiddenAreas.length];
    const doms = ['weather', 'light', 'media_player', 'vacuum', 'person', 'alarm_control_panel', 'lock', 'binary_sensor', 'camera', 'switch', 'cover', 'climate', 'fan'];
    for (const id in h.states) {
      const d = dom(id);
      if (d === 'camera' && this._view === 'cams') continue;
      if (doms.includes(d)) { const s = h.states[id]; parts.push(id + s.state + (d === 'climate' ? `${s.attributes.current_temperature}/${s.attributes.temperature}/${s.attributes.hvac_action}` : '')); }
      else if (this._view === 'rooms' && d === 'sensor') parts.push(id + h.states[id].state);
      else if (d === 'sensor' && (h.states[id].attributes.warning_count !== undefined || h.states[id].attributes.is_ice_warning !== undefined)) parts.push(id + h.states[id].state + h.states[id].attributes.warning_count);
      else if ((this._eids || []).includes(id)) parts.push(id + h.states[id].state);
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
    if (s.alerts.weather) out.push(...this._warnAlerts());
    return out.sort((x, y) => x.sev - y.sev);
  }
  _inf() { return { ...INFO, ...((this._cfg && this._cfg.info) || {}) }; }
  _ok(st) { return !!st && !['unavailable', 'unknown', ''].includes(st.state); }
  _ice() {
    const h = this._hass; let st = h.states[this._inf().ice];
    if (!st) st = Object.values(h.states).find((x) => x.attributes && x.attributes.is_ice_warning !== undefined);
    return st ? { id: st.entity_id, warn: st.attributes.is_ice_warning === true, possible: st.attributes.is_ice_possible === true } : null;
  }
  _when(start, end) {
    const now = new Date(); const f = (d) => { const t = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? t : `${d.toLocaleDateString('de-DE', { weekday: 'short' })} ${t}`; };
    const a = start ? new Date(start) : null; const b = end ? new Date(end) : null;
    if (a && a > now) return `ab ${f(a)}`; return b ? `bis ${f(b)}` : '';
  }
  _warns() {
    const h = this._hass; const out = []; const seen = new Set();
    const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    for (const id in h.states) {
      const st = h.states[id]; const a = st.attributes || {}; const d = dom(id);
      if (d === 'sensor' && a.warning_count > 0) {
        for (let i = 1; i <= a.warning_count; i++) {
          const w = a[`warning_${i}`]; if (!w) continue;
          let title = clean(w.headline || w.event || 'Warnung').replace(/^amtliche\s+\S*warnung\s+vor\s+/i, '');
          if (title === title.toUpperCase()) title = title.charAt(0) + title.slice(1).toLowerCase();
          const key = title + w.start_time; if (seen.has(key)) continue; seen.add(key);
          const lv = w.level || 1;
          out.push({ kind: 'dwd', id, sev: lv >= 3 ? 0 : 1, title, sub: this._when(w.start_time, w.end_time), desc: clean(w.description).slice(0, 220), ins: '', icon: /frost|eis|glatt/i.test(title) ? 'mdi:snowflake-alert' : 'mdi:weather-cloudy-alert', since: st.last_changed });
        }
      } else if (d === 'binary_sensor' && st.state === 'on' && (a.headline || /warnung_\d+$/.test(id)) && (a.sender !== undefined || a.headline !== undefined)) {
        const sv = String(a.severity || '').toLowerCase();
        out.push({ kind: 'nina', id, sev: ['extreme', 'severe'].includes(sv) ? 0 : 1, title: clean(a.headline || a.friendly_name), sub: this._when(a.start, a.expires), desc: clean(a.description).slice(0, 220), ins: '', icon: 'mdi:alert-octagon-outline', since: st.last_changed });
      }
    }
    return out;
  }
  _warnAlerts() {
    const s = this._set; const out = [];
    this._warns().forEach((w) => { if (s.excludeEntities.includes(w.id)) return; out.push({ sev: w.sev, text: `${w.kind === 'nina' ? 'NINA' : 'DWD'}: ${w.title}${w.sub ? ` · ${w.sub}` : ''}`, icon: w.icon, k: w.id, id: w.id, since: w.since }); });
    const ice = this._ice();
    if (ice && ice.warn && !s.excludeEntities.includes(ice.id)) out.push({ sev: 1, text: 'Eisgefahr', icon: 'mdi:snowflake-alert', k: ice.id, id: ice.id, since: this._hass.states[ice.id].last_changed });
    return out;
  }
  _infoPills() {
    const h = this._hass; const inf = this._inf(); const out = [];
    this._warns().forEach((w) => out.push(`<button class="pill ${w.sev === 0 ? 'bad' : 'warn'}" data-act="warns"><ha-icon icon="${w.icon}"></ha-icon>${esc(w.title)}${w.sub ? ` · ${esc(w.sub)}` : ''}</button>`));
    const ice = this._ice();
    if (ice && (ice.warn || ice.possible)) out.push(`<button class="pill ${ice.warn ? 'warn' : ''}" data-act="warns"><ha-icon icon="mdi:snowflake-alert"></ha-icon>${ice.warn ? 'Eisgefahr' : 'Glätte möglich'}</button>`);
    const bk = h.states[inf.bike];
    if (this._ok(bk)) out.push(`<button class="pill" data-act="warns"><ha-icon icon="mdi:bike"></ha-icon>${esc(bk.state.split(' · ')[0])}</button>`);
    const pl = h.states[inf.pollen];
    if (this._ok(pl) && Number(pl.attributes.numeric_state) > 0) out.push(`<button class="pill warn" data-act="warns"><ha-icon icon="mdi:flower-pollen"></ha-icon>Pollen: ${esc(pl.attributes.named_state || pl.state)}</button>`);
    const tr = inf.travel.map(([l, id]) => [l, h.states[id]]).find(([, x]) => this._ok(x) && !isNaN(parseFloat(x.state)));
    if (tr) out.push(`<button class="pill" data-act="trav"><ha-icon icon="mdi:car-clock"></ha-icon>${esc(tr[0].split(' ')[0])} ${Math.round(parseFloat(tr[1].state))} min</button>`);
    else if (inf.trains.some(([, id]) => this._ok(h.states[id]))) out.push('<button class="pill" data-act="trav"><ha-icon icon="mdi:train"></ha-icon>Fahrzeiten</button>');
    return out.join('');
  }
  _byDomain() {
    const D = {};
    for (const id in this._hass.states) { const st = this._hass.states[id]; const r = this._hass.entities && this._hass.entities[id]; if (r && r.hidden) continue; (D[dom(id)] || (D[dom(id)] = [])).push(st); }
    return D;
  }

  /* ---------- Rendering ---------- */
  _render() {
    if (!this._hass || !this._loaded) return;
    this._pwMap = null;
    if (this.classList) this.classList.toggle('ed', !!this._edit);
    const body = this._view === 'home' ? this._home() : this._view === 'rooms' ? this._rooms() : this._view === 'more' ? this._more() : this._cams();
    const nav = [['home', 'mdi:home-outline', 'Zuhause'], ['rooms', 'mdi:view-grid-outline', 'Räume'], ['cams', 'mdi:cctv', 'Kameras'], ['more', 'mdi:view-dashboard-outline', 'Mehr']]
      .map(([v, i, l]) => `<button class="${this._view === v ? 'sel' : ''}" data-act="nav" data-v="${v}"><ha-icon icon="${i}"></ha-icon>${l}</button>`).join('');
    const scroll = this.shadowRoot.querySelector('.body'); const top = scroll ? scroll.scrollTop : 0;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="app" style="position:relative"><div class="body">${body}</div><div class="nav">${nav}</div>${this._sheetHtml()}</div>`;
    const nb = this.shadowRoot.querySelector('.body'); if (nb) nb.scrollTop = top;
    if (this._sheet === 'add') this._fillList();
  }
  _num(id) { const st = this._hass.states[id]; const v = st ? parseFloat(st.state) : NaN; return isNaN(v) ? null : v; }
  _w(v) { return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} kW` : `${Math.round(v)} W`; }
  _avatar(p, big) {
    const pic = p && p.attributes.entity_picture; const nm = (p && p.attributes.friendly_name) || '?';
    return `<div class="av">${pic ? `<img src="${esc(pic)}" alt="">` : `<span>${esc(nm[0])}</span>`}${big ? '' : '<i></i>'}</div>`;
  }
  _presence(persons) {
    return `<div class="pps">${persons.map((p) => {
      const home = p.state === 'home';
      const lbl = home ? 'Zuhause' : p.state === 'not_home' ? 'Unterwegs' : p.state;
      return `<div class="pp ${home ? 'home' : ''}" data-act="info" data-id="${p.entity_id}">${this._avatar(p, false)}<div><b>${esc(p.attributes.friendly_name)}</b><span>${esc(lbl)}</span></div></div>`;
    }).join('')}</div>`;
  }
  _energy() {
    const e = { ...ENERGY, ...(this._cfg.energy || {}) }; const n = (k) => this._num(e[k]);
    const cons = n('consumption'); const pv = n('pv');
    if (cons === null && pv === null) return '';
    const gin = n('grid_in') || 0; const gout = n('grid_out') || 0; const bin = n('battery_in') || 0; const bout = n('battery_out') || 0;
    const soc = n('soc'); const fc = n('forecast');
    const max = Math.max(cons || 0, pv || 0, gin, gout, bin, bout, 1);
    const row = (ic, label, v, cls) => `<div class="rw"><div class="rl"><span><ha-icon icon="${ic}"></ha-icon>${label}</span><span>${this._w(v)}</span></div><div class="bar ${cls}"><i style="width:${Math.max(2, Math.round((v / max) * 100))}%"></i></div></div>`;
    const grid = gout > gin ? ['Netz · Einspeisung', gout] : ['Netz · Bezug', gin];
    const bat = bin > bout ? ['Batterie · lädt', bin] : ['Batterie · entlädt', bout];
    const sub = fc !== null ? `Prognose heute bis ${this._w(fc)}` : 'Aktuelle Leistung';
    return `<div class="en" data-act="info" data-id="${e.consumption}"><div class="hd"><div class="ib"><ha-icon icon="mdi:flash"></ha-icon></div><div><b>Stromverbrauch</b><span>${sub}</span></div><div class="big">${this._w(cons || 0)}</div></div>
      ${row('mdi:solar-power', 'PV-Erzeugung', pv || 0, '')}${row('mdi:transmission-tower', grid[0], grid[1], 'g')}${row('mdi:home-battery', `${bat[0]}${soc !== null ? ` · ${Math.round(soc)} %` : ''}`, bat[1], 'b')}</div>`;
  }
  _home() {
    const h = this._hass; const D = this._byDomain(); const al = this._alerts();
    const persons = D.person || [];
    const home = persons.filter((p) => p.state === 'home').length;
    const alarm = (D.alarm_control_panel || [])[0];
    const AL = { disarmed: 'Aus', armed_home: 'Zuhause', armed_away: 'Scharf', armed_night: 'Nacht', armed_vacation: 'Urlaub', triggered: 'ALARM', pending: 'Wartet', arming: 'Schaltet scharf' };
    const cl = (D.climate || []).map((c) => c.attributes.current_temperature).filter((v) => typeof v === 'number');
    const temp = cl.length ? (cl.reduce((a, b) => a + b, 0) / cl.length).toFixed(1) : null;
    const hu = (D.sensor || []).filter((s) => s.attributes.device_class === 'humidity' && !OUTDOOR.includes(this._areaOf(s.entity_id)) && !isNaN(parseFloat(s.state))).map((s) => parseFloat(s.state));
    const hum = hu.length ? Math.round(hu.reduce((a, b) => a + b, 0) / hu.length) : null;
    const wx = (D.weather || [])[0];
    const lang = (h.locale && h.locale.language) || 'de';
    const date = new Date().toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
    const hr = new Date().getHours();
    const greet = hr < 5 ? 'Gute Nacht' : hr < 11 ? 'Guten Morgen' : hr < 17 ? 'Guten Tag' : hr < 22 ? 'Guten Abend' : 'Gute Nacht';
    const me = persons.find((p) => h.user && p.attributes.user_id === h.user.id);
    const nm = this._cfg.name || (me && me.attributes.friendly_name) || (h.user && h.user.name) || '';
    const lights = (D.light || []).filter((l) => l.state === 'on');
    const meta = [date, temp && `${temp}° innen`, hum !== null && `${hum}% Luftfeuchtigkeit`].filter(Boolean).join(' • ');
    const ai = al.length ? this._ai % al.length : 0;
    const note = al.length
      ? `<div class="note" data-act="alerts"><ha-icon icon="${al[ai].icon}"></ha-icon><span class="note-t">${esc(al[ai].text)}</span></div>`
      : `<div class="note" data-act="alerts"><ha-icon icon="mdi:check-circle-outline"></ha-icon><span class="note-t">Alles in Ordnung</span></div>`;
    const apill = alarm ? `<button class="pill ${alarm.state === 'triggered' ? 'bad' : ''}" data-act="info" data-id="${alarm.entity_id}"><ha-icon icon="mdi:shield-home"></ha-icon>${esc(AL[alarm.state] || alarm.state)}</button>` : '';
    const wpill = wx && typeof wx.attributes.temperature === 'number' ? `<button class="pill" data-act="info" data-id="${wx.entity_id}"><ha-icon icon="${WX[wx.state] || 'mdi:weather-cloudy'}"></ha-icon>${wx.attributes.temperature.toFixed(1)}° draußen</button>` : '';
    const pills = [
      lights.length ? `<button class="pill" data-act="lights"><ha-icon icon="mdi:lamp"></ha-icon>${lights.length} an</button>` : '',
      wpill,
      this._infoPills(),
      al.length ? `<button class="pill ${al.some((a) => a.sev === 0) ? 'bad' : 'warn'}" data-act="alerts"><ha-icon icon="mdi:bell-ring-outline"></ha-icon>${al.length} Meldung${al.length > 1 ? 'en' : ''}</button>` : '',
    ].join('');
    const cards = [];
    if (lights.length) {
      const names = [...new Set(lights.map((l) => this._aname(this._areaOf(l.entity_id))).filter(Boolean))].slice(0, 3).join(', ');
      cards.push(`<div class="card" data-act="lights"><ha-icon icon="mdi:lightbulb-group"></ha-icon><div><b>${lights.length} Licht${lights.length > 1 ? 'er' : ''} an</b><span>${esc(names)}</span></div></div>`);
    }
    (D.media_player || []).filter((m) => m.state === 'playing').forEach((m) => cards.push(this._card(m, m.attributes.media_title || 'Läuft')));
    (D.vacuum || []).filter((v) => ['cleaning', 'returning'].includes(v.state)).forEach((v) => cards.push(this._card(v, '')));
    this._appls().forEach((a) => { const i = this._applInfo(a); if (i && !i.off) cards.push(this._applCard(a)); });
    const pk = this._pkgs(); if (pk && pk.n > 0) cards.push(this._pkgMini(pk));
    const pr = this._printerInfo(); if (pr && pr.active) cards.push(`<div class="ap run" data-act="info" data-id="${this._xid('printer_progress')}"><div class="h"><ha-icon icon="mdi:printer-3d-nozzle"></ha-icon><div><b>3D-Druck</b><span>${Math.round(pr.prog || 0)} %${pr.left !== null ? ` · noch ${this._fmtMin(pr.left)}` : ''}</span></div></div><div class="bar"><i style="width:${Math.round(pr.prog || 0)}%"></i></div></div>`);
    this._set.pinned.forEach((p) => {
      const st = h.states[p.entity]; if (!st) return;
      if (p.only && INACTIVE.includes(st.state)) return;
      cards.push(this._card(st, this._state(st), p.entity, this._edit));
    });
    cards.push(`<div class="card add" data-act="add"><ha-icon icon="mdi:plus"></ha-icon>Karte hinzufügen</div>`);
    const en = this._energy();
    return `<div class="top"><div class="logo"><ha-icon icon="mdi:home-variant"></ha-icon></div><div class="ttl">Lumora.</div>${apill}</div>
      <div class="meta">${esc(meta)}</div>
      <div class="hello">${this._avatar(me, true)}<div><h1>${greet}${nm ? `, ${esc(nm)}` : ''}</h1><div class="sub">${home}/${persons.length} zu Hause</div></div></div>
      ${this._presence(persons)}${note}<div class="pills">${pills}</div>
      ${en ? `<h3>Energie</h3>${en}` : ''}
      <h3>Aktiv jetzt<span class="pill" style="padding:5px 10px;font-size:12px" data-act="edit"><ha-icon icon="mdi:pencil"></ha-icon>${this._edit ? 'Fertig' : 'Bearbeiten'}</span></h3>
      ${this._hint()}<div class="grid">${cards.join('')}</div>`;
  }
  _card(st, sub, pinId, edit) {
    const x = edit && pinId ? `<span class="x" data-act="unpin" data-id="${pinId}"><ha-icon icon="mdi:close"></ha-icon></span>${this._tools('pinned', pinId, null)}` : '';
    const sp = this._special(st, x, ''); if (sp) return sp;
    return `<div class="card" data-act="info" data-id="${st.entity_id}">${x}<ha-icon icon="${this._icon(st)}"></ha-icon><div><b>${esc(st.attributes.friendly_name || st.entity_id)}</b><span>${esc(sub)}</span></div></div>`;
  }
  _special(st, extra, cls) {
    const d = dom(st.entity_id);
    if (d === 'climate') return this._climCard(st, extra, cls);
    if (d === 'vacuum') return this._vacCard(st, extra, cls);
    return null;
  }
  _climCard(st, extra, cls) {
    const a = st.attributes; const cur = a.current_temperature; const tgt = a.temperature;
    const min = a.min_temp ?? 5; const max = a.max_temp ?? 30; const step = a.target_temp_step || 0.5;
    const act = a.hvac_action;
    const label = st.state === 'unavailable' ? 'Offline' : st.state === 'off' ? 'Aus' : act === 'heating' ? 'Heizt' : act === 'cooling' ? 'Kühlt' : act === 'idle' ? 'Leerlauf' : st.state === 'heat' ? 'Heizen' : ({ cool: 'Kühlen', auto: 'Auto', dry: 'Entfeuchten', fan_only: 'Lüften', heat_cool: 'Auto' }[st.state] || st.state);
    const pct = typeof tgt === 'number' ? Math.min(1, Math.max(0, (tgt - min) / (max - min))) : 0;
    const slider = typeof tgt === 'number' ? `<div class="vs" data-id="${st.entity_id}" data-min="${min}" data-max="${max}" data-step="${step}"><div class="vf" style="height:calc(40px + (100% - 40px) * ${pct})"></div><div class="vt" style="bottom:calc(2px + (100% - 40px) * ${pct})"><i>${tgt.toFixed(1)}</i></div></div>` : '';
    return `<div class="cl ${act === 'heating' ? 'heat' : ''} ${cls || ''}">${extra}<div class="clm" data-act="info" data-id="${st.entity_id}"><div class="clt"><ha-icon icon="${(a.hvac_modes || []).includes('cool') ? 'mdi:air-conditioner' : 'mdi:radiator'}"></ha-icon><em>${label}</em></div><div class="cv">${typeof cur === 'number' ? cur.toFixed(1) : '–'}°</div><div class="cn">${esc(a.friendly_name || st.entity_id)}</div><div class="cs">${typeof tgt === 'number' ? `Soll ${tgt.toFixed(1)}°` : ''}</div></div>${slider}</div>`;
  }
  _vacCard(st, extra, cls) {
    const a = st.attributes; const run = st.state === 'cleaning';
    const bat = typeof a.battery_level === 'number' ? a.battery_level : (a.battery ? parseInt(a.battery, 10) : null);
    const txt = (VAC[st.state] || st.state) + (bat !== null && !isNaN(bat) ? ` · ${bat} %` : '');
    return `<div class="vc ${run ? 'run' : ''} ${cls || ''}">${extra}<div class="vm" data-act="info" data-id="${st.entity_id}"><ha-icon icon="mdi:robot-vacuum"></ha-icon><b>${esc(a.friendly_name || st.entity_id)}</b><span>${esc(txt)}</span></div>
      <div class="vb"><button class="sq" data-act="vstart" data-id="${st.entity_id}" aria-label="${run ? 'Pausieren' : 'Starten'}"><ha-icon icon="${run ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button><button class="sq" data-act="vdock" data-id="${st.entity_id}" aria-label="Zur Station"><ha-icon icon="mdi:home-import-outline"></ha-icon></button></div></div>`;
  }

  /* ---------- Steckdosen ---------- */
  _plugPower(id) {
    if (!this._pwMap) {
      const h = this._hass; const m = {}; const byDev = {};
      for (const k in h.entities || {}) {
        const r = h.entities[k]; const st = h.states[k];
        if (r && r.device_id && st && dom(k) === 'sensor' && st.attributes.device_class === 'power' && st.attributes.unit_of_measurement === 'W' && !r.hidden) (byDev[r.device_id] || (byDev[r.device_id] = [])).push(k);
      }
      for (const k in h.entities || {}) { const r = h.entities[k]; if (r && dom(k) === 'switch' && r.device_id && byDev[r.device_id]) m[k] = byDev[r.device_id][0]; }
      this._pwMap = m;
    }
    return this._pwMap[id] || null;
  }
  _peak(id) {
    const pk = this._pk || (this._pk = {}); const c = pk[id];
    if (c && (c.busy || Date.now() - c.at < 600000)) return c;
    pk[id] = { ...(c || {}), busy: true, at: c ? c.at : 0 };
    const start = new Date(); start.setHours(0, 0, 0, 0);
    this._hass.callWS({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: new Date().toISOString(), entity_ids: [id], include_start_time_state: true, significant_changes_only: false, minimal_response: true, no_attributes: true })
      .then((r) => {
        let best = null;
        for (const x of (r && r[id]) || []) {
          const v = parseFloat(x.s !== undefined ? x.s : x.state); if (isNaN(v)) continue;
          if (!best || v > best.v) best = { v, t: x.lu !== undefined ? x.lu * 1000 : new Date(x.last_updated || x.last_changed).getTime() };
        }
        pk[id] = { at: Date.now(), v: best && best.v, t: best && best.t };
        clearTimeout(this._rt); this._rt = setTimeout(() => this._render(), 100);
      }).catch(() => { pk[id] = { at: Date.now() }; });
    return pk[id];
  }
  _plugCard(st, pw, extra, cls, area) {
    const on = st.state === 'on'; const ps = this._hass.states[pw]; const v = ps ? parseFloat(ps.state) : NaN;
    const pk = this._peak(pw);
    let n = st.attributes.friendly_name || st.entity_id;
    if (area && n.toLowerCase().startsWith(area.toLowerCase() + ' ') && n.length > area.length + 1) n = n.slice(area.length + 1);
    const peak = pk && typeof pk.v === 'number' ? `Spitze ${Math.round(pk.v)} W um ${new Date(pk.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '';
    return `<div class="pl ${on ? 'on' : ''} ${cls || ''}">${extra}<div class="plt" data-act="toggle" data-id="${st.entity_id}"><ha-icon icon="mdi:power-plug${on ? '' : '-off'}-outline"></ha-icon><em>${st.state === 'unavailable' ? 'Offline' : on ? 'Ein' : 'Aus'}</em></div>
      <div class="plv" data-act="info" data-id="${st.entity_id}">${isNaN(v) ? '–' : Math.round(v * 10) / 10}<small>W</small></div><div class="cn" data-act="info" data-id="${st.entity_id}">${esc(n)}</div>${peak ? `<div class="cs">${peak}</div>` : ''}</div>`;
  }

  /* ---------- Geräte, Pakete, Drucker ---------- */
  _fmtMin(m) { m = Math.round(m); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; }
  _dur(st) {
    if (!st || ['unavailable', 'unknown', 'none', ''].includes(st.state)) return null;
    const x = st.state; const n = parseFloat(x);
    if (/^\d+:\d{2}(:\d{2})?$/.test(x)) { const p = x.split(':').map(Number); return p[0] * 60 + p[1] + (p[2] || 0) / 60; }
    if (/\d{4}-\d{2}-\d{2}T/.test(x)) return Math.max(0, (new Date(x).getTime() - Date.now()) / 60000);
    if (isNaN(n)) return null;
    const u = st.attributes.unit_of_measurement;
    return u === 's' ? n / 60 : u === 'h' ? n * 60 : n;
  }
  _appls() { return this._cfg.appliances || APPLIANCES; }
  _applInfo(a) {
    const z = this._hass.states[`${a.base}_zustand`]; if (!z) return null;
    const stt = z.state; const off = ['off', 'unavailable', 'unknown', 'none', ''].includes(stt);
    const done = ['finished', 'end'].includes(stt);
    const active = !off && !done && !['pause', 'paused', 'ready', 'idle'].includes(stt);
    let prog = this._num(`${a.base}_fortschritt`); if (prog !== null && prog <= 1 && prog > 0) prog *= 100;
    const left = this._dur(this._hass.states[`${a.base}_verbleibende_zeit`]);
    const pr = this._hass.states[`${a.base}_programm`];
    const prg = pr && !['unavailable', 'unknown', 'none', 'off', ''].includes(pr.state) ? pr.state : null;
    return { off, done, active, prog, left, program: prg, label: done ? a.hint : (APL[stt] || stt) };
  }
  _applCard(a) {
    const i = this._applInfo(a); if (!i) return '';
    const sub = [i.label, i.active && i.left !== null ? `noch ${this._fmtMin(i.left)}` : null, i.active ? i.program : null].filter(Boolean).join(' · ');
    return `<div class="ap ${i.active ? 'run' : ''}" data-act="info" data-id="${a.base}_zustand"><div class="h"><ha-icon icon="${a.icon}"></ha-icon><div><b>${esc(a.title)}</b><span>${esc(i.off ? 'Aus' : sub)}</span></div></div>${i.active && i.prog !== null ? `<div class="bar"><i style="width:${Math.round(i.prog)}%"></i></div>` : ''}</div>`;
  }
  _pkgs() {
    const st = this._xs('packages'); if (!st) return null;
    const arr = (v) => (Array.isArray(v) ? v : []);
    return { st, n: parseInt(st.state, 10) || 0, today: parseInt(st.attributes.today_count, 10) || 0, dhl: arr(st.attributes.dhl), amz: arr(st.attributes.amazon) };
  }
  _pkgMini(pk) {
    const first = pk.dhl.find((x) => !x.delivered) || pk.dhl[0] || pk.amz[0];
    const sub = pk.today > 0 ? `${pk.today} heute in Zustellung` : (first && (first.short_status || first.status)) || '';
    return `<div class="card" data-act="nav" data-v="more"><ha-icon icon="mdi:package-variant-closed"></ha-icon><div><b>${pk.n} Paket${pk.n === 1 ? '' : 'e'}</b><span>${esc(sub)}</span></div></div>`;
  }
  _pkgPanel(pk) {
    const rows = [...pk.dhl.map((x) => ({ t: `DHL ${x.tracking_id || ''}`, s: x.short_status || x.status, p: typeof x.progress === 'number' ? x.progress / 5 : null })),
      ...pk.amz.map((x) => ({ t: x.custom_name || x.friendly_name || 'Amazon', s: x.status || x.short_status, p: null }))];
    return this._panel('mdi:package-variant-closed', 'Pakete', pk.today > 0 ? `${pk.today} heute in Zustellung` : 'Sendungen', pk.n, rows.map((r) => `<div class="pkr"><b>${esc(r.t)}</b><span>${esc(r.s || '')}</span>${r.p !== null ? `<div class="bar"><i style="width:${Math.round(r.p * 100)}%"></i></div>` : ''}</div>`).join('') || '<div class="empty">Keine Sendungen unterwegs.</div>', pk.st.entity_id);
  }
  _panel(icon, title, sub, big, body, id) {
    return `<div class="en" data-act="info" data-id="${id}"><div class="hd"><div class="ib"><ha-icon icon="${icon}"></ha-icon></div><div><b>${esc(title)}</b><span>${esc(sub)}</span></div><div class="big">${big}</div></div>${body || ''}</div>`;
  }
  _printerInfo() {
    const stt = this._xs('printer_status'); if (!stt) return null;
    const prog = this._num(this._xid('printer_progress'));
    const left = this._dur(this._hass.states[this._xid('printer_left')]);
    const active = /print|run/.test(stt.state) && !/idle|complete|finish/.test(stt.state);
    return { st: stt, prog, left, active, nozzle: this._num(this._xid('printer_nozzle')), bed: this._num(this._xid('printer_bed')) };
  }
  _xid(k) { return { ...EXTRA, ...(this._cfg.extras || {}) }[k]; }
  _xs(k) { const st = this._hass.states[this._xid(k)]; return st && !['unavailable', 'unknown'].includes(st.state) ? st : null; }
  _stat(icon, label, val, unit, id) {
    return `<div class="card" data-act="info" data-id="${id}"><ha-icon icon="${icon}"></ha-icon><div><b>${esc(val)}${unit ? ` ${esc(unit)}` : ''}</b><span>${esc(label)}</span></div></div>`;
  }
  _de(v, d = 0) { return Number(v).toLocaleString('de-DE', { maximumFractionDigits: d }); }

  /* ---------- Tab Mehr ---------- */
  _more() {
    const h = this._hass; const items = []; const add = (id, html, wide) => { if (html) items.push({ id, html, wide }); };
    this._appls().forEach((a) => add(`appl:${a.base}`, this._applCard(a)));
    const pk = this._pkgs(); if (pk) add('pkg', this._pkgPanel(pk), true);
    add('energy', this._energy(), true);
    const m = this._xs('meter'); if (m) add('stat:meter', this._stat('mdi:meter-electric', 'Netzbezug aktuell', this._de(parseFloat(m.state)), 'W', m.entity_id));
    const gas = this._xs('gas'); if (gas) add('stat:gas', this._stat('mdi:meter-gas', 'Gaszähler', this._de(parseFloat(gas.state), 1), 'm³', gas.entity_id));
    const wat = this._xs('water'); if (wat) add('stat:water', this._stat('mdi:water', 'Wasserzähler', this._de(parseFloat(wat.state), 1), 'm³', wat.entity_id));
    const sv = this._xs('saving_total'); if (sv) add('stat:sav', this._stat('mdi:piggy-bank-outline', 'PV-Ersparnis gesamt', this._de(parseFloat(sv.state), 0), '€', sv.entity_id));
    const sy = this._xs('saving_year'); if (sy) add('stat:savy', this._stat('mdi:cash-refund', 'Ersparnis pro Jahr', this._de(parseFloat(sy.state), 0), '€', sy.entity_id));
    const pr = this._printerInfo();
    if (pr) {
      const cam = h.states[this._xid('printer_cam')]; const pic = cam && cam.state !== 'unavailable' && cam.attributes.entity_picture;
      add('printer', this._panel('mdi:printer-3d-nozzle', '3D-Drucker', pr.active ? 'Druckt' : 'Bereit', pr.prog !== null ? `${Math.round(pr.prog)} %` : '',
        `${pr.prog !== null ? `<div class="bar"><i style="width:${Math.round(pr.prog)}%"></i></div>` : ''}<div class="pkr"><span>${[pr.left !== null ? `noch ${this._fmtMin(pr.left)}` : '', pr.nozzle !== null ? `Düse ${Math.round(pr.nozzle)}°` : '', pr.bed !== null ? `Bett ${Math.round(pr.bed)}°` : ''].filter(Boolean).join(' · ')}</span></div>${pic ? `<img src="${esc(pic)}" alt="">` : ''}`, pr.st.entity_id), true);
    }
    const pt = this._xs('pool_temp');
    if (pt) {
      const sw = (k, l) => { const s = h.states[this._xid(k)]; return s ? `<button class="pill ${s.state === 'on' ? 'sel' : ''}" data-act="toggle" data-id="${s.entity_id}">${l} ${s.state === 'on' ? 'an' : 'aus'}</button>` : ''; };
      add('pool', this._panel('mdi:pool', 'Pool', 'Wassertemperatur', `${this._de(parseFloat(pt.state), 1)}°`, `<div class="pills">${sw('pool_pump', 'Pumpe')}${sw('pool_heat', 'Heizung')}</div>`, pt.entity_id), true);
    }
    const wx = (this._byDomain().weather || [])[0];
    if (wx) {
      const a = wx.attributes;
      add('wx', this._stat(WX[wx.state] || 'mdi:weather-cloudy', `${WXL[wx.state] || wx.state}${typeof a.humidity === 'number' ? ` · ${Math.round(a.humidity)} % Feuchte` : ''}${typeof a.wind_speed === 'number' ? ` · ${Math.round(a.wind_speed)} km/h` : ''}`, typeof a.temperature === 'number' ? this._de(a.temperature, 1) : '–', '°C', wx.entity_id));
    }
    const tk = this._xs('tank'); if (tk) add('tank', this._stat('mdi:gas-station', `Tankzeit${tk.attributes.stunde ? ` · ${tk.attributes.stunde} Uhr` : ''}`, this._de(parseFloat(tk.state), 3), '', tk.entity_id));
    const hs = this._xs('health');
    if (hs) {
      const v = parseFloat(hs.state); const at = hs.attributes;
      add('health', this._panel('mdi:heart-pulse', 'HA-Health', `Hardware ${at.hardware_score ?? '–'} · Anwendungen ${at.application_score ?? '–'}${at.zombie_count ? ` · ${at.zombie_count} Zombie-Entitäten` : ''}`, `${Math.round(v)}`, `<div class="bar ${v >= 80 ? 'b' : ''}"><i style="width:${Math.min(100, v)}%"></i></div>`, hs.entity_id));
    }
    const ph = this._xs('pihole_ratio');
    if (ph) {
      const sw = h.states[this._xid('pihole_switch')]; const q = this._num(this._xid('pihole_queries')); const cl = this._num(this._xid('pihole_clients'));
      add('pihole', this._panel('mdi:shield-check-outline', 'Pi-hole', `${q !== null ? `${this._de(q)} Abfragen` : ''}${cl !== null ? ` · ${this._de(cl)} Clients` : ''}`, `${this._de(parseFloat(ph.state), 1)} %`,
        sw ? `<div class="pills"><button class="pill ${sw.state === 'on' ? 'sel' : ''}" data-act="toggle" data-id="${sw.entity_id}">Filter ${sw.state === 'on' ? 'an' : 'aus'}</button></div>` : '', ph.entity_id));
    }
    const lg = this._xs('lage');
    if (lg) {
      const an = lg.attributes.analysis_summary; const hl = an && typeof an === 'object' ? an.headline : '';
      add('lage', this._panel('mdi:alert-circle-outline', 'Lage Deutschland', hl || 'Lagebild', `${Math.round(parseFloat(lg.state))}`, '', lg.entity_id));
    }
    const ord = this._ord('more', items, (x) => x.id);
    const cells = ord.filter((x) => this._edit || !this._set.hidden.includes(x.id)).map((x) => `<div class="mw ${x.wide ? 'wide' : ''} ${this._set.hidden.includes(x.id) ? 'hid' : ''}">${this._tools('more', x.id, 'hidden')}${x.html}</div>`);
    return `<div class="rh"><h2>Mehr</h2><div class="inf">${this._editBtn()}</div></div>${this._hint()}<div class="grid">${cells.join('') || '<div class="empty">Keine weiteren Daten gefunden.</div>'}</div>`;
  }
  _dgItem(el) {
    while (el && el !== this.shadowRoot) {
      if (el.querySelector) { const m = el.querySelector(':scope > i.dg'); if (m) return { el, scope: m.dataset.s, id: m.dataset.id }; }
      el = el.parentNode || el.host;
    }
    return null;
  }
  _dgStart(e) {
    const t = e.target; if (!t.closest || t.closest('.mini') || t.closest('.x') || t.closest('[data-act="edit"]')) return;
    const it = this._dgItem(t); if (!it) return;
    this._dg = { ...it, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, on: false, pid: e.pointerId, touch: e.pointerType !== 'mouse', over: null };
    if (this._dg.touch) this._dg.timer = setTimeout(() => this._dgBegin(), 280);
  }
  _dgBegin() {
    const d = this._dg; if (!d || d.on) return; d.on = true;
    const body = this.shadowRoot.querySelector('.body'); d.s0 = body ? body.scrollTop : 0;
    d.el.classList.add('dgo');
    try { d.el.setPointerCapture(d.pid); } catch (_) { /* ignore */ }
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (_) { /* ignore */ }
    this._dgLoop();
  }
  _dgMove(e) {
    const d = this._dg; if (!d) return; d.cx = e.clientX; d.cy = e.clientY;
    if (!d.on) {
      if (Math.hypot(d.cx - d.x, d.cy - d.y) > (d.touch ? 10 : 5)) { if (d.touch) { clearTimeout(d.timer); this._dg = null; } else this._dgBegin(); }
      return;
    }
    this._dgPlace();
  }
  _dgPlace() {
    const d = this._dg; if (!d || !d.on) return;
    const body = this.shadowRoot.querySelector('.body'); const sc = body ? body.scrollTop : 0;
    d.el.style.transform = `translate(${d.cx - d.x}px,${d.cy - d.y + (sc - d.s0)}px)`;
    let over = null;
    this.shadowRoot.querySelectorAll('i.dg').forEach((m) => {
      if (m.dataset.s !== d.scope || m.dataset.id === d.id) return;
      const el = m.parentNode; el.classList.remove('dgt');
      const r = el.getBoundingClientRect();
      if (d.cx >= r.left && d.cx <= r.right && d.cy >= r.top && d.cy <= r.bottom) over = { el, id: m.dataset.id };
    });
    if (over) over.el.classList.add('dgt');
    d.over = over;
  }
  _dgLoop() {
    const d = this._dg; if (!d || !d.on) return;
    const body = this.shadowRoot.querySelector('.body');
    if (body) { const r = body.getBoundingClientRect(); let v = 0; if (d.cy < r.top + 90) v = -Math.ceil((r.top + 90 - d.cy) / 6); else if (d.cy > r.bottom - 130) v = Math.ceil((d.cy - (r.bottom - 130)) / 6); if (v) { body.scrollTop += v; this._dgPlace(); } }
    requestAnimationFrame(() => this._dgLoop());
  }
  _dgEnd() {
    const d = this._dg; this._dg = null; if (!d) return;
    clearTimeout(d.timer);
    if (!d.on) return;
    this._dgAt = Date.now();
    const s = this._set;
    if (d.over) {
      if (d.scope === 'pinned') {
        const i = s.pinned.findIndex((q) => q.entity === d.id); const j = s.pinned.findIndex((q) => q.entity === d.over.id);
        if (i >= 0 && j >= 0) { const [m] = s.pinned.splice(i, 1); s.pinned.splice(j, 0, m); }
      } else {
        const ids = [...((this._ids && this._ids[d.scope]) || [])]; const i = ids.indexOf(d.id); const j = ids.indexOf(d.over.id);
        if (i >= 0 && j >= 0) { ids.splice(i, 1); ids.splice(j, 0, d.id); s.order[d.scope] = ids; }
      }
      this._save();
    }
    this._sig = ''; this._render();
  }
  _dragTo(e) {
    const d = this._drag; const r = d.el.getBoundingClientRect(); const inner = Math.max(1, r.height - 40);
    const p = Math.min(1, Math.max(0, (r.bottom - 20 - e.clientY) / inner));
    let v = d.min + p * (d.max - d.min); v = Math.min(d.max, Math.max(d.min, Math.round(v / d.step) * d.step)); d.val = v;
    const q = (v - d.min) / (d.max - d.min);
    d.el.querySelector('.vf').style.height = `calc(40px + (100% - 40px) * ${q})`;
    const t = d.el.querySelector('.vt'); t.style.bottom = `calc(2px + (100% - 40px) * ${q})`; t.querySelector('i').textContent = v.toFixed(1);
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
    list.forEach((f) => { f.areas.sort((a, b) => a.name.localeCompare(b.name, 'de')); f.areas = this._ord('areas:' + f.id, f.areas, (x) => x.id); });
    return this._ord('floors', list, (f) => f.id);
  }
  _rooms() {
    const floors = this._roomData();
    if (!floors.length) return `<div class="empty">Keine Räume gefunden. Weise Entitäten in Home Assistant Bereichen zu.</div>`;
    let f = floors.find((x) => x.id === this._floor) || floors.find((x) => /eg|erd/i.test(x.id + x.name)) || floors[0];
    this._floor = f.id;
    let a = f.areas.find((x) => x.id === this._area) || f.areas[0]; this._area = a.id;
    const ftabs = floors.map((x) => `<button class="pill ${x.id === f.id ? 'sel' : ''}" data-act="floor" data-id="${x.id}">${esc(x.name)}${this._tools('floors', x.id, null)}</button>`).join('');
    const atabs = f.areas.map((x) => { const hd = this._set.hiddenAreas.includes(x.id); return `<button class="pill ${x.id === a.id ? 'sel' : ''} ${hd ? 'hid' : ''}" data-act="area" data-id="${x.id}">${esc(x.name)}${this._tools('areas:' + f.id, x.id, 'hiddenAreas')}</button>`; }).join('');
    const ents = a.ents; const info = [];
    const rs = this._set.roomSensors[a.id] || {};
    const pick = (id) => { const x = id && this._hass.states[id]; return x && !isNaN(parseFloat(x.state)) ? x : null; };
    const DER = /taupunkt|dew|frost|hitzeindex|heat.?index|humidex|simmer|soll|target|offset|setpoint|gef(ü|u)hlt|feels|comfort|absolut/i;
    const auto = (dc) => {
      const l = ents.filter((x) => dom(x.entity_id) === 'sensor' && x.attributes.device_class === dc && !isNaN(parseFloat(x.state)) && !DER.test(`${x.entity_id} ${x.attributes.friendly_name || ''}`));
      return l.find((x) => !/thermostat/i.test(x.attributes.friendly_name || x.entity_id)) || l[0];
    };
    const t = pick(rs.temp) || auto('temperature');
    const c = ents.find((x) => dom(x.entity_id) === 'climate' && typeof x.attributes.current_temperature === 'number');
    const hu = pick(rs.hum) || auto('humidity');
    if (t) info.push(`${parseFloat(t.state).toFixed(1)}°`); else if (c) info.push(`${c.attributes.current_temperature.toFixed(1)}°`);
    if (hu) info.push(`${Math.round(parseFloat(hu.state))}%`);
    const cams = this._ord('rcams:' + a.id, ents.filter((s) => dom(s.entity_id) === 'camera' && s.state !== 'unavailable'), (s) => s.entity_id);
    const used = new Set(ents.filter((s) => dom(s.entity_id) === 'switch').map((s) => this._plugPower(s.entity_id)).filter(Boolean));
    const tileEnts = this._ord('tiles:' + a.id, ents.filter((s) => dom(s.entity_id) !== 'camera' && !used.has(s.entity_id) && !['temperature', 'humidity'].includes(s.attributes.device_class))
      .sort((x, y) => ROOM_DOMAINS.indexOf(dom(x.entity_id)) - ROOM_DOMAINS.indexOf(dom(y.entity_id))), (s) => s.entity_id);
    const tiles = tileEnts.map((s) => this._tile(s, a.name, 'tiles:' + a.id)).join('');
    return `<div class="tabs">${ftabs}</div><div class="tabs">${atabs}</div>
      <div class="rh"><h2>${esc(a.name)}</h2><div class="inf"><span>${info.join(' · ')}</span>${this._edit ? `<button class="pill" data-act="rsens" data-id="${a.id}"><ha-icon icon="mdi:thermometer"></ha-icon>Sensoren</button>` : ''}${this._editBtn()}</div></div>${this._hint()}
      ${cams.length ? `<div class="cams" style="margin-bottom:10px">${cams.map((s) => this._camHtml(s, 'rcams:' + a.id)).join('')}</div>` : ''}
      <div class="grid">${tiles || '<div class="empty">Keine Geräte in diesem Raum.</div>'}</div>`;
  }
  _editBtn() { return `<button class="pill" data-act="edit"><ha-icon icon="mdi:pencil"></ha-icon>${this._edit ? 'Fertig' : 'Bearbeiten'}</button>`; }
  _tools(scope, id, hideKey) {
    if (!this._edit) return '';
    const list = hideKey === 'hiddenAreas' ? this._set.hiddenAreas : this._set.hidden;
    const eye = hideKey ? `<span class="mini" data-act="${hideKey === 'hiddenAreas' ? 'hidearea' : 'hidee'}" data-id="${esc(id)}"><ha-icon icon="${list.includes(id) ? 'mdi:eye' : 'mdi:eye-off'}"></ha-icon></span>` : '';
    return `<span class="tools">${eye}</span><i class="dg" data-s="${esc(scope)}" data-id="${esc(id)}" style="display:none"></i>`;
  }
  _ord(scope, items, idf) {
    const o = this._set.order[scope];
    const res = !o || !o.length ? items : items.map((x, i) => [x, i]).sort((a, b) => { const ia = o.indexOf(idf(a[0])); const ib = o.indexOf(idf(b[0])); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib) || a[1] - b[1]; }).map((x) => x[0]);
    (this._ids || (this._ids = {}))[scope] = res.map(idf);
    return res;
  }
  _hint() { return this._edit ? '<div class="hint">Bearbeiten: Element gedrückt halten und ziehen zum Verschieben. Das Auge blendet aus oder wieder ein.</div>' : ''; }
  _tile(st, area, scope) {
    const d = dom(st.entity_id); const on = !INACTIVE.includes(st.state);
    if (d === 'switch') { const pw = this._plugPower(st.entity_id); if (pw) return this._plugCard(st, pw, this._tools(scope, st.entity_id, 'hidden'), this._set.hidden.includes(st.entity_id) ? 'hid' : '', area); }
    if (d === 'climate' || d === 'vacuum') return this._special(st, this._tools(scope, st.entity_id, 'hidden'), this._set.hidden.includes(st.entity_id) ? 'hid' : '');
    let n = st.attributes.friendly_name || st.entity_id;
    if (n.toLowerCase().startsWith(area.toLowerCase() + ' ') && n.length > area.length + 1) n = n.slice(area.length + 1);
    const sens = d === 'sensor' ? 'sens' : '';
    const bad = d === 'binary_sensor' && st.state === 'on' && ['door', 'window', 'opening', 'smoke', 'moisture', 'gas'].includes(st.attributes.device_class);
    return `<div class="tile ${on || bad ? 'on' : ''} ${sens} ${this._set.hidden.includes(st.entity_id) ? 'hid' : ''}">${this._tools(scope, st.entity_id, 'hidden')}<div class="ic" data-act="toggle" data-id="${st.entity_id}"><ha-icon icon="${this._icon(st)}"></ha-icon></div>
      <div class="tx" data-act="info" data-id="${st.entity_id}"><b>${esc(n)}</b><span>${esc(this._state(st))}</span></div></div>`;
  }
  _camHtml(st, scope) {
    const src = st.attributes.entity_picture || '';
    return `<div class="cam ${this._set.hidden.includes(st.entity_id) ? 'hid' : ''}" data-act="info" data-id="${st.entity_id}">${src ? `<img loading="lazy" src="${esc(src)}" alt="">` : ''}${this._tools(scope, st.entity_id, 'hidden')}<span class="n">${esc(cleanName(st.attributes.friendly_name))}</span></div>`;
  }
  _cams() {
    const cams = this._ord('cams', (this._byDomain().camera || []).filter((s) => s.state !== 'unavailable' && (this._edit || !this._set.hidden.includes(s.entity_id))), (s) => s.entity_id);
    return `<div class="rh"><h2>Kameras</h2><div class="inf"><span>${cams.length}</span>${this._editBtn()}</div></div>${this._hint()}<div class="cams">${cams.map((s) => this._camHtml(s, 'cams')).join('') || '<div class="empty">Keine Kameras verfügbar.</div>'}</div>`;
  }

  /* ---------- Sheets ---------- */
  _sheetHtml() {
    if (!this._sheet) return '';
    let c = '';
    if (this._sheet === 'alerts') {
      const al = this._alerts(); const s = this._set;
      const CAT = [['door', 'Türen'], ['window', 'Fenster'], ['motion', 'Bewegung'], ['smoke', 'Rauch / Wasser / Gas'], ['alarm', 'Alarmanlage'], ['lock', 'Schloss entsperrt'], ['weather', 'DWD, NINA & Eiswarnung']];
      c = `<h2>Meldungen</h2>${al.map((a) => `<div class="row"><ha-icon icon="${a.icon}"></ha-icon><div class="t"><b>${esc(a.text)}</b><span>${ago(a.since)}</span></div><button data-act="hide" data-id="${a.id}">Ausblenden</button></div>`).join('') || '<div class="empty">Keine aktiven Meldungen.</div>'}
        <h4>Was gemeldet wird</h4>${CAT.map(([k, l]) => `<div class="row"><div class="t"><b>${l}</b></div><button class="${s.alerts[k] ? 'sel' : ''}" data-act="cat" data-k="${k}">${s.alerts[k] ? 'An' : 'Aus'}</button></div>`).join('')}
        <h4>Räume von Meldungen ausnehmen</h4>${Object.keys(this._hass.areas || {}).sort((x, y) => this._aname(x).localeCompare(this._aname(y), 'de')).map((id) => `<div class="row"><div class="t"><b>${esc(this._aname(id))}</b></div><button class="${s.excludeAreas.includes(id) ? '' : 'sel'}" data-act="exarea" data-id="${id}">${s.excludeAreas.includes(id) ? 'Aus' : 'Gemeldet'}</button></div>`).join('')}
        ${s.excludeEntities.length ? `<h4>Ausgeblendet</h4>${s.excludeEntities.map((id) => `<div class="row"><div class="t"><b>${esc((this._hass.states[id] && this._hass.states[id].attributes.friendly_name) || id)}</b></div><button data-act="unhide" data-id="${id}">Einblenden</button></div>`).join('')}` : ''}`;
    } else if (this._sheet === 'rs') {
      const aid = this._rsArea; const rs = this._set.roomSensors[aid] || {};
      const mk = (dc, key, title) => {
        const l = Object.values(this._hass.states).filter((x) => dom(x.entity_id) === 'sensor' && x.attributes.device_class === dc && this._areaOf(x.entity_id) === aid && !isNaN(parseFloat(x.state)));
        return `<h4>${title}</h4><div class="row"><div class="t"><b>Automatisch</b><span>Ohne Taupunkt, Hitzeindex und Ähnliches</span></div><button class="${!rs[key] ? 'sel' : ''}" data-act="rspick" data-k="${key}" data-id="">Auto</button></div>`
          + l.map((x) => `<div class="row"><div class="t"><b>${esc(x.attributes.friendly_name || x.entity_id)}</b><span>${esc(this._state(x))}</span></div><button class="${rs[key] === x.entity_id ? 'sel' : ''}" data-act="rspick" data-k="${key}" data-id="${x.entity_id}">Wählen</button></div>`).join('')
          + (l.length ? '' : '<div class="empty">Keine Sensoren in diesem Bereich. Weise sie in Home Assistant dem Bereich zu.</div>');
      };
      c = `<h2>Sensoren · ${esc(this._aname(aid))}</h2>${mk('temperature', 'temp', 'Temperatur')}${mk('humidity', 'hum', 'Luftfeuchtigkeit')}`;
    } else if (this._sheet === 'warns') {
      const inf = this._inf(); const h = this._hass; const ice = this._ice(); const bk = h.states[inf.bike]; const pl = h.states[inf.pollen];
      const row = (ic, t, sub) => `<div class="row"><ha-icon icon="${ic}"></ha-icon><div class="t"><b>${esc(t)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>`;
      const rows = this._warns().map((w) => row(w.icon, `${w.kind === 'nina' ? 'NINA' : 'DWD'}: ${w.title}`, [w.sub, w.desc].filter(Boolean).join(' · ')));
      if (ice) rows.push(row('mdi:snowflake-alert', ice.warn ? 'Eisgefahr' : ice.possible ? 'Glätte möglich' : 'Kein Eis', ''));
      if (this._ok(bk)) rows.push(row('mdi:bike', 'Fahrrad', bk.state));
      if (this._ok(pl)) rows.push(row('mdi:flower-pollen', 'Pollen', pl.attributes.named_state || pl.state));
      c = `<h2>Warnungen und Hinweise</h2>${rows.join('') || '<div class="empty">Keine Warnungen.</div>'}`;
    } else if (this._sheet === 'trav') {
      const inf = this._inf(); const h = this._hass;
      const car = inf.travel.map(([l, id]) => [l, h.states[id]]).filter(([, x]) => this._ok(x) && !isNaN(parseFloat(x.state))).map(([l, x]) => `<div class="row"><ha-icon icon="mdi:car-clock"></ha-icon><div class="t"><b>${esc(l)}: ${Math.round(parseFloat(x.state))} min</b><span>${x.attributes.distance !== undefined ? `${Number(x.attributes.distance).toFixed(1).replace('.', ',')} km` : ''}${x.attributes.route ? ` · ${esc(x.attributes.route)}` : ''}</span></div></div>`);
      const tn = inf.trains.map(([l, id]) => [l, h.states[id]]).filter(([, x]) => this._ok(x) && Array.isArray(x.attributes.trips)).map(([l, x]) => `<div class="row"><ha-icon icon="mdi:train"></ha-icon><div class="t"><b>${esc(l)}</b>${x.attributes.trips.slice(0, 3).map((t) => `<span>${esc(t.departure)}${t.departure_delay > 0 ? ` +${t.departure_delay}` : ''} → ${esc(t.arrival)} · ${esc((t.transports || []).filter(Boolean).join(', '))} · ${t.duration} min</span>`).join('')}</div></div>`);
      c = `<h2>Fahrzeiten</h2>${car.join('')}${tn.join('') || ''}${car.length + tn.length ? '' : '<div class="empty">Keine Daten.</div>'}`;
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
    if (Date.now() - (this._dgAt || 0) < 450) return;
    if (this._edit && ['info', 'toggle', 'vstart', 'vdock'].includes(act)) return;
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
      case 'vstart': h.callService('vacuum', h.states[id] && h.states[id].state === 'cleaning' ? 'pause' : 'start', { entity_id: id }); return;
      case 'vdock': h.callService('vacuum', 'return_to_base', { entity_id: id }); return;
      case 'rsens': this._sheet = 'rs'; this._rsArea = id; break;
      case 'rspick': { const r = s.roomSensors[this._rsArea] || (s.roomSensors[this._rsArea] = {}); if (id) r[t.dataset.k] = id; else delete r[t.dataset.k]; this._save(); break; }
      case 'alerts': this._sheet = 'alerts'; break;
      case 'warns': this._sheet = 'warns'; break;
      case 'trav': this._sheet = 'trav'; break;
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
      case 'mv': {
        const sc = t.dataset.s; const dd = Number(t.dataset.d);
        if (sc === 'pinned') {
          const i = s.pinned.findIndex((q) => q.entity === id); const j = i + dd;
          if (i >= 0 && j >= 0 && j < s.pinned.length) [s.pinned[i], s.pinned[j]] = [s.pinned[j], s.pinned[i]];
        } else {
          const ids = [...((this._ids && this._ids[sc]) || [])]; const i = ids.indexOf(id); const j = i + dd;
          if (i >= 0 && j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; s.order[sc] = ids; }
        }
        this._save(); break;
      }
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
