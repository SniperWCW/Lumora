/* Lumora
 * Schnelle, abhängigkeitsfreie Karte: Startseite mit gefilterten Meldungen + Räume je Etage/Area + Kameras.
 * Einbindung: Ressource /local/lumora/lumora.js (Typ: JavaScript-Modul), Karte: type: custom:lumora-card (Panel-Ansicht). Optional: theme: forest.
 */
const VERSION = '0.0.0-dev';
const KEY = 'lumora_panel';
const DEF = {
  alerts: { door: true, window: true, motion: true, smoke: true, alarm: true, lock: false, weather: true, climate: true },
  chips: { warn: false, ice: false },
  excludeEntities: [],
  excludeAreas: ['fahrzeug'],
  pinned: [],
  homeCams: [],
  hidden: [],
  hiddenAreas: [],
  order: {},
  roomSensors: {},
  sources: {},
  quick: [],
  custom: [],
  devices: [],
  size: {},
  place: {},
  ignore: [],
  battLimit: 20,
  fx: {},
  snooze: {},
  notify: { push: '', tts: '', min: 0 },
  door: { bell: [], motion: [], cam: '', secs: 30 },
};
const norm = (t) => String(t || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
const PV = '(?:^|[^a-z])pv(?:[^a-z]|$)|solar|photovolt';
const PVT = '(?:^|[^a-z])pv(?:[^a-z]|$)';
const BAT = 'batter|akku|speicher';
const BADDEV = /phone|ipad|watch|handy|mobil|tablet|remote|fernbedienung|kamera|camera/;
const P = ['sensor'];
const SLOTS = {
  e_pv: { g: 'Energie', l: 'PV-Leistung', d: P, dc: 'power', re: new RegExp(PV), no: new RegExp(`prognos|forecast|solcast|ersparnis|${BAT}|netz|grid|verbrauch|consum|total|gesamt|einspeis`), pri: /out|leistung|power|erzeug|prod/ },
  e_consumption: { g: 'Energie', l: 'Hausverbrauch', d: P, dc: 'power', re: /verbrauch|consum|house|home.?load|(^|[^a-z])load/, no: new RegExp(`netz|grid|${PVT}|${BAT}|einspeis|gas|wasser|water|drucker|printer|pool|spa(?:[^a-z]|$)|kaffee|steckdose`), pri: /haus|house|total|gesamt|aktuell|in(?:[^a-z]|$)/ },
  e_grid_in: { g: 'Energie', l: 'Netzbezug', d: P, dc: 'power', re: /grid|netz|bezug|import/, no: new RegExp(`out|einspeis|export|${BAT}|${PVT}|feed|verg|erl|energy|total`), pri: /in|bezug|import/ },
  e_grid_out: { g: 'Energie', l: 'Einspeisung', d: P, dc: 'power', re: /einspeis|export|grid.?out|netz.?out|feed/, no: /energy|verg|erl|compens|total|gesamt|prognos|batter|akku/ },
  e_battery_in: { g: 'Energie', l: 'Batterie laden', d: P, dc: 'power', re: new RegExp(`(?:${BAT}).*(?:in|lad|charge)|charge|laden`), no: new RegExp(`dis|entlad|soc|stand|level|ladestand|${BADDEV.source}`) },
  e_battery_out: { g: 'Energie', l: 'Batterie entladen', d: P, dc: 'power', re: new RegExp(`(?:${BAT}).*(?:out|entlad|discharge)|discharge`), no: BADDEV },
  e_soc: { g: 'Energie', l: 'Batterie-Ladestand', d: P, dc: 'battery', re: new RegExp(`(?:${PV}|${BAT}|home.?batt).*(?:soc|batter|stand|level|ladung)|soc`), no: BADDEV, pri: /soc/ },
  e_forecast: { g: 'Energie', l: 'PV-Prognose heute', d: P, re: /(?:prognos|forecast|solcast).*(?:heute|today|peak|spitze|power|leistung)|(?:heute|today).*(?:prognos|forecast|solcast)/, no: /morgen|tomorrow/ },
  meter: { g: 'Zähler', l: 'Stromzähler (Leistung)', d: P, dc: 'power', re: /smart.?meter|stromz[a-z]*hler|zahler|meter/, no: /gas|wasser|water|energy|total|batter|solar|pv/ },
  gas: { g: 'Zähler', l: 'Gaszähler', d: P, re: /(?=.*gas)(?=.*(?:value|zahler|stand|meter|total))/, no: /preis|price|rate|status|problem|ersparnis|kosten|cost|flow|error|raw|timestamp|pre$/ },
  water: { g: 'Zähler', l: 'Wasserzähler', d: P, re: /(?=.*(?:wasser|water))(?=.*(?:value|zahler|stand|meter|total))/, no: /preis|price|rate|status|problem|kosten|cost|flow|error|raw|timestamp|pre$/ },
  saving_total: { g: 'Zähler', l: 'PV-Ersparnis gesamt', d: P, re: /ersparnis|savings?/, no: /jahr|year|monat|month|tag|day|woche|week/, pri: /gesamt|total/ },
  saving_year: { g: 'Zähler', l: 'Ersparnis pro Jahr', d: P, re: /(?=.*(?:ersparnis|savings?))(?=.*(?:jahr|year))/ },
  packages: { g: 'Haushalt', l: 'Pakete', d: P, re: /paket|package|parcel/, no: /status|tracking|batter/ },
  tank: { g: 'Haushalt', l: 'Tankzeit', d: P, re: /tankzeit|tank.?zeit|best.?time.?fuel/ },
  printer_status: { g: '3D-Drucker', l: 'Druckstatus', d: P, re: /print.*status|druck.*status|printer.*state|print_state/, no: /camera/ },
  printer_plug: { g: '3D-Drucker', l: 'Drucker-Steckdose', d: ['switch'], re: /3d.?(?:drucker|printer)|(?:drucker|printer).*(?:steckdose|plug|socket)|steckdose.*(?:drucker|printer)/ },
  printer_plugw: { g: '3D-Drucker', l: 'Drucker-Verbrauch', d: P, u: /^k?w$/i, re: /3d.?(?:drucker|printer)|(?:drucker|printer).*(?:steckdose|plug|socket)|steckdose.*(?:drucker|printer)/ },
  printer_boxt: { g: '3D-Drucker', l: 'Gehäuse-Temperatur', d: P, u: /°/, re: /3d.?(?:drucker|printer)/, no: /nozzle|bed|dusen|bett/ },
  printer_boxh: { g: '3D-Drucker', l: 'Gehäuse-Luftfeuchte', d: P, u: /%/, re: /3d.?(?:drucker|printer).*(?:humid|feucht)/ },
  printer_time: { g: '3D-Drucker', l: 'Druckzeit gesamt', d: P, re: /druckzeit|print.?time/, no: /left|rest|verbleib|remain/ },
  pool_temp: { g: 'Pool', l: 'Pooltemperatur', d: P, u: /°/, re: /pool|spa(?:[^a-z]|$)|spa_|layz/, no: /garten|aussen|outdoor|luft|air|weather|max|ziel|target|soll/ },
  pool_power: { g: 'Pool', l: 'Pool-Leistung', d: P, u: /^k?w$/i, re: /pool|spa(?:[^a-z]|$)|spa_|layz/ },
  pool_pump: { g: 'Pool', l: 'Pool-Pumpe', d: ['switch'], re: /(?:pool|spa|layz).*pump|pump.*(?:pool|spa|layz)/ },
  pool_heat: { g: 'Pool', l: 'Pool-Heizung', d: ['switch'], re: /(?:pool|spa|layz).*(?:heat|heiz)|(?:heat|heiz).*(?:pool|spa|layz)/ },
  pool_rec: { g: 'Pool', l: 'Pool-Empfehlung (Smart Pool Assistant)', d: P, at: 'last_calculation', re: /pool.?empfehl|pool.?recommend/ },
  pool_fetch: { g: 'Pool', l: 'PoolLab-Abruf (Button)', any: true, d: ['button'], re: /poollab.*(?:abruf|fetch)|messwerte.?abrufen/ },
  pool_winter: { g: 'Pool', l: 'Pool-Winterschlaf (blendet Karte aus)', d: ['input_boolean', 'switch'], re: /winter/ },
  lz_conn: { g: 'Pool', l: 'LayzSpa Verbindung', d: ['binary_sensor'], re: /layz.*(?:connect|verbind)|(?:connect|verbind).*layz/ },
  lz_ip: { g: 'Pool', l: 'LayzSpa IP-Adresse', d: P, re: /layz.*(?:^|[^a-z])ip(?:[^a-z]|$)/ },
  lz_rssi: { g: 'Pool', l: 'LayzSpa WLAN-Signal', d: P, re: /layz.*(?:rssi|wlan|wifi|signal)/ },
  lz_bubbles: { g: 'Pool', l: 'LayzSpa Blubber', d: ['switch'], re: /layz.*(?:bubble|blubb|air)/ },
  lz_temp: { g: 'Pool', l: 'LayzSpa Ist-Temperatur', d: P, u: /°/, re: /layz|(?:^|[^a-z])spa(?:[^a-z]|$)/, no: /target|ziel|soll|setpoint/, pri: /temp_c|current|aktuell/ },
  lz_target: { g: 'Pool', l: 'LayzSpa Ziel-Temperatur (Anzeige)', d: P, u: /°/, re: /layz.*(?:target|ziel|soll)|(?:target|ziel|soll).*layz/ },
  lz_ctl: { g: 'Pool', l: 'LayzSpa Zieltemperatur steuern (climate/number)', d: ['climate', 'number'], re: /layz/ },
  lz_error: { g: 'Pool', l: 'LayzSpa Fehlercode', d: P, re: /layz.*(?:error|fehler)/ },
  health: { g: 'System', l: 'HA-Health-Score', d: P, re: /health.?score|ha.?health|haghs/, no: /hardware|application|zombie/ },
  pihole_ratio: { g: 'System', l: 'Pi-hole blockiert', d: P, re: /(?=.*pi.?hole)(?=.*(?:blockiert|blocked|ratio|percent|prozent|anteil))/ },
  pihole_queries: { g: 'System', l: 'Pi-hole Abfragen', d: P, re: /(?=.*pi.?hole)(?=.*(?:abfragen|queries))/, no: /blockiert|blocked|unique|einzigartig|anteil/ },
  pihole_clients: { g: 'System', l: 'Pi-hole Clients', d: P, re: /(?=.*pi.?hole)(?=.*clients)/ },
  pihole_switch: { g: 'System', l: 'Pi-hole Schalter', d: ['switch'], re: /pi.?hole/ },
  lage: { g: 'System', l: 'Lage Deutschland', d: P, re: /lage.*score|score.*lage/ },
  vent: { g: 'Hinweise', l: 'Hauslüftung (Room Climate)', d: P, re: /room.?climate.*haus.*luft|hausluftung/ },
  day: { g: 'Hinweise', l: 'Tageslage (Room Climate)', d: P, re: /room.?climate.*tageslage/ },
  ice: { g: 'Hinweise', l: 'Eiswarnung', d: P, at: 'is_ice_warning' },
  bike: { g: 'Hinweise', l: 'Fahrrad-Hinweis', d: P, re: /fahrrad|bike|cycl/, no: /batter|akku|speed|heart|puls|dist|status|power/ },
  pollen: { g: 'Hinweise', l: 'Pollen', d: P, re: /pollen|allergy/, no: /warnung|maximum|forecast_/, pri: /allergy_risk|risk|risiko/ },
};
const APPL_TYPES = [
  { re: /waschmaschine|washer|washing/, title: 'Waschmaschine', icon: 'mdi:washing-machine', hint: 'Wäsche entnehmen' },
  { re: /trockner|dryer/, title: 'Trockner', icon: 'mdi:tumble-dryer', hint: 'Wäsche entnehmen' },
  { re: /spulmaschine|geschirrspul|dishwasher/, title: 'Spülmaschine', icon: 'mdi:dishwasher', hint: 'Geschirr ausräumen' },
];
const WXL = { 'clear-night': 'Klare Nacht', sunny: 'Sonnig', cloudy: 'Bewölkt', partlycloudy: 'Teils bewölkt', rainy: 'Regen', pouring: 'Starkregen', snowy: 'Schnee', fog: 'Nebel', windy: 'Windig', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter mit Regen', hail: 'Hagel', exceptional: 'Außergewöhnlich' };
const APL = { wash: 'Wäscht', washing: 'Wäscht', rinse: 'Spült', spin: 'Schleudert', drying: 'Trocknet', run: 'Läuft', running: 'Läuft', finished: 'Fertig', end: 'Fertig', pause: 'Pausiert', paused: 'Pausiert', ready: 'Bereit', idle: 'Bereit', off: 'Aus' };
/* Rohwerte von Herstellern (snake_case) in lesbaren Klartext übersetzen; Unbekanntes wird zumindest sauber formatiert */
const HUMAN = {
  power_off: 'Aus', standby: 'Bereit', not_running: 'Bereit', in_use: 'In Betrieb', programmed: 'Programmiert', waiting_to_start: 'Wartet auf Start', delayed_start: 'Verzögerter Start', delay_start: 'Verzögerter Start',
  door_open: 'Tür offen', error: 'Fehler', aborting: 'Bricht ab', pre_wash: 'Vorwäsche', main_wash: 'Hauptwäsche', cooling: 'Kühlt ab', anti_crease: 'Knitterschutz', program_ended: 'Programm beendet', cleaning_is_complete: 'Reinigung fertig',
  eco: 'Eco', auto: 'Automatik', quick: 'Schnell', intensive: 'Intensiv', normal: 'Normal', cotton: 'Baumwolle', delicates: 'Feinwäsche', wool: 'Wolle', mixed: 'Mix', easy_care: 'Pflegeleicht', rinse_hold: 'Spülstopp', sportswear: 'Sportbekleidung', shirts: 'Hemden',
};
const human = (v) => {
  const k = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_'); if (HUMAN[k]) return HUMAN[k];
  if (!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(k)) return v;
  const t = k.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1);
};
const SEV = ['Kritisch', 'Warnung', 'Info'];
const PKG_DAYS = 5;
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
  button: 'mdi:gesture-tap-button', alarm_control_panel: 'mdi:shield-home', automation: 'mdi:robot', input_button: 'mdi:gesture-tap-button', update: 'mdi:package-up', lawn_mower: 'mdi:robot-mower', valve: 'mdi:valve',
};
const NAME_ICON = [[/stumm|mute|silence/i, 'mdi:bell-off'], [/restart|neustart|reboot/i, 'mdi:restart'], [/identify|finden|locate/i, 'mdi:map-marker-radius']];
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
  return { alerts: { ...DEF.alerts, ...v.alerts }, chips: { ...DEF.chips, ...v.chips }, excludeEntities: arr('excludeEntities'), excludeAreas: arr('excludeAreas'), pinned: arr('pinned'), homeCams: arr('homeCams'), hidden: arr('hidden'), hiddenAreas: arr('hiddenAreas'), order: { ...v.order }, roomSensors: JSON.parse(JSON.stringify(v.roomSensors || {})), sources: { ...v.sources }, quick: arr('quick'), custom: JSON.parse(JSON.stringify(v.custom || [])), devices: JSON.parse(JSON.stringify(v.devices || [])), size: { ...v.size }, place: { ...v.place }, ignore: arr('ignore'), battLimit: v.battLimit || DEF.battLimit, fx: mergeFx(v.fx), _pub: v._pub || 0, _base: v._base || 0, snooze: { ...v.snooze }, notify: { ...DEF.notify, ...v.notify }, door: { ...DEF.door, ...v.door, bell: [...((v.door && v.door.bell) || [])], motion: [...((v.door && v.door.motion) || [])] } };
};
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'gerade eben';
  if (m < 60) return `seit ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `seit ${h} h` : `seit ${Math.floor(h / 24)} d`;
};
const EVT_SUFFIX = [[/\s+Latest\s+Object\s+Detector\s+Snapshot\s*$/i, 'Letzte Erkennung'], [/\s+Latest\s+Thumbnail\s*$/i, 'Letztes Ereignis']];
const cleanName = (n) => {
  let s = String(n || '').replace(/\s*(Motion Detected|Belegung|Bewegung|Person Detection|Motion Alarm)\s*$/i, '').trim();
  let tail = '';
  for (const [re, label] of EVT_SUFFIX) if (re.test(s)) { s = s.replace(re, '').trim(); tail = label; break; }
  const w = s.split(' ');
  const half = w.length / 2;
  if (Number.isInteger(half) && w.slice(0, half).join(' ') === w.slice(half).join(' ')) s = w.slice(0, half).join(' ');
  return tail ? `${s} · ${tail}` : s;
};

const CSS = `
:host{display:block;height:calc(100vh - var(--header-height,56px));height:calc(100dvh - var(--header-height,56px));
 --fg:#3b3226;--fg2:rgba(59,50,38,.68);--a:rgba(110,88,56,.11);--b:rgba(255,255,255,.75);--from:#f2eadb;--to:#d6c5a8;
 --sheet:#f6f0e4;--selbg:#4a3c2b;--selfg:#f6f0e4;--accent:#e6b655;--accentfg:#3a2a00;--on:rgba(238,176,52,.46);--onring:rgba(205,140,20,.6);--line:rgba(59,50,38,.12);--nav:rgba(255,255,255,.5);
 --bad:rgba(205,65,50,.25);--badfg:#7d1f16;--warn:rgba(224,160,40,.32);--okbg:rgba(100,150,80,.22);--scrim:rgba(40,30,15,.45);--shadow:0 1px 3px rgba(80,60,30,.14);
 color:var(--fg);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
:host([theme=forest]){--on:rgba(255,190,70,.3);--onring:rgba(255,205,110,.65);--fg:#fff;--fg2:rgba(255,255,255,.72);--a:rgba(255,255,255,.12);--b:rgba(255,255,255,.2);--from:#5b7248;--to:#232f21;
 --sheet:#1f2a1e;--selbg:rgba(255,255,255,.88);--selfg:#223;--line:rgba(255,255,255,.1);--nav:rgba(0,0,0,.18);
 --bad:rgba(244,67,54,.5);--badfg:#fff;--warn:rgba(255,193,7,.28);--okbg:rgba(120,200,120,.25);--scrim:rgba(0,0,0,.55);--shadow:none}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.app{height:100%;display:flex;flex-direction:column;background:linear-gradient(165deg,var(--zp-from,var(--from)) 0%,var(--zp-to,var(--to)) 100%)}
.body{flex:1;overflow:auto;padding:20px 18px 16px}
.top{display:flex;align-items:center;gap:12px}
.logo{width:48px;height:48px;border-radius:14px;background:var(--a);display:grid;place-items:center}
.ttl{font-size:18px;font-weight:600;flex:1}
[data-act]{cursor:pointer;-webkit-tap-highlight-color:transparent}[data-act=noop]{cursor:auto}
.pill{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:99px;background:var(--a);cursor:pointer;border:0;color:inherit;font:inherit;font-size:14px}
.pill.warn{background:var(--warn)}.pill.bad{background:var(--bad);color:var(--badfg)}.pill.ok{background:var(--okbg)}
.pill ha-icon{--mdc-icon-size:18px}
.vent{display:flex;gap:10px;align-items:center;margin:2px 0 6px;color:var(--fg2);font-size:13px;cursor:pointer}.vent b{display:block;font-size:14px;font-weight:600;color:var(--fg)}.vent ha-icon{--mdc-icon-size:22px;flex:none}.vent.warn ha-icon{color:#c98a2b}.vent.bad ha-icon{color:#c0504a}
.meta{margin:26px 0 6px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg2)}
h1{margin:0;font-size:clamp(26px,7.4vw,38px);line-height:1.1;font-weight:600;letter-spacing:-.02em}
.hello{display:flex;gap:14px;align-items:center;margin:14px 0 14px}.hello .sub{font-size:14px;color:var(--fg2);margin-top:4px}
.av{width:42px;height:42px;border-radius:50%;background:var(--b);display:grid;place-items:center;position:relative;font-weight:600;flex:none}
.av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.av i{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#9a9a9a;border:2px solid var(--from)}
.hello .av{width:64px;height:64px;font-size:24px}.pp.home .av i{background:#4caf50}
.pp{position:relative;display:flex;align-items:center;gap:10px;background:var(--a);border-radius:99px;padding:5px 16px 5px 5px;cursor:pointer}
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
.pl.on{background:var(--on);box-shadow:inset 0 0 0 1.5px var(--onring),var(--shadow)}.pl.on .plt ha-icon{color:var(--accentfg)}
.plt{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);cursor:pointer}
.plt ha-icon{--mdc-icon-size:24px;color:var(--fg)}.plt em{font-style:normal;margin-left:auto}
.plv{font-size:30px;font-weight:600;margin-top:auto;cursor:pointer}.plv small{font-size:16px;font-weight:500;color:var(--fg2);margin-left:4px}
.pl .cn{margin-top:2px}.pl .cs{margin-top:8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.pkr{margin-top:12px}.pkr b{display:block;font-size:14px}.pkr span{font-size:12.5px;color:var(--fg2)}
.en img{width:100%;border-radius:12px;display:block;margin-top:12px;aspect-ratio:16/9;object-fit:cover}
.en .pills{margin:12px 0 0}
.sq{width:46px;height:46px;border-radius:14px;border:0;background:var(--b);color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}
.note{display:flex;gap:10px;align-items:center;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2);margin-bottom:14px;cursor:pointer}
.note ha-icon{--mdc-icon-size:20px;flex:none}.note.sv0{color:#e5484d}.note.sv1{color:#e8a13a}.sev{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:var(--fg2)}.sev.s0{background:#e5484d}.sev.s1{background:#e8a13a}
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
.mini.po{position:absolute;top:6px;left:38px;z-index:2;background:rgba(40,30,20,.72);color:#fff;width:26px;height:26px}
.tools .mini{width:36px;height:36px;background:rgba(40,30,20,.72);color:#fff}.tools .mini ha-icon{--mdc-icon-size:20px}
.pill .tools .mini{width:26px;height:26px}.pill .tools .mini ha-icon{--mdc-icon-size:16px}
:host(.ed) .tile,:host(.ed) .card,:host(.ed) .pl,:host(.ed) .cam,:host(.ed) .pill,:host(.ed) .mw,:host(.ed) .vc,:host(.ed) .cl,:host(.ed) .ap{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;cursor:grab}
:host(.ed) .tile{padding-right:78px}:host(.ed) .plt em{margin-right:42px}
.dgo{z-index:50!important;box-shadow:0 12px 30px rgba(0,0,0,.35)!important;opacity:.92;transition:none!important;pointer-events:none}
.dgt{outline:3px solid var(--fg)!important;outline-offset:-3px}
.tile .ic{width:42px;height:42px;border-radius:50%;background:var(--a);display:grid;place-items:center;flex:none}
.tile .tx{min-width:0;flex:1}
.tile.on{background:var(--on);box-shadow:inset 0 0 0 1.5px var(--onring),var(--shadow)}.tile.bad{background:var(--bad);box-shadow:inset 0 0 0 1.5px rgba(205,65,50,.6)}.tile.bad .ic{background:rgba(205,65,50,.75);color:#fff}.tile.on .ic{background:var(--accent);color:var(--accentfg)}
.tile.sens .ic{background:transparent}
.cams.hc{grid-template-columns:repeat(2,minmax(0,1fr))}.cams.hc .cam:last-child:nth-child(odd){grid-column:1/-1}.grid .cam{grid-column:span 2}
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
.sbg{position:absolute;top:0;right:0;bottom:0;left:0;background:var(--scrim);display:flex;align-items:flex-end;justify-content:center;z-index:5}
.sheet{width:100%;max-width:560px;max-height:82%;overflow:auto;background:var(--sheet);border-radius:24px 24px 0 0;padding:18px 18px 28px}
.sxw{position:sticky;top:-6px;height:0;z-index:3;display:flex;justify-content:flex-end;overflow:visible}.sx{width:44px;height:44px;margin:-8px -8px 0 0;border:0;border-radius:50%;background:var(--b);color:var(--fg);display:grid;place-items:center;cursor:pointer;box-shadow:var(--shadow);touch-action:manipulation}.sx ha-icon{--mdc-icon-size:24px}
.sheet h2{margin:0 52px 12px 0;font-size:20px}.sheet h4{margin:18px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg2);font-weight:500}
.row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.row .t{flex:1;min-width:0}.row .t b{display:block;font-size:15px;font-weight:500}.row .t span{font-size:12.5px;color:var(--fg2)}
.row button{border:0;border-radius:99px;padding:7px 12px;background:var(--a);color:inherit;font:inherit;font-size:13px;cursor:pointer}
.row button.sel{background:var(--selbg);color:var(--selfg)}
.srch,.ccin{width:100%;padding:12px 14px;border-radius:12px;border:0;background:var(--a);color:var(--fg);font:inherit;font-size:15px;margin-bottom:10px;outline:none}
.srch::placeholder,.ccin::placeholder{color:var(--fg2)}
.tile.sz-w,.pl.sz-w{grid-column:span 2}.tile.sz-f,.pl.sz-f{grid-column:1/-1}
.tile .tools .mini{width:30px;height:30px}.tile .tools .mini ha-icon{--mdc-icon-size:17px}
.mw{container-type:inline-size}.enw{height:100%}.enw>.en{height:100%;box-sizing:border-box}
.en .hd>div:nth-child(2){min-width:0}.en .hd b,.en .rl span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.en .rl span:first-child{min-width:0}
@container (max-width:270px){.en{padding:12px}.en .hd{flex-wrap:wrap;gap:8px}.en .ib{width:34px;height:34px}.en .hd>div:nth-child(2){flex:1;min-width:0}.en .hd b{font-size:14px}.en .hd span{font-size:11.5px}.en .big{margin-left:0;flex-basis:100%;font-size:26px}.en .rl{font-size:12.5px}.en .rl ha-icon{margin-right:4px}.en .rl span:first-child{white-space:normal}.en .rw{margin-top:10px}}
.en .rl span:last-child{white-space:nowrap;flex:none}
.mw.sz-w{grid-column:span 2}.mw.sz-f{grid-column:1/-1}
.mw>.card,.mw>.en,.mw>.qs{height:100%;box-sizing:border-box}
.dbp{position:fixed;top:0;right:0;bottom:0;left:0;z-index:50}
.dbb{position:absolute;top:0;right:0;bottom:0;left:0;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}
.dbc{width:100%;max-width:720px;max-height:100%;overflow:auto;background:var(--sheet);color:var(--fg);border-radius:24px;padding:14px;box-sizing:border-box}
.dbh{display:flex;align-items:center;gap:12px;margin-bottom:10px}.dbh>div{flex:1;min-width:0}.dbh b{display:block;font-size:18px}.dbh span{font-size:12.5px;color:var(--fg2)}.dbh>ha-icon{--mdc-icon-size:28px;color:var(--accent)}
.dbv{position:relative;height:0;padding-top:56.25%;border-radius:16px;overflow:hidden;background:#000}.dbv img,.dbv ha-camera-stream{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block}
.dbbar{height:4px;border-radius:2px;background:var(--line);margin:10px 0;overflow:hidden}.dbbar i{display:block;height:100%;background:var(--accent);animation:dbbar linear forwards}
@keyframes dbbar{from{width:100%}to{width:0}}
.dbf{display:flex;gap:8px;justify-content:flex-end}
.mw.qw{align-self:start}.mw.qw>.qs{height:auto}
[data-act]:focus{outline:none}[data-act]:focus-visible{outline:2px solid var(--accent,#c28a2c);outline-offset:2px}
.card.sz-w,.vc.sz-w,.cl.sz-w,.ap.sz-w{grid-column:span 2}.card.sz-f,.vc.sz-f,.cl.sz-f,.ap.sz-f{grid-column:1/-1}
.mw .tools{flex-wrap:wrap;justify-content:flex-end;max-width:100%}.mw .tools .mini{width:30px;height:30px}.mw .tools .mini ha-icon{--mdc-icon-size:17px}
.mini.sz{position:absolute;top:6px;left:70px;z-index:2;background:rgba(40,30,20,.72);color:#fff;width:26px;height:26px}
.grid.reg{margin:4px 0 12px}
.en.nopt{cursor:default}
.qs{background:var(--a);border-radius:20px;padding:14px}
.qh{display:flex;gap:8px;align-items:center;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg2);margin-bottom:10px}.qh ha-icon{--mdc-icon-size:18px}
.qc{display:flex;flex-wrap:wrap;gap:8px}
.qa{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:99px;padding:10px 14px;background:var(--b);color:inherit;font:inherit;font-size:14px;cursor:pointer;box-shadow:var(--shadow);transition:background .2s}
.qa ha-icon{--mdc-icon-size:20px}.qa.ok{background:var(--accent);color:var(--accentfg)}
.qa.add{background:transparent;box-shadow:none;border:1.5px dashed var(--fg2);color:var(--fg2)}
.qx{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.25);color:#fff;margin-right:-6px}.qx ha-icon{--mdc-icon-size:14px}
.br{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);cursor:pointer;margin-top:4px}
.br .t{flex:1;min-width:0}.br .t b{display:block;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.br .t span{font-size:12px;color:var(--fg2)}
.br em{font-style:normal;font-size:14px;font-weight:600}.br>ha-icon{--mdc-icon-size:22px;flex:none}
.spk{display:block;width:100%;color:var(--fg);overflow:visible}.spk.a{color:var(--accent)}
.spi{width:64px;display:inline-block}
.card.on,.card.cu.on{background:var(--on);box-shadow:inset 0 0 0 1.5px var(--onring),var(--shadow)}.card.on>ha-icon{color:var(--accentfg)}
.card.cu.sp{gap:6px;width:100%;box-sizing:border-box}.card.cu .spt{display:flex;gap:12px;align-items:center;width:100%}
.card.cu .spl{font-size:12px;color:var(--fg2)}
.en .rw .spk{margin-top:6px}
.pool{--ok:#3d8b40;--wn:#b4731a;--bd:#c0392b;--bl:#23729e;background:var(--a);border-radius:20px;padding:16px;min-width:0}
:host([theme=forest]) .pool{--ok:#8fd18f;--wn:#ffcf66;--bd:#ff9a90;--bl:#8ccdf2}
.pool b{font-weight:600}
.pool .s-ok{color:var(--ok)}.pool .s-wn{color:var(--wn)}.pool .s-bd{color:var(--bd)}.pool .s-bl{color:var(--bl)}
.pool-hd{display:flex;align-items:center;gap:12px}
.pool-hd .ib{width:44px;height:44px;border-radius:14px;background:var(--b);display:grid;place-items:center;flex:none}
.pool-hd .tt{flex:1;min-width:0}.pool-hd .tt b{display:block;font-size:16px}.pool-hd .tt span{display:block;font-size:12.5px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pool-hd .big{font-size:30px;font-weight:600;white-space:nowrap;cursor:pointer}
.pool-err{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:10px 12px;border-radius:14px;background:var(--bad);color:var(--badfg);font-size:13px;line-height:1.4}
.pool-err ha-icon{--mdc-icon-size:22px;flex:none}
.pool-strip{display:grid;grid-template-columns:1fr 1fr 1.1fr;gap:8px;margin-top:12px}
.pool-seg{border-radius:14px;padding:10px 12px;background:var(--b);min-width:0;display:flex;flex-direction:column;gap:3px}
.pool-seg.ok{background:var(--okbg)}.pool-seg.wn{background:var(--warn)}.pool-seg.bd{background:var(--bad)}.pool-seg.bl{background:rgba(60,150,210,.2)}
.pool-seg small{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg2)}
.pool-seg b{font-size:14.5px;line-height:1.25}.pool-seg i{font-style:normal;font-size:12px;color:var(--fg2);line-height:1.3}
.pool-seg.ok b{color:var(--ok)}.pool-seg.wn b{color:var(--wn)}.pool-seg.bd b{color:var(--badfg)}.pool-seg.bl b{color:var(--bl)}
.pool-seg .pool-ab{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;flex-wrap:wrap}
.pool-tag{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;border-radius:99px;padding:3px 8px;background:var(--a)}
.pool-btn{border:0;border-radius:99px;padding:8px 14px;background:var(--selbg);color:var(--selfg);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.pool-btn:disabled{opacity:.55;cursor:default}
.pool-btn.alt{background:var(--b);color:var(--fg)}.pool-btn.sel{background:var(--accent);color:var(--accentfg)}
.pool-vals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.pool-v{background:var(--b);border-radius:14px;padding:10px 8px;text-align:center;min-width:0;cursor:pointer}
.pool-v small{display:block;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2)}
.pool-v b{display:block;font-size:19px;margin-top:2px;white-space:nowrap}.pool-v em{display:block;font-style:normal;font-size:11px;color:var(--fg2);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pool-rr{display:flex;gap:12px;margin-top:14px}.pool-rr>ha-icon{--mdc-icon-size:26px;flex:none;margin-top:1px}
.pool-rc{flex:1;min-width:0;font-size:14px;line-height:1.45}
.pool-hist{font-size:12px;color:var(--fg2);font-style:italic;margin-top:2px}
.pool-note{margin-top:6px;padding:8px 10px;border-radius:12px;background:var(--b);font-size:13px;line-height:1.4}
.pool-sp{font-size:12px;color:var(--fg2)}
.pool-in{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:8px}
.pool-in label{display:flex;flex-direction:column;gap:3px;flex:1 1 90px;min-width:80px;font-size:11px;font-weight:600;color:var(--fg2)}
.pool-in>input{flex:1 1 90px;width:auto!important}
.pool input[type=number]{width:100%;min-width:0;height:38px;border-radius:12px;border:0;background:var(--b);color:var(--fg);font:inherit;font-size:15px;padding:0 10px;outline:none}
.pool input::placeholder{color:var(--fg2)}.pool input:disabled{opacity:.5}
.pool-ok{height:38px;border:0;border-radius:12px;padding:0 16px;background:var(--selbg);color:var(--selfg);font:inherit;font-size:14px;font-weight:600;cursor:pointer;flex:none}
.pool-ok:disabled{opacity:.45;cursor:default}
.pool-lnk{display:inline-block;margin-top:6px;font-size:12.5px;color:var(--fg2);cursor:pointer;text-decoration:underline}
.pool-bk{margin-top:6px;padding:8px 10px;border-radius:12px;background:var(--b);font-size:12.5px}
.pool-bk div{display:flex;justify-content:space-between;gap:10px;padding:2px 0}.pool-bk div.sum{border-top:1px solid var(--line);margin-top:4px;padding-top:6px;font-weight:600}
.pool-sec{background:var(--b);border-radius:16px;margin-top:10px;overflow:hidden}
.pool-sh{display:flex;align-items:center;gap:8px;padding:12px 12px;cursor:pointer;min-width:0}
.pool-sh>ha-icon{--mdc-icon-size:22px;flex:none}.pool-sh b{font-size:14px;white-space:nowrap}
.pool-ss{flex:1;min-width:0;text-align:right;font-size:12px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pool-sh .pool-ch{color:var(--fg2)}
.pool-sb{padding:2px 12px 14px;font-size:13.5px}
.pool-tb{display:flex;flex-direction:column}
.pool-tr{display:grid;grid-template-columns:minmax(80px,1fr) minmax(70px,.9fr) minmax(70px,.9fr) minmax(100px,1.2fr);gap:10px;padding:8px 0;border-bottom:1px solid var(--line);align-items:center}
.pool-tr:last-child{border-bottom:0}.pool-tr.th{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2);padding-top:4px}
.pool-tr .r{text-align:right;color:var(--fg2);font-size:12.5px}.pool-tr small{display:block;font-size:11px;color:var(--fg2);font-weight:400}
.pool-tr.hs{grid-template-columns:minmax(60px,.8fr) minmax(90px,1.4fr) minmax(70px,.8fr) minmax(80px,.9fr)}
.pool-wx{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pool-wc{background:var(--a);border-radius:14px;padding:10px}.pool-wc .d{font-size:12px;color:var(--fg2)}
.pool-wc .t{display:flex;justify-content:space-between;align-items:center;margin-top:2px}.pool-wc .t ha-icon{--mdc-icon-size:26px}
.pool-wc .m{display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px;gap:8px}.pool-wc .m span{color:var(--fg2)}
.pool-kv{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--line);font-size:13px}
.pool-kv:last-child{border-bottom:0}.pool-kv span{color:var(--fg2)}.pool-kv b{text-align:right;min-width:0}
.pool-2c{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pool-card2{background:var(--a);border-radius:14px;padding:10px 12px}.pool-card2 h5{margin:0 0 6px;font-size:14px;display:flex;justify-content:space-between;gap:8px}
.pool-ctrl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
.pool-cb{border:0;border-radius:14px;padding:12px 6px;background:var(--a);color:inherit;font:inherit;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer}
.pool-cb ha-icon{--mdc-icon-size:24px}.pool-cb.on{background:var(--accent);color:var(--accentfg)}.pool-cb:disabled{opacity:.45;cursor:default}
.pool-tmp{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:12px}.pool-tmp div{text-align:center}.pool-tmp small{display:block;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2)}.pool-tmp b{font-size:24px}
.pool-adj{display:flex;align-items:center;gap:12px;margin-top:12px}.pool-adj span{flex:1;text-align:center;font-size:12.5px;color:var(--fg2)}
.pool-adj button{width:44px;height:40px;border:0;border-radius:12px;background:var(--selbg);color:var(--selfg);font:inherit;font-size:22px;line-height:1;cursor:pointer}.pool-adj button:disabled{opacity:.45;cursor:default}
.pool-eta{margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--a);text-align:center}.pool-eta small{display:block;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2)}.pool-eta b{display:block;font-size:17px;margin-top:2px}.pool-eta i{display:block;font-style:normal;font-size:12px;color:var(--fg2);margin-top:1px}
.pool-chips{display:flex;gap:8px;flex-wrap:wrap}.pool-chip{background:var(--a);border-radius:12px;padding:7px 10px;font-size:12.5px;display:flex;flex-direction:column}.pool-chip small{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2)}
.pool-modes{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pool-ft{margin-top:12px;font-size:11.5px;color:var(--fg2);line-height:1.5}
.pool-lz{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;border-radius:99px;padding:3px 9px;background:var(--a);flex:none}
.pool-lz i{width:8px;height:8px;border-radius:50%;background:var(--bd);display:block}.pool-lz.on i{background:var(--ok)}
.prn-cam{margin-top:12px;border-radius:14px;overflow:hidden;background:var(--b);cursor:pointer}.prn-cam img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.prn-bar{margin-top:12px}.prn-t{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:12.5px;color:var(--fg2)}
.prn-ch{margin-top:12px}.prn-ch .pool-chip{cursor:pointer;flex:1 1 90px}.prn-ch .pool-chip b{display:flex;align-items:center;gap:4px;font-size:15px}.prn-ch .pool-chip b i{font-style:normal;font-size:12px;color:var(--fg2)}.prn-ch ha-icon{--mdc-icon-size:16px;width:16px;height:16px}
.prn-act{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.prn-act .pool-btn{flex:1 1 90px;display:flex;align-items:center;justify-content:center;gap:6px}.prn-act ha-icon{--mdc-icon-size:18px;width:18px;height:18px}
.pool-btn.prn-pa{background:#ffad45;color:#2b1a00}.pool-btn.prn-re{background:#3f9d56;color:#fff}.pool-btn.prn-st{background:#e5484d;color:#fff}.pool-btn.cf{outline:2px solid var(--fg);outline-offset:1px}
.prn-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
.prn-box{display:flex;align-items:center;gap:10px;background:var(--b);border-radius:14px;padding:9px 10px;min-width:0;cursor:pointer}
.prn-box .i{width:34px;height:34px;border-radius:10px;background:var(--a);display:grid;place-items:center;flex:none}
.prn-box small,.prn-c small{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg2)}
.prn-box b{font-size:17px;white-space:nowrap}.prn-box b i,.prn-c b i{font-style:normal;font-size:11px;color:var(--fg2);margin-left:2px}
.prn-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}
.prn-c{background:var(--b);border-radius:14px;padding:9px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
.prn-c ha-icon{--mdc-icon-size:18px;width:18px;height:18px}.prn-c b{font-size:16px;white-space:nowrap;cursor:pointer}
.prn-c .sp{display:flex;align-items:center;gap:6px;margin-top:4px}.prn-c .sp button{width:30px;height:30px;border-radius:99px;border:0;background:var(--a);color:var(--fg);font:inherit;font-size:17px;line-height:1;cursor:pointer}
.prn-pv{margin-top:12px;border-radius:14px;overflow:hidden;cursor:pointer}.prn-pv img{display:block;width:100%;max-height:280px;object-fit:contain;background:var(--b)}
@container (max-width:520px){
  .pool{padding:12px}
  .pool-strip{grid-template-columns:1fr}
  .pool-vals{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pool-2c{grid-template-columns:1fr}
  .pool-tr{grid-template-columns:1fr 1fr;row-gap:2px}.pool-tr.th{display:none}.pool-tr .r{text-align:left}
  .pool-tr.hs{grid-template-columns:1fr 1fr}
  .pool-hd .big{font-size:26px}
  .prn-4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pool-ss{display:none}
}
.dvc{background:var(--a);border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0;position:relative}
.dvc.run{background:rgba(120,170,110,.25)}
.dvh{display:flex;align-items:center;gap:12px;cursor:pointer;min-width:0}.dvh .ib{width:42px;height:42px;border-radius:14px;background:var(--line);display:grid;place-items:center;flex:none}
.dvh .tt{min-width:0;flex:1;display:flex;flex-direction:column}.dvh .tt b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dvh .tt span{font-size:12.5px;color:var(--fg2)}
.dvh .big{font-size:30px;font-weight:600;letter-spacing:-.02em;flex:none}
.dvb{display:flex;gap:8px;flex-wrap:wrap}.dvb .sq{width:44px;height:44px}
.dvf{display:flex;gap:6px;flex-wrap:wrap}
.dvs{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px}
.dvs>div{background:var(--line);border-radius:14px;padding:8px 10px;min-width:0;cursor:pointer}.dvs small{display:block;font-size:11px;color:var(--fg2)}.dvs b{font-size:15px;font-weight:600}
.dvm{display:flex;flex-direction:column;gap:8px}.dvm>div{display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:13px;cursor:pointer}.dvm span{color:var(--fg2)}
.dvm i{grid-column:1/-1;height:5px;border-radius:3px;background:var(--line);overflow:hidden}.dvm i u{display:block;height:100%;background:var(--b)}.dvm i.lo u{background:#c9694f}
.dverr{display:flex;gap:8px;align-items:center;background:rgba(200,80,60,.16);border-radius:12px;padding:8px 10px;font-size:13px}.dverr ha-icon{--mdc-icon-size:20px;flex:none}
.bb{height:5px;border-radius:3px;background:var(--line);overflow:hidden;margin-top:5px}.bb u{display:block;height:100%;background:#7fa56a}.bb.wn u{background:#d9a441}.bb.lo u{background:#c9694f}
.br em.lo,.br>ha-icon.lo{color:#c9694f}.br em.wn,.br>ha-icon.wn{color:#b8862b}
.px{display:grid;grid-template-columns:auto minmax(0,1fr) 74px 74px;gap:4px 10px;align-items:center;padding:9px 0;border-top:1px solid var(--line);cursor:pointer;margin-top:4px}
.px>ha-icon{--mdc-icon-size:22px}.px .t{min-width:0}.px .t b{display:block;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.px .t span{font-size:12px;color:var(--fg2)}
.px>span{font-size:12.5px;text-align:right;white-space:nowrap}.px.off>ha-icon,.px.off .st{color:#c9694f}.px.na{opacity:.55}.px .st{grid-column:span 2;font-weight:600}
.dvc.pxoff{opacity:.85}
@media (max-width:480px){.px{grid-template-columns:auto minmax(0,1fr) 62px 62px;gap:4px 6px}.px>span{font-size:12px}}
`;

const SIZES = ['s', 'w', 'f'];
const SIZE_ICON = { s: 'mdi:size-s', w: 'mdi:size-m', f: 'mdi:size-l' };
const BATX = /phone|ipad|watch|handy|tablet|pixel|galaxy|saug|vacuum|robo|laptop|macbook/;
/* Karten-Register: jede Karte ist ein Objekt { id, label, icon, home, fixed, size, items(card) -> [{ id, html, size, cfg }] }.
   Auch von außen erweiterbar: window.LumoraCards.register({...}). */
const REG = [];
const hmMin = (m) => { const hh = Math.floor(m / 60); const mm = m % 60; return hh <= 0 ? `${mm} min` : mm <= 0 ? `${hh} h` : `${hh} h ${mm} min`; };
const dvStat = (c, l, s2, d) => (s2 ? `<div data-act="info" data-id="${s2.entity_id}"><small>${l}</small><b>${c._dvVal(s2, d)}</b></div>` : '');
const newItems = () => { const items = []; return { items, add: (id, html, wide) => { if (html) items.push({ id, html, size: wide ? 'f' : 's' }); } }; };
const registerCard = (def) => { const i = REG.findIndex((x) => x.id === def.id); if (i >= 0) REG[i] = def; else REG.push(def); };

/* ---------- Effekte (Overlay über dem ganzen Dashboard) ---------- */
const FX_KEYS = ['weather', 'night', 'autumn', 'halloween', 'christmas'];
const FX_LABEL = {
  weather: ['Wetter', 'Regen, Schnee, Hagel, Gewitter, Nebel und Wolken passend zur Wetter-Entität'],
  night: ['Nachthimmel', 'Sterne, Mond mit Phase und Sternschnuppen nach Sonnenstand'],
  autumn: ['Herbst', 'Fallende Blätter, automatisch 22.9. bis 30.11.'],
  halloween: ['Halloween', 'Fledermäuse, Spinne, Geister, automatisch 24.10. bis 1.11.'],
  christmas: ['Weihnachten', 'Schnee, Lichterkette und Schlitten, automatisch ab 1. Advent bis 6.1.'],
};
const FX_MODES = ['auto', 'on', 'off'];
const FX_MODE_L = { auto: 'Auto', on: 'Immer an', off: 'Aus' };
const FX_WMODES = ['auto', 'rain', 'snow', 'storm', 'fog', 'off'];
const FX_WMODE_L = { auto: 'Auto', rain: 'Test: Regen', snow: 'Test: Schnee', storm: 'Test: Gewitter', fog: 'Test: Nebel', off: 'Aus' };
const FX_DURS = [0, 30, 60, 300, 900, 3600];
const durL = (d) => (!d ? 'Dauerhaft' : d < 60 ? `${d} s` : d < 3600 ? `${d / 60} Min.` : `${d / 3600} Std.`);
const FX_LEVELS = [['Wenig', 0.5], ['Mittel', 1], ['Viel', 1.6]];
const fxDate = (now) => {
  const y = now.getFullYear(); const m = now.getMonth(); const d = now.getDate();
  const day = (mm, dd) => mm * 100 + dd; const cur = day(m, d);
  const f4 = new Date(y, 11, 24); f4.setDate(24 - f4.getDay());
  const f1 = new Date(f4); f1.setDate(f4.getDate() - 21);
  return {
    autumn: cur >= day(8, 22) && cur <= day(10, 30),
    halloween: cur >= day(9, 24) && cur <= day(10, 1),
    christmas: now >= f1 || cur <= day(0, 6),
  };
};
const moonPhase = () => { const jd = Date.now() / 86400000 + 2440587.5; const p = ((jd - 2451550.1) / 29.530588853) % 1; return p < 0 ? p + 1 : p; };
const Fx = (() => {
  let cv = null; let ctx = null; let W = 0; let H = 0; let raf = 0; let last = 0; let dpr = 1;
  const owners = new Set(); let hiddenAt = 0;
  let conf = { level: 1, act: {} };
  const S = {}; // Zustand je Effekt
  const R = (a, b) => a + Math.random() * (b - a);
  const scale = () => Math.max(0.5, Math.min(1.6, (W * H) / (1280 * 720)));
  const get = (k) => S[k] || (S[k] = { a: 0, t0: 0, on: false, p: [], v: '', tm: 0 });
  const resize = () => {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const vis = () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 30000) FX_KEYS.forEach((k) => { if (S[k]) S[k].t0 = Date.now(); });
    hiddenAt = 0; kick();
  };
  const mount = () => {
    if (cv) return;
    cv = document.createElement('canvas'); cv.id = 'lumora-fx';
    cv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5';
    cv.setAttribute('aria-hidden', 'true');
    ctx = cv.getContext('2d'); document.body.appendChild(cv); resize();
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', vis);
  };
  const unmount = () => {
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis);
    if (cv) cv.remove(); cv = null; ctx = null; FX_KEYS.forEach((k) => delete S[k]);
  };
  const kick = () => { if (!raf && cv && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };

  /* --- Partikel-Fabriken --- */
  const n = (base) => Math.round(base * conf.level * scale());
  const fill = (arr, count, mk) => { while (arr.length < count) arr.push(mk(true)); if (arr.length > count + 8) arr.length = count; };
  const mkDrop = (init, heavy) => ({ x: R(-100, W + 100), y: init ? R(-H, H) : R(-60, -5), l: R(heavy ? 14 : 10, heavy ? 26 : 20), s: R(heavy ? 900 : 650, heavy ? 1300 : 900) });
  const mkFlake = (init, big) => ({ x: R(0, W), y: init ? R(0, H) : R(-10, -2), r: R(1, big ? 4 : 3), s: R(30, 75), ph: R(0, 6.28), w: R(0.5, 1.4) });
  const mkLeaf = (init) => ({ x: R(0, W), y: init ? R(0, H) : R(-30, -10), sz: R(9, 17), s: R(35, 80), ph: R(0, 6.28), w: R(0.6, 1.5), rot: R(0, 6.28), rs: R(-2, 2), c: ['#c0562a', '#d98a1f', '#a63a1e', '#8a5a2b', '#e0b030', '#b8481c'][Math.floor(R(0, 6))] });
  const mkStar = () => ({ x: R(0, W), y: R(0, H * 0.7), r: R(0.4, 1.5), ph: R(0, 6.28), sp: R(0.8, 2.4) });
  const mkBat = (init) => { const dir = Math.random() < 0.5 ? 1 : -1; return { x: init ? R(0, W) : (dir > 0 ? -50 : W + 50), y: R(40, H * 0.5), dir, s: R(70, 140), sz: R(26, 40), ph: R(0, 6.28), amp: R(20, 60), f: R(0.8, 1.6) }; };
  const mkGhost = () => ({ x: R(0, W), y: R(H * 0.2, H * 0.8), s: R(10, 25), ph: R(0, 6.28), sz: R(34, 52) });

  /* --- Zeichnen --- */
  const rain = (st, dt, a, heavy, slant) => {
    fill(st.p, n(heavy ? 170 : 90), () => mkDrop(true, heavy));
    ctx.strokeStyle = `rgba(175,205,255,${0.5 * a})`; ctx.lineWidth = 1.2; ctx.beginPath();
    st.p.forEach((d, i) => {
      d.y += d.s * dt; d.x += d.s * dt * slant;
      if (d.y > H) st.p[i] = mkDrop(false, heavy);
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * slant, d.y - d.l);
    });
    ctx.stroke();
  };
  /* Tropfen an der Scheibe: wachsen langsam, laufen ab einer Größe als Schlieren nach unten */
  const mkPane = (init) => ({ x: R(0, W), y: R(0, H), r: init ? R(1, 4.5) : R(0.8, 1.6), sl: 0, vy: 0, y0: 0 });
  const pane = (st, dt, a, heavy) => {
    const arr = st.pd || (st.pd = []); const cnt = n(heavy ? 46 : 28);
    while (arr.length < cnt) arr.push(mkPane(true));
    if (arr.length > cnt + 8) arr.length = cnt;
    ctx.fillStyle = `rgba(205,225,255,${0.2 * a})`; ctx.strokeStyle = `rgba(255,255,255,${0.32 * a})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); const trail = [];
    arr.forEach((d, i) => {
      if (!d.sl) {
        d.r += dt * (heavy ? 0.45 : 0.25);
        if (d.r > 5 + (i % 3)) { d.sl = 1; d.vy = R(30, 70); d.y0 = d.y; }
      } else {
        d.y += d.vy * dt; d.r -= dt * 0.7;
        trail.push(d);
        if (d.y > H || d.r < 1) { arr[i] = mkPane(false); return; }
      }
      ctx.moveTo(d.x + d.r, d.y); ctx.arc(d.x, d.y, d.r, 0, 6.283);
    });
    ctx.fill(); ctx.stroke();
    if (trail.length) { ctx.strokeStyle = `rgba(205,225,255,${0.12 * a})`; ctx.lineWidth = 1.6; ctx.beginPath(); trail.forEach((d) => { ctx.moveTo(d.x, d.y0); ctx.lineTo(d.x, d.y); }); ctx.stroke(); }
  };
  const snow = (st, dt, a, big, cnt, t) => {
    fill(st.p, n(cnt), () => mkFlake(true, big));
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    st.p.forEach((f, i) => {
      f.y += f.s * dt; f.x += Math.sin(t * f.w + f.ph) * 22 * dt;
      if (f.y > H + 6) st.p[i] = mkFlake(false, big);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    });
  };
  const fogs = (st, dt, a) => {
    fill(st.p, 6, () => ({ x: R(0, W), y: R(H * 0.1, H * 0.95), r: R(220, 420), s: R(6, 18) * (Math.random() < 0.5 ? 1 : -1) }));
    st.p.forEach((f) => {
      f.x += f.s * dt; if (f.x > W + f.r) f.x = -f.r; if (f.x < -f.r) f.x = W + f.r;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, `rgba(200,208,215,${0.2 * a})`); g.addColorStop(1, 'rgba(200,208,215,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    });
  };
  const clouds = (st, dt, a) => {
    fill(st.p, 5, () => ({ x: R(0, W), y: R(20, H * 0.35), r: R(120, 220), s: R(4, 10) }));
    st.p.forEach((c) => {
      c.x += c.s * dt; if (c.x > W + c.r * 2) c.x = -c.r * 2;
      [[0, 0, 1], [0.7, 0.15, 0.75], [-0.7, 0.2, 0.7], [0.3, -0.25, 0.7]].forEach(([dx, dy, k]) => {
        const g = ctx.createRadialGradient(c.x + dx * c.r, c.y + dy * c.r, 0, c.x + dx * c.r, c.y + dy * c.r, c.r * k);
        g.addColorStop(0, `rgba(205,212,222,${0.2 * a})`); g.addColorStop(1, 'rgba(205,212,222,0)');
        ctx.fillStyle = g; ctx.fillRect(c.x + dx * c.r - c.r, c.y + dy * c.r - c.r, c.r * 2, c.r * 2);
      });
    });
  };
  const bolt = (st, dt, a) => {
    st.tm -= dt;
    if (st.tm <= 0) {
      st.tm = R(5, 13); st.fl = 1; st.dbl = Math.random() < 0.45 ? 1 : 0;
      let x = R(W * 0.1, W * 0.9); let y = 0; const pts = [[x, y]];
      while (y < H * R(0.45, 0.8)) { y += R(20, 50); x += R(-35, 35); pts.push([x, y]); }
      st.bolt = pts;
    }
    if (st.fl > 0) {
      ctx.fillStyle = `rgba(235,240,255,${0.3 * st.fl * a})`; ctx.fillRect(0, 0, W, H);
      if (st.bolt && st.fl > 0.45) {
        ctx.strokeStyle = `rgba(255,255,255,${st.fl * a})`; ctx.lineWidth = 2.4; ctx.shadowColor = '#bcd'; ctx.shadowBlur = 14;
        ctx.beginPath(); st.bolt.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.shadowBlur = 0;
      }
      st.fl -= dt * 2.2;
      if (st.fl <= 0 && st.dbl) { st.dbl = 0; st.fl = 0.75; }
    }
  };
  const sun = (a, t) => {
    const g = ctx.createRadialGradient(W * 0.88, 0, 0, W * 0.88, 0, Math.max(W, H) * 0.6);
    g.addColorStop(0, `rgba(255,214,120,${(0.2 + 0.03 * Math.sin(t * 0.6)) * a})`); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  /* Mond weicht der Kopfzeile aus (Alarm-Pille, HA-Leiste): neben ihr, bei Platzmangel darunter */
  let mpAt = 0; let mp = null;
  const moonPos = (r) => {
    const now = Date.now();
    if (!mp || mp.r !== r || now - mpAt > 500) {
      mpAt = now; let y = 56 + r * 2.2;
      try {
        const o = owners.values().next().value; const top = o && o.shadowRoot && o.shadowRoot.querySelector('.top');
        if (top) {
          const b = top.getBoundingClientRect(); const last = top.lastElementChild; const lr = last ? last.getBoundingClientRect() : b;
          y = (W - lr.right) < r * 3.4 + 12 ? b.bottom + r * 2 : b.top + b.height / 2;
        }
      } catch { /* ignore */ }
      mp = { r, x: W - r * 2.4 - 8, y: Math.max(56 + r * 2, Math.min(y, H * 0.3)) };
    }
    return [mp.x, mp.y];
  };
  const drawMoon = (a) => {
    const r = W < 600 ? 16 : Math.max(22, Math.min(34, W * 0.03)); const [mx, my] = moonPos(r); const p = moonPhase();
    ctx.save(); ctx.translate(mx, my);
    const g = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 3.2);
    g.addColorStop(0, `rgba(230,236,255,${0.28 * a})`); g.addColorStop(1, 'rgba(230,236,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-r * 3.2, -r * 3.2, r * 6.4, r * 6.4);
    ctx.fillStyle = `rgba(40,52,84,${0.55 * a})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    const k = Math.cos(p * 6.283); const waxing = p < 0.5;
    ctx.fillStyle = `rgba(245,243,225,${0.95 * a})`; ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, !waxing);
    ctx.ellipse(0, 0, Math.max(0.01, r * Math.abs(k)), r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
    ctx.fill(); ctx.restore();
  };
  const night = (st, dt, a, t) => {
    ctx.fillStyle = `rgba(8,14,40,${0.16 * a})`; ctx.fillRect(0, 0, W, H);
    fill(st.p, n(110), mkStar);
    st.p.forEach((s) => { const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * s.sp + s.ph)); ctx.fillStyle = `rgba(255,255,235,${tw * a * 0.9})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill(); });
    drawMoon(a);
    st.tm -= dt;
    if (st.tm <= 0) { st.tm = R(5, 12); st.sh = st.sh || []; st.sh.push({ x: R(W * 0.1, W * 0.9), y: R(0, H * 0.35), vx: R(-520, -340), vy: R(200, 320), life: 1, len: R(90, 160) }); }
    (st.sh || []).forEach((s) => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.1;
      const m = Math.hypot(s.vx, s.vy); const tx = s.x - (s.vx / m) * s.len; const ty = s.y - (s.vy / m) * s.len;
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty); g.addColorStop(0, `rgba(255,255,255,${Math.max(0, s.life) * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
    });
    if (st.sh) st.sh = st.sh.filter((s) => s.life > 0);
  };
  const leaf = (l, a) => {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot); ctx.scale(1, Math.cos(l.rot * 1.3) * 0.6 + 0.5);
    ctx.globalAlpha = 0.85 * a; ctx.fillStyle = l.c; ctx.beginPath();
    ctx.moveTo(0, -l.sz); ctx.quadraticCurveTo(l.sz * 0.9, -l.sz * 0.2, 0, l.sz); ctx.quadraticCurveTo(-l.sz * 0.9, -l.sz * 0.2, 0, -l.sz); ctx.fill();
    ctx.strokeStyle = 'rgba(90,40,10,.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -l.sz); ctx.lineTo(0, l.sz); ctx.stroke(); ctx.restore();
  };
  const autumn = (st, dt, a, t) => {
    fill(st.p, n(20), mkLeaf);
    st.p.forEach((l, i) => { l.y += l.s * dt; l.x += Math.sin(t * l.w + l.ph) * 40 * dt + 14 * dt; l.rot += l.rs * dt; if (l.y > H + 20 || l.x > W + 30) st.p[i] = mkLeaf(false); leaf(l, a); });
  };
  const emoji = (ch, x, y, sz, a, sx) => { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); if (sx !== undefined) ctx.scale(sx, 1); ctx.font = `${sz}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, 0, 0); ctx.restore(); };
  const halloween = (st, dt, a, t) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,120,0,0)'); g.addColorStop(1, `rgba(255,110,0,${0.16 * a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    fill(st.p, n(4), mkBat);
    st.p.forEach((b, i) => {
      b.x += b.dir * b.s * dt; const yy = b.y + Math.sin(t * b.f + b.ph) * b.amp;
      if ((b.dir > 0 && b.x > W + 60) || (b.dir < 0 && b.x < -60)) st.p[i] = mkBat(false);
      emoji('\u{1F987}', b.x, yy, b.sz, 0.9 * a, (b.dir > 0 ? -1 : 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * 9 + b.ph))));
    });
    st.g = st.g || []; fill(st.g, n(2), mkGhost);
    st.g.forEach((q) => { q.y -= q.s * dt; q.x += Math.sin(t * 0.7 + q.ph) * 24 * dt; if (q.y < -50) { q.y = H + 40; q.x = R(0, W); } emoji('\u{1F47B}', q.x, q.y, q.sz, 0.55 * a); });
    st.tm -= dt;
    if (!st.sp && st.tm <= 0) { st.sp = { x: R(W * 0.1, W * 0.9), y: 0, ph: 0, wait: 0 }; st.tm = R(18, 35); }
    if (st.sp) {
      const q = st.sp;
      if (q.ph === 0) { q.y += 90 * dt; if (q.y > H * 0.28) { q.ph = 1; q.wait = 2.2; } }
      else if (q.ph === 1) { q.wait -= dt; q.y += Math.sin(t * 3) * 10 * dt; if (q.wait <= 0) q.ph = 2; }
      else { q.y -= 110 * dt; if (q.y < -30) st.sp = null; }
      if (st.sp) { ctx.strokeStyle = `rgba(200,200,200,${0.7 * a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x, 0); ctx.lineTo(q.x, q.y); ctx.stroke(); emoji('\u{1F577}\u{FE0F}', q.x, q.y + 10, 34, a); }
    }
  };
  const christmas = (st, dt, a, t) => {
    snow(st, dt, a * 0.8, true, 45, t);
    const step = 44; const nB = Math.ceil(W / step) + 1; const cols = ['#ff4040', '#ffd24a', '#4cd964', '#4aa8ff', '#ff7ad9'];
    ctx.strokeStyle = `rgba(30,70,30,${0.7 * a})`; ctx.lineWidth = 1.4; ctx.beginPath();
    const yAt = (x) => 10 + 12 * Math.sin((x / step) * Math.PI);
    for (let x = 0; x <= W + step; x += 6) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x)));
    ctx.stroke();
    for (let i = 0; i < nB; i++) {
      const x = i * step; const y = yAt(x) + 5; const on = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7); const c = cols[i % cols.length];
      ctx.globalAlpha = a * on; ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 3.6, 5.2, 0, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    st.tm -= dt;
    if (!st.sl && st.tm <= 0) { st.sl = { x: W + 120, y: R(H * 0.12, H * 0.3), ph: R(0, 6) }; st.tm = R(45, 90); }
    if (st.sl) { const q = st.sl; q.x -= 160 * dt; if (q.x < -160) st.sl = null; else emoji('\u{1F98C}\u{1F98C}\u{1F6F7}', q.x, q.y + Math.sin(t * 2 + q.ph) * 8, 34, a); }
  };

  const frame = (ts) => {
    raf = 0; if (!cv) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; const t = ts / 1000; const now = Date.now();
    ctx.clearRect(0, 0, W, H);
    let busy = false;
    FX_KEYS.forEach((k) => {
      const st = get(k); const c = conf.act[k]; let want = 0;
      if (c) { if (!st.on) { st.on = true; st.t0 = now; } want = (!c.dur || (now - st.t0) / 1000 < c.dur) ? 1 : 0; } else st.on = false;
      st.a += Math.max(-1, Math.min(1, (want - st.a))) * Math.min(1, dt * 1.2);
      if (st.a < 0.01 && !want) { st.a = 0; st.p = []; st.pd = null; st.dbl = 0; st.g = null; st.sh = null; st.sp = null; st.sl = null; st.bolt = null; st.fl = 0; return; }
      busy = true; const a = st.a; const v = c ? c.v : st.v; st.v = v || st.v;
      if (k === 'weather') {
        const rainy = ['rain', 'pouring', 'storm', 'lightning-rainy', 'snowy-rainy'].includes(v);
        if (v === 'fog') fogs(st, dt, a);
        else if (v === 'cloud') clouds(st, dt, a);
        else if (v === 'sun') sun(a, t);
        else {
          if (v === 'storm' || v === 'lightning-rainy' || v === 'lightning') { ctx.fillStyle = `rgba(20,28,50,${0.18 * a})`; ctx.fillRect(0, 0, W, H); bolt(st, dt, a); }
          if (rainy) { rain(st, dt, a, v === 'pouring' || v === 'storm', v === 'storm' ? 0.28 : 0.08); pane(st, dt, a, v === 'pouring' || v === 'storm'); }
          if (v === 'snow' || v === 'snowy-rainy') snow(st, dt, a, false, 110, t);
          if (v === 'hail') { fill(st.p, n(80), () => mkDrop(true, true)); ctx.fillStyle = `rgba(235,245,255,${0.85 * a})`; st.p.forEach((d, i) => { d.y += d.s * 1.1 * dt; if (d.y > H) st.p[i] = mkDrop(false, true); ctx.beginPath(); ctx.arc(d.x, d.y, 2, 0, 6.283); ctx.fill(); }); }
        }
      } else if (k === 'night') night(st, dt, a, t);
      else if (k === 'autumn') autumn(st, dt, a, t);
      else if (k === 'halloween') halloween(st, dt, a, t);
      else if (k === 'christmas') christmas(st, dt, a, t);
    });
    if (busy) raf = requestAnimationFrame(frame);
    else if (!Object.keys(conf.act).length) unmount();
  };
  return {
    attach(o) { owners.add(o); },
    detach(o) { owners.delete(o); if (!owners.size) unmount(); },
    set(act, level) {
      conf = { level: level || 1, act: act || {} };
      if (Object.keys(conf.act).length) { mount(); kick(); }
      else if (cv && !FX_KEYS.some((k) => S[k] && S[k].a > 0)) unmount();
      else kick();
    },
  };
})();

const mergeFx = (f) => {
  f = f || {}; const e = {};
  FX_KEYS.forEach((k) => { const x = (f.e && f.e[k]) || {}; e[k] = { m: x.m || 'auto', d: FX_DURS.includes(x.d) ? x.d : 0 }; });
  return { on: f.on !== false, level: FX_LEVELS.some((l) => l[1] === f.level) ? f.level : 1, respect: f.respect !== false, e };
};
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
    this.shadowRoot.addEventListener('focusout', (e) => {
      if (e.target.dataset && e.target.dataset.pk) setTimeout(() => { if (!this._plFocus() && this._hass) { this._sig = ''; this.hass = this._hass; } }, 200);
    });
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._db) { this._doorHide(true); return; }
      if (e.key === 'Escape' && this._sheet) { this._sheet = null; this._sig = ''; this._render(); return; }
      const ka = e.target && e.target.closest && e.target.closest('[data-act]');
      if ((e.key === 'Enter' || e.key === ' ') && ka && ka === e.target && !/^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(ka.tagName) && !e.target.dataset.go) { e.preventDefault(); ka.click(); return; }
      if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.go) return;
      e.preventDefault(); if (this._poolClick({ dataset: { k: e.target.dataset.go } }, 'pl-go')) { this._sig = ''; this._render(); }
    });
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
      else if (e.target.classList.contains('ccin')) {
        const cu = this._set.custom.find((x) => x.id === this._ccId); if (!cu) return;
        cu.title = e.target.value; clearTimeout(this._ct); this._ct = setTimeout(() => this._save(), 600);
      } else if (e.target.classList.contains('dvin')) {
        const iv = this._set.devices.find((x) => x.id === this._dvId); if (!iv) return;
        iv.title = e.target.value; clearTimeout(this._ct); this._ct = setTimeout(() => { this._save(); this._sig = ''; }, 600);
      }
    });
  }
  setConfig(cfg) {
    this._cfg = cfg || {};
    if (this._mq && this._mqf) { try { this._mq.removeEventListener('change', this._mqf); } catch (_) { /* ältere Browser */ } this._mq = this._mqf = null; }
    if (cfg && cfg.theme === 'auto' && window.matchMedia) {
      this._mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._mqf = () => this.setAttribute('theme', this._mq.matches ? 'forest' : 'sand');
      this._mqf();
      try { this._mq.addEventListener('change', this._mqf); } catch (_) { /* ältere Browser */ }
    } else if (cfg && cfg.theme) this.setAttribute('theme', cfg.theme);
    if (cfg && cfg.color_from) this.style.setProperty('--zp-from', cfg.color_from);
    if (cfg && cfg.color_to) this.style.setProperty('--zp-to', cfg.color_to);
  }
  getCardSize() { return 12; }
  connectedCallback() {
    Fx.attach(this);
    this._tick = setInterval(() => {
      this._tk = (this._tk || 0) + 1; if (this._tk % 2 === 0) this._refreshCams();
      if (this._edit || this._dg) return;
      const el = this.shadowRoot.querySelector('.note-t');
      const al = this._hass ? this._alerts() : [];
      if (el && al.length > 1) { this._ai = (this._ai + 1) % al.length; el.textContent = al[this._ai].text; if (el.parentElement) el.parentElement.className = `note sv${al[this._ai].sev}`; }
    }, 5000);
  }
  disconnectedCallback() { clearInterval(this._tick); this._doorHide(); Fx.detach(this); }

  set hass(h) {
    const first = !this._hass;
    this._hass = h;
    if (first) this._load();
    if (this._loaded) this._notifyAlerts();
    if (this._loaded) this._doorCheck();
    if (!this._loaded || ['add', 'srcpick', 'quick', 'cc', 'dv', 'dvadd', 'dvmain', 'dvpick', 'dbpick'].includes(this._sheet) || this._drag || this._dg || this._edit) return;
    if (this._down && this._edit) { this._pend = true; return; }
    if (this._plFocus()) return;
    this._fxUpdate();
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      clearTimeout(this._rt);
      this._rt = setTimeout(() => this._render(), 200);
    }
  }
  _signature() {
    const h = this._hass;
    if (this._view === 'cams') return ['cams', this._sheet, this._edit, this._set.hidden.join(), (this._set.order.cams || []).join(), Object.values(h.states).filter((x) => dom(x.entity_id) === 'camera').map((x) => x.entity_id + (x.state === 'unavailable' ? 'x' : '') + (x.attributes.entity_picture || '')).join()].join('|'); const parts = [this._view, this._floor, this._area, this._sheet, this._edit, Math.floor(Date.now() / 60000), this._set.pinned.length, this._set.hidden.length, this._set.hiddenAreas.length];
    const cuSet = new Set(this._set.custom.map((x) => x.entity));
    const doms = ['weather', 'light', 'media_player', 'vacuum', 'person', 'alarm_control_panel', 'lock', 'binary_sensor', 'camera', 'switch', 'cover', 'climate', 'fan'];
    for (const id in h.states) {
      const d = dom(id);
      if (d === 'camera' && this._view === 'cams') continue;
      if (doms.includes(d)) { const s = h.states[id]; parts.push(id + s.state + (d === 'climate' ? `${s.attributes.current_temperature}/${s.attributes.temperature}/${s.attributes.hvac_action}` : '')); }
      else if (this._view === 'rooms' && d === 'sensor') parts.push(id + h.states[id].state);
      else if (d === 'sensor' && (h.states[id].attributes.warning_count !== undefined || h.states[id].attributes.is_ice_warning !== undefined)) parts.push(id + h.states[id].state + h.states[id].attributes.warning_count);
      else if (id.startsWith('sensor.room_climate_')) parts.push(id + h.states[id].state + h.states[id].attributes.mold_risk);
      else if (this._auto().tracked.has(id)) parts.push(id + h.states[id].state);
      else if (cuSet.has(id) || this._set.pinned.some((p) => p.entity === id)) parts.push(id + h.states[id].state);
    }
    for (const iv of this._dvAll()) { try { const m = this._dvMap(iv); parts.push(iv.main + (h.states[iv.main] ? h.states[iv.main].state + (h.states[iv.main].attributes.fan_speed || '') : '')); Object.values(m).forEach((x) => { if (x && h.states[x]) parts.push(x + h.states[x].state); }); } catch (_) { /* ignore */ } }
    if (['home', 'more', 'rooms'].includes(this._view)) { parts.push(this._plSig()); parts.push(this._prSig()); }
    if (!this._bd || Date.now() - this._bd.t > 30000) this._bd = { t: Date.now(), s: this._batteries().map((x) => x.id + x.v).join() + '|' + this._offline().map((x) => x.did).join() };
    parts.push(this._bd.s);
    parts.push('sn' + this._snoozed().length);
    return parts.join('|');
  }

  _fxUpdate(force) {
    const now = Date.now(); if (!force && now - (this._fxAt || 0) < 4000) return;
    this._fxAt = now; const h = this._hass; if (!h || !this._loaded) return;
    const s = this._set.fx; const act = {};
    const still = s.respect && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (s.on && !still) {
      const dt = fxDate(new Date(now)); const sunE = h.states['sun.sun'];
      const dark = sunE ? sunE.state === 'below_horizon' : (new Date(now).getHours() < 7 || new Date(now).getHours() >= 18);
      const put = (k, ok, v) => { const c = s.e[k]; if (c.m !== 'off' && ok) act[k] = { dur: c.d, v }; };
      const wx = (this._byDomain().weather || [])[0]; const m = s.e.weather.m;
      const MAP = { rainy: 'rain', pouring: 'pouring', snowy: 'snow', 'snowy-rainy': 'snowy-rainy', hail: 'hail', lightning: 'lightning', 'lightning-rainy': 'lightning-rainy', fog: 'fog', cloudy: 'cloud', partlycloudy: 'cloud', exceptional: 'storm', sunny: dark ? '' : 'sun' };
      const TEST = { rain: 'rain', snow: 'snow', storm: 'storm', fog: 'fog' };
      const wv = TEST[m] || (m === 'auto' && wx ? MAP[wx.state] || '' : '');
      put('weather', !!wv, wv);
      put('night', s.e.night.m === 'on' || dark, '');
      put('autumn', s.e.autumn.m === 'on' || dt.autumn, '');
      put('halloween', s.e.halloween.m === 'on' || dt.halloween, '');
      put('christmas', s.e.christmas.m === 'on' || dt.christmas, '');
    }
    Fx.set(act, s.level);
  }

  async _load() {
    let mine = null;
    try {
      const r = await this._hass.callWS({ type: 'frontend/get_user_data', key: KEY });
      if (r && r.value) mine = r.value;
    } catch {
      try { const j = localStorage.getItem(KEY); if (j) mine = JSON.parse(j); } catch (_) { /* ignore */ }
    }
    const base = this._cfg && this._cfg.layout && this._cfg.shared !== false ? this._cfg.layout : null;
    /* Jeder Benutzer darf bearbeiten: eigene Einstellungen haben Vorrang, sonst gilt das veröffentlichte Gruppenlayout */
    this._hasBase = !!base;
    /* Wurde das Gruppenlayout nach den eigenen Einstellungen veröffentlicht, gilt es (Stempel _pub/_base) */
    const bp = base ? (base._pub || 0) : 0; const useMine = !!mine && (!base || (mine._base || 0) >= bp);
    const pick = useMine ? mine : base;
    if (pick) { this._set = merge(pick); if (!useMine) this._set._base = bp; }
    this._loaded = true; this._sig = this._signature(); this._fxUpdate(true); this._render();
  }
  async _save() {
    this._fxUpdate(true);
    try { localStorage.setItem(KEY, JSON.stringify(this._set)); } catch (_) { /* ignore */ }
    try { await this._hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: this._set }); } catch (_) { /* ignore */ }
  }

  /* Eigene Einstellungen verwerfen, danach gilt wieder das veröffentlichte Gruppenlayout */
  async _resetMine() {
    const base = this._cfg && this._cfg.layout; if (!base) return;
    this._set = merge(base); this._set._base = base._pub || 0;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    try { await this._hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: null }); } catch { /* ignore */ }
    this._msg = 'Zurückgesetzt: Es gilt wieder das Gruppenlayout.'; this._sig = ''; this._render();
  }

  /* ---------- Daten ---------- */
  _areaOf(id) {
    const h = this._hass; const r = h.entities && h.entities[id];
    if (!r) return null;
    return r.area_id || (r.device_id && h.devices && h.devices[r.device_id] && h.devices[r.device_id].area_id) || null;
  }
  _aname(id) { const a = this._hass.areas && this._hass.areas[id]; return a ? a.name : ''; }
  _state(st) {
    let r; try { r = this._hass.formatEntityState ? this._hass.formatEntityState(st) : st.state; } catch { r = st.state; }
    return r === st.state ? human(r) : r;
  }
  _icon(st) {
    const a = st.attributes; const d = dom(st.entity_id); const on = !INACTIVE.includes(st.state);
    if (a.icon) return a.icon;
    const dc = a.device_class;
    if ((d === 'binary_sensor' || d === 'sensor') && DC_ICON[dc]) return Array.isArray(DC_ICON[dc]) ? DC_ICON[dc][on ? 0 : 1] : DC_ICON[dc];
    if (d === 'light') return on ? 'mdi:lightbulb' : 'mdi:lightbulb-outline';
    if (d === 'cover') return st.state === 'open' ? 'mdi:window-shutter-open' : 'mdi:window-shutter';
    if (d === 'lock') return st.state === 'unlocked' ? 'mdi:lock-open' : 'mdi:lock';
    if (d === 'button' || d === 'input_button') { const nm = NAME_ICON.find(([re]) => re.test(`${st.entity_id} ${a.friendly_name || ''}`)); if (nm) return nm[1]; }
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
        else if (['motion', 'occupancy', 'moving', 'presence'].includes(dc) && s.alerts.motion) {
          const key = 'm:' + where; if (seen.has(key)) continue; seen.add(key);
          a = { sev: 2, text: `Bewegung: ${where}`, icon: 'mdi:motion-sensor', k: id, motion: where };
        }
      }
      if (a) out.push({ ...a, id, since: st.last_changed });
    }
    if (s.alerts.weather) out.push(...this._warnAlerts());
    if (s.alerts.climate) out.push(...this._climAlerts());
    const now = Date.now(); const sn = s.snooze || {};
    return out.filter((a) => !(sn[a.id] > now)).sort((x, y) => x.sev - y.sev);
  }
  _ntfOpts(k) {
    const h = this._hass;
    if (k === 'push') return [''].concat(Object.keys((h.services && h.services.notify) || {}).filter((x) => !['send_message', 'persistent_notification'].includes(x)).sort());
    if (k === 'tts') return [''].concat(Object.keys(h.states).filter((id) => dom(id) === 'media_player').sort());
    return [0, 1, 2];
  }
  _ntfRows() {
    const n = this._set.notify; const nm = (id) => (id && this._hass.states[id] && this._hass.states[id].attributes.friendly_name) || id;
    const row = (k, l, v) => `<div class="row"><div class="t"><b>${l}</b></div><button class="${v === 'Aus' ? '' : 'sel'}" data-act="ntf" data-k="${k}">${esc(v)}</button></div>`;
    return row('push', 'Push-Nachricht', n.push ? `notify.${n.push}` : 'Aus') + row('tts', 'Ansage auf Lautsprecher', n.tts ? nm(n.tts) : 'Aus') + row('min', 'Ab Schweregrad', ['Kritisch', 'Warnung', 'Alle'][n.min] || 'Kritisch') + '<div class="empty" style="padding:6px 0;font-size:12px">Wirkt nur, solange Lumora geöffnet ist (z. B. am Wandtablet).</div>';
  }
  _snoozed() {
    const now = Date.now(); const sn = this._set.snooze || {};
    return Object.keys(sn).filter((id) => sn[id] > now).map((id) => ({ id, until: sn[id], name: (this._hass.states[id] && this._hass.states[id].attributes.friendly_name) || id }));
  }
  /* Neue Meldungen per Push (notify.*) und/oder Ansage (tts.speak) melden; beim ersten Durchlauf nur merken */
  _notifyAlerts() {
    const n = this._set.notify; if (!n || (!n.push && !n.tts)) return;
    const now = Date.now(); if (now - (this._ntAt || 0) < 10000) return; this._ntAt = now;
    const h = this._hass; let seen = {};
    try { seen = JSON.parse(localStorage.getItem('lumora_notified') || '{}'); } catch { seen = {}; }
    const first = !this._ntInit; this._ntInit = true;
    const cur = {}; const fresh = [];
    this._alerts().filter((a) => a.id && a.sev <= n.min).forEach((a) => { const k = `${a.id}|${a.text}`; cur[k] = seen[k] || now; if (!seen[k] && !first) fresh.push(a); });
    try { localStorage.setItem('lumora_notified', JSON.stringify(cur)); } catch { /* ignore */ }
    if (!fresh.length) return;
    const msg = fresh.map((a) => a.text).join('. ');
    if (n.push) Promise.resolve(h.callService('notify', n.push, { title: 'Lumora', message: msg })).catch(() => {});
    const tts = Object.keys(h.states).find((id) => dom(id) === 'tts');
    if (n.tts && tts) Promise.resolve(h.callService('tts', 'speak', { entity_id: tts, media_player_entity_id: n.tts, message: msg })).catch(() => {});
  }
  _climAlerts() {
    const h = this._hass; const s = this._set; const out = []; const T = {
      schimmelrisiko: [1, 'Schimmelrisiko', 'mdi:mushroom-outline'], fenster_schliessen: [1, 'Fenster schließen', 'mdi:window-closed'],
      lueften_jetzt: [2, 'Jetzt lüften', 'mdi:window-open-variant'], rollladen_schliessen: [2, 'Rollladen schließen', 'mdi:blinds'], heizung_herunterregeln: [2, 'Heizung herunterregeln', 'mdi:radiator-off'],
    };
    const moldRooms = new Set();
    for (const id in h.states) {
      const st = h.states[id];
      const m = /^binary_sensor\.room_climate_(.+?)_(schimmelrisiko|fenster_schliessen|lueften_jetzt|rollladen_schliessen|heizung_herunterregeln)$/.exec(id);
      if (m) {
        if (st.state !== 'on' || s.excludeEntities.includes(id)) continue;
        const area = this._areaOf(id); if (area && s.excludeAreas.includes(area)) continue;
        const room = area ? this._aname(area) : m[1]; const t = T[m[2]];
        if (m[2] === 'schimmelrisiko') moldRooms.add(room);
        out.push({ sev: t[0], text: `${t[1]}: ${room}`, icon: t[2], k: id, id, since: st.last_changed });
      } else if (/^sensor\.room_climate_.+_recommendation$/.test(id) && st.attributes.mold_risk === 'high' && !s.excludeEntities.includes(id)) {
        const room = st.attributes.room_name || cleanName(st.attributes.friendly_name);
        if (moldRooms.has(room)) continue;
        out.push({ sev: 1, text: `Schimmelrisiko hoch: ${room}`, icon: 'mdi:mushroom-outline', k: id, id, since: st.last_changed });
      }
    }
    const day = h.states[this._inf().day];
    if (!out.length && this._ok(day) && day.attributes.has_actions && !s.excludeEntities.includes(day.entity_id)) (day.attributes.actions || []).forEach((t, i) => out.push({ sev: 2, text: String(t), icon: 'mdi:home-thermometer-outline', k: `${day.entity_id}:${i}`, id: day.entity_id, since: day.last_changed }));
    return out;
  }
  _vent() {
    const st = this._hass.states[this._inf().vent]; if (!this._ok(st)) return '';
    const a = st.attributes; const calm = ['keep_windows_closed', 'unknown'].includes(st.state);
    const rooms = (a.recommended_rooms || []).length ? `Zuerst: ${a.recommended_rooms.join(', ')}` : '';
    const win = a.next_window && a.next_window.available ? `Nächstes Fenster ${a.next_window.label}` : '';
    const dur = a.duration_minutes && /recommended/.test(st.state) ? ` · ${a.duration_minutes} min` : '';
    const cls = a.color === 'red' ? 'bad' : a.color === 'orange' || a.color === 'yellow' ? 'warn' : '';
    return `<div class="vent ${cls}" data-act="info" data-id="${st.entity_id}"><ha-icon icon="${calm ? 'mdi:window-closed-variant' : 'mdi:window-open-variant'}"></ha-icon><div><b>${esc(a.title || st.state)}${dur}</b><span>${esc([rooms, win].filter(Boolean).join(' · ') || a.reason || '')}</span></div></div>`;
  }
  _chipOn(k) { const v = this._set.chips[k]; return v === undefined ? true : v; }
  _cands(k, loose) {
    const d = SLOTS[k]; const h = this._hass; const out = [];
    for (const id in h.states) {
      if (!d.d.includes(dom(id))) continue;
      const r = h.entities && h.entities[id]; if (r && r.hidden) continue;
      const st = h.states[id]; const a = st.attributes || {};
      if (d.dc && a.device_class !== d.dc) continue;
      const txt = norm(`${id} ${a.friendly_name || ''}`);
      const unit = String(a.unit_of_measurement || '');
      let ok = !(d.at && a[d.at] === undefined) && !(d.u && !d.u.test(unit)) && (!d.re || d.re.test(txt)) && !(d.no && d.no.test(txt));
      if (ok && !loose && !d.any && ['unavailable', 'unknown', ''].includes(st.state)) ok = false;
      if (!ok && !loose) continue;
      out.push({ id, ok, pri: d.pri && d.pri.test(txt) ? 1 : 0, name: a.friendly_name || id });
    }
    return out.sort((x, y) => (y.ok - x.ok) || (y.pri - x.pri) || x.id.length - y.id.length || x.id.localeCompare(y.id));
  }
  _auto() {
    const now = Date.now(); if (this._ac && now - this._ac.t < 30000) return this._ac;
    const h = this._hass; const v = {}; const tracked = new Set();
    if (h) {
      Object.keys(SLOTS).forEach((k) => { const c = this._cands(k, false)[0]; if (c) { v[k] = c.id; tracked.add(c.id); } });
      const travel = []; const trains = []; const appls = [];
      Object.values(h.states).forEach((st) => {
        const a = st.attributes || {}; const id = st.entity_id; if (dom(id) !== 'sensor') return;
        if (a.route !== undefined && a.distance !== undefined && a.duration !== undefined && parseFloat(st.state) > 0) { travel.push([cleanName(a.friendly_name) || id, id]); tracked.add(id); }
        else if (Array.isArray(a.trips)) { trains.push([cleanName(a.friendly_name) || id, id]); tracked.add(id); }
        const m = /^sensor\.(.+)_zustand$/.exec(id);
        if (m) { const ty = APPL_TYPES.find((t) => t.re.test(norm(`${id} ${a.friendly_name || ''}`))); if (ty) { appls.push({ base: `sensor.${m[1]}`, title: ty.title, icon: ty.icon, hint: ty.hint }); ['zustand', 'programm', 'fortschritt', 'verbleibende_zeit'].forEach((x) => tracked.add(`sensor.${m[1]}_${x}`)); } }
      });
      travel.sort((x, y) => x[0].localeCompare(y[0], 'de')); trains.sort((x, y) => x[0].localeCompare(y[0], 'de'));
      this._ac = { t: now, v, travel, trains, appls, tracked };
      const ps = v.printer_status && /^sensor\.(.+)_print_status$/.exec(v.printer_status);
      if (ps) ['print_progress', 'print_time_left', 'nozzle_temperature', 'bed_temperature', 'working_layer', 'total_layers', 'used_material_length'].forEach((x) => tracked.add(`sensor.${ps[1]}_${x}`));
      return this._ac;
    }
    return { t: 0, v, travel: [], trains: [], appls: [], tracked };
  }
  _slot(k) {
    const c = this._cfg || {};
    const ov = k.startsWith('e_') ? (c.energy && c.energy[k.slice(2)]) : ((c.extras && c.extras[k]) || (c.info && c.info[k]));
    if (ov) return ov;
    const ch = this._set.sources[k]; if (ch === '-') return null; if (ch) return ch;
    if (k.startsWith('printer_') && !['printer_status', 'printer_plug', 'printer_plugw', 'printer_boxt', 'printer_boxh', 'printer_time'].includes(k)) {
      const st = this._slot('printer_status'); const m = st && /^sensor\.(.+)_print_status$/.exec(st); if (!m) return null;
      const p = m[1]; const st0 = this._hass.states;
      const map = { printer_progress: `sensor.${p}_print_progress`, printer_left: `sensor.${p}_print_time_left`, printer_nozzle: `sensor.${p}_nozzle_temperature`, printer_bed: `sensor.${p}_bed_temperature`,
        printer_pause: `button.${p}_pause_print`, printer_resume: `button.${p}_resume_print`, printer_stop: `button.${p}_stop_print`,
        printer_bedt: `number.${p}_bed_target`, printer_nozt: `number.${p}_nozzle_target`, printer_tune: `number.${p}_print_tuning`,
        printer_layer: `sensor.${p}_working_layer`, printer_layers: `sensor.${p}_total_layers`, printer_mat: `sensor.${p}_used_material_length`, printer_prev: `image.${p}_current_print_preview` };
      if (map[k]) return st0[map[k]] ? map[k] : null;
      if (k === 'printer_cam') return Object.keys(st0).find((i) => i.startsWith(`camera.${p}`)) || null;
      return null;
    }
    return this._auto().v[k] || null;
  }
  _inf() {
    const c = (this._cfg && this._cfg.info) || {}; const a = this._auto();
    return { vent: this._slot('vent'), day: this._slot('day'), ice: this._slot('ice'), bike: this._slot('bike'), pollen: this._slot('pollen'), travel: c.travel || a.travel, trains: c.trains || a.trains };
  }
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
  _infoPills(al) {
    const h = this._hass; const inf = this._inf(); const out = []; const on = (k) => this._chipOn(k);
    if (on('warn')) this._warns().forEach((w) => out.push(`<button class="pill ${w.sev === 0 ? 'bad' : 'warn'}" data-act="warns"><ha-icon icon="${w.icon}"></ha-icon>${esc(w.title)}${w.sub ? ` · ${esc(w.sub)}` : ''}</button>`));
    const ice = this._ice();
    if (on('ice') && ice && (ice.warn || ice.possible)) out.push(`<button class="pill ${ice.warn ? 'warn' : ''}" data-act="warns"><ha-icon icon="mdi:snowflake-alert"></ha-icon>${ice.warn ? 'Eisgefahr' : 'Glätte möglich'}</button>`);
    const bk = h.states[inf.bike];
    if (on('bike') && this._ok(bk)) out.push(`<button class="pill" data-act="warns"><ha-icon icon="mdi:bike"></ha-icon>${esc(bk.state.split(' · ')[0])}</button>`);
    const pl = h.states[inf.pollen];
    if (on('pollen') && this._ok(pl) && Number(pl.attributes.numeric_state) > 0) out.push(`<button class="pill warn" data-act="warns"><ha-icon icon="mdi:flower-pollen"></ha-icon>Pollen: ${esc(pl.attributes.named_state || pl.state)}</button>`);
    const mo = [...new Set((al || []).filter((x) => x.motion).map((x) => x.motion))];
    if (on('motion') && mo.length) out.push(`<button class="pill" data-act="alerts"><ha-icon icon="mdi:motion-sensor"></ha-icon>Bewegung · ${esc(mo.slice(0, 2).join(', '))}${mo.length > 2 ? ` +${mo.length - 2}` : ''}</button>`);
    const hasTr = inf.travel.some(([, id]) => this._ok(h.states[id])) || inf.trains.some(([, id]) => this._ok(h.states[id]));
    if (on('trav') && hasTr) out.push('<button class="pill" data-act="trav"><ha-icon icon="mdi:car-clock"></ha-icon>Fahrzeiten</button>');
    return out.join('');
  }
  /* ---------- Türklingel & Bewegung: Kamera-Popup ---------- */
  _doorCheck() {
    const d = this._set.door; const h = this._hass; if (!d || !h) return;
    const prev = this._dbPrev || (this._dbPrev = {}); const first = !this._dbInit; this._dbInit = true;
    const BAD = ['unavailable', 'unknown', 'off', 'idle', 'none', 'clear', 'closed', 'not_home', 'standby'];
    [...d.bell.map((id) => [id, 'bell']), ...d.motion.map((id) => [id, 'motion'])].forEach(([id, kind]) => {
      const st = h.states[id]; const was = prev[id]; prev[id] = st ? st.state : undefined;
      if (!st || first || was === undefined || was === st.state || was === 'unavailable' || BAD.includes(st.state)) return;
      if (Date.now() - new Date(st.last_changed).getTime() > 30000) return;
      this._doorShow(id, kind);
    });
  }

  _doorCam(id, kind) {
    const h = this._hass; const d = this._set.door;
    const area = id && this._areaOf(id);
    const inArea = area ? (Object.values(h.states).find((s) => dom(s.entity_id) === 'camera' && s.state !== 'unavailable' && this._areaOf(s.entity_id) === area && !/_latest_(thumbnail|object_detector_snapshot)$/.test(s.entity_id)) || {}).entity_id : '';
    const order = kind === 'bell' ? [d.cam, inArea] : [inArea, d.cam];
    return order.find((c) => c && h.states[c]) || '';
  }

  _doorShow(id, kind) {
    const h = this._hass; const d = this._set.door; const now = Date.now();
    if (kind === 'motion' && now < (this._dbCool || 0)) return;
    if (this._db && this._db.kind === 'bell' && kind !== 'bell') return;
    const cam = this._doorCam(id, kind); if (!cam) return;
    const st = h.states[id]; const area = id && this._areaOf(id);
    const title = kind === 'bell' ? 'Es hat geklingelt' : `Bewegung${area ? ` · ${this._aname(area)}` : ''}`;
    const sub = `${(st && st.attributes.friendly_name) || ''}${st ? ' · ' : ''}${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    clearTimeout(this._dbT);
    this._dbT = setTimeout(() => this._doorHide(), Math.max(5, d.secs || 30) * 1000);
    if (this._db && this._db.cam === cam && this._db.kind === kind) { this._doorBar(); return; }
    this._doorHide(); this._db = { cam, kind };
    const el = document.createElement('div'); el.className = 'dbp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
    const secs = Math.max(5, d.secs || 30);
    el.innerHTML = `<div class="dbb" data-act="dbclose"><div class="dbc" data-act="noop"><div class="dbh"><ha-icon icon="${kind === 'bell' ? 'mdi:bell-ring' : 'mdi:motion-sensor'}"></ha-icon><div><b>${esc(title)}</b><span>${esc(sub)}</span></div></div><div class="dbv"></div><div class="dbbar"><i style="animation-duration:${secs}s"></i></div><div class="dbf"><button class="pill" data-act="dbopen" data-id="${esc(cam)}"><ha-icon icon="mdi:cctv"></ha-icon>Details</button><button class="pill sel" data-act="dbclose">Schließen</button></div></div></div>`;
    this._dbEl = el; this.shadowRoot.appendChild(el); this._doorMedia();
    this._dbI = setInterval(() => this._doorMedia(), 2000);
    this._a11y();
  }

  _doorBar() {
    const i = this._dbEl && this._dbEl.querySelector('.dbbar i'); if (!i) return;
    i.style.animation = 'none'; void i.offsetWidth; i.style.animation = '';
  }

  _doorMedia() {
    const v = this._dbEl && this._dbEl.querySelector('.dbv'); const st = this._db && this._hass.states[this._db.cam]; if (!v || !st) return;
    if (customElements.get('ha-camera-stream')) {
      let s = v.querySelector('ha-camera-stream');
      if (!s) { s = document.createElement('ha-camera-stream'); s.muted = true; s.controls = false; s.setAttribute('muted', ''); v.appendChild(s); }
      s.hass = this._hass; s.stateObj = st; return;
    }
    const base = st.attributes.entity_picture; if (!base) return;
    let img = v.querySelector('img'); if (!img) { img = document.createElement('img'); img.alt = ''; v.appendChild(img); }
    img.src = `${base}${base.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  }

  _doorHide(manual) {
    clearTimeout(this._dbT); clearInterval(this._dbI);
    if (manual && this._db && this._db.kind === 'motion') this._dbCool = Date.now() + 20000;
    if (this._dbEl && this._dbEl.parentNode) this._dbEl.parentNode.removeChild(this._dbEl);
    this._dbEl = null; this._db = null;
  }

  _doorCands(kind, q) {
    const BELL = /klingel|doorbell|bell|ring/i; const MOT = /motion|occupancy|person|bewegung|presence/i;
    const rx = kind === 'bell' ? BELL : MOT; const doms = kind === 'bell' ? ['event', 'binary_sensor', 'button', 'input_button', 'sensor'] : ['binary_sensor', 'event'];
    return Object.values(this._hass.states).filter((s) => doms.includes(dom(s.entity_id)))
      .map((s) => ({ id: s.entity_id, name: s.attributes.friendly_name || s.entity_id, ok: rx.test(`${s.entity_id} ${s.attributes.friendly_name || ''} ${s.attributes.device_class || ''}`) ? 1 : 0 }))
      .filter((x) => (q ? norm(`${x.id} ${x.name}`).includes(q) : x.ok))
      .sort((a, b) => b.ok - a.ok || a.name.localeCompare(b.name, 'de')).slice(0, 80);
  }

  /* Klickbare Flächen für Tastatur und Screenreader erreichbar machen */
  _a11y() {
    const sh = this.shadowRoot.querySelector('.sheet'); if (sh && !sh.getAttribute('role')) { sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); }
    this.shadowRoot.querySelectorAll('[data-act]').forEach((el) => {
      if (/^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(el.tagName) || el.getAttribute('role') || el.dataset.act === 'noop' || el.classList.contains('sbg')) return;
      el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
    });
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
    const keep = {}; const qa = this.shadowRoot.querySelectorAll;
    const pk = {}; let fk = null;
    if (qa) {
      this.shadowRoot.querySelectorAll('[data-pk]').forEach((i) => { if (i.value !== '') pk[i.dataset.pk] = i.value; });
      const ae = this.shadowRoot.activeElement; if (ae && ae.dataset && ae.dataset.pk) { fk = { k: ae.dataset.pk }; try { fk.s = ae.selectionStart; fk.e = ae.selectionEnd; } catch (_) { /* number-Felder */ } }
    }
    if (qa) this.shadowRoot.querySelectorAll('img[data-b]').forEach((i) => { (keep[i.dataset.b] || (keep[i.dataset.b] = [])).push(i); });
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="app" style="position:relative"><div class="body">${body}</div><div class="nav">${nav}</div>${this._sheetHtml()}</div>`;
    this._a11y();
    if (this._dbEl) this.shadowRoot.appendChild(this._dbEl);
    if (qa) this.shadowRoot.querySelectorAll('img[data-b]').forEach((n) => { const o = (keep[n.dataset.b] || []).shift(); if (o && o !== n) n.replaceWith(o); });
    const nb = this.shadowRoot.querySelector('.body'); if (nb) nb.scrollTop = top;
    if (qa) {
      Object.keys(pk).forEach((k) => { const i = this.shadowRoot.querySelector(`[data-pk="${k}"]`); if (i && !i.disabled) i.value = pk[k]; });
      if (fk) { const i = this.shadowRoot.querySelector(`[data-pk="${fk.k}"]`); if (i) { i.focus(); try { if (fk.s != null) i.setSelectionRange(fk.s, fk.e); } catch (_) { /* number-Felder */ } } }
    }
    if (['add', 'srcpick', 'quick', 'dvmain', 'dvpick', 'dbpick'].includes(this._sheet)) this._fillList();
  }
  _num(id) { const st = this._hass.states[id]; const v = st ? parseFloat(st.state) : NaN; return isNaN(v) ? null : v; }
  _w(v) { return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} kW` : `${Math.round(v)} W`; }
  _avatar(p, big) {
    const pic = p && p.attributes.entity_picture; const nm = (p && p.attributes.friendly_name) || '?';
    return `<div class="av">${pic ? `<img src="${esc(pic)}" alt="">` : `<span>${esc(nm[0])}</span>`}${big ? '' : '<i></i>'}</div>`;
  }
  _energy() {
    const e = {}; ['pv', 'consumption', 'grid_in', 'grid_out', 'battery_in', 'battery_out', 'soc', 'forecast'].forEach((k) => { e[k] = this._slot(`e_${k}`); }); const n = (k) => this._num(e[k]);
    const cons = n('consumption'); const pv = n('pv');
    if (cons === null && pv === null) return '';
    const gin = n('grid_in') || 0; const gout = n('grid_out') || 0; const bin = n('battery_in') || 0; const bout = n('battery_out') || 0;
    const soc = n('soc'); const fc = n('forecast');
    const max = Math.max(cons || 0, pv || 0, gin, gout, bin, bout, 1);
    const row = (ic, label, v, cls) => `<div class="rw"><div class="rl"><span><ha-icon icon="${ic}"></ha-icon>${label}</span><span>${this._w(v)}</span></div><div class="bar ${cls}"><i style="width:${Math.max(2, Math.round((v / max) * 100))}%"></i></div></div>`;
    const grid = gout > gin ? ['Netz · Einspeisung', gout] : ['Netz · Bezug', gin];
    const bat = bin > bout ? ['Batterie · lädt', bin] : ['Batterie · entlädt', bout];
    const sub = fc !== null ? `Prognose heute bis ${this._w(fc)}` : 'Aktuelle Leistung';
    return `<div class="en" data-act="info" data-id="${e.consumption || e.pv}"><div class="hd"><div class="ib"><ha-icon icon="mdi:flash"></ha-icon></div><div><b>Stromverbrauch</b><span>${sub}</span></div><div class="big">${this._w(cons || 0)}</div></div>
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
      ? `<div class="note sv${al[ai].sev}" data-act="alerts"><ha-icon icon="${al[ai].icon}"></ha-icon><span class="note-t">${esc(al[ai].text)}</span></div>`
      : `<div class="note" data-act="alerts"><ha-icon icon="mdi:check-circle-outline"></ha-icon><span class="note-t">Alles in Ordnung</span></div>`;
    const apill = alarm ? `<button class="pill ${alarm.state === 'triggered' ? 'bad' : ''}" data-act="info" data-id="${alarm.entity_id}"><ha-icon icon="mdi:shield-home"></ha-icon>${esc(AL[alarm.state] || alarm.state)}</button>` : '';
    const wpill = wx && typeof wx.attributes.temperature === 'number' ? `<button class="pill" data-act="info" data-id="${wx.entity_id}"><ha-icon icon="${WX[wx.state] || 'mdi:weather-cloudy'}"></ha-icon>${wx.attributes.temperature.toFixed(1)}° draußen</button>` : '';
    const pills = [
      lights.length && this._chipOn('lights') ? `<button class="pill" data-act="lights"><ha-icon icon="mdi:lamp"></ha-icon>${lights.length} an</button>` : '',
      this._chipOn('outdoor') ? wpill : '',
      this._infoPills(al),
      al.length && this._chipOn('count') ? `<button class="pill ${al.some((a) => a.sev === 0) ? 'bad' : 'warn'}" data-act="alerts"><ha-icon icon="mdi:bell-ring-outline"></ha-icon>${al.length} Meldung${al.length > 1 ? 'en' : ''}</button>` : '',
      this._edit ? '<button class="pill" data-act="chips"><ha-icon icon="mdi:tune"></ha-icon>Chips</button><button class="pill" data-act="src"><ha-icon icon="mdi:link-variant"></ha-icon>Quellen</button><button class="pill" data-act="hc"><ha-icon icon="mdi:cctv"></ha-icon>Kameras</button><button class="pill" data-act="door"><ha-icon icon="mdi:bell-ring"></ha-icon>Klingel</button><button class="pill" data-act="fx"><ha-icon icon="mdi:weather-night"></ha-icon>Effekte</button>' : '',
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
      const idle = !!p.only && INACTIVE.includes(st.state);
      if (idle && !this._edit) return;
      cards.push(this._card(st, `${this._state(st)}${this._edit && p.only ? ' · nur wenn aktiv' : ''}`, p.entity, this._edit, `${idle ? 'hid' : ''} ${this._set.size[p.entity] ? `sz-${this._set.size[p.entity]}` : ''}`, p));
    });
    cards.push(`<div class="card add" data-act="add"><ha-icon icon="mdi:plus"></ha-icon>Karte hinzufügen</div>`);
    const en = this._energy();
    const regItems = this._regItems('home');
    if (en) regItems.push({ id: 'energyhome', html: `<div class="enw">${en}</div>`, size: this._set.size.energyhome || 'f', def: { fixed: true } });
    const regCells = this._ord('homereg', regItems, (x) => x.id).map((x) => this._cell(x, 'homereg')).filter(Boolean).join('');
    return `<div class="top"><div class="logo"><ha-icon icon="mdi:home-variant"></ha-icon></div><div class="ttl">Lumora.</div>${apill}</div>
      <div class="meta">${esc(meta)}</div>${this._vent()}
      <div class="hello">${this._avatar(me, true)}<div><h1>${greet}${nm ? `, ${esc(nm)}` : ''}</h1><div class="sub">${persons.length ? `${home}/${persons.length} zu Hause` : ''}</div></div></div>
      ${note}<div class="pills">${pills}</div>${regCells ? `<div class="grid reg">${regCells}</div>` : ''}
      ${this._homeCams()}
      <h3>Aktiv jetzt<button class="pill" style="padding:5px 10px;font-size:12px" data-act="edit"><ha-icon icon="mdi:pencil"></ha-icon>${this._edit ? 'Fertig' : 'Bearbeiten'}</button></h3>
      ${this._hint()}<div class="grid">${cards.join('')}</div>`;
  }
  _card(st, sub, pinId, edit, cls, p) {
    const x = edit && pinId ? `<span class="x" data-act="unpin" data-id="${pinId}"><ha-icon icon="mdi:close"></ha-icon></span><span class="mini po" data-act="ponly" data-id="${pinId}"><ha-icon icon="${p && p.only ? 'mdi:flash' : 'mdi:flash-off'}"></ha-icon></span><span class="mini sz" data-act="size" data-id="${pinId}" data-d="${this._set.size[pinId] || 's'}"><ha-icon icon="${SIZE_ICON[this._set.size[pinId] || 's']}"></ha-icon></span>${this._tools('pinned', pinId, null)}` : '';
    if (dom(st.entity_id) === 'camera') return this._camHtml(st, 'pinned', x);
    const sp = this._special(st, x, cls || ''); if (sp) return sp;
    const lit = ['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'media_player', 'cover', 'lock'].includes(dom(st.entity_id)) && !INACTIVE.includes(st.state) && st.state !== 'closed';
    return `<div class="card ${lit ? 'on' : ''} ${cls || ''}" data-act="info" data-id="${st.entity_id}">${x}<ha-icon icon="${this._icon(st)}"></ha-icon><div><b>${esc(st.attributes.friendly_name || st.entity_id)}</b><span>${esc(sub)}</span></div></div>`;
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
        if (!this._edit) { clearTimeout(this._rt); this._rt = setTimeout(() => this._render(), 100); }
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
  _appls() { return this._cfg.appliances || this._auto().appls; }
  _applInfo(a) {
    const z = this._hass.states[`${a.base}_zustand`]; if (!z) return null;
    const stt = z.state; const off = ['off', 'unavailable', 'unknown', 'none', ''].includes(stt);
    const done = ['finished', 'end'].includes(stt);
    const active = !off && !done && !['pause', 'paused', 'ready', 'idle'].includes(stt);
    let prog = this._num(`${a.base}_fortschritt`); if (prog !== null && prog <= 1 && prog > 0) prog *= 100;
    const left = this._dur(this._hass.states[`${a.base}_verbleibende_zeit`]);
    const pr = this._hass.states[`${a.base}_programm`];
    const prg = pr && !['unavailable', 'unknown', 'none', 'off', ''].includes(pr.state) ? pr.state : null;
    return { off, done, active, prog, left, program: prg ? human(prg) : null, label: done ? a.hint : (APL[stt] || human(stt)) };
  }
  _applCard(a) {
    const i = this._applInfo(a); if (!i) return '';
    const sub = [i.label, i.active && i.left !== null ? `noch ${this._fmtMin(i.left)}` : null, i.active ? i.program : null].filter(Boolean).join(' · ');
    return `<div class="ap ${i.active ? 'run' : ''}" data-act="info" data-id="${a.base}_zustand"><div class="h"><ha-icon icon="${a.icon}"></ha-icon><div><b>${esc(a.title)}</b><span>${esc(i.off ? 'Aus' : sub)}</span></div></div>${i.active && i.prog !== null ? `<div class="bar"><i style="width:${Math.round(i.prog)}%"></i></div>` : ''}</div>`;
  }
  _pkgs() {
    const st = this._xs('packages'); if (!st) return null;
    const arr = (v) => (Array.isArray(v) ? v : []);
    const keep = (x) => this._pkgKeep(x);
    const dhl = arr(st.attributes.dhl).filter((x) => x && x.tracking_id && keep(x));
    const amz = arr(st.attributes.amazon).filter((x) => x && x.tracking_id && keep(x));
    return { st, n: dhl.length + amz.length, today: parseInt(st.attributes.today_count, 10) || 0, dhl, amz };
  }
  /* Offene Sendungen immer, zugestellte nur die letzten PKG_DAYS Tage (wie Zuhause 3.0) */
  _pkgKeep(x) {
    const txt = `${x.status || ''} ${x.short_status || ''}`.toLowerCase();
    const done = x.delivered === true || String(x.delivered).toLowerCase() === 'true' || String(x.group || '').toLowerCase() === 'delivered' || String(x.short_status || '').toUpperCase() === 'DELIVERED' || txt.includes('zugestellt');
    if (!done) return true;
    const cut = new Date(); cut.setHours(0, 0, 0, 0); cut.setDate(cut.getDate() - PKG_DAYS);
    let d = null;
    const m = String(x.status || '').match(/(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/i);
    if (m) {
      const mo = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'].indexOf(m[2].toLowerCase().replace('maerz', 'märz'));
      const now = new Date(); d = new Date(now.getFullYear(), mo, Number(m[1]), 12);
      if (d.getTime() > now.getTime() + 7 * 864e5) d.setFullYear(now.getFullYear() - 1);
    } else {
      const t = new Date(x.event_time || x.last_changed || 0);
      if (!Number.isNaN(t.getTime())) d = t;
    }
    return !d || d.getTime() >= cut.getTime();
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
  _xid(k) { return this._slot(k); }
  _xs(k) { const st = this._hass.states[this._xid(k)]; return st && !['unavailable', 'unknown'].includes(st.state) ? st : null; }
  _stat(icon, label, val, unit, id) {
    return `<div class="card" data-act="info" data-id="${id}"><ha-icon icon="${icon}"></ha-icon><div><b>${esc(val)}${unit ? ` ${esc(unit)}` : ''}</b><span>${esc(label)}</span></div></div>`;
  }
  _de(v, d = 0) { return Number(v).toLocaleString('de-DE', { maximumFractionDigits: d }); }

  /* ---------- Tab Mehr ---------- */
_more() {
    const items = this._ord('more', this._regItems('more'), (x) => x.id);
    const cells = items.map((x) => this._cell(x, 'more')).filter(Boolean);
    return `<div class="rh"><h2>Mehr</h2><div class="inf">${this._editBtn()}</div></div>${this._hint()}<div class="grid">${cells.join('') || '<div class="empty">Keine weiteren Daten gefunden.</div>'}${this._edit ? '<div class="card add" data-act="add"><ha-icon icon="mdi:plus"></ha-icon>Karte hinzufügen</div>' : ''}</div>`;
  }

  /* ---------- Karten-Register ---------- */
  _allReg() {
    const s = this._set; const out = [];
    for (const def of REG) {
      let its = [];
      try { its = def.items(this) || []; } catch { its = []; }
      for (const it of its) {
        if (!it || !it.html) continue;
        out.push({ ...it, def, pl: def.fixed ? 'more' : (s.place[it.id] || (def.home ? 'home' : 'more')), size: s.size[it.id] || it.size || def.size || 's' });
      }
    }
    return out;
  }
  _regItems(where) { return this._allReg().filter((x) => x.pl === where); }
  _cell(x, scope) {
    const hd = this._set.hidden.includes(x.id);
    if (hd && !this._edit) return '';
    const opts = { size: x.size, place: x.def.fixed ? null : scope, cfg: x.cfg };
    return `<div class="mw sz-${x.size} ${x.id === 'quick' ? 'qw' : ''} ${hd ? 'hid' : ''}">${this._tools(scope, x.id, 'hidden', opts)}${x.html}</div>`;
  }

  /* ---------- Verlauf (Sparklines) ---------- */
  _hist(id, hours) {
    const hc = this._hc || (this._hc = {}); const k = `${id}|${hours}`; const c = hc[k];
    if (c && (c.busy || Date.now() - c.at < 600000)) return c.pts;
    const e = hc[k] = { at: c ? c.at : 0, pts: c ? c.pts : null, busy: true };
    const end = Date.now(); const t0 = end - hours * 3600000;
    this._hass.callWS({ type: 'history/history_during_period', start_time: new Date(t0).toISOString(), end_time: new Date(end).toISOString(), entity_ids: [id], include_start_time_state: true, significant_changes_only: false, minimal_response: true, no_attributes: true })
      .then((r) => {
        const raw = [];
        for (const x of (r && r[id]) || []) {
          const v = parseFloat(x.s !== undefined ? x.s : x.state); if (isNaN(v)) continue;
          const t = x.lu !== undefined ? x.lu * 1000 : new Date(x.last_updated || x.last_changed).getTime();
          raw.push([Math.max(t, t0), v]);
        }
        raw.sort((a, b) => a[0] - b[0]);
        const N = 48; const dt = (end - t0) / N; const pts = []; let j = 0; let last = raw.length ? raw[0][1] : null;
        for (let b = 0; b < N && raw.length; b++) {
          const hi = t0 + (b + 1) * dt; let sum = 0; let n = 0;
          while (j < raw.length && raw[j][0] < hi) { sum += raw[j][1]; n++; last = raw[j][1]; j++; }
          pts.push([t0 + (b + 0.5) * dt, n ? sum / n : last]);
        }
        e.pts = pts; e.at = Date.now(); e.busy = false;
        if (!this._edit && !this._dg && !this._sheet) { clearTimeout(this._hr); this._hr = setTimeout(() => this._render(), 300); }
      }).catch(() => { e.busy = false; e.at = Date.now() - 540000; });
    return e.pts;
  }
  _spark(pts, h, cls) {
    h = h || 44;
    if (!pts || pts.length < 2) return `<div class="spk" style="height:${h}px"></div>`;
    const vs = pts.map((p) => p[1]); let mn = Math.min(...vs); let mx = Math.max(...vs); if (mx - mn < 1e-9) { mn -= 1; mx += 1; }
    const W = 200; const a = pts[0][0]; const span = Math.max(1, pts[pts.length - 1][0] - a);
    const line = pts.map((p) => `${((p[0] - a) / span * W).toFixed(1)},${(h - 3 - (p[1] - mn) / (mx - mn) * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg class="spk ${cls || ''}" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px"><polygon points="0,${h} ${line} ${W},${h}" fill="currentColor" opacity=".13"/><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  _hrs(h) { return h < 24 ? `${h} h` : h === 24 ? '24 h' : `${Math.round(h / 24)} Tage`; }

  /* ---------- Schnellaktionen ---------- */
  _quickHtml(q) {
    const h = this._hass;
    const chips = q.map((id) => {
      const st = h.states[id];
      const ic = id === '__alloff' ? 'mdi:lightbulb-group-off' : this._icon(st);
      const nm = id === '__alloff' ? 'Alles Licht aus' : (st.attributes.friendly_name || id);
      return `<button class="qa" data-act="qrun" data-id="${esc(id)}"><ha-icon icon="${ic}"></ha-icon>${esc(nm)}${this._edit ? `<span class="qx" data-act="qdel" data-id="${esc(id)}"><ha-icon icon="mdi:close"></ha-icon></span>` : ''}</button>`;
    }).join('');
    return `<div class="qs"><div class="qh"><ha-icon icon="mdi:flash"></ha-icon>Schnellaktionen</div><div class="qc">${chips}${this._edit ? '<button class="qa add" data-act="quick"><ha-icon icon="mdi:plus"></ha-icon>Aktion</button>' : ''}</div></div>`;
  }

  /* ---------- Batterien und Offline ---------- */
  _devName(id) {
    const h = this._hass; const r = h.entities && h.entities[id]; const dv = r && r.device_id && h.devices && h.devices[r.device_id];
    const n = dv && (dv.name_by_user || dv.name); if (n) return n;
    return cleanName(String((h.states[id] && h.states[id].attributes.friendly_name) || id).replace(/\s*(batterie|battery|akku)\s*(level|stand)?\s*$/i, ''));
  }
  _batteries(all) {
    const h = this._hass; const lim = this._set.battLimit; const ig = this._set.ignore; const out = [];
    for (const id in h.states) {
      const d = dom(id); if (d !== 'sensor' && d !== 'binary_sensor') continue;
      const st = h.states[id]; const a = st.attributes || {}; if (a.device_class !== 'battery' || ig.includes(id)) continue;
      const r = h.entities && h.entities[id]; if (r && r.hidden) continue;
      if (BATX.test(norm(`${id} ${a.friendly_name || ''}`))) continue;
      let v = null;
      if (d === 'sensor') {
        v = parseFloat(st.state); if (isNaN(v) || (!all && v > lim)) continue;
        if (a.unit_of_measurement && a.unit_of_measurement !== '%') continue;
      } else if (st.state !== 'on') continue;
      out.push({ id, v, name: this._devName(id) });
    }
    return out.sort((x, y) => (x.v === null ? -1 : x.v) - (y.v === null ? -1 : y.v));
  }
  _battHtml(l) {
    const lim = this._set.battLimit; const ig = this._set.ignore.length;
    const rows = l.slice(0, 8).map((x) => `<div class="br" data-act="info" data-id="${x.id}"><ha-icon icon="${x.v === null ? 'mdi:battery-alert' : x.v <= 10 ? 'mdi:battery-10' : 'mdi:battery-30'}"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${esc(this._aname(this._areaOf(x.id)))}</span></div><em>${x.v === null ? 'schwach' : `${Math.round(x.v)} %`}</em>${this._edit ? `<span class="mini" data-act="ign" data-id="${x.id}"><ha-icon icon="mdi:eye-off"></ha-icon></span>` : ''}</div>`).join('');
    const more = l.length > 8 ? `<div class="pkr"><span>+ ${l.length - 8} weitere</span></div>` : '';
    const ed = this._edit ? `<div class="pills" style="margin-top:10px"><button class="pill" data-act="bl">Grenze ${lim} %</button>${ig ? `<button class="pill" data-act="ignclear">${ig} ausgeblendet, zurücksetzen</button>` : ''}</div>` : '';
    return `<div class="en nopt"><div class="hd"><div class="ib"><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon></div><div><b>Batterien schwach</b><span>bis ${lim} %</span></div><div class="big">${l.length}</div></div>${rows || '<div class="empty">Alle Batterien in Ordnung.</div>'}${more}${ed}</div>`;
  }
  _battAllHtml(l) {
    const lim = this._set.battLimit; const ig = this._set.ignore.length;
    const low = l.filter((x) => x.v === null || x.v <= lim).length;
    const rows = l.slice(0, this._battMore ? l.length : 8).map((x) => {
      const cls = x.v === null || x.v <= 10 ? 'lo' : x.v <= lim ? 'wn' : '';
      const ic = x.v === null || x.v <= 5 ? 'mdi:battery-alert-variant-outline' : x.v >= 95 ? 'mdi:battery' : `mdi:battery-${Math.max(10, Math.round(x.v / 10) * 10)}`;
      const bar = x.v === null ? '' : `<div class="bb ${cls}"><u style="width:${Math.max(2, Math.min(100, x.v))}%"></u></div>`;
      return `<div class="br" data-act="info" data-id="${x.id}"><ha-icon class="${cls}" icon="${ic}"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${esc(this._aname(this._areaOf(x.id)))}</span>${bar}</div><em class="${cls}">${x.v === null ? 'schwach' : `${Math.round(x.v)} %`}</em>${this._edit ? `<span class="mini" data-act="ign" data-id="${x.id}"><ha-icon icon="mdi:eye-off"></ha-icon></span>` : ''}</div>`;
    }).join('');
    const more = l.length > 8 ? `<div class="pills" style="margin-top:8px"><button class="pill" data-act="battmore">${this._battMore ? 'Weniger anzeigen' : `Alle ${l.length} anzeigen`}</button></div>` : '';
    const ed = this._edit ? `<div class="pills" style="margin-top:10px"><button class="pill" data-act="bl">Warnschwelle ${lim} %</button>${ig ? `<button class="pill" data-act="ignclear">${ig} ausgeblendet, zurücksetzen</button>` : ''}</div>` : '';
    return `<div class="en nopt"><div class="hd"><div class="ib"><ha-icon icon="mdi:battery-heart-variant"></ha-icon></div><div><b>Batterien</b><span>${low ? `${low} schwach (bis ${lim} %)` : 'alle in Ordnung'}</span></div><div class="big">${l.length}</div></div>${rows}${more}${ed}</div>`;
  }
  /* ---------- Proxmox (Integration proxmoxve): Node, LXC, VM ---------- */
  _pxDur(ms) { const m = Math.max(0, Math.floor(ms / 60000)); const d = Math.floor(m / 1440); const hh = Math.floor((m % 1440) / 60); return d ? `${d} d ${hh} h` : hh ? `${hh} h ${m % 60} min` : `${m} min`; }
  _pxAgo(iso) { const t = new Date(iso).getTime(); if (isNaN(t)) return ''; const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? `vor ${m} min` : m < 1440 ? `vor ${Math.floor(m / 60)} h` : `vor ${Math.floor(m / 1440)} d`; }
  _pxState(F) {
    const s = this._dvS(F.state); const rn = F.running && this._hass.states[F.running];
    if (s) return { key: s.state, on: s.state === 'running' || s.state === 'online', txt: PX_ST[s.state] || s.state };
    if (rn && rn.state === 'on') return { key: 'running', on: true, txt: PX_ST.running };
    if (rn && rn.state === 'off') return { key: 'stopped', on: false, txt: PX_ST.stopped };
    return { key: 'na', on: false, txt: 'Nicht verfügbar' };
  }
  _pxUse(F, k, kmax, kp) {
    const u = this._num(F[k]); const m = this._num(F[kmax]); let p = kp ? this._num(F[kp]) : null;
    if (p === null && u !== null && m) p = u / m * 100;
    const st = F[k] && this._hass.states[F[k]];
    return { u, m, p, unit: st ? st.attributes.unit_of_measurement || '' : '' };
  }
  _pxDevices() {
    const h = this._hass; const reg = h.entities || {}; const by = {};
    for (const id in reg) { const r = reg[id]; if (!r || r.platform !== 'proxmoxve' || !r.device_id || r.hidden || !h.states[id]) continue; (by[r.device_id] || (by[r.device_id] = [])).push(id); }
    const out = [];
    for (const did in by) {
      const ids = by[did]; const F = {};
      for (const k in PXF) F[k] = ids.find((i) => this._dvMatch(i, PXF[k])) || null;
      F.running = ids.find((i) => dom(i) === 'binary_sensor' && h.states[i].attributes.device_class === 'running') || null;
      const dv = h.devices && h.devices[did];
      out.push({ did, F, kind: pxKind(dv && dv.model, F), name: dv ? (dv.name_by_user || dv.name) : did, st: this._pxState(F), main: F.running || F.state || ids[0] });
    }
    const ord = { node: 0, lxc: 1, vm: 2 };
    return out.sort((a, b) => ord[a.kind] - ord[b.kind] || String(a.name).localeCompare(String(b.name), 'de'));
  }
  _pxHtml(l) {
    const run = l.filter((x) => x.st.on).length; const node = l.find((x) => x.kind === 'node');
    const lb = node && this._dvS(node.F.lastbackup); const bp = node && node.F.backup && this._hass.states[node.F.backup];
    const sub = `${run} von ${l.length} laufen${lb ? ` · Backup ${this._pxAgo(lb.state)}` : ''}${bp && bp.state === 'on' ? ' · Backup-Problem' : ''}`;
    const rows = l.map((x) => {
      const K = PX_KIND[x.kind]; const cls = x.st.on ? '' : x.st.key === 'na' ? 'na' : 'off';
      const c = this._num(x.F.cpu); const r = this._pxUse(x.F, 'ram', 'rammax', 'ramp').p;
      const vals = x.st.on ? `<span>${c !== null ? `CPU ${this._de(c, c < 10 ? 1 : 0)} %` : ''}</span><span>${r !== null ? `RAM ${this._de(r)} %` : ''}</span>` : `<span class="st">${esc(x.st.txt)}</span>`;
      return `<div class="px ${cls}" data-act="info" data-id="${x.main}"><ha-icon icon="${K.icon}"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${K.l}</span></div>${vals}</div>`;
    }).join('');
    return `<div class="en nopt"><div class="hd"><div class="ib"><ha-icon icon="mdi:server"></ha-icon></div><div><b>Proxmox</b><span>${esc(sub)}</span></div><div class="big">${run}/${l.length}</div></div>${rows}</div>`;
  }
  _offline() {
    const h = this._hass; const ig = this._set.ignore; const dev = {};
    for (const id in h.states) {
      const r = h.entities && h.entities[id]; if (!r || !r.device_id || r.hidden || r.entity_category) continue;
      if (dom(id) === 'update') continue;
      const o = dev[r.device_id] || (dev[r.device_id] = { n: 0, off: 0, id });
      o.n++; if (h.states[id].state === 'unavailable') o.off++;
    }
    const out = []; const tot = Object.keys(dev).length;
    for (const did in dev) {
      const o = dev[did]; if (!o.n || o.off < o.n || ig.includes(did)) continue;
      const dv = h.devices && h.devices[did]; const name = dv ? (dv.name_by_user || dv.name) : null;
      if (BATX.test(norm(`${name || ''} ${o.id}`))) continue;
      out.push({ did, id: o.id, name: name || cleanName(h.states[o.id].attributes.friendly_name || o.id) });
    }
    if (out.length > Math.max(5, tot * 0.5)) return [];
    return out.sort((x, y) => x.name.localeCompare(y.name, 'de'));
  }
  _offHtml(l) {
    const rows = l.slice(0, 6).map((x) => `<div class="br" data-act="info" data-id="${x.id}"><ha-icon icon="mdi:lan-disconnect"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${esc(this._aname(this._areaOf(x.id)))}</span></div>${this._edit ? `<span class="mini" data-act="ign" data-id="${x.did}"><ha-icon icon="mdi:eye-off"></ha-icon></span>` : ''}</div>`).join('');
    const more = l.length > 6 ? `<div class="pkr"><span>+ ${l.length - 6} weitere</span></div>` : '';
    return `<div class="en nopt"><div class="hd"><div class="ib"><ha-icon icon="mdi:lan-disconnect"></ha-icon></div><div><b>Geräte offline</b><span>nicht erreichbar</span></div><div class="big">${l.length}</div></div>${rows}${more}</div>`;
  }

  /* ---------- Eigene Karten ---------- */
  _customHtml(cu, st) {
    const a = st.attributes; const name = cu.title || a.friendly_name || cu.entity;
    const num = parseFloat(st.state); const isNum = !isNaN(num); const unit = a.unit_of_measurement || '';
    const val = isNum ? `${this._de(num, Math.abs(num) >= 100 ? 0 : 1)}${unit ? ` ${esc(unit)}` : ''}` : esc(this._state(st));
    const ic = `<ha-icon icon="${this._icon(st)}"></ha-icon>`;
    if (cu.kind === 'toggle') {
      const on = !INACTIVE.includes(st.state);
      return `<div class="card cu ${on ? 'on' : ''}" data-act="toggle" data-id="${cu.entity}">${ic}<div><b>${esc(name)}</b><span>${esc(this._state(st))}</span></div></div>`;
    }
    if (cu.kind === 'spark' && isNum) {
      const hrs = cu.hours || 24; const pts = this._hist(cu.entity, hrs);
      const rng = pts && pts.length > 1 ? `${this._de(Math.min(...pts.map((p) => p[1])), 1)} bis ${this._de(Math.max(...pts.map((p) => p[1])), 1)}${unit ? ` ${esc(unit)}` : ''}` : '';
      return `<div class="card cu sp" data-act="info" data-id="${cu.entity}"><div class="spt">${ic}<div><b>${val}</b><span>${esc(name)}</span></div></div>${this._spark(pts, 46)}<span class="spl">${this._hrs(hrs)}${rng ? ` · ${rng}` : ''}</span></div>`;
    }
    return `<div class="card cu" data-act="info" data-id="${cu.entity}">${ic}<div><b>${val}</b><span>${esc(name)}</span></div></div>`;
  }
  _customMissing(cu) {
    return `<div class="card cu"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><div><b>Entität fehlt</b><span>${esc(cu.entity)}</span></div></div>`;
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
    /* Räume ohne eigene Entitäten bleiben sichtbar, sobald eine Karte (z. B. Proxmox) dorthin verschoben wurde */
    new Set(Object.values(this._set.place).filter((p) => typeof p === 'string' && p.startsWith('area:')).map((p) => p.slice(5))).forEach((aid) => {
      if (areas[aid] || !(h.areas && h.areas[aid])) return;
      if (this._regItems(`area:${aid}`).some((x) => this._edit || !this._set.hidden.includes(x.id))) areas[aid] = [];
    });
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
  _areaEnts(aid) {
    for (const f of this._roomData()) { const a = f.areas.find((x) => x.id === aid); if (a) return a.ents; }
    return [];
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
    const isAct = (x) => { const d = dom(x.entity_id); return d !== 'sensor' && (d === 'binary_sensor' ? x.state === 'on' : !INACTIVE.includes(x.state)); };
    const nAct = tileEnts.filter(isAct).length; const onlyAct = this._roomAct && !this._edit;
    const tiles = (onlyAct ? tileEnts.filter(isAct) : tileEnts).map((s) => this._tile(s, a.name, 'tiles:' + a.id)).join('');
    const lg = ents.filter((x) => dom(x.entity_id) === 'light'); const cv = ents.filter((x) => dom(x.entity_id) === 'cover');
    const qa = [
      (nAct || this._roomAct) && `<button class="pill ${this._roomAct ? 'sel' : ''}" data-act="roomact"><ha-icon icon="mdi:flash-outline"></ha-icon>Aktiv (${nAct})</button>`,
      lg.length && `<button class="pill" data-act="rmlight" data-id="${esc(a.id)}"><ha-icon icon="${lg.some((x) => x.state === 'on') ? 'mdi:lightbulb-off-outline' : 'mdi:lightbulb-on-outline'}"></ha-icon>${lg.some((x) => x.state === 'on') ? 'Licht aus' : 'Licht an'}</button>`,
      cv.length && `<button class="pill" data-act="rmcover" data-id="${esc(a.id)}"><ha-icon icon="mdi:blinds"></ha-icon>${cv.some((x) => x.state !== 'closed') ? 'Rollläden zu' : 'Rollläden auf'}</button>`,
    ].filter(Boolean).join('');
    const rsc = `areareg:${a.id}`; const rcells = this._ord(rsc, this._regItems(`area:${a.id}`), (x) => x.id).map((x) => this._cell(x, rsc)).filter(Boolean).join('');
    return `<div class="tabs">${ftabs}</div><div class="tabs">${atabs}</div>
      <div class="rh"><h2>${esc(a.name)}</h2><div class="inf"><span>${info.join(' · ')}</span>${t ? `<span class="spi">${this._spark(this._hist(t.entity_id, 24), 24)}</span>` : ''}${this._edit ? `<button class="pill" data-act="regpick"><ha-icon icon="mdi:card-plus-outline"></ha-icon>Karte</button><button class="pill" data-act="rsens" data-id="${a.id}"><ha-icon icon="mdi:thermometer"></ha-icon>Sensoren</button>` : ''}${this._editBtn()}</div></div>${this._hint()}
      ${cams.length ? `<div class="cams" style="margin-bottom:10px">${cams.map((s) => this._camHtml(s, 'rcams:' + a.id)).join('')}</div>` : ''}
      ${qa ? `<div class="tabs" style="margin-bottom:10px">${qa}</div>` : ''}
      <div class="grid">${rcells}${tiles || (rcells ? '' : `<div class="empty">${onlyAct ? 'Nichts aktiv in diesem Raum.' : 'Keine Geräte in diesem Raum.'}</div>`)}</div>`;
  }
  _editBtn() { return `<button class="pill" data-act="edit"><ha-icon icon="mdi:pencil"></ha-icon>${this._edit ? 'Fertig' : 'Bearbeiten'}</button>`; }
  _tools(scope, id, hideKey, o) {
    if (!this._edit) return '';
    const list = hideKey === 'hiddenAreas' ? this._set.hiddenAreas : this._set.hidden;
    const eye = hideKey ? `<span class="mini" data-act="${hideKey === 'hiddenAreas' ? 'hidearea' : 'hidee'}" data-id="${esc(id)}"><ha-icon icon="${list.includes(id) ? 'mdi:eye' : 'mdi:eye-off'}"></ha-icon></span>` : '';
    const e = esc(id);
    const cf = o && o.cfg ? `<span class="mini" data-act="cc" data-id="${e}"><ha-icon icon="mdi:cog-outline"></ha-icon></span>` : '';
    const sz = o && o.size ? `<span class="mini" data-act="size" data-id="${e}" data-d="${o.size}"><ha-icon icon="${SIZE_ICON[o.size]}"></ha-icon></span>` : '';
    const pl = o && o.place ? `<span class="mini" data-act="placeopen" data-id="${e}"><ha-icon icon="mdi:folder-move-outline"></ha-icon></span>` : '';
    return `<span class="tools">${cf}${sz}${pl}${eye}</span><i class="dg" data-s="${esc(scope)}" data-id="${esc(id)}" style="display:none"></i>`;
  }
  _ord(scope, items, idf) {
    const o = this._set.order[scope];
    const res = !o || !o.length ? items : items.map((x, i) => [x, i]).sort((a, b) => { const ia = o.indexOf(idf(a[0])); const ib = o.indexOf(idf(b[0])); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib) || a[1] - b[1]; }).map((x) => x[0]);
    (this._ids || (this._ids = {}))[scope] = res.map(idf);
    return res;
  }
  _hint() {
    if (!this._edit) return '';
    const admin = this._hass.user && this._hass.user.is_admin;
    return `<div class="hint">${this._msg ? esc(this._msg) : 'Bearbeiten: Element gedrückt halten und ziehen zum Verschieben. Das Auge blendet aus oder ein, das Größen-Symbol ändert die Breite, das Haus-Symbol verschiebt eine Karte zwischen Zuhause und Mehr.'}${admin && this._cfg.shared !== false ? ' <button class="pill" data-act="publish" style="margin-top:8px"><ha-icon icon="mdi:account-group"></ha-icon>Layout für alle speichern</button>' : ''}${this._hasBase ? ' <button class="pill" data-act="resetmine" style="margin-top:8px"><ha-icon icon="mdi:backup-restore"></ha-icon>Auf Gruppenlayout zurücksetzen</button>' : ''}</div>`;
  }
  async _publish() {
    const h = this._hass; const seg = (location.pathname.split('/')[1] || ''); const url = !seg || seg === 'lovelace' ? null : seg;
    this._msg = 'Speichere …'; this._render();
    try {
      this._set._pub = Date.now(); this._set._base = this._set._pub;
      const cfg = await h.callWS({ type: 'lovelace/config', url_path: url, force: true });
      let hit = false;
      const walk = (o) => { if (!o || typeof o !== 'object' || hit) return; if (o.type === 'custom:lumora-card') { o.layout = JSON.parse(JSON.stringify(this._set)); hit = true; return; } Object.values(o).forEach(walk); };
      walk(cfg);
      if (!hit) throw new Error('Karte nicht im Dashboard gefunden');
      await h.callWS({ type: 'lovelace/config/save', url_path: url, config: cfg });
      this._hasBase = true; this._save();
      this._msg = 'Layout gespeichert. Andere Benutzer sehen es nach dem Neuladen.';
    } catch (e) { this._msg = `Speichern nicht möglich (${(e && (e.message || e.code)) || e}). Das Dashboard muss im Bearbeitungsmodus der Oberfläche liegen und du Administrator sein.`; }
    this._render(); clearTimeout(this._mt); this._mt = setTimeout(() => { this._msg = null; if (!this._dg) this._render(); }, 6000);
  }
  _tile(st, area, scope) {
    const d = dom(st.entity_id); const on = !INACTIVE.includes(st.state);
    const sz = this._set.size[st.entity_id] || 's'; const szc = sz === 's' ? '' : `sz-${sz}`;
    const tl = this._tools(scope, st.entity_id, 'hidden', { size: sz });
    const hc = `${this._set.hidden.includes(st.entity_id) ? 'hid' : ''} ${szc}`;
    if (d === 'switch') { const pw = this._plugPower(st.entity_id); if (pw) return this._plugCard(st, pw, tl, hc, area); }
    if (d === 'climate' || d === 'vacuum') return this._special(st, tl, hc);
    let n = st.attributes.friendly_name || st.entity_id;
    if (n.toLowerCase().startsWith(area.toLowerCase() + ' ') && n.length > area.length + 1) n = n.slice(area.length + 1);
    const sens = d === 'sensor' ? 'sens' : '';
    const bad = d === 'binary_sensor' && st.state === 'on' && ['door', 'window', 'opening', 'smoke', 'moisture', 'gas'].includes(st.attributes.device_class);
    return `<div class="tile ${bad ? 'bad' : on ? 'on' : ''} ${sens} ${hc}">${tl}<div class="ic" data-act="toggle" data-id="${st.entity_id}"><ha-icon icon="${this._icon(st)}"></ha-icon></div>
      <div class="tx" data-act="info" data-id="${st.entity_id}"><b>${esc(n)}</b><span>${esc(this._state(st))}</span></div></div>`;
  }
  _camHtml(st, scope, extra) {
    const src = st.attributes.entity_picture || '';
    const tools = extra !== undefined ? extra : this._tools(scope, st.entity_id, 'hidden');
    return `<div class="cam ${this._set.hidden.includes(st.entity_id) ? 'hid' : ''}" data-act="info" data-id="${st.entity_id}">${src ? `<img data-b="${esc(src)}" src="${esc(src)}" alt="">` : ''}${tools}<span class="n">${esc(cleanName(st.attributes.friendly_name))}</span></div>`;
  }
  _homeCams() {
    const sts = this._set.homeCams.map((id) => this._hass.states[id]).filter((x) => x && x.state !== 'unavailable'); if (!sts.length) return '';
    const ord = this._ord('homecams', sts, (x) => x.entity_id);
    return `<h3>Kameras</h3><div class="cams hc">${ord.map((x) => this._camHtml(x, 'homecams', this._edit ? `<span class="x" data-act="hcam" data-id="${x.entity_id}"><ha-icon icon="mdi:close"></ha-icon></span>${this._tools('homecams', x.entity_id, null)}` : '')).join('')}</div>`;
  }
  _refreshCams() {
    if (this._edit || this._dg || (typeof document !== 'undefined' && document.hidden)) return;
    const q = this.shadowRoot.querySelectorAll; if (!q) return;
    this.shadowRoot.querySelectorAll('img[data-b]').forEach((img) => {
      const b = img.dataset.b; const u = `${b}${b.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const n = new Image(); n.onload = () => { img.src = u; }; n.src = u;
    });
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
      const CAT = [['door', 'Türen'], ['window', 'Fenster'], ['motion', 'Bewegung'], ['smoke', 'Rauch / Wasser / Gas'], ['alarm', 'Alarmanlage'], ['lock', 'Schloss entsperrt'], ['weather', 'DWD, NINA & Eiswarnung'], ['climate', 'Schimmel, Lüften & Raumklima']];
      c = `<h2>Meldungen</h2>${al.map((a) => `<div class="row"><ha-icon icon="${a.icon}"></ha-icon><div class="t"><b><i class="sev s${a.sev}"></i>${esc(a.text)}</b><span>${SEV[a.sev] || ''} · ${ago(a.since)}</span></div><button data-act="snooze" data-id="${a.id}">1 h Ruhe</button><button data-act="hide" data-id="${a.id}">Ausblenden</button></div>`).join('') || '<div class="empty">Keine aktiven Meldungen.</div>'}
        ${this._snoozed().length ? `<h4>Schlummernd</h4>${this._snoozed().map((x) => `<div class="row"><div class="t"><b>${esc(x.name)}</b><span>bis ${new Date(x.until).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></div><button data-act="unsnooze" data-id="${x.id}">Aufheben</button></div>`).join('')}` : ''}
        <h4>Benachrichtigen bei neuen Meldungen</h4>${this._ntfRows()}
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
    } else if (this._sheet === 'hc') {
      const cams = (this._byDomain().camera || []).filter((x) => x.state !== 'unavailable'); const on = this._set.homeCams;
      c = `<h2>Kameras auf der Startseite</h2>${cams.map((x) => `<div class="row"><ha-icon icon="mdi:cctv"></ha-icon><div class="t"><b>${esc(cleanName(x.attributes.friendly_name))}</b></div><button class="${on.includes(x.entity_id) ? 'sel' : ''}" data-act="hcam" data-id="${x.entity_id}">${on.includes(x.entity_id) ? 'An' : 'Aus'}</button></div>`).join('') || '<div class="empty">Keine Kameras gefunden.</div>'}`;
    } else if (this._sheet === 'src') {
      const h = this._hass; const gs = {}; Object.keys(SLOTS).forEach((k) => { (gs[SLOTS[k].g] || (gs[SLOTS[k].g] = [])).push(k); });
      c = `<h2>Sensoren und Quellen</h2><div class="hint">Was Lumora findet, ist schon eingetragen. Passt etwas nicht oder fehlt es, wähle es hier aus. Nicht Gefundenes bleibt einfach unsichtbar.</div>${Object.entries(gs).map(([g, ks]) => `<h4>${g}</h4>${ks.map((k) => {
        const id = this._slot(k); const st = id && h.states[id]; const ch = this._set.sources[k];
        const sub = ch === '-' ? 'Nicht verwendet' : st ? `${st.attributes.friendly_name || id}${ch ? '' : ' · automatisch'}` : id ? `${id} (nicht verfügbar)` : 'Nicht gefunden';
        return `<div class="row"><div class="t"><b>${SLOTS[k].l}</b><span>${esc(sub)}</span></div><button data-act="srcpick" data-k="${k}">Ändern</button></div>`;
      }).join('')}`).join('')}`;
    } else if (this._sheet === 'srcpick') {
      const k = this._sk;
      c = `<h2>${esc(SLOTS[k].l)}</h2><input class="srch" placeholder="Entität suchen" value="${esc(this._q)}"><div class="row" data-act="srcset" data-k="${k}" data-id=""><div class="t"><b>Automatisch erkennen</b></div></div><div class="row" data-act="srcset" data-k="${k}" data-id="-"><div class="t"><b>Nicht verwenden</b></div></div><div class="list"></div>`;
    } else if (this._sheet === 'chips') {
      const CH = [['lights', 'Lampen an'], ['outdoor', 'Außentemperatur'], ['motion', 'Bewegung'], ['count', 'Zähler der Meldungen'], ['warn', 'Wetter- und NINA-Warnungen'], ['ice', 'Eiswarnung'], ['bike', 'Fahrrad'], ['pollen', 'Pollen'], ['trav', 'Fahrzeiten']];
      c = `<h2>Chips</h2><div class="hint">Warnungen stehen schon in der Meldungszeile, deshalb sind sie hier standardmäßig aus.</div>${CH.map(([k, l]) => `<div class="row"><div class="t"><b>${l}</b></div><button class="${this._chipOn(k) ? 'sel' : ''}" data-act="chip" data-k="${k}">${this._chipOn(k) ? 'An' : 'Aus'}</button></div>`).join('')}`;
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
        <div class="row"><div class="t"><b>Gerätekarte</b><span>Staubsauger, PV-Übersicht und mehr: Entitäten werden automatisch gefunden</span></div><button data-act="adddv">Wählen</button></div>
        <div class="row"><div class="t"><b>Als eigene Karte</b><span>Wert, Verlauf oder Schalter statt Kachel</span></div><button class="${this._cust ? 'sel' : ''}" data-act="ascust">${this._cust ? 'An' : 'Aus'}</button></div>
        <div class="list"></div>`;
    } else if (this._sheet === 'place') {
      const cur = this._allReg().find((x) => x.id === this._plId); const at = cur ? cur.pl : '';
      const b = (p, l, ic) => `<div class="row"><ha-icon icon="${ic}"></ha-icon><div class="t"><b>${esc(l)}</b></div><button class="${at === p ? 'sel' : ''}" data-act="placeset" data-p="${esc(p)}">${at === p ? 'Hier' : 'Hierhin'}</button></div>`;
      c = `<h2>Karte platzieren</h2>${b('home', 'Zuhause (Startseite)', 'mdi:home-outline')}${b('more', 'Mehr', 'mdi:view-dashboard-outline')}${this._roomData().map((f) => `<h4>${esc(f.name)}</h4>${f.areas.map((ar) => b(`area:${ar.id}`, ar.name, 'mdi:door')).join('')}`).join('')}`;
    } else if (this._sheet === 'regpick') {
      const here = `area:${this._area}`;
      c = `<h2>Karte in diesen Raum holen</h2>${this._allReg().filter((x) => !x.def.fixed).map((x) => `<div class="row"><ha-icon icon="${x.def.icon}"></ha-icon><div class="t"><b>${esc(x.def.label)}</b></div><button class="${x.pl === here ? 'sel' : ''}" data-act="regset" data-id="${esc(x.id)}">${x.pl === here ? 'Hier' : 'Holen'}</button></div>`).join('') || '<div class="empty">Keine Karten verfügbar.</div>'}`;
    } else if (this._sheet === 'dvadd') {
      c = `<h2>Gerätekarte hinzufügen</h2><div class="hint">Wähle den Gerätetyp. Passende Entitäten werden automatisch gefunden und lassen sich danach einzeln ändern.</div>${Object.values(DEVTPL).map((tp) => `<div class="row" data-act="dvtype" data-k="${tp.type}"><ha-icon icon="${tp.icon}"></ha-icon><div class="t"><b>${esc(tp.label)}</b><span>${esc(tp.desc || '')}</span></div></div>`).join('')}`;
    } else if (this._sheet === 'dvmain') {
      const tp = DEVTPL[this._dvT];
      c = `<h2>${esc(tp ? tp.label : '')}: Gerät wählen</h2><input class="srch" placeholder="Entität suchen" value="${esc(this._q)}"><div class="list"></div>`;
    } else if (this._sheet === 'dv') {
      const iv = this._set.devices.find((x) => x.id === this._dvId); const tp = iv && DEVTPL[iv.type];
      if (iv && tp) {
        const F = this._dvMap(iv); const ms = this._hass.states[iv.main];
        c = `<h2>${esc(tp.label)}</h2><div class="hint">${esc(iv.main)}</div><h4>Titel</h4><input class="dvin" placeholder="${esc((ms && ms.attributes.friendly_name) || iv.main)}" value="${esc(iv.title)}">
          <h4>Entitäten</h4><div class="hint">Gefundenes ist schon eingetragen. Passt etwas nicht, wähle es selbst aus.</div>${Object.keys(tp.fields).map((k) => {
          const ch = iv.map[k]; const st = F[k] && this._hass.states[F[k]];
          const sub = ch === '-' ? 'Nicht verwendet' : st ? `${st.attributes.friendly_name || F[k]}${ch ? ' · manuell' : ' · automatisch'}` : F[k] ? `${F[k]} (nicht verfügbar)` : 'Nicht gefunden';
          return `<div class="row"><div class="t"><b>${esc(tp.fields[k].l)}</b><span>${esc(sub)}</span></div><button data-act="dvpick" data-k="${k}">Ändern</button></div>`;
        }).join('')}
          <div class="row" style="border:0"><button data-act="dvdel">Karte löschen</button><button class="sel" data-act="close">Fertig</button></div>`;
      }
    } else if (this._sheet === 'dvpick') {
      const iv = this._set.devices.find((x) => x.id === this._dvId); const tp = iv && DEVTPL[iv.type]; const k = this._dvK;
      if (tp && tp.fields[k]) c = `<h2>${esc(tp.fields[k].l)}</h2><input class="srch" placeholder="Entität suchen" value="${esc(this._q)}"><div class="row" data-act="dvset" data-k="${k}" data-id=""><div class="t"><b>Automatisch erkennen</b></div></div><div class="row" data-act="dvset" data-k="${k}" data-id="-"><div class="t"><b>Nicht verwenden</b></div></div><div class="list"></div>`;
    } else if (this._sheet === 'fx') {
      const f = this._set.fx; const lv = FX_LEVELS.find((l) => l[1] === f.level) || FX_LEVELS[1];
      const tg = (k, v) => `<button class="${v ? 'sel' : ''}" data-act="fxg" data-k="${k}">${v ? 'An' : 'Aus'}</button>`;
      c = `<h2>Effekte</h2><div class="hint">Stimmungs-Effekte über dem ganzen Dashboard. Pro Effekt: Auto (nach Wetter, Sonnenstand oder Datum), Immer an oder Aus, dazu die Dauer. Nach Ablauf der Dauer wird der Effekt ausgeblendet; sie startet neu, wenn du das Dashboard wieder öffnest.</div>
        <div class="row"><div class="t"><b>Effekte anzeigen</b></div>${tg('on', f.on)}</div>
        <div class="row"><div class="t"><b>Intensität</b><span>Anzahl der Partikel</span></div><button data-act="fxg" data-k="level">${lv[0]}</button></div>
        <div class="row"><div class="t"><b>Bewegung reduzieren beachten</b><span>Gerät meldet „weniger Animationen“: keine Effekte</span></div>${tg('respect', f.respect)}</div>
        <h4>Effekte</h4>${FX_KEYS.map((k) => { const e = f.e[k]; const ml = k === 'weather' ? FX_WMODE_L[e.m] : FX_MODE_L[e.m]; return `<div class="row"><div class="t"><b>${FX_LABEL[k][0]}</b><span>${FX_LABEL[k][1]}</span></div><button class="${e.m === 'off' ? '' : 'sel'}" data-act="fxm" data-k="${k}">${ml}</button><button data-act="fxd" data-k="${k}">${durL(e.d)}</button></div>`; }).join('')}
        <div class="hint">Beim Wetter lassen sich Regen, Schnee, Gewitter und Nebel zum Ausprobieren fest einstellen.</div>`;
    } else if (this._sheet === 'door') {
      const d = this._set.door; const cn = d.cam && this._hass.states[d.cam];
      const lst = (k) => d[k].map((id) => `<div class="row"><ha-icon icon="${k === 'bell' ? 'mdi:bell-ring' : 'mdi:motion-sensor'}"></ha-icon><div class="t"><b>${esc((this._hass.states[id] && this._hass.states[id].attributes.friendly_name) || id)}</b><span>${esc(id)}</span></div><button data-act="dbdel" data-k="${k}" data-id="${esc(id)}">Entfernen</button></div>`).join('');
      c = `<h2>Türklingel &amp; Bewegung</h2><div class="hint">Bei Auslösung öffnet sich die Kamera als Popup und schließt von selbst. Wirkt nur, solange Lumora geöffnet ist (z. B. am Wandtablet). Bewegung nutzt bevorzugt die Kamera im selben Raum.</div>
        <h4>Standard-Kamera</h4><div class="row" data-act="dbcam"><ha-icon icon="mdi:cctv"></ha-icon><div class="t"><b>${esc(cn ? cn.attributes.friendly_name : 'Nicht gewählt')}</b><span>Für die Türklingel und wenn im Raum keine Kamera liegt</span></div></div>
        <h4>Anzeigedauer</h4><div class="row"><div class="t"><b>${d.secs} Sekunden</b></div><button data-act="dbsecs">Ändern</button></div>
        <h4>Türklingel</h4>${lst('bell')}<div class="row" data-act="dbadd" data-k="bell"><ha-icon icon="mdi:plus"></ha-icon><div class="t"><b>Auslöser hinzufügen</b></div></div>
        <h4>Bewegung</h4>${lst('motion')}<div class="row" data-act="dbadd" data-k="motion"><ha-icon icon="mdi:plus"></ha-icon><div class="t"><b>Bewegungsmelder hinzufügen</b></div></div>
        <div class="row" style="border:0"><button data-act="dbtest">Popup testen</button><button class="sel" data-act="close">Fertig</button></div>`;
    } else if (this._sheet === 'dbcam') {
      const cams = (this._byDomain().camera || []).filter((x) => x.state !== 'unavailable'); const cur = this._set.door.cam;
      c = `<h2>Standard-Kamera</h2>${cams.map((x) => `<div class="row" data-act="dbsetcam" data-id="${esc(x.entity_id)}"><ha-icon icon="mdi:cctv"></ha-icon><div class="t"><b>${esc(cleanName(x.attributes.friendly_name))}</b><span>${esc(x.entity_id)}</span></div><ha-icon icon="${cur === x.entity_id ? 'mdi:check-circle' : 'mdi:circle-outline'}"></ha-icon></div>`).join('') || '<div class="empty">Keine Kameras gefunden.</div>'}`;
    } else if (this._sheet === 'dbpick') {
      c = `<h2>${this._dbk === 'bell' ? 'Türklingel-Auslöser' : 'Bewegungsmelder'}</h2><div class="hint">Binärsensor, Ereignis- oder Tasten-Entität. Ohne Suche erscheinen passende Vorschläge.</div><input class="srch" placeholder="Suchen" value="${esc(this._q)}"><div class="list"></div><div class="row" style="border:0"><button class="sel" data-act="dbback">Fertig</button></div>`;
    } else if (this._sheet === 'quick') {
      c = `<h2>Schnellaktionen</h2><div class="hint">Szenen, Skripte und Tasten mit einem Tipp auslösen. Mehrfachauswahl möglich.</div><input class="srch" placeholder="Suchen" value="${esc(this._q)}"><div class="list"></div>`;
    } else if (this._sheet === 'cc') {
      const cu = this._set.custom.find((x) => x.id === this._ccId);
      if (cu) {
        const st = this._hass.states[cu.entity];
        const K = [['value', 'Wert'], ['spark', 'Verlauf'], ['toggle', 'Schalter']]; const HR = [6, 24, 72, 168];
        c = `<h2>Eigene Karte</h2><div class="hint">${esc(cu.entity)}</div><h4>Titel</h4><input class="ccin" placeholder="${esc((st && st.attributes.friendly_name) || cu.entity)}" value="${esc(cu.title)}">
          <h4>Darstellung</h4><div class="tabs">${K.map(([k, l]) => `<button class="pill ${cu.kind === k ? 'sel' : ''}" data-act="cckind" data-k="${k}">${l}</button>`).join('')}</div>
          ${cu.kind === 'spark' ? `<h4>Zeitraum</h4><div class="tabs">${HR.map((v) => `<button class="pill ${(cu.hours || 24) === v ? 'sel' : ''}" data-act="cchrs" data-k="${v}">${this._hrs(v)}</button>`).join('')}</div>` : ''}
          <div class="row" style="border:0"><button data-act="ccdel">Karte löschen</button><button class="sel" data-act="close">Fertig</button></div>`;
      }
    }
    return `<div class="sbg" data-act="close"><div class="sheet" data-act="noop"><div class="sxw"><button class="sx" data-act="close" aria-label="Schließen"><ha-icon icon="mdi:close"></ha-icon></button></div>${c}</div></div>`;
  }
  _fillList() {
    this._fillList0(); this._a11y();
  }

  _fillList0() {
    const el = this.shadowRoot.querySelector('.list'); if (!el) return;
    if (this._sheet === 'srcpick') {
      const q = norm(this._q); const k = this._sk;
      el.innerHTML = this._cands(k, true).filter((x) => !q || norm(`${x.id} ${x.name}`).includes(q)).slice(0, 60).map((x) => `<div class="row" data-act="srcset" data-k="${k}" data-id="${x.id}"><ha-icon icon="mdi:link-variant"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${esc(x.id)}${x.ok ? ' · passt' : ''}</span></div></div>`).join('') || '<div class="empty">Nichts gefunden.</div>';
      return;
    }
    if (this._sheet === 'dvmain') {
      const tp = DEVTPL[this._dvT]; const q = norm(this._q); if (!tp) return;
      el.innerHTML = this._dvMains(tp).filter((x) => !q || norm(`${x.id} ${x.name}`).includes(q)).slice(0, 60).map((x) => `<div class="row" data-act="dvnew" data-id="${esc(x.id)}"><ha-icon icon="${tp.icon}"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${esc(x.id)}</span></div></div>`).join('') || '<div class="empty">Keine passende Entität gefunden.</div>';
      return;
    }
    if (this._sheet === 'dvpick') {
      const iv = this._set.devices.find((x) => x.id === this._dvId); const tp = iv && DEVTPL[iv.type]; const k = this._dvK; if (!tp || !tp.fields[k]) return;
      const q = norm(this._q); const sp = tp.fields[k]; const P = this._dvPool(iv); const near = new Set(P.A.concat(P.B));
      const l = Object.values(this._hass.states).filter((x) => [].concat(sp.dom).includes(dom(x.entity_id)) && (!q || norm(`${x.entity_id} ${x.attributes.friendly_name || ''}`).includes(q)));
      l.sort((a, b) => (near.has(b.entity_id) ? 1 : 0) - (near.has(a.entity_id) ? 1 : 0));
      el.innerHTML = l.slice(0, 60).map((x) => `<div class="row" data-act="dvset" data-k="${k}" data-id="${esc(x.entity_id)}"><ha-icon icon="mdi:link-variant"></ha-icon><div class="t"><b>${esc(x.attributes.friendly_name || x.entity_id)}</b><span>${esc(x.entity_id)}${near.has(x.entity_id) ? ' · am selben Gerät' : ''}</span></div></div>`).join('') || '<div class="empty">Nichts gefunden.</div>';
      return;
    }
    if (this._sheet === 'dbpick') {
      const sel = this._set.door[this._dbk] || [];
      el.innerHTML = this._doorCands(this._dbk, norm(this._q)).map((x) => `<div class="row" data-act="dbtog" data-id="${esc(x.id)}"><ha-icon icon="${this._dbk === 'bell' ? 'mdi:bell-ring' : 'mdi:motion-sensor'}"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${esc(x.id)}</span></div><ha-icon icon="${sel.includes(x.id) ? 'mdi:check-circle' : 'mdi:circle-outline'}"></ha-icon></div>`).join('') || '<div class="empty">Nichts gefunden. Suche nach einem Namen.</div>';
      return;
    }
    if (this._sheet === 'quick') {
      const q = norm(this._q); const sel = this._set.quick;
      const all = [{ id: '__alloff', name: 'Alle Lichter ausschalten', ic: 'mdi:lightbulb-group-off', sub: 'Eingebaute Aktion' }]
        .concat(Object.values(this._hass.states).filter((s) => ['scene', 'script', 'button', 'input_button'].includes(dom(s.entity_id))).map((s) => ({ id: s.entity_id, name: s.attributes.friendly_name || s.entity_id, ic: this._icon(s), sub: s.entity_id })))
        .filter((x) => !q || norm(`${x.id} ${x.name}`).includes(q)).slice(0, 80);
      el.innerHTML = all.map((x) => `<div class="row" data-act="qtog" data-id="${esc(x.id)}"><ha-icon icon="${x.ic}"></ha-icon><div class="t"><b>${esc(x.name)}</b><span>${esc(x.sub)}</span></div><ha-icon icon="${sel.includes(x.id) ? 'mdi:check-circle' : 'mdi:circle-outline'}"></ha-icon></div>`).join('') || '<div class="empty">Nichts gefunden.</div>';
      return;
    }
    const q = this._q.toLowerCase(); const f = FLT[this._flt];
    const pinned = this._set.pinned.map((p) => p.entity);
    const res = Object.values(this._hass.states).filter((s) => {
      const d = dom(s.entity_id); if (f ? !f.includes(d) : !ROOM_DOMAINS.concat(['script', 'input_boolean']).includes(d)) return false;
      const r = this._hass.entities && this._hass.entities[s.entity_id]; if (r && (r.hidden || r.entity_category)) return false;
      return !q || s.entity_id.toLowerCase().includes(q) || (s.attributes.friendly_name || '').toLowerCase().includes(q);
    }).slice(0, 40);
    el.innerHTML = res.map((s) => `<div class="row" data-act="pick" data-id="${s.entity_id}"><ha-icon icon="${this._icon(s)}"></ha-icon><div class="t"><b>${esc(s.attributes.friendly_name || s.entity_id)}</b><span>${esc(s.entity_id)}${pinned.includes(s.entity_id) ? ' · angepinnt' : ''}</span></div></div>`).join('') || '<div class="empty">Nichts gefunden.</div>';
  }

  /* ---------- Gerätekarten: Vorlagen mit automatischer Zuordnung ---------- */
  _dvAll() { return this._set.devices.filter((x) => DEVTPL[x.type]); }
  _dvMains(tp) {
    const sp = tp.main; const reg0 = this._hass.entities || {};
    const usePl = sp.platform && Object.values(reg0).some((r) => r && r.platform === sp.platform);
    const out = Object.values(this._hass.states).filter((x) => {
      const id = x.entity_id; const a = x.attributes;
      if (![].concat(sp.dom).includes(dom(id))) return false;
      if (usePl && !(reg0[id] && reg0[id].platform === sp.platform)) return false;
      if (sp.dc && a.device_class !== sp.dc) return false;
      if (sp.unit && !sp.unit.includes(a.unit_of_measurement)) return false;
      const r = this._hass.entities && this._hass.entities[id]; return !(r && r.hidden);
    }).map((x) => ({ id: x.entity_id, name: x.attributes.friendly_name || x.entity_id, hit: sp.prefer ? sp.prefer.test(norm(`${x.entity_id} ${x.attributes.friendly_name || ''}`)) : false }));
    return out.sort((a, b) => (b.hit ? 1 : 0) - (a.hit ? 1 : 0));
  }
  _dvPool(iv) {
    const h = this._hass; const reg = h.entities || {}; const ids = Object.keys(h.states);
    const k = `${iv.main}|${ids.length}`; const cache = this._dvP || (this._dvP = {});
    if (cache[iv.id] && cache[iv.id].k === k) return cache[iv.id];
    const r = reg[iv.main]; const dv = r && r.device_id; const stem = iv.main.split('.')[1];
    const P = { k, A: [], B: [], C: [] };
    for (const id of ids) {
      if (id === iv.main) continue;
      const e = reg[id]; if (e && e.hidden) continue;
      if (dv && e && e.device_id === dv) P.A.push(id);
      else if (id.split('.')[1].startsWith(`${stem}_`)) P.B.push(id);
      else P.C.push(id);
    }
    return (cache[iv.id] = P);
  }
  _dvMatch(id, sp) {
    const st = this._hass.states[id]; if (!st) return false;
    if (sp.dom && ![].concat(sp.dom).includes(dom(id))) return false;
    const a = st.attributes;
    if (sp.dc && a.device_class !== sp.dc) return false;
    if (sp.unit && !sp.unit.includes(a.unit_of_measurement)) return false;
    const t = norm(`${id} ${a.friendly_name || ''}`);
    if (sp.re && !sp.re.test(t)) return false;
    if (sp.not && sp.not.test(t)) return false;
    return true;
  }
  _dvFind(iv, sp) {
    const P = this._dvPool(iv); let first = null;
    for (const g of ['A', 'B', 'C']) {
      for (const id of P[g]) {
        if (g === 'C' && !(sp.wide && sp.wide.test(norm(id)))) continue;
        if (!this._dvMatch(id, sp)) continue;
        if (!['unavailable', 'unknown'].includes(this._hass.states[id].state)) return id;
        if (!first) first = id;
      }
      if (first) return first;
    }
    return null;
  }
  _dvMap(iv) {
    const tp = DEVTPL[iv.type]; const P = this._dvPool(iv); const ck = `${P.k}|${JSON.stringify(iv.map)}`;
    const cache = this._dvR || (this._dvR = {});
    if (cache[iv.id] && cache[iv.id].k === ck) return cache[iv.id].v;
    const v = {};
    for (const k in tp.fields) { const m = iv.map[k]; v[k] = m === '-' ? null : m || this._dvFind(iv, tp.fields[k]); }
    cache[iv.id] = { k: ck, v };
    return v;
  }
  _dvS(id) { const st = id && this._hass.states[id]; return st && !['unavailable', 'unknown', ''].includes(st.state) ? st : null; }
  _dvVal(st, d) {
    const v = parseFloat(st.state); const u = st.attributes.unit_of_measurement || '';
    return isNaN(v) ? esc(this._state(st)) : `${this._de(v, d === undefined ? (Math.abs(v) < 10 ? 1 : 0) : d)}${u ? ` ${esc(u)}` : ''}`;
  }
  _dvPow(st) { const v = parseFloat(st && st.state); if (isNaN(v)) return null; return st.attributes.unit_of_measurement === 'kW' ? v * 1000 : v; }

  /* ---------- Pool: Smart Pool Assistant + LayzSpa ---------- */
  _P() { return this._pl || (this._pl = { open: {}, wx: {}, wxBusy: {}, eta: {}, etaBusy: {}, fetching: false, fetchErr: null, opt: {}, optAt: 0 }); }
  _plCfg() { return (this._cfg && this._cfg.pool) || {}; }
  _plFocus() { const r = this.shadowRoot; const a = r && r.activeElement; return !!(a && a.dataset && a.dataset.pk); }
  _plRefresh() {
    if (this._edit || this._dg || this._sheet || this._plFocus()) return;
    clearTimeout(this._plr); this._plr = setTimeout(() => { this._sig = ''; this._render(); }, 250);
  }
  _plSig() {
    const h = this._hass;
    return ['pool_rec', 'pool_winter', 'pool_fetch', 'pool_pump', 'pool_heat', 'pool_temp', 'lz_conn', 'lz_ip', 'lz_rssi', 'lz_bubbles', 'lz_temp', 'lz_target', 'lz_ctl', 'lz_error']
      .map((k) => { const id = this._slot(k); const s = id && h.states[id]; return s ? `${id}${s.state}${s.last_updated || ''}` : ''; }).join(',');
  }
  _plOpt(k, v) { const P = this._P(); return P.opt[k] !== undefined && Date.now() - P.optAt < 8000 ? P.opt[k] : v; }
  _plNum(v) { return v === null || v === undefined || v === '' || typeof v === 'boolean' ? NaN : Number(v); }
  _plKnown(v) { return v !== undefined && v !== null && v !== '' && v !== 'unknown' && v !== 'unavailable'; }
  _plN(v, d = 2, sign) {
    const n = this._plNum(v); if (!Number.isFinite(n)) return '--';
    return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: sign ? 'exceptZero' : 'auto' });
  }
  _plDose(v, unit) {
    const n = this._plNum(v); if (!Number.isFinite(n)) return `-- ${unit}`;
    return `${n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} ${unit}`;
  }
  _plTime(raw) {
    if (!raw) return '--'; const d = new Date(raw); if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  _plSpoons(value, unit) {
    let rest = Math.round(this._plNum(value) * 2); if (!Number.isFinite(rest) || rest <= 0) return '';
    const parts = [];
    for (const sp of [15, 7.5, 5, 2.5, 1]) { const st = Math.round(sp * 2); while (rest >= st) { parts.push(this._plDose(sp, unit)); rest -= st; } }
    return rest !== 0 || !parts.length ? '' : parts.join(' + ');
  }
  _plRange(a, lo, hi, leg) {
    let l = this._plNum(a[lo]); let u = this._plNum(a[hi]); const g = this._plNum(a[leg]);
    if (!Number.isFinite(l)) l = g; if (!Number.isFinite(u)) u = g;
    if (!Number.isFinite(l) || !Number.isFinite(u)) return null;
    return l <= u ? { low: l, high: u } : { low: u, high: l };
  }
  _plRangeTxt(r, suf = '') {
    if (!r) return '--'; const f = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return r.low === r.high ? `${f(r.low)}${suf}` : `${f(r.low)}-${f(r.high)}${suf}`;
  }
  _plCls(value, r, tol) {
    const n = this._plNum(value); if (!Number.isFinite(n) || !r) return '';
    if (n >= r.low && n <= r.high) return 'ok';
    return (n < r.low ? r.low - n : n - r.high) <= tol ? 'wn' : 'bd';
  }
  _plCya(value, type) {
    const n = this._plNum(value); const inorg = type === 'inorganic'; const T = '30-50 ppm';
    if (!Number.isFinite(n)) return { label: '--', target: T, cls: '', action: inorg ? 'Noch kein CYA-Messwert vorhanden. Bei anorganischem Chlor nur separat relevant.' : 'Noch kein CYA-Messwert vorhanden.' };
    if (n < 20) return { label: 'Zu niedrig', target: T, cls: 'wn', action: inorg ? 'Bei Bedarf separat Stabilisator dosieren, sonst bleibt Chlor unstabilisiert.' : 'Chlor wird zu schnell abgebaut, Cyanursäure erhöhen.' };
    if (n < 30) return { label: 'Leicht niedrig', target: T, cls: 'wn', action: 'Noch leicht erhöhen, damit der Zielbereich stabil erreicht wird.' };
    if (n <= 50) return { label: 'Optimal', target: T, cls: 'ok', action: inorg ? 'Guter Stabilisatorbereich. Mit anorganischem Chlor nicht unnötig weiter erhöhen.' : 'Perfekter Bereich, regelmäßig kontrollieren.' };
    if (n <= 80) return { label: 'Erhöht', target: T, cls: 'wn', action: inorg ? 'Erhöht. Kein zusätzlicher Stabilisator nötig, Wasserwechsel einplanen.' : 'Noch akzeptabel, organisches Chlor sparsam nutzen und Wasserwechsel einplanen.' };
    if (n <= 100) return { label: 'Zu hoch', target: T, cls: 'bd', action: inorg ? 'Teilwasserwechsel durchführen.' : 'Teilwasserwechsel durchführen und organisches Chlor vermeiden.' };
    return { label: 'Kritisch', target: T, cls: 'bd', action: inorg ? 'Sehr hoher Wert. Großer Wasserwechsel erforderlich.' : 'Sehr hoher Wert. Wasserwechsel erforderlich und organisches Chlor sofort stoppen.' };
  }
  _plBath(a) {
    const issues = []; const warns = []; const n = (v) => this._plNum(v);
    const chlor = n(a.chlor_ist); const ph = n(a.ph_ist); const temp = n(a.temp_ist); const uv = n(a.weather_uv_today);
    const rp = n(a.weather_rain_probability_today); const ra = n(a.weather_rain_amount_today); const wind = n(a.weather_wind_speed_today); const cond = a.weather_condition_today;
    const cr = this._plRange(a, 'chlor_min', 'chlor_max', 'chlor_target'); const pr = this._plRange(a, 'ph_min', 'ph_max', 'ph_target');
    if (a.awaiting_retest || a.awaiting_retest_chlor || a.awaiting_retest_ph) issues.push('Nachmessung abwarten');
    if (a.data_source === 'Speicher' || !Number.isFinite(chlor) || !Number.isFinite(ph)) issues.push('aktuelle Chlor-/pH-Messung fehlt');
    if (Number.isFinite(chlor) && cr) {
      const lo = cr.low - chlor; const hi = chlor - cr.high;
      if (chlor <= 0.3) issues.push('Chlor sehr niedrig');
      else if (a.is_shock === true) issues.push('Chlor im Schockchlorungsbereich');
      else if (chlor > 5 || hi > 0.9) issues.push('Chlor zu hoch');
      else if (lo > 0.3) warns.push('Chlor niedrig');
      else if (hi > 0.3) warns.push('Chlor erhöht');
    }
    if (Number.isFinite(ph) && pr) {
      const d = ph < pr.low ? pr.low - ph : ph > pr.high ? ph - pr.high : 0;
      if (ph < 6.8 || ph > 7.8 || d > 0.4) issues.push('pH deutlich außerhalb'); else if (d > 0.15) warns.push('pH nicht ideal');
    }
    if (Number.isFinite(temp)) { if (temp >= 41) issues.push('Temperatur sehr hoch'); else if (temp > 36) warns.push('warmes Wasser'); }
    if (['lightning', 'lightning-rainy', 'lightning_rainy', 'exceptional'].includes(cond)) issues.push('Wetter unsicher'); else if (['pouring', 'rainy'].includes(cond)) warns.push('Regen erwartet');
    if (Number.isFinite(wind)) { if (wind >= 50) issues.push('starker Wind'); else if (wind >= 30) warns.push('windig'); }
    if (Number.isFinite(rp) && rp >= 60) warns.push('Regenrisiko');
    if (Number.isFinite(ra) && ra >= 5) warns.push('Regenmenge');
    if (Number.isFinite(uv) && uv >= 8 && !this._plOpt('covered', a.pool_covered)) warns.push('hohe UV-Belastung');
    if (issues.length) return { cls: 'bd', title: 'Nicht empfohlen', detail: issues.slice(0, 2).join(', ') };
    if (warns.length) return { cls: 'wn', title: 'Baden möglich', detail: warns.slice(0, 2).join(', ') };
    return { cls: 'ok', title: 'Viel Spaß beim Baden', detail: 'Werte im grünen Bereich' };
  }
  _plStatus(rec) {
    let t = rec.state || '✅ Alle Werte im Zielbereich'; let cls = 'ok';
    if (t === 'unavailable' || t === 'unknown') t = '⚠️ Warte auf Daten...';
    if (t.includes('⏳')) cls = 'bl';
    else if (t.includes('⚠️') || t.includes('hoch') || t.includes('niedrig')) cls = t.includes('hoch') || t.includes('Schock') ? 'bd' : 'wn';
    return { t, cls };
  }
  _plRetest(a) {
    if (!a || a.awaiting_retest !== true) return '';
    const l = [];
    if (a.awaiting_retest_chlor === true) { const s = this._plTime(a.chlor_retest_window_start); const e = this._plTime(a.chlor_retest_window_end); if (s !== '--' && e !== '--') l.push(`Chlor: ${s} - ${e} Uhr`); }
    if (a.awaiting_retest_ph === true && a.awaiting_retest_since) { const f = this._plTime(a.awaiting_retest_since); if (f !== '--') l.push(`pH: ab ${f} Uhr`); }
    return l.join(' | ');
  }
  _plPlan(a) {
    const P = this._P(); const opt = P.opt.bath !== undefined && Date.now() - P.optAt < 8000;
    const hrs = this._plNum(opt ? P.opt.bath : a.bath_plan_hours); const on = Number.isFinite(hrs) && hrs > 0 && (opt || a.bath_plan_active === true);
    return { on, hrs };
  }
  _plHrs(v, d = 1) { return Number(v).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: d }); }
  _plDur(hv) {
    if (!Number.isFinite(hv) || hv < 0) return 'Nicht genügend Daten'; if (hv <= 0.2) return 'jetzt';
    return hmMin(Math.max(1, Math.round(hv * 60)));
  }
  _plStars(v) {
    if (!this._plKnown(v)) return 'Noch keine Bewertung';
    if (typeof v === 'string' && /^[*-]{5}$/.test(v)) return v.replaceAll('*', '★').replaceAll('-', '☆');
    const q = this._plNum(v); if (!Number.isFinite(q) || q <= 0) return 'Noch keine Bewertung';
    const r = Math.max(0, Math.min(5, Math.round(q))); return '★'.repeat(r) + '☆'.repeat(5 - r);
  }
  _plLN(v, suf = '', d = 2, sign) { return this._plKnown(v) && Number.isFinite(this._plNum(v)) ? `${this._plN(v, d, sign)}${suf}` : 'Nicht genügend Daten'; }
  _plLStatus(s) { return { learning: 'Lernphase', stable: 'Stabil', variable: 'Schwankend', unstable: 'Instabil' }[s] || 'Nicht genügend Daten'; }
  _plSamples(v) { const n = this._plNum(v); return Number.isFinite(n) && n > 0 ? n : 0; }
  _plSum(kind, d) { const n = this._plSamples(d.samples); return n < 3 ? `${kind}: Lernphase ${n}/3` : `${kind}: ${this._plLStatus(d.status)} ${this._plStars(d.quality)}`; }

  /* --- Bereiche --- */
  _plSec(k, icon, title, sum, body, badge) {
    const o = !!this._P().open[k];
    return `<div class="pool-sec"><div class="pool-sh" data-act="pl-open" data-k="${k}"><ha-icon icon="${icon}"></ha-icon><b>${esc(title)}</b><span class="pool-ss">${sum || ''}</span>${badge || ''}<ha-icon class="pool-ch" icon="${o ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon></div>${o ? `<div class="pool-sb">${typeof body === 'function' ? body() : body}</div>` : ''}</div>`;
  }
  _plStab(a) {
    const ca = a.chlor_stability_attributes || {}; const da = a.chlor_dose_factor_attributes || {}; const fa = a.chlor_forecast_attributes || {}; const pa = a.ph_stability_attributes || {};
    const cs = this._plSamples(ca.samples); const ds = this._plSamples(da.samples); const ps = this._plSamples(pa.samples);
    const cq = ca.context_prediction_quality ?? ca.prediction_quality ?? a.chlor_prediction_quality; const pq = pa.prediction_quality ?? a.ph_prediction_quality;
    const cst = a.chlor_stability || 'learning'; const pst = a.ph_stability || 'learning'; const trend = pa.trend || a.ph_trend;
    const conf = { high: 'hoch', medium: 'mittel', low: 'niedrig', learning: 'Lernphase', unknown: 'unbekannt' };
    const basis = { similar_intervals: 'ähnliche Intervalle', '14d_average': '14-Tage-Mittel', learning: 'Lernphase', no_measurement: 'keine Messung', insufficient: 'zu wenig Daten' };
    const trendL = { learning: 'Lernphase', stable: 'stabil', rising: 'steigt', falling: 'fällt' }[trend] || 'Nicht genügend Daten';
    const kv = (l, v) => `<div class="pool-kv"><span>${l}</span><b>${esc(v)}</b></div>`;
    const sum = `${this._plSum('Chlor', { samples: cs, status: cst, quality: cq })} · ${this._plSum('pH', { samples: ps, status: pst, quality: pq })}`;
    return this._plSec('stab', 'mdi:chart-bell-curve', 'Stabilität', esc(sum), () => `<div class="pool-2c">
      <div class="pool-card2"><h5><span>Chlor</span><span>${this._plStars(cq)}</span></h5><div class="pool-sp">${cs < 3 ? `Lernphase: ${cs} von 3 Intervallen` : this._plLStatus(cst)}</div>
        ${kv('Ø 14 Tage', this._plLN(ca.average_daily_loss ?? a.chlor_consumption_14d, ' mg/l/d'))}${kv('24h', this._plLN(a.chlor_consumption_24h, ' mg/l/d'))}${kv('7 Tage', this._plLN(a.chlor_consumption_7d, ' mg/l/d'))}
        ${kv('Min / Max', `${this._plLN(ca.min_daily_loss, ' mg/l/d')} / ${this._plLN(ca.max_daily_loss, ' mg/l/d')}`)}${kv('Persönlicher Faktor', this._plLN(ca.personal_chlor_factor ?? a.personal_chlor_factor))}
        ${kv('Dosierfaktor', this._plLN(a.personal_chlor_dose_factor))}${kv('Effektiver Wirkstoff', this._plLN(a.effective_chlor_content, '', 3))}${kv('Dosierqualität', `${this._plStars(a.chlor_dose_prediction_quality)} · ${ds} Samples`)}
        ${kv('Prognose', a.chlor_forecast_message || 'Keine Prognose verfügbar')}${kv('Bis Minimum', this._plDur(this._plNum(a.chlor_hours_to_min)))}${kv('Bis 0,6 mg/l', this._plDur(this._plNum(a.chlor_hours_to_critical_low)))}
        ${kv('Konfidenz', conf[a.chlor_forecast_confidence] || 'unbekannt')}${kv('Basis', basis[a.chlor_forecast_basis] || fa.basis || 'unbekannt')}</div>
      <div class="pool-card2"><h5><span>pH</span><span>${this._plStars(pq)}</span></h5><div class="pool-sp">${ps < 3 ? `Lernphase: ${ps} von 3 Intervallen` : this._plLStatus(pst)}</div>
        ${kv('Ø 14 Tage', this._plLN(pa.average_daily_drift ?? a.ph_drift_14d, ' pH/d', 3, true))}${kv('24h', this._plLN(a.ph_drift_24h, ' pH/d', 3, true))}${kv('7 Tage', this._plLN(a.ph_drift_7d, ' pH/d', 3, true))}
        ${kv('Min / Max', `${this._plLN(pa.min_daily_drift, ' pH/d', 3, true)} / ${this._plLN(pa.max_daily_drift, ' pH/d', 3, true)}`)}${kv('Trend', trendL)}</div></div>`);
  }

  /* --- Wetter --- */
  _plWxId(a) {
    const h = this._hass; const c = this._plCfg().weather_entity;
    if (c && h.states[c]) return c; if (a.weather_entity && h.states[a.weather_entity]) return a.weather_entity; return null;
  }
  _plWxLabel(c) { return { clear: 'Klar', 'clear-night': 'Klar', clear_night: 'Klar', cloudy: 'Bewölkt', exceptional: 'Extrem', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitterregen', lightning_rainy: 'Gewitterregen', partlycloudy: 'Sonne/Wolken', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', snowy_rainy: 'Schneeregen', sunny: 'Sonnig', windy: 'Windig', 'windy-variant': 'Windig', windy_variant: 'Windig' }[c] || c || '--'; }
  _plWxIcon(c) { const k = String(c || '').replace(/_/g, '-'); return WX[k] || { clear: 'mdi:weather-sunny', exceptional: 'mdi:weather-hurricane', 'snowy-rainy': 'mdi:weather-snowy-rainy', 'windy-variant': 'mdi:weather-windy-variant' }[k] || 'mdi:weather-partly-cloudy'; }
  _plWV(v, suf = '') { const n = this._plNum(v); return v === undefined || v === null || v === '' ? '--' : Number.isFinite(n) ? `${n.toFixed(0)}${suf}` : `${v}${suf}`; }
  _plWind(v, unit) {
    const n = this._plNum(v); if (v === undefined || v === null || v === '') return '--'; if (!Number.isFinite(n)) return `${v}`;
    const u = `${unit || ''}`.trim().toLowerCase();
    if (u.includes('km')) return `${n.toFixed(0)} km/h`; if (u.includes('m/s')) return `${n.toFixed(1)} m/s`;
    return n >= 20 ? `${n.toFixed(0)} km/h` : `${n.toFixed(1)} m/s`;
  }
  _plUv(v) { const n = this._plNum(v); return !Number.isFinite(n) ? '' : n >= 8 ? 's-bd' : n >= 6 ? 's-wn' : 's-ok'; }
  _plFcNorm(r, id) {
    if (!r) return []; if (Array.isArray(r)) return r;
    if (Array.isArray(r.forecast)) return r.forecast;
    if (r.response) return this._plFcNorm(r.response, id);
    if (Array.isArray(r.result && r.result.forecast)) return r.result.forecast;
    const e = id ? r[id] : null; return Array.isArray(e && e.forecast) ? e.forecast : [];
  }
  _plFcLoad(id) {
    const P = this._P(); if (!id || P.wxBusy[id]) return;
    const c = P.wx[id]; if (c && !c.fc.length && Date.now() - c.at < 300000) return; if (c && c.fc.length && Date.now() - c.at < 1800000) return;
    P.wxBusy[id] = true;
    const h = this._hass;
    const tries = [
      () => h.callWS({ type: 'call_service', domain: 'weather', service: 'get_forecasts', service_data: { type: 'daily' }, target: { entity_id: id }, return_response: true }),
      () => h.callWS({ type: 'weather/forecast', entity_id: id, forecast_type: 'daily' }),
    ];
    (async () => {
      let fc = [];
      for (const t of tries) { try { fc = this._plFcNorm(await t(), id); if (fc.length) break; } catch (_) { /* nächster Versuch */ } }
      P.wx[id] = { fc, at: Date.now() }; P.wxBusy[id] = false; this._plRefresh();
    })();
  }
  _plWxDays(a, ws, extra) {
    const coord = Array.isArray(a.weather_forecast_days) && a.weather_forecast_days.length ? a.weather_forecast_days : null;
    const fc = coord || (ws && Array.isArray(ws.attributes.forecast) && ws.attributes.forecast.length ? ws.attributes.forecast : extra);
    if (!Array.isArray(fc) || !fc.length) return [];
    return fc.slice(0, 2).map((e, i) => {
      const d = e.datetime ? new Date(e.datetime) : null;
      const lab = d ? d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) : (i === 0 ? 'Heute' : 'Morgen');
      const pp = e.precipitation_probability; const am = e.precipitation_amount ?? e.precipitation ?? e.native_precipitation;
      const pr = pp !== null && pp !== undefined ? { v: pp, u: '%' } : am !== null && am !== undefined ? { v: am, u: ' mm' } : { v: null, u: '' };
      return { label: `${i === 0 ? 'Heute' : 'Morgen'} · ${lab}`, cond: e.condition, pr: pr.v, pu: pr.u,
        uv: i === 0 ? (a.weather_uv_today ?? e.uv_index ?? e.uv ?? null) : (e.uv_index ?? e.uv ?? null), wind: e.wind_speed ?? e.native_wind_speed ?? null,
        wu: e.wind_speed_unit ?? a.weather_wind_speed_unit ?? (ws && ws.attributes.wind_speed_unit) ?? null, t: e.temperature ?? e.native_temperature ?? null, tl: e.templow ?? e.native_templow ?? e.low_temperature ?? null };
    });
  }
  _plWx(a) {
    const id = this._plWxId(a); const ws = id ? this._hass.states[id] : null; const P = this._P();
    const cf = (id && P.wx[id] && P.wx[id].fc) || [];
    if (id && !(Array.isArray(a.weather_forecast_days) && a.weather_forecast_days.length) && !(ws && Array.isArray(ws.attributes.forecast) && ws.attributes.forecast.length) && !cf.length) this._plFcLoad(id);
    let days = this._plWxDays(a, ws, cf);
    if (!days.length) {
      const cond = a.weather_condition_today || (ws && !['unknown', 'unavailable'].includes(ws.state) ? ws.state : null);
      const t = a.weather_temperature_today ?? (ws && ws.attributes.temperature) ?? null; const w = a.weather_wind_speed_today ?? (ws && ws.attributes.wind_speed) ?? null;
      const rp = a.weather_rain_probability_today; const ra = a.weather_rain_amount_today; const pr = rp ?? ra ?? null; const uv = a.weather_uv_today ?? null;
      if (cond !== null || t !== null || w !== null || pr !== null || uv !== null) days = [{ label: 'Heute', cond, pr, pu: rp !== null && rp !== undefined ? '%' : (ra !== null && ra !== undefined ? ' mm' : ''), uv, wind: w, wu: a.weather_wind_speed_unit ?? (ws && ws.attributes.wind_speed_unit) ?? null, t, tl: null }];
    }
    if (!days.length) {
      if (!id) return '';
      return this._plSec('wx', 'mdi:weather-partly-cloudy', 'Wetter', '', `<div class="empty">${P.wxBusy[id] ? 'Lade Tagesvorhersage...' : 'Keine Tagesvorhersage gefunden.'}</div>`);
    }
    const d0 = days[0]; const sp = [];
    if (d0.cond) sp.push(this._plWxLabel(d0.cond)); if (d0.t !== null && d0.t !== undefined) sp.push(this._plWV(d0.t, '°'));
    if (d0.uv !== null && d0.uv !== undefined) sp.push(`UV ${this._plWV(d0.uv)}`); if (d0.pr !== null && d0.pr !== undefined) sp.push(`Regen ${this._plWV(d0.pr, d0.pu || '')}`);
    if (d0.wind !== null && d0.wind !== undefined) sp.push(`Wind ${this._plWind(d0.wind, d0.wu)}`);
    return this._plSec('wx', 'mdi:weather-partly-cloudy', 'Wetter', esc(sp.join(', ') || 'Heute'), () => `<div class="pool-wx">${days.map((d) => `<div class="pool-wc"><div class="d">${esc(d.label)}</div>
      <div class="t"><b>${this._plWV(d.t, '°')} / ${this._plWV(d.tl, '°')}</b><ha-icon icon="${this._plWxIcon(d.cond)}"></ha-icon></div><div class="pool-sp">${esc(this._plWxLabel(d.cond))}</div>
      <div class="m"><span>Sonne/UV</span><b class="${this._plUv(d.uv)}">${this._plWV(d.uv)}</b></div><div class="m"><span>Regen</span><b>${this._plWV(d.pr, d.pu || '')}</b></div><div class="m"><span>Wind</span><b>${this._plWind(d.wind, d.wu)}</b></div></div>`).join('')}</div>
      ${a.weather_note ? `<div class="pool-note">${esc(a.weather_note)}</div>` : ''}`);
  }

  /* --- LayzSpa --- */
  _plLz() {
    const h = this._hass; const g = (k) => { const id = this._xid(k); return id && h.states[id] ? id : null; };
    const L = { conn: g('lz_conn'), ip: g('lz_ip'), rssi: g('lz_rssi'), pump: g('pool_pump'), heat: g('pool_heat'), bub: g('lz_bubbles'), cur: g('lz_temp'), tgt: g('lz_target'), ctl: g('lz_ctl'), err: g('lz_error') };
    L.any = !!(L.conn || L.cur || L.pump || L.heat || L.bub);
    return L;
  }
  _plCtl(L) {
    const h = this._hass; const ok = (id) => id && h.states[id] && ['number', 'climate'].includes(dom(id));
    const id = ok(L.ctl) ? L.ctl : ok(L.tgt) ? L.tgt : null; if (!id) return null;
    const s = h.states[id]; const d = dom(id); const at = s.attributes || {};
    const cur = parseFloat(d === 'climate' ? at.temperature : s.state); if (!Number.isFinite(cur)) return null;
    const step = parseFloat(d === 'climate' ? (at.target_temp_step ?? 1) : (at.step ?? 1));
    return { id, d, cur, step: Number.isFinite(step) && step > 0 ? step : 1, min: parseFloat(d === 'climate' ? at.min_temp : at.min), max: parseFloat(d === 'climate' ? at.max_temp : at.max) };
  }
  _plAdjust(dir) {
    const L = this._plLz(); const i = this._plCtl(L); if (!i) return;
    const p = String(i.step).includes('.') ? String(i.step).split('.')[1].length : 0;
    let v = i.cur + dir * i.step; if (Number.isFinite(i.min)) v = Math.max(i.min, v); if (Number.isFinite(i.max)) v = Math.min(i.max, v);
    v = Number(v.toFixed(p));
    if (i.d === 'climate') this._hass.callService('climate', 'set_temperature', { entity_id: i.id, temperature: v });
    else this._hass.callService('number', 'set_value', { entity_id: i.id, value: v });
  }
  _plRssi(v) {
    const n = parseInt(v, 10); if (Number.isNaN(n)) return { l: '?', c: 's-bd' };
    return { l: `${n} dBm`, c: n >= -65 ? 's-ok' : n >= -75 ? 's-wn' : 's-bd' };
  }
  _plLzErr(v) {
    const c = Number(v); if (!Number.isInteger(c) || c === 0) return null;
    if (c === 2) return { t: 'Fehlercode E02 – Wasserdurchfluss gestört', m: 'Die Pumpe erkennt zu wenig Wasserdurchfluss.', s: 'Filter reinigen oder tauschen. Ein- und Auslässe im Whirlpool auf Verstopfungen durch Schmutz oder Blätter prüfen und diese entfernen.' };
    if (c === 4 || c === 8) return { t: `Fehlercode ${c === 4 ? 'E04' : 'E08'} – Temperatur zu hoch`, m: 'Das Wasser ist über 50 °C heiß oder die Pumpe stand zu lange in der prallen Sonne (Außentemperatur über 40 °C).', s: 'Wasser abkühlen lassen, Pumpe in den Schatten stellen und das System über die Reset-Taste neu starten.' };
    return { t: `Unbekannter LayzSpa-Fehlercode (${c})`, m: 'Für diesen Fehlercode ist keine Anleitung hinterlegt.', s: 'Fehlercode in der LayzSpa-Anleitung nachschlagen.' };
  }
  _plEtaCfg() {
    const c = this._plCfg().heat_eta || (this._plCfg().layzspa && this._plCfg().layzspa.heat_eta) || {}; const cl = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    return { on: c.enabled !== false, hours: cl(parseFloat(c.history_hours), 6, 168, 48), fb: cl(parseFloat(c.fallback_rate_c_per_hour), 0.1, 10, 3) };
  }
  _plLzDur(hv) {
    if (!Number.isFinite(hv) || hv < 0) return '--'; return hmMin(Math.max(1, Math.ceil(hv * 60)));
  }
  _plEta(L, cur, tgt, heatOn) {
    const c = this._plEtaCfg(); if (!c.on || !L.cur || !L.heat) return null;
    if (!Number.isFinite(cur) || !Number.isFinite(tgt)) return { v: '--', d: 'Temperaturdaten fehlen', c: '' };
    const dl = tgt - cur; if (dl <= 0) return { v: 'Erreicht', d: 'Zieltemperatur erreicht', c: 's-ok' };
    const key = `${L.cur}|${L.heat}|${c.hours}`; const ch = this._P().eta[key]; const rate = ch && ch.rate; const learned = Number.isFinite(rate) && rate > 0;
    const eff = learned ? rate : c.fb; const dur = this._plLzDur(dl / eff);
    const src = learned ? `${rate.toFixed(1).replace('.', ',')} °C/h aus ${ch.hours}h Verlauf` : `${c.fb.toFixed(1).replace('.', ',')} °C/h Fallback`;
    this._plEtaLoad(L, c, key);
    return { v: `ca. ${dur}`, d: heatOn ? src : `Heizung aus · ${src}`, c: heatOn ? (learned ? 's-ok' : 's-wn') : '' };
  }
  _plEtaLoad(L, c, key) {
    const P = this._P(); if (P.etaBusy[key]) return; const ch = P.eta[key]; if (ch && Date.now() - ch.at < 600000) return;
    P.etaBusy[key] = true; const end = new Date(); const start = new Date(end.getTime() - c.hours * 3600000);
    this._hass.callWS({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(), entity_ids: [L.cur, L.heat], minimal_response: false, no_attributes: true })
      .then((hist) => { P.eta[key] = { ...this._plRate(hist, L.cur, L.heat), hours: c.hours, at: Date.now() }; })
      .catch(() => { P.eta[key] = { rate: null, hours: c.hours, at: Date.now() }; })
      .finally(() => { delete P.etaBusy[key]; this._plRefresh(); });
  }
  _plRate(hist, tid, hid) {
    const ser = Array.isArray(hist) ? hist : []; const ts = ser.find((x) => x && x[0] && x[0].entity_id === tid) || []; const hs = ser.find((x) => x && x[0] && x[0].entity_id === hid) || [];
    const tp = ts.map((e) => ({ ts: Date.parse(e.last_changed || e.last_updated), v: parseFloat(e.state) })).filter((e) => Number.isFinite(e.ts) && Number.isFinite(e.v)).sort((x, y) => x.ts - y.ts);
    const hp = hs.map((e) => ({ ts: Date.parse(e.last_changed || e.last_updated), s: e.state })).filter((e) => Number.isFinite(e.ts)).sort((x, y) => x.ts - y.ts);
    if (tp.length < 2 || hp.length < 1) return { rate: null };
    let hi = 0; let gain = 0; let hrs = 0;
    const at = (t) => { if (!hp[hi] || hp[hi].ts > t) return null; while (hi + 1 < hp.length && hp[hi + 1].ts <= t) hi++; return hp[hi].s; };
    for (let i = 1; i < tp.length; i++) {
      const p = tp[i - 1]; const c = tp[i]; const dh = (c.ts - p.ts) / 3600000; const dt = c.v - p.v;
      if (dh < 0.03 || dh > 4 || dt <= 0.02 || dt / dh > 8) continue;
      if (at(p.ts) !== 'on' && at(c.ts) !== 'on') continue;
      gain += dt; hrs += dh;
    }
    return hrs < 0.33 || gain < 0.2 ? { rate: null } : { rate: gain / hrs };
  }
  _plLzSec(L) {
    const h = this._hass; const st = (id) => (id ? h.states[id] : null); const ok = L.conn ? st(L.conn).state === 'on' : true;
    const cur = parseFloat(st(L.cur) && st(L.cur).state); const ctl = this._plCtl(L); const tgt = ctl ? ctl.cur : parseFloat(st(L.tgt) && st(L.tgt).state);
    const eta = this._plEta(L, cur, tgt, st(L.heat) && st(L.heat).state === 'on'); const rs = this._plRssi(st(L.rssi) && st(L.rssi).state);
    const tf = (v) => (Number.isFinite(v) ? `${v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C` : '--');
    const btn = (id, k, ic, lab) => (id ? `<button class="pool-cb ${st(id).state === 'on' ? 'on' : ''}" data-act="pl-sw" data-id="${id}" ${ok ? '' : 'disabled'}><ha-icon icon="${ic}"></ha-icon>${lab}</button>` : '');
    const title = L.conn || L.cur ? 'LayzSpa' : 'Pumpe & Heizung';
    const badge = L.conn ? `<span class="pool-lz ${ok ? 'on' : ''}"><i></i>${ok ? 'Verbunden' : 'Getrennt'}</span>` : '';
    const sum = Number.isFinite(cur) ? `${tf(cur)}${Number.isFinite(tgt) ? ` → ${tf(tgt)}` : ''}` : '';
    return this._plSec('lz', 'mdi:hot-tub', title, esc(sum), () => `${L.ip || L.rssi ? `<div class="pool-chips">${L.ip ? `<div class="pool-chip"><small>IP-Adresse</small><b>${esc(st(L.ip).state)}</b></div>` : ''}${L.rssi ? `<div class="pool-chip"><small>WLAN-Signal</small><b class="${rs.c}">${rs.l}</b></div>` : ''}</div>` : ''}
      <div class="pool-ctrl">${btn(L.pump, 'pump', 'mdi:pump', 'Pumpe')}${btn(L.heat, 'heat', 'mdi:fire', 'Heizung')}${btn(L.bub, 'bub', 'mdi:chart-bubble', 'Blubber')}</div>
      ${Number.isFinite(cur) || Number.isFinite(tgt) ? `<div class="pool-tmp"><div><small>Aktuell</small><b>${tf(cur)}</b></div><ha-icon icon="mdi:arrow-right-thin"></ha-icon><div><small>Ziel</small><b class="s-bl">${tf(tgt)}</b></div></div>` : ''}
      ${eta ? `<div class="pool-eta"><small>Auf Wunschtemperatur</small><b class="${eta.c}">${eta.v}</b><i>${esc(eta.d)}</i></div>` : ''}
      ${ctl ? `<div class="pool-adj"><button data-act="pl-adj" data-d="-1" ${ok ? '' : 'disabled'}>−</button><span>Zieltemperatur anpassen</span><button data-act="pl-adj" data-d="1" ${ok ? '' : 'disabled'}>+</button></div>` : ''}`, badge);
  }

  /* --- Hauptkarte --- */
  _plFetchUi(a) {
    const P = this._P(); const id = this._xid('pool_fetch'); const btn = id && this._hass.states[id] ? id : null;
    const next = a.next_poollab_fetch_allowed_at ? Date.parse(a.next_poollab_fetch_allowed_at) : NaN; const left = Number.isFinite(next) ? Math.max(0, Math.ceil((next - Date.now()) / 1000)) : 0;
    const last = a.last_poollab_fetch_completed_at ? new Date(a.last_poollab_fetch_completed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
    if (!btn) return null;
    if (P.fetching || a.poollab_fetch_result === 'running') return { dis: true, lab: 'Abruf läuft...', st: 'PoolLab wird gerade abgefragt.', meta: 'läuft', cls: 'bl' };
    if (P.fetchErr) return { dis: false, lab: 'Erneut abrufen', st: P.fetchErr, meta: 'Fehler', cls: 'bd' };
    if (left > 0) { clearTimeout(this._pft); this._pft = setTimeout(() => this._plRefresh(), left * 1000 + 500); return { dis: true, lab: 'Warten', st: `Nächster Abruf ab ${new Date(next).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr möglich.`, meta: 'wartet', cls: 'bl' }; }
    if (a.poollab_fetch_result === 'error' && a.poollab_fetch_error) return { dis: false, lab: 'Erneut abrufen', st: a.poollab_fetch_error, meta: 'Fehler', cls: 'bd' };
    return { dis: false, lab: 'Messwerte abrufen', st: last ? `Zuletzt erfolgreich um ${last} Uhr.` : 'Bereit für einen manuellen PoolLab-Abruf.', meta: 'bereit', cls: 'ok' };
  }
  async _plFetch() {
    const P = this._P(); const id = this._xid('pool_fetch'); if (!id || P.fetching) return;
    P.fetchErr = null; P.fetching = true; this._sig = ''; this._render();
    try { await this._hass.callService('button', 'press', { entity_id: id }); } catch (e) { P.fetchErr = `Abruf fehlgeschlagen: ${(e && e.message) || e}`; }
    P.fetching = false; this._sig = ''; this._render();
  }
  _plLog(type, amount, extra) {
    const id = this._xid('pool_rec'); if (!id) return; const P = this._P();
    const d = { entity_id: id, type, amount };
    if (extra) Object.entries(extra).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') d[k] = v; });
    if (type === 'set_covered') P.opt.covered = amount > 0;
    if (type === 'set_usage') P.opt.usage = ({ 0: 'none', 1: 'normal', 2: 'party' })[amount] || 'none';
    if (type === 'set_bath_plan') P.opt.bath = amount;
    if (['set_covered', 'set_usage', 'set_bath_plan'].includes(type)) P.optAt = Date.now();
    this._hass.callService('smart_pool_assistant', 'log_maintenance', d);
  }
  _plGo(k) {
    const f = (n) => { const i = this.shadowRoot.querySelector(`[data-pk="${n}"]`); return i ? parseFloat(String(i.value).replace(',', '.')) : NaN; };
    const clr = (...ns) => ns.forEach((n) => { const i = this.shadowRoot.querySelector(`[data-pk="${n}"]`); if (i) i.value = ''; });
    if (k === 'chlor') { const v = f('chlor'); if (!(v >= 0)) return false; this._plLog('chlor', v); clr('chlor'); return false; }
    if (k === 'ph') {
      const p = f('ph_plus'); const m = f('ph_minus');
      if (p > 0) this._plLog('ph_plus', p); else if (m > 0) this._plLog('ph_minus', m); else return false;
      clr('ph_plus', 'ph_minus'); return false;
    }
    if (k === 'wex') {
      const l = f('wex_l'); const p = f('wex_p'); if (!Number.isFinite(l) && !Number.isFinite(p)) return false;
      this._plLog('water_exchange', Number.isFinite(l) ? l : 0, { water_exchange_percent: Number.isFinite(p) ? p : null }); clr('wex_l', 'wex_p'); return false;
    }
    if (k === 'bath') { const v = f('bath'); if (!(v >= 0)) return false; this._plLog('set_bath_plan', v); clr('bath'); return true; }
    return false;
  }
  _poolClick(t, act) {
    const k = t.dataset.k; const P = this._P(); const h = this._hass;
    switch (act) {
      case 'pl-open': P.open[k] = !P.open[k]; return true;
      case 'pl-go': return this._plGo(k);
      case 'pl-fetch': this._plFetch(); return false;
      case 'pl-sw': { const id = t.dataset.id; if (id && h.states[id]) h.callService(dom(id), h.states[id].state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id }); return false; }
      case 'pl-adj': this._plAdjust(Number(t.dataset.d)); return false;
      case 'pl-cover': { const a = this._plAttr(); this._plLog('set_covered', this._plOpt('covered', a.pool_covered) ? 0 : 1); return true; }
      case 'pl-usage': this._plLog('set_usage', Number(k)); return true;
      case 'pl-bathclear': this._plLog('set_bath_plan', 0); return true;
      case 'pl-filter': this._plLog(k === 'clean' ? 'filter_clean' : 'filter_replace', 0); return false;
      case 'pl-full': this._set.size.pool = 'f'; this._save(); return true;
      case 'pl-info': this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: t.dataset.id }, bubbles: true, composed: true })); return false;
      default: return false;
    }
  }
  _plAttr() { const id = this._xid('pool_rec'); const s = id && this._hass.states[id]; return (s && s.attributes) || {}; }
  _plRows(a) {
    const fromStore = a.data_source === 'Speicher'; const awC = a.awaiting_retest_chlor === true; const awP = a.awaiting_retest_ph === true;
    const n = (v) => this._plNum(v); const dose = n(a.chlor_dose); const pre = n(a.chlor_pre);
    const hasChlor = this._plKnown(a.chlor_ist) && !fromStore; const cr = this._plRange(a, 'chlor_min', 'chlor_max', 'chlor_target');
    const hi = hasChlor && cr ? n(a.chlor_ist) - cr.high : 0; const lo = hasChlor && cr ? cr.low - n(a.chlor_ist) : 0;
    const { on: plan, hrs: bh } = this._plPlan(a);
    const bTime = this._plTime(a.bath_plan_until); const sp = (v, u) => { const s = this._plSpoons(v, u); return s ? ` <span class="pool-sp">(Messlöffel: ${s})</span>` : ''; };
    let ct;
    if (awC) ct = '<i>Warten auf erneute Messung nach Chlor-Zugabe.</i>';
    else if (!hasChlor) ct = fromStore ? '<i>Warte auf neue Messung (Werte aus Speicher)</i>' : 'Warte auf Messwerte...';
    else if (a.chlor_product_type === 'inorganic' && (dose > 0 || pre > 0)) {
      const preT = `<b>${this._plDose(pre, 'g')}</b>`; const doseT = `<b>${this._plDose(dose, 'g')}</b>`;
      const preM = plan ? `Jetzt ${preT} zugeben${sp(pre, 'g')}. So passt der Mindestwert voraussichtlich in ca. <b>${this._plHrs(bh)}h</b> um <b>${bTime} Uhr</b> noch.` : `Vor dem Baden bei Bedarf nur ${preT} bis in den sicheren Bereich korrigieren${sp(pre, 'g')}.`;
      const doseM = `Nach der Nutzung ${doseT} anorganisches Chlor zur aktiven Desinfektion zugeben${sp(dose, 'g')}.`;
      ct = pre > 0 && dose > 0 ? `${preM} ${doseM}` : pre > 0 ? preM : doseM;
    } else if (dose > 0) ct = `Bitte <b>${this._plDose(dose, 'g')}</b> Chlor für den Zielbereich hinzufügen${sp(dose, 'g')} (Vor Baden: ca. ${this._plDose(pre, 'g')}).`;
    else ct = hi > 0.2 ? `<span class="s-bd">Chlorwert ist zu hoch! (+${this._plN(hi)} mg/l)</span>` : lo > 0.2 ? 'Chlorwert zu niedrig.' : 'Chlorwert ist im Zielbereich.';
    const la = a.last_chlor_action || {}; const lpp = a.last_ph_plus_action || {}; const lpm = a.last_ph_minus_action || {}; const lw = a.last_water_exchange_action || {};
    const chist = la.time ? `Zuletzt: ${this._plN(la.amount)} g (${esc(la.time)})` : '';
    const fm = a.chlor_forecast_message; const conf = { high: 'hoch', medium: 'mittel', low: 'niedrig', learning: 'Lernphase', unknown: 'unbekannt' }[a.chlor_forecast_confidence] || 'unbekannt';
    const fc = fm ? `<div class="pool-note">${esc(fm)} Konfidenz: ${conf}.</div>` : '';
    let bk = '';
    if (dose > 0 && !awC && a.awaiting_retest !== true) {
      const b = (v) => n(v) || 0; const sg = (v) => `${v > 0 ? '+' : ''}${this._plN(v)} g`; const rw = (l, v) => (v !== 0 ? `<div><span>${l}</span><span>${sg(v)}</span></div>` : '');
      const sum = b(a.chlor_breakdown_sum_raw); const md = b(a.chlor_breakdown_min_dose_applied); const vol = n(a.volume_m3); const lit = n(a.volume_liters); const df = n(a.personal_chlor_dose_factor); const ec = n(a.effective_chlor_content); const sm = n((a.chlor_dose_factor_attributes || {}).samples);
      const body = `<div><span>Basis (Ziel-Ist)</span><span>${this._plN(b(a.chlor_breakdown_base))} g</span></div>${rw('Schockchlorungsziel', b(a.chlor_breakdown_shock_adj))}${rw('Temperatur-Zuschlag', b(a.chlor_breakdown_temp_adj))}${rw('Offenes Becken', b(a.chlor_breakdown_env_adj))}${rw('UV-Zuschlag', b(a.chlor_breakdown_uv_adj))}${rw('Nutzung', b(a.chlor_breakdown_bather_adj))}
        <div class="sum"><span>Summe (vor Min/Max)</span><span>${this._plN(sum)} g</span></div>${md > 0 ? `<div><span>Mindestdosis angewendet</span><span>+${this._plN(md - sum)} g</span></div>` : (dose !== sum ? `<div><span>Schockchlorungsgrenze angewendet</span><span>${this._plN(dose - sum)} g</span></div>` : '')}
        <div class="sum"><span>Empfohlene Menge</span><span>${this._plN(dose)} g</span></div>${Number.isFinite(vol) && vol > 0 ? `<div><span>Berechnetes Volumen</span><span>${this._plHrs(vol, 3)} m³${Number.isFinite(lit) && lit > 0 ? ` (${this._plHrs(lit, 0)} l)` : ''}</span></div>` : ''}
        ${Number.isFinite(df) && df > 0 ? `<div><span>Gelernter Dosierfaktor</span><span>${this._plN(df)}${Number.isFinite(sm) && sm > 0 ? ` (${sm} Samples)` : ''}</span></div>` : ''}${Number.isFinite(ec) && ec > 0 ? `<div><span>Effektiver Wirkstoff</span><span>${this._plN(ec, 3)}</span></div>` : ''}`;
      bk = `<div class="pool-lnk" data-act="pl-open" data-k="bk">Berechnungsdetails ${this._P().open.bk ? '▴' : '▾'}</div>${this._P().open.bk ? `<div class="pool-bk">${body}</div>` : ''}`;
    }
    const input = (key, ph, dis, step = '0.1', go = key) => `<input type="number" inputmode="decimal" min="0" step="${step}" data-pk="${key}" data-go="${go}" placeholder="${dis ? 'Neue Messung abwarten' : ph}" ${dis ? 'disabled' : ''}>`;
    const lab = (l, inp) => `<label>${l}${inp}</label>`;
    let pt = fromStore ? '<i>Warte auf neue Messung...</i>' : 'Warte auf Messwerte...';
    if (awP) pt = '<i>Warten auf erneute Messung nach pH-Zugabe.</i>';
    else if (this._plKnown(a.ph_ist) && !fromStore) {
      pt = 'pH-Wert ist im Zielbereich.';
      if (n(a.ph_senker_total) > 0) pt = `📉 pH-Minus: ca. <b>${this._plDose(a.ph_senker_total, 'ml')}</b> hinzufügen.${sp(a.ph_senker_total, 'ml')}`;
      else if (n(a.ph_erhoeher_total) > 0) pt = `📈 pH-Plus: ca. <b>${this._plDose(a.ph_erhoeher_total, 'g')}</b> hinzufügen.${sp(a.ph_erhoeher_total, 'g')}`;
    }
    const phist = [lpp.time ? `Zuletzt pH+: ${this._plN(lpp.amount)} g (${esc(lpp.time)})` : '', lpm.time ? `Zuletzt pH−: ${this._plN(lpm.amount)} ml (${esc(lpm.time)})` : ''].filter(Boolean).join(' | ');
    const whist = lw.time ? `Zuletzt Wasserwechsel: ${this._plN(lw.liters, 0)} l / ${this._plN(lw.percent, 1)} % (${esc(lw.time)})` : '';
    const row = (ic, main, hist, extra, inputs) => `<div class="pool-rr"><ha-icon icon="${ic}"></ha-icon><div class="pool-rc"><div>${main}</div>${hist ? `<div class="pool-hist">${hist}</div>` : ''}${extra || ''}<div class="pool-in">${inputs}</div></div></div>`;
    return row('mdi:pill', ct, chist, fc + bk, `${input('chlor', 'Menge g', awC)}<button class="pool-ok" data-act="pl-go" data-k="chlor" ${awC ? 'disabled' : ''}>OK</button>`)
      + row('mdi:test-tube', pt, phist, '', `${input('ph_plus', 'Plus g', awP)}${input('ph_minus', 'Minus ml', awP, '0.1', 'ph')}<button class="pool-ok" data-act="pl-go" data-k="ph" ${awP ? 'disabled' : ''}>OK</button>`)
      + row('mdi:water-sync', a.cya_forecast_message || 'Keine CYA-Prognose verfügbar.', whist, '', `${lab('Wasserwechsel l', input('wex_l', 'l', false, '1', 'wex'))}${lab('Wasserwechsel %', input('wex_p', '%', false, '0.1', 'wex'))}<button class="pool-ok" data-act="pl-go" data-k="wex">OK</button>`);
  }
  _plTable(a) {
    const cr = this._plRange(a, 'chlor_min', 'chlor_max', 'chlor_target'); const pr = this._plRange(a, 'ph_min', 'ph_max', 'ph_target'); const cya = this._plCya(a.cyanuric_acid, a.chlor_product_type);
    const src = (s, m) => `<b>${esc(s || '--')}</b>${m ? `<small>${esc(m)}</small>` : ''}`; const bt = this._P().fetching || a.bluetooth_connected === true;
    const r = (l, v, tg, so) => `<div class="pool-tr"><b>${l}</b><div>${v}</div><div>${tg}</div><div class="r">${so}</div></div>`;
    return `<div class="pool-tb"><div class="pool-tr th"><div>Messwert</div><div>Ist</div><div>Ziel</div><div class="r">Quelle</div></div>
      ${r('Chlor', `<b class="s-${this._plCls(a.chlor_ist, cr, 0.7)}">${this._plN(a.chlor_ist)} mg/l</b>`, this._plRangeTxt(cr, ' mg/l'), src(a.chlor_source, a.chlor_measurement))}
      ${r('pH-Wert', `<b class="s-${this._plCls(a.ph_ist, pr, 0.3)}">${this._plN(a.ph_ist)}</b>`, this._plRangeTxt(pr), src(a.ph_source, a.ph_measurement))}
      ${r('Temperatur', `<b>${this._plN(a.temp_ist)} °C</b>`, '--', src(a.temp_source, a.temp_measurement))}
      ${r('Cyanursäure', `<b class="s-${cya.cls}">${this._plN(a.cyanuric_acid)} ppm</b>`, `${cya.target}<small class="s-${cya.cls}">${cya.label}</small>`, `${src(a.cyanuric_acid_source, a.cyanuric_acid_measurement)}<small>${cya.action}</small>`)}
      ${r('BT Verbindung', `<b class="s-${bt ? 'ok' : 'bd'}">Bluetooth: ${bt ? 'Ja' : 'Nein'}</b>`, esc(a.ble_measurement || '--'), bt ? 'aktiv' : 'inaktiv')}</div>`;
  }
  _plActs(a) {
    const l = Array.isArray(a.last_activities) ? a.last_activities : []; if (!l.length) return '';
    const txt = (e) => {
      if (e && e.text) return e.text; const ty = e && e.type; const am = e && e.amount; const f0 = (v) => this._plN(v, 0);
      if (ty === 'chlor') return am != null ? `${f0(am)} g Chlor hinzugefügt` : 'Chlor hinzugefügt';
      if (ty === 'ph_plus') return am != null ? `${f0(am)} g pH-Plus hinzugefügt` : 'pH-Plus hinzugefügt';
      if (ty === 'ph_minus') return am != null ? `${f0(am)} ml pH-Minus hinzugefügt` : 'pH-Minus hinzugefügt';
      if (ty === 'water_exchange') return `${f0(e.liters || am || 0)} l Wasser gewechselt (${this._plN(e.percent || 0, 1)} %)`;
      if (ty === 'filter_clean') return 'Filter gereinigt'; if (ty === 'filter_replace') return 'Filter getauscht';
      if (ty === 'set_covered') return `Abdeckung: ${am > 0 ? 'Abgedeckt' : 'Offen'}`;
      if (ty === 'set_usage') return `Nutzungsmodus: ${{ 0: 'Keine', 1: 'Normal', 2: 'Party', none: 'Keine', normal: 'Normal', party: 'Party' }[am] || 'Keine'}`;
      return '--';
    };
    return this._plSec('act', 'mdi:history', 'Letzte Aktivitäten', `${l.length} Einträge`, () => `<div class="pool-tb">${l.map((e) => `<div class="pool-tr hs"><b>${e && e.type === 'set_covered' ? 'Abdeckung' : e && e.type === 'set_usage' ? 'Modus' : 'Aktivität'}</b><div>✅ ${esc(txt(e))}</div><div class="r">${esc((e && e.time) || '--')}</div><div></div></div>`).join('')}</div>`);
  }
  _plHist(a) {
    const l = Array.isArray(a.last_measurements_display) && a.last_measurements_display.length ? a.last_measurements_display : (Array.isArray(a.last_api_measurements) ? a.last_api_measurements.map((m) => ({ ...m, source: 'API' })) : []);
    if (!l.length) return '';
    return this._plSec('mh', 'mdi:cloud-download-outline', 'Letzte Chemie-Messwerte', `${Math.min(5, l.length)} Einträge`, () => `<div class="pool-tb"><div class="pool-tr th hs"><div>Quelle</div><div>Parameter</div><div>Wert</div><div class="r">Zeit</div></div>${l.slice(0, 5).map((m) => {
      const t = m.timestamp ? new Date(m.timestamp).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--';
      const v = !isNaN(parseFloat(m.value)) ? this._plN(m.value) : m.value;
      return `<div class="pool-tr hs"><b>${esc(m.source || 'API')}</b><div>${esc(m.parameter ? String(m.parameter).replace('PL ', '') : 'Unbekannt')}</div><div><b>${esc(v)}</b></div><div class="r">${t}</div></div>`;
    }).join('')}</div>`);
  }
  _plFilter(a) {
    const c = (v, s) => `<b class="${s === 'ok' ? 's-ok' : s === 'warning' ? 's-wn' : s === 'critical' ? 's-bd' : ''}">${v !== null && v !== undefined ? v : '--'}</b>`;
    const hc = a.hours_since_filter_clean; const dr = a.days_since_filter_replace;
    return this._plSec('flt', 'mdi:air-filter', 'Filter Wartung', `Reinigung ${hc != null ? `${hc}h` : '--'}, Wechsel ${dr != null ? `${dr}d` : '--'}`, () => `<div class="pool-kv"><span>Reinigung: ${c(hc, a.filter_clean_status)} Stunden her <small>(Empf. alle ${a.filter_clean_interval ?? '--'} Stunden)</small></span><button class="pool-btn alt" data-act="pl-filter" data-k="clean">Gereinigt</button></div>
      <div class="pool-kv"><span>Wechsel: ${c(dr, a.filter_replace_status)} Tage her <small>(Empf. alle ${a.filter_replace_interval ?? '--'} Tage)</small></span><button class="pool-btn alt" data-act="pl-filter" data-k="replace">Gewechselt</button></div>`);
  }
  _plUsage(a) {
    const cov = !!this._plOpt('covered', a.pool_covered); const um = this._plOpt('usage', a.usage_mode); const L = { none: 'Keine', normal: 'Normal', party: 'Party' };
    const { on: plan, hrs: ph } = this._plPlan(a);
    const sum = `${cov ? 'Abgedeckt' : 'Offen'}, Nutzung ${L[um] || 'Keine'}${plan && Number.isFinite(ph) ? `, Baden in ${this._plHrs(ph)}h` : ''}`;
    return this._plSec('use', 'mdi:pool', 'Status & Nutzung', esc(sum), () => `<div class="pool-modes"><button class="pool-btn ${cov ? 'sel' : 'alt'}" data-act="pl-cover"><ha-icon icon="${cov ? 'mdi:pool' : 'mdi:sun-side'}" style="--mdc-icon-size:16px"></ha-icon> ${cov ? 'Abgedeckt' : 'Offen'}</button>
      <button class="pool-btn ${um === 'none' || !um ? 'sel' : 'alt'}" data-act="pl-usage" data-k="0">Keine</button><button class="pool-btn ${um === 'party' ? 'sel' : 'alt'}" data-act="pl-usage" data-k="2">Party</button></div>
      <div class="pool-in">${`<label>Baden in (Stunden)<input type="number" inputmode="decimal" min="0.5" max="24" step="0.5" data-pk="bath" data-go="bath" placeholder="Stunden"></label>`}<button class="pool-ok" data-act="pl-go" data-k="bath">Setzen</button><button class="pool-btn alt" data-act="pl-bathclear">Zurücksetzen</button></div>
      <div class="pool-sp" style="margin-top:8px">${plan && Number.isFinite(ph) ? `Badeplan aktiv: in ${this._plHrs(ph)}h${a.bath_plan_until ? `, geplant für ${this._plTime(a.bath_plan_until)} Uhr` : ''}.` : 'Kein Badezeitpunkt geplant. Ohne Zeitangabe bleibt die Hauptdosierung für nach der Nutzung.'}</div>`);
  }
  _poolHtml() {
    const h = this._hass; const recId = this._xid('pool_rec'); const rec = recId && h.states[recId]; const L = this._plLz();
    const wi = this._xs('pool_winter');
    if (wi && wi.state === 'on') return this._edit ? '<div class="en nopt"><div class="hd"><div class="ib"><ha-icon icon="mdi:snowflake"></ha-icon></div><div><b>Pool</b><span>Winterschlaf aktiv · Karte ist ausgeblendet</span></div></div></div>' : '';
    const pt = this._xs('pool_temp');
    if (!rec && !L.any && !pt) return '';
    const a = rec ? rec.attributes : {}; const size = this._set.size.pool || 'f';
    const tempV = rec && this._plKnown(a.temp_ist) ? this._plNum(a.temp_ist) : parseFloat((this._xs('lz_temp') || pt || {}).state);
    const tempId = (rec && this._plKnown(a.temp_ist) ? recId : (this._xs('lz_temp') ? this._xid('lz_temp') : pt && pt.entity_id)) || recId;
    const big = Number.isFinite(tempV) ? `<div class="big" data-act="pl-info" data-id="${tempId}">${this._plN(tempV, 1)}°</div>` : '';
    const lerr = L.err ? this._plLzErr(h.states[L.err].state) : null;
    const errHtml = lerr ? `<div class="pool-err"><ha-icon icon="mdi:alert-circle"></ha-icon><div><b>${esc(lerr.t)}</b><br><b>Bedeutung:</b> ${esc(lerr.m)}<br><b>Lösung:</b> ${esc(lerr.s)}</div></div>` : '';
    const head = (sub) => `<div class="pool-hd"><div class="ib"><ha-icon icon="mdi:pool"></ha-icon></div><div class="tt"><b>Pool</b><span>${esc(sub)}</span></div>${big}</div>`;
    if (!rec) return `<div class="pool">${head(L.any ? 'LayzSpa' : 'Wassertemperatur')}${errHtml}${L.any ? this._plLzSec(L) : ''}</div>`;
    const stx = this._plStatus(rec); const bath = this._plBath(a); const rt = this._plRetest(a);
    const hasChlor = this._plKnown(a.chlor_ist) && a.data_source !== 'Speicher';
    const cr = this._plRange(a, 'chlor_min', 'chlor_max', 'chlor_target'); const pr = this._plRange(a, 'ph_min', 'ph_max', 'ph_target'); const cya = this._plCya(a.cyanuric_acid, a.chlor_product_type);
    const val = (l, v, u, cls, sub, id) => `<div class="pool-v" data-act="pl-info" data-id="${id}"><small>${l}</small><b class="${cls ? `s-${cls}` : ''}">${v}${u}</b><em>${sub}</em></div>`;
    const vals = `${val('Chlor', this._plN(a.chlor_ist), ' mg/l', this._plCls(a.chlor_ist, cr, 0.7), `Ziel ${this._plRangeTxt(cr)}`, recId)}${val('pH', this._plN(a.ph_ist), '', this._plCls(a.ph_ist, pr, 0.3), `Ziel ${this._plRangeTxt(pr)}`, recId)}${val('Temperatur', this._plN(a.temp_ist, 1), ' °C', '', esc(a.temp_source || '--'), recId)}${val('Cyanursäure', this._plN(a.cyanuric_acid, 0), ' ppm', cya.cls, cya.label, recId)}`;
    if (size !== 'f') {
      return `<div class="pool">${head(hasChlor ? `Messung: ${a.last_measurement || '--'}` : 'Warte auf Messwerte')}${errHtml}
        <div class="pool-strip" style="grid-template-columns:1fr"><div class="pool-seg ${stx.cls}"><small>Status</small><b>${esc(stx.t)}</b>${rt ? `<i>Nachmessfenster: ${esc(rt)}</i>` : ''}</div><div class="pool-seg ${bath.cls}"><small>Baden</small><b>${esc(bath.title)}</b><i>${esc(bath.detail)}</i></div></div>
        <div class="pool-vals" style="grid-template-columns:repeat(2,minmax(0,1fr))">${vals}</div><div class="pool-in"><button class="pool-btn" data-act="pl-full">Alle Funktionen</button></div></div>`;
    }
    const fe = this._plFetchUi(a);
    const fetchSeg = fe ? `<div class="pool-seg ${fe.cls}"><small>PoolLab</small><b>${esc(fe.st)}</b><i>Manueller Abruf direkt aus der Karte.</i><div class="pool-ab"><span class="pool-tag s-${fe.cls}">${fe.meta}</span><button class="pool-btn" data-act="pl-fetch" ${fe.dis ? 'disabled' : ''}>${fe.lab}</button></div></div>` : '';
    const msum = `Chlor ${this._plN(a.chlor_ist)} mg/l, pH ${this._plN(a.ph_ist)}, ${this._plN(a.temp_ist, 1)} °C, CYA ${this._plN(a.cyanuric_acid, 0)} ppm`;
    const lastCalc = a.last_calculation_raw || rec.last_updated;
    return `<div class="pool">${head(`${a.data_source ? `Datenquelle: ${a.data_source}` : 'Smart Pool Assistant'}`)}${errHtml}
      <div class="pool-strip" style="${fe ? '' : 'grid-template-columns:1fr 1fr'}"><div class="pool-seg ${stx.cls}"><small>Status</small><b>${esc(stx.t)}</b>${rt ? `<i>Nachmessfenster: ${esc(rt)}</i>` : ''}</div>
        <div class="pool-seg ${bath.cls}"><small>Baden</small><b>${esc(bath.title)}</b><i>${esc(bath.detail)}</i></div>${fetchSeg}</div>
      <div class="pool-vals">${vals}</div>
      ${this._plRows(a)}
      ${this._plWx(a)}${this._plStab(a)}
      ${this._plSec('meas', 'mdi:gauge', 'Aktuelle Messwerte', esc(msum), () => this._plTable(a))}
      ${L.any ? this._plLzSec(L) : ''}
      ${this._plActs(a)}${this._plHist(a)}${this._plFilter(a)}${this._plUsage(a)}
      <div class="pool-ft">Berechnet: ${esc(a.last_calculation || '--')} | Messung: ${esc(a.last_measurement || '--')}${a.last_measurement_source ? ` (${esc(a.last_measurement_source)})` : ''}<br>Daten-Aktualität: ${lastCalc ? ago(lastCalc) : '--'}</div></div>`;
  }

  /* ---------- 3D-Drucker ---------- */
  _R() { return this._prs || (this._prs = { cf: '', cfAt: 0, opt: {}, optAt: 0 }); }
  _prSig() {
    const h = this._hass;
    return ['printer_status', 'printer_progress', 'printer_left', 'printer_nozzle', 'printer_bed', 'printer_plug', 'printer_plugw', 'printer_boxt', 'printer_boxh', 'printer_time', 'printer_bedt', 'printer_nozt', 'printer_tune', 'printer_layer', 'printer_layers', 'printer_mat', 'printer_prev', 'printer_cam']
      .map((k) => { const id = this._xid(k); const x = id && h.states[id]; return x ? `${id}${x.state}` : ''; }).join(',') + this._R().cf;
  }
  _prX() {
    const h = this._hass; const g = (k) => { const id = this._xid(k); return id && h.states[id] ? id : null; };
    const o = {}; ['status', 'cam', 'pause', 'resume', 'stop', 'bedt', 'nozt', 'tune', 'layer', 'layers', 'mat', 'prev', 'plug', 'plugw', 'boxt', 'boxh', 'time'].forEach((n) => { o[n] = g(`printer_${n}`); });
    o.st = this._xs('printer_status'); o.progId = this._xid('printer_progress');
    o.prog = this._num(o.progId); o.left = this._dur(h.states[this._xid('printer_left')]);
    o.nozzle = this._num(this._xid('printer_nozzle')); o.bed = this._num(this._xid('printer_bed'));
    return o;
  }
  _prPhase(s) {
    if (!s) return 'idle'; const x = norm(s.state);
    if (/pause/.test(x)) return 'paused';
    if (/error|fail|fehler|stop|cancel|abort/.test(x)) return 'error';
    if (/complete|finish|done|fertig/.test(x)) return 'done';
    if (/print|run|druck|heat/.test(x) && !/idle/.test(x)) return 'printing';
    return 'idle';
  }
  _prVal(id) { const R = this._R(); const x = this._hass.states[id]; const v = x ? parseFloat(x.state) : NaN; return R.opt[id] !== undefined && Date.now() - R.optAt < 8000 ? R.opt[id] : v; }
  _prStep(id, dir) {
    const h = this._hass; const x = h.states[id]; if (!x) return; const at = x.attributes || {}; const R = this._R();
    const base = this._prVal(id); if (!Number.isFinite(base)) return;
    const stp = Math.max(5, parseFloat(at.step) || 1); let v = base + dir * stp;
    const mn = parseFloat(at.min); const mx = parseFloat(at.max); if (Number.isFinite(mn)) v = Math.max(mn, v); if (Number.isFinite(mx)) v = Math.min(mx, v);
    if (v === base) return;
    if (Date.now() - R.optAt >= 8000) R.opt = {};
    R.opt[id] = v; R.optAt = Date.now();
    h.callService('number', 'set_value', { entity_id: id, value: v });
  }
  _printClick(t, act) {
    const R = this._R(); const h = this._hass; const k = t.dataset.k;
    switch (act) {
      case 'pr-btn': {
        const X = this._prX(); const ph = this._prPhase(X.st); const run = ph === 'printing' || ph === 'paused';
        const sure = (key) => {
          if (R.cf === key && Date.now() - R.cfAt < 4000) { R.cf = ''; return true; }
          R.cf = key; R.cfAt = Date.now();
          setTimeout(() => { if (R.cf === key && Date.now() - R.cfAt >= 3900) { R.cf = ''; this._sig = ''; this._render(); } }, 4000);
          return false;
        };
        if (k === 'power') {
          if (!X.plug) return false; const on = h.states[X.plug].state === 'on';
          if (on && run && !sure('power')) return true;
          R.cf = ''; h.callService('switch', on ? 'turn_off' : 'turn_on', { entity_id: X.plug }); return true;
        }
        if (k === 'stop' && !sure('stop')) return true;
        const id = X[k]; R.cf = ''; if (id) h.callService('button', 'press', { entity_id: id }); return true;
      }
      case 'pr-adj': this._prStep(t.dataset.id, Number(t.dataset.d)); return true;
      case 'pr-full': this._set.size.printer = 'f'; this._save(); return true;
      case 'pr-info': this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: t.dataset.id }, bubbles: true, composed: true })); return false;
      default: return false;
    }
  }
  _printerHtml() {
    const h = this._hass; const X = this._prX(); const R = this._R();
    if (!X.st && !X.plug) return '';
    const size = this._set.size.printer || 'f'; const full = size === 'f';
    const plugOn = X.plug ? h.states[X.plug].state === 'on' : true;
    const ph = !plugOn ? 'off' : this._prPhase(X.st);
    const M = { printing: ['Druckt', 'mdi:printer-3d-nozzle', 's-bl'], paused: ['Pausiert', 'mdi:pause-circle', 's-wn'], error: ['Fehler oder abgebrochen', 'mdi:alert-circle', 's-bd'], done: ['Druck fertig', 'mdi:check-circle', 's-ok'], idle: ['Bereit', 'mdi:printer-3d', 's-ok'], off: ['Ausgeschaltet', 'mdi:power-plug-off', ''] }[ph];
    const run = ph === 'printing' || ph === 'paused';
    const prog = X.prog !== null ? Math.max(0, Math.min(100, X.prog)) : null;
    const big = run && prog !== null ? `<div class="big" data-act="pr-info" data-id="${X.progId}">${Math.round(prog)} %</div>` : '';
    const sub = [];
    if (run) {
      const ly = X.layer && X.layers ? `${Math.round(this._num(X.layer) ?? 0)} / ${Math.round(this._num(X.layers) ?? 0)}` : '';
      if (ly) sub.push(`Layer ${ly}`);
      if (X.left !== null) { sub.push(`noch ${this._fmtMin(X.left)}`); sub.push(`fertig ca. ${new Date(Date.now() + X.left * 60000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`); }
    }
    const head = `<div class="pool-hd"><div class="ib"><ha-icon icon="${M[1]}"></ha-icon></div><div class="tt"><b>3D-Drucker</b><span class="${M[2]}">${M[0]}</span></div>${big}</div>`;
    const bar = run && prog !== null ? `<div class="bar prn-bar"><i style="width:${Math.round(prog)}%"></i></div>` : '';
    const info = sub.length ? `<div class="prn-t">${sub.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : '';
    const temp = (ic, l, cur, tgt, id, col) => cur === null && tgt === null ? '' : `<div class="pool-chip" data-act="pr-info" data-id="${id}"><small>${l}</small><b><ha-icon icon="${ic}" style="color:${col}"></ha-icon> ${cur !== null ? `${this._de(cur, 0)}°` : '--'}${tgt !== null && tgt > 0 ? ` <i>/ ${this._de(tgt, 0)}°</i>` : ''}</b></div>`;
    const tn = this._prVal(X.nozt), tb = this._prVal(X.bedt);
    const temps = plugOn ? `<div class="pool-chips prn-ch">${temp('mdi:printer-3d-nozzle-heat', 'Düse', X.nozzle, Number.isFinite(tn) ? tn : null, this._xid('printer_nozzle') || X.nozt, '#ef6569')}${temp('mdi:radiator', 'Bett', X.bed, Number.isFinite(tb) ? tb : null, this._xid('printer_bed') || X.bedt, '#ffad45')}</div>` : '';
    const btn = (key, ic, txt, cls) => { const cf = R.cf === key; return `<button class="pool-btn ${cls}${cf ? ' cf' : ''}" data-act="pr-btn" data-k="${key}"><ha-icon icon="${cf ? 'mdi:help-circle' : ic}"></ha-icon>${cf ? (key === 'stop' ? 'Wirklich stoppen?' : 'Wirklich ausschalten?') : txt}</button>`; };
    const acts = [];
    if (plugOn && ph === 'printing' && X.pause) acts.push(btn('pause', 'mdi:pause', 'Pause', 'prn-pa'));
    if (plugOn && ph === 'paused' && X.resume) acts.push(btn('resume', 'mdi:play', 'Fortsetzen', 'prn-re'));
    if (plugOn && run && X.stop) acts.push(btn('stop', 'mdi:stop', 'Stopp', 'prn-st'));
    if (X.plug) acts.push(btn('power', 'mdi:power', plugOn ? 'Ausschalten' : 'Einschalten', plugOn ? 'alt' : 'sel'));
    const actHtml = acts.length ? `<div class="prn-act">${acts.join('')}</div>` : '';
    const camSt = X.cam && h.states[X.cam]; const camPic = camSt && camSt.state !== 'unavailable' && camSt.attributes.entity_picture;
    const cam = camPic && plugOn && (full || run) ? `<div class="prn-cam" data-act="pr-info" data-id="${X.cam}"><img data-b="${esc(camPic)}" src="${esc(camPic)}" alt=""></div>` : '';
    if (!full) return `<div class="pool prn">${head}${bar}${info}${temps}${cam}${actHtml}<div class="pool-in"><button class="pool-btn" data-act="pr-full">Alle Funktionen</button></div></div>`;
    const wv = X.plugw ? parseFloat(h.states[X.plugw].state) : NaN;
    const wTxt = !Number.isFinite(wv) ? '--' : Math.abs(wv) >= 1000 ? `${this._de(wv / 1000, 2)}<i>kW</i>` : `${this._de(wv, 0)}<i>W</i>`;
    const box = (ic, col, l, v, id) => `<div class="prn-box"${id ? ` data-act="pr-info" data-id="${id}"` : ''}><div class="i"><ha-icon icon="${ic}" style="color:${col}"></ha-icon></div><div><small>${l}</small><b>${v}</b></div></div>`;
    const stat = (X.plug || X.plugw) ? `<div class="prn-2">${X.plug ? box(plugOn ? 'mdi:power-plug' : 'mdi:power-plug-off', plugOn ? '#63d17a' : '#9a9a9a', 'Strom', plugOn ? 'EIN' : 'AUS', X.plug) : ''}${X.plugw ? box('mdi:lightning-bolt', '#f6cc59', 'Verbrauch', wTxt, X.plugw) : ''}</div>` : '';
    const ctl = (ic, col, l, id, fmt, adj) => {
      if (!id) return ''; const v = adj ? this._prVal(id) : parseFloat(h.states[id].state); const okv = Number.isFinite(v);
      const sp = adj && plugOn ? `<div class="sp"><button data-act="pr-adj" data-id="${id}" data-d="-1" aria-label="weniger">−</button><button data-act="pr-adj" data-id="${id}" data-d="1" aria-label="mehr">+</button></div>` : '';
      return `<div class="prn-c"><ha-icon icon="${ic}" style="color:${col}"></ha-icon><b data-act="pr-info" data-id="${id}">${okv ? fmt(v) : '--'}</b><small>${l}</small>${sp}</div>`;
    };
    const mat = (v) => (v >= 1000 ? `${this._de(v / 1000, 2)}<i>m</i>` : `${this._de(v, 0)}<i>${esc((X.mat && h.states[X.mat].attributes.unit_of_measurement) || 'mm')}</i>`);
    const ctls = [ctl('mdi:radiator', '#ffad45', 'Bett soll', X.bedt, (v) => `${Math.round(v)}<i>°C</i>`, true), ctl('mdi:printer-3d-nozzle-heat', '#ef6569', 'Düse soll', X.nozt, (v) => `${Math.round(v)}<i>°C</i>`, true), ctl('mdi:speedometer', '#31bfca', 'Speed', X.tune, (v) => `${Math.round(v)}<i>%</i>`, true), ctl('mdi:spool', '#ba8ce0', 'Material', X.mat, mat, false)].join('');
    const ctlHtml = ctls ? `<div class="prn-4">${ctls}</div>` : '';
    const chip = (l, v, id) => `<div class="pool-chip" data-act="pr-info" data-id="${id}"><small>${l}</small><b>${v}</b></div>`;
    const stx = (id) => h.states[id];
    const chips = [];
    if (X.boxt && this._ok(stx(X.boxt))) chips.push(chip('Gehäuse', `${this._de(parseFloat(stx(X.boxt).state), 1)} °C`, X.boxt));
    if (X.boxh && this._ok(stx(X.boxh))) chips.push(chip('Luftfeuchte', `${this._de(parseFloat(stx(X.boxh).state), 0)} %`, X.boxh));
    if (X.time && this._ok(stx(X.time))) { const d = this._dur(stx(X.time)); chips.push(chip('Druckzeit', d !== null ? this._fmtMin(d) : esc(`${stx(X.time).state} ${stx(X.time).attributes.unit_of_measurement || ''}`.trim()), X.time)); }
    const pv = X.prev && this._ok(stx(X.prev)) && stx(X.prev).attributes.entity_picture;
    const prev = pv ? `<div class="prn-pv" data-act="pr-info" data-id="${X.prev}"><img src="${esc(pv)}" alt=""></div>` : '';
    return `<div class="pool prn">${head}${bar}${info}${cam}${temps}${actHtml}${stat}${ctlHtml}${chips.length ? `<div class="pool-chips prn-ch">${chips.join('')}</div>` : ''}${prev}</div>`;
  }

  /* ---------- Aktionen ---------- */
  _click(e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act; const id = t.dataset.id; const h = this._hass; const s = this._set;
    if (act === 'noop') return;
    e.stopPropagation();
    if (Date.now() - (this._dgAt || 0) < 450) return;
    if (this._edit && ['info', 'toggle', 'vstart', 'vdock', 'vlocate', 'vfan', 'qrun'].includes(act)) return;
    if (act.startsWith('pr-')) { if (this._edit) return; if (this._printClick(t, act)) { this._sig = ''; this._render(); } return; }
    if (act.startsWith('pl-')) { if (this._edit) return; if (this._poolClick(t, act)) { this._sig = ''; this._render(); } return; }
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
      case 'vlocate': h.callService('vacuum', 'locate', { entity_id: id }); return;
      case 'vfan': h.callService('vacuum', 'set_fan_speed', { entity_id: id, fan_speed: t.dataset.v }); return;
      case 'adddv': this._sheet = 'dvadd'; break;
      case 'dvtype': this._dvT = t.dataset.k; this._sheet = 'dvmain'; this._q = ''; break;
      case 'dvnew': {
        const iv = { id: `dv${Date.now().toString(36)}`, type: this._dvT, main: id, map: {}, title: '' };
        s.devices.push(iv); if (this._view === 'more') s.place[iv.id] = 'more';
        this._dvId = iv.id; this._sheet = 'dv'; this._save(); break;
      }
      case 'dvpick': this._sheet = 'dvpick'; this._dvK = t.dataset.k; this._q = ''; break;
      case 'dvset': {
        const iv = s.devices.find((x) => x.id === this._dvId);
        if (iv) { if (id) iv.map[t.dataset.k] = id; else delete iv.map[t.dataset.k]; this._save(); }
        this._sheet = 'dv'; break;
      }
      case 'dvdel': {
        const did = this._dvId; s.devices = s.devices.filter((x) => x.id !== did);
        delete s.size[did]; delete s.place[did]; s.hidden = s.hidden.filter((x) => x !== did);
        this._save(); this._sheet = null; break;
      }
      case 'vstart': h.callService('vacuum', h.states[id] && h.states[id].state === 'cleaning' ? 'pause' : 'start', { entity_id: id }); return;
      case 'vdock': h.callService('vacuum', 'return_to_base', { entity_id: id }); return;
      case 'rsens': this._sheet = 'rs'; this._rsArea = id; break;
      case 'rspick': { const r = s.roomSensors[this._rsArea] || (s.roomSensors[this._rsArea] = {}); if (id) r[t.dataset.k] = id; else delete r[t.dataset.k]; this._save(); break; }
      case 'alerts': this._sheet = 'alerts'; break;
      case 'warns': this._sheet = 'warns'; break;
      case 'chips': this._sheet = 'chips'; break;
      case 'fx': this._sheet = 'fx'; break;
      case 'fxg': { const f = s.fx; const k = t.dataset.k; if (k === 'level') f.level = FX_LEVELS[(FX_LEVELS.findIndex((l) => l[1] === f.level) + 1) % FX_LEVELS.length][1]; else f[k] = !f[k]; this._save(); break; }
      case 'fxm': { const e = s.fx.e[t.dataset.k]; const L = t.dataset.k === 'weather' ? FX_WMODES : FX_MODES; e.m = L[(L.indexOf(e.m) + 1) % L.length]; this._save(); break; }
      case 'fxd': { const e = s.fx.e[t.dataset.k]; e.d = FX_DURS[(FX_DURS.indexOf(e.d) + 1) % FX_DURS.length]; this._save(); break; }
      case 'door': this._sheet = 'door'; break;
      case 'dbcam': this._sheet = 'dbcam'; break;
      case 'dbsetcam': s.door.cam = id; this._save(); this._sheet = 'door'; break;
      case 'dbsecs': { const L = [15, 30, 60, 120]; s.door.secs = L[(L.indexOf(s.door.secs) + 1) % L.length]; this._save(); break; }
      case 'dbadd': this._dbk = t.dataset.k; this._q = ''; this._sheet = 'dbpick'; break;
      case 'dbtog': { const l = s.door[this._dbk]; s.door[this._dbk] = l.includes(id) ? l.filter((x) => x !== id) : [...l, id]; this._save(); this._fillList(); return; }
      case 'dbdel': s.door[t.dataset.k] = s.door[t.dataset.k].filter((x) => x !== id); this._save(); break;
      case 'dbback': this._sheet = 'door'; break;
      case 'dbtest': this._sheet = null; this._doorShow('', 'bell'); break;
      case 'dbclose': this._doorHide(true); return;
      case 'dbopen': this._doorHide(); this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true })); return;
      case 'hc': this._sheet = 'hc'; break;
      case 'hcam': s.homeCams = s.homeCams.includes(id) ? s.homeCams.filter((x) => x !== id) : [...s.homeCams, id]; this._save(); break;
      case 'src': this._sheet = 'src'; this._ac = null; break;
      case 'srcpick': this._sheet = 'srcpick'; this._sk = t.dataset.k; this._q = ''; break;
      case 'srcset': { const k = t.dataset.k; if (id) s.sources[k] = id; else delete s.sources[k]; this._save(); this._ac = null; this._sheet = 'src'; break; }
      case 'chip': s.chips[t.dataset.k] = !this._chipOn(t.dataset.k); this._save(); break;
      case 'trav': this._sheet = 'trav'; break;
      case 'lights': this._sheet = 'lights'; break;
      case 'lightsoff': h.callService('light', 'turn_off', { entity_id: (this._byDomain().light || []).filter((x) => x.state === 'on').map((x) => x.entity_id) }); this._sheet = null; break;
      case 'close': this._sheet = null; break;
      case 'cat': s.alerts[t.dataset.k] = !s.alerts[t.dataset.k]; this._save(); break;
      case 'hide': if (!s.excludeEntities.includes(id)) s.excludeEntities.push(id); this._save(); break;
      case 'snooze': s.snooze[id] = Date.now() + 3600000; this._save(); break;
      case 'unsnooze': delete s.snooze[id]; this._save(); break;
      case 'ntf': { const k = t.dataset.k; const o = this._ntfOpts(k); const cur = k === 'min' ? s.notify.min : s.notify[k]; s.notify[k] = o[(Math.max(0, o.indexOf(cur)) + 1) % o.length]; this._ntAt = 0; this._save(); break; }
      case 'unhide': s.excludeEntities = s.excludeEntities.filter((x) => x !== id); this._save(); break;
      case 'add': this._sheet = 'add'; this._q = ''; this._flt = 'all'; this._cust = false; break;
      case 'resetmine': this._resetMine(); break;
      case 'roomact': this._roomAct = !this._roomAct; break;
      case 'rmlight': { const l = this._areaEnts(id).filter((x) => dom(x.entity_id) === 'light'); h.callService('light', l.some((x) => x.state === 'on') ? 'turn_off' : 'turn_on', { entity_id: l.map((x) => x.entity_id) }); break; }
      case 'rmcover': { const c = this._areaEnts(id).filter((x) => dom(x.entity_id) === 'cover'); h.callService('cover', c.some((x) => x.state !== 'closed') ? 'close_cover' : 'open_cover', { entity_id: c.map((x) => x.entity_id) }); break; }
      case 'ascust': this._cust = !this._cust; break;
      case 'size': { const cur = t.dataset.d || 's'; s.size[id] = SIZES[(SIZES.indexOf(cur) + 1) % SIZES.length]; this._save(); break; }
      case 'placeopen': this._sheet = 'place'; this._plId = id; break;
      case 'placeset': s.place[this._plId] = t.dataset.p; this._save(); this._sheet = null; break;
      case 'regpick': this._sheet = 'regpick'; break;
      case 'regset': s.place[id] = `area:${this._area}`; this._save(); this._sheet = null; break;
      case 'quick': this._sheet = 'quick'; this._q = ''; break;
      case 'qtog': s.quick = s.quick.includes(id) ? s.quick.filter((x) => x !== id) : [...s.quick, id]; this._save(); this._fillList(); return;
      case 'qdel': s.quick = s.quick.filter((x) => x !== id); this._save(); break;
      case 'qrun': {
        if (id === '__alloff') h.callService('light', 'turn_off', { entity_id: 'all' });
        else { const d = dom(id); if (d === 'button' || d === 'input_button') h.callService(d, 'press', { entity_id: id }); else h.callService(d, 'turn_on', { entity_id: id }); }
        t.classList.add('ok'); setTimeout(() => t.classList.remove('ok'), 1200); return;
      }
      case 'ign': if (!s.ignore.includes(id)) s.ignore.push(id); this._bd = null; this._save(); break;
      case 'ignclear': s.ignore = []; this._bd = null; this._save(); break;
      case 'battmore': this._battMore = !this._battMore; break;
      case 'bl': { const Lm = [10, 15, 20, 30]; s.battLimit = Lm[(Lm.indexOf(s.battLimit) + 1) % Lm.length]; this._bd = null; this._save(); break; }
      case 'cc': if (s.devices.some((x) => x.id === id)) { this._sheet = 'dv'; this._dvId = id; } else { this._sheet = 'cc'; this._ccId = id; } break;
      case 'cckind': { const cu = s.custom.find((x) => x.id === this._ccId); if (cu) { cu.kind = t.dataset.k; this._save(); } break; }
      case 'cchrs': { const cu = s.custom.find((x) => x.id === this._ccId); if (cu) { cu.hours = Number(t.dataset.k); this._save(); } break; }
      case 'ccdel': { const cid = this._ccId; s.custom = s.custom.filter((x) => x.id !== cid); delete s.size[cid]; delete s.place[cid]; s.hidden = s.hidden.filter((x) => x !== cid); this._save(); this._sheet = null; break; }
      case 'flt': this._flt = t.dataset.k; this._render(); return;
      case 'onlyact': this._only = !this._only; this._render(); return;
      case 'pick': {
        if (this._cust) {
          const st = h.states[id]; const d = dom(id); const num = st && !isNaN(parseFloat(st.state));
          const cid = `cu${Date.now().toString(36)}`;
          s.custom.push({ id: cid, entity: id, kind: ['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'cover'].includes(d) ? 'toggle' : num ? 'spark' : 'value', hours: 24, title: '' });
          if (this._view === 'more') s.place[cid] = 'more';
          this._sheet = 'cc'; this._ccId = cid; this._cust = false; this._save(); break;
        }
        if (!s.pinned.some((p) => p.entity === id)) s.pinned.push({ entity: id, only: this._only });
        this._save(); this._sheet = null; this._only = false; break;
      }
      case 'ponly': { const q = s.pinned.find((x) => x.entity === id); if (q) q.only = !q.only; this._save(); break; }
      case 'unpin': s.pinned = s.pinned.filter((p) => p.entity !== id); this._save(); break;
      case 'edit': this._edit = !this._edit; break;
      case 'publish': this._publish(); return;
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

registerCard({ id: 'appliances', label: 'Haushaltsgeräte', icon: 'mdi:washing-machine', items: (c) => {
  const { items, add } = newItems();
    c._appls().forEach((a) => add(`appl:${a.base}`, c._applCard(a)));
  return items;
} });
registerCard({ id: 'pkg', label: 'Pakete', icon: 'mdi:package-variant-closed', items: (c) => {
  const { items, add } = newItems();
    const pk = c._pkgs(); if (pk) add('pkg', c._pkgPanel(pk), true);
  return items;
} });
registerCard({ id: 'energy', label: 'Energie', icon: 'mdi:lightning-bolt', fixed: true, items: (c) => {
  const { items, add } = newItems();
    add('energy', c._energy(), true);
  return items;
} });
registerCard({ id: 'meter', label: 'Netzbezug', icon: 'mdi:meter-electric', items: (c) => {
  const { items, add } = newItems();
    const m = c._xs('meter'); if (m) add('stat:meter', c._stat('mdi:meter-electric', 'Netzbezug aktuell', c._de(parseFloat(m.state)), 'W', m.entity_id));
  return items;
} });
registerCard({ id: 'gas', label: 'Gaszähler', icon: 'mdi:meter-gas', items: (c) => {
  const { items, add } = newItems();
    const gas = c._xs('gas'); if (gas) add('stat:gas', c._stat('mdi:meter-gas', 'Gaszähler', c._de(parseFloat(gas.state), 1), 'm³', gas.entity_id));
  return items;
} });
registerCard({ id: 'water', label: 'Wasserzähler', icon: 'mdi:water', items: (c) => {
  const { items, add } = newItems();
    const wat = c._xs('water'); if (wat) add('stat:water', c._stat('mdi:water', 'Wasserzähler', c._de(parseFloat(wat.state), 1), 'm³', wat.entity_id));
  return items;
} });
registerCard({ id: 'saving', label: 'PV-Ersparnis', icon: 'mdi:piggy-bank-outline', items: (c) => {
  const { items, add } = newItems();
    const sv = c._xs('saving_total'); if (sv) add('stat:sav', c._stat('mdi:piggy-bank-outline', 'PV-Ersparnis gesamt', c._de(parseFloat(sv.state), 0), '€', sv.entity_id));
  return items;
} });
registerCard({ id: 'saving_year', label: 'Ersparnis pro Jahr', icon: 'mdi:cash-refund', items: (c) => {
  const { items, add } = newItems();
    const sy = c._xs('saving_year'); if (sy) add('stat:savy', c._stat('mdi:cash-refund', 'Ersparnis pro Jahr', c._de(parseFloat(sy.state), 0), '€', sy.entity_id));
  return items;
} });
registerCard({ id: 'printer', label: '3D-Drucker', icon: 'mdi:printer-3d-nozzle', items: (c) => {
  const html = c._printerHtml();
  return html ? [{ id: 'printer', html, size: 'f' }] : [];
} });
registerCard({ id: 'pool', label: 'Pool', icon: 'mdi:pool', items: (c) => {
  const html = c._poolHtml();
  return html ? [{ id: 'pool', html, size: 'f' }] : [];
} });
registerCard({ id: 'wx', label: 'Wetter', icon: 'mdi:weather-partly-cloudy', items: (c) => {
  const { items, add } = newItems();
    const wx = (c._byDomain().weather || [])[0];
    if (wx) {
      const a = wx.attributes;
      add('wx', c._stat(WX[wx.state] || 'mdi:weather-cloudy', `${WXL[wx.state] || wx.state}${typeof a.humidity === 'number' ? ` · ${Math.round(a.humidity)} % Feuchte` : ''}${typeof a.wind_speed === 'number' ? ` · ${Math.round(a.wind_speed)} km/h` : ''}`, typeof a.temperature === 'number' ? c._de(a.temperature, 1) : '–', '°C', wx.entity_id));
    }
  return items;
} });
registerCard({ id: 'tank', label: 'Tankzeit', icon: 'mdi:gas-station', items: (c) => {
  const { items, add } = newItems();
    const tk = c._xs('tank'); if (tk) add('tank', c._stat('mdi:gas-station', `Tankzeit${tk.attributes.stunde ? ` · ${tk.attributes.stunde} Uhr` : ''}`, c._de(parseFloat(tk.state), 3), '', tk.entity_id));
  return items;
} });
registerCard({ id: 'health', label: 'HA-Health', icon: 'mdi:heart-pulse', items: (c) => {
  const { items, add } = newItems();
    const hs = c._xs('health');
    if (hs) {
      const v = parseFloat(hs.state); const at = hs.attributes;
      add('health', c._panel('mdi:heart-pulse', 'HA-Health', `Hardware ${at.hardware_score ?? '–'} · Anwendungen ${at.application_score ?? '–'}${at.zombie_count ? ` · ${at.zombie_count} Zombie-Entitäten` : ''}`, `${Math.round(v)}`, `<div class="bar ${v >= 80 ? 'b' : ''}"><i style="width:${Math.min(100, v)}%"></i></div>`, hs.entity_id));
    }
  return items;
} });
registerCard({ id: 'pihole', label: 'Pi-hole', icon: 'mdi:shield-check-outline', items: (c) => {
  const h = c._hass; const { items, add } = newItems();
    const ph = c._xs('pihole_ratio');
    if (ph) {
      const sw = h.states[c._xid('pihole_switch')]; const q = c._num(c._xid('pihole_queries')); const cl = c._num(c._xid('pihole_clients'));
      add('pihole', c._panel('mdi:shield-check-outline', 'Pi-hole', `${q !== null ? `${c._de(q)} Abfragen` : ''}${cl !== null ? ` · ${c._de(cl)} Clients` : ''}`, `${c._de(parseFloat(ph.state), 1)} %`,
        sw ? `<div class="pills"><button class="pill ${sw.state === 'on' ? 'sel' : ''}" data-act="toggle" data-id="${sw.entity_id}">Filter ${sw.state === 'on' ? 'an' : 'aus'}</button></div>` : '', ph.entity_id));
    }
  return items;
} });
registerCard({ id: 'lage', label: 'Lage Deutschland', icon: 'mdi:alert-circle-outline', items: (c) => {
  const { items, add } = newItems();
    const lg = c._xs('lage');
    if (lg) {
      const an = lg.attributes.analysis_summary; const hl = an && typeof an === 'object' ? an.headline : '';
      add('lage', c._panel('mdi:alert-circle-outline', 'Lage Deutschland', hl || 'Lagebild', `${Math.round(parseFloat(lg.state))}`, '', lg.entity_id));
    }
  return items;
} });
registerCard({ id: 'quick', label: 'Schnellaktionen', icon: 'mdi:flash', home: true, size: 'f', items: (c) => {
  const q = c._set.quick.filter((id) => id === '__alloff' || c._hass.states[id]);
  if (!q.length && !c._edit) return [];
  return [{ id: 'quick', html: c._quickHtml(q), size: 'f' }];
} });
registerCard({ id: 'batt', label: 'Batterien', icon: 'mdi:battery-alert-variant-outline', home: true, size: 'w', items: (c) => {
  const l = c._batteries();
  if (!l.length && !(c._edit && c._set.ignore.length)) return [];
  return [{ id: 'batt', html: c._battHtml(l), size: 'w' }];
} });
registerCard({ id: 'offline', label: 'Geräte offline', icon: 'mdi:lan-disconnect', home: true, size: 'w', items: (c) => {
  const l = c._offline();
  return l.length ? [{ id: 'offline', html: c._offHtml(l), size: 'w' }] : [];
} });
registerCard({ id: 'espark', label: 'Energie-Verlauf', icon: 'mdi:chart-areaspline', size: 'f', items: (c) => {
  const rows = [['PV-Erzeugung', c._xs('e_pv'), 'a'], ['Hausverbrauch', c._xs('e_consumption'), '']].filter((r) => r[1]);
  if (!rows.length) return [];
  const body = rows.map(([l, st, cl]) => `<div class="rw" data-act="info" data-id="${st.entity_id}"><div class="rl"><span>${l}</span><span>${c._w(parseFloat(st.state) || 0)}</span></div>${c._spark(c._hist(st.entity_id, 24), 56, cl)}</div>`).join('');
  return [{ id: 'espark', html: `<div class="en nopt"><div class="hd"><div class="ib"><ha-icon icon="mdi:chart-areaspline"></ha-icon></div><div><b>Energie-Verlauf</b><span>letzte 24 Stunden</span></div></div>${body}</div>`, size: 'f' }];
} });
registerCard({ id: 'custom', label: 'Eigene Karten', icon: 'mdi:card-text-outline', home: true, size: 's', items: (c) => c._set.custom.map((cu) => {
  const st = c._hass.states[cu.entity];
  if (!st) return c._edit ? { id: cu.id, html: c._customMissing(cu), cfg: true } : null;
  return { id: cu.id, html: c._customHtml(cu, st), size: cu.kind === 'spark' ? 'w' : 's', cfg: true };
}).filter(Boolean) });

/* ---------- Gerätekarten-Vorlagen ----------
   Eine Vorlage beschreibt Felder (dom, dc, unit, re, not) und wie die Karte gezeichnet wird. Gesucht wird erst am selben
   Gerät der Haupt-Entität, dann bei Entitäten mit gleichem Namensanfang, nur mit `wide` auch im ganzen System.
   Manuelle Wahl (Zahnrad) überschreibt jedes Feld. Auch von außen erweiterbar: window.LumoraDevices.register({...}). */
const DEVTPL = {};
const registerDevice = (t) => { DEVTPL[t.type] = t; };
const NOENERGY = /grid|netz|export|import|feed|einsp|bezug|load|verbrauch|consum|batter/;
registerDevice({
  type: 'vacuum', label: 'Staubsauger', icon: 'mdi:robot-vacuum', desc: 'Start, Station, Saugstufe, Wartung und Fehler', size: 'w',
  main: { dom: 'vacuum' },
  fields: {
    battery: { l: 'Akku', dom: 'sensor', dc: 'battery' },
    error: { l: 'Fehler', dom: 'sensor', re: /error|fehler|stoerung/ },
    area: { l: 'Gereinigte Fläche', dom: 'sensor', unit: ['m²', 'm2'], re: /clean|reinig|area|flache/ },
    time: { l: 'Reinigungsdauer', dom: 'sensor', dc: 'duration', re: /clean|reinig|dauer|duration/, not: /filter|brush|burste|left|remaining|verbleib|rest/ },
    filter: { l: 'Filter', dom: 'sensor', re: /filter/, not: /reset|dirty|schmutz/ },
    mainbrush: { l: 'Hauptbürste', dom: 'sensor', re: /main.?brush|haupt.?burste/, not: /reset/ },
    sidebrush: { l: 'Seitenbürste', dom: 'sensor', re: /side.?brush|seiten.?burste/, not: /reset/ },
    map: { l: 'Karte', dom: ['image', 'camera'], re: /map|karte/ },
  },
  render: (c, iv, F, st) => {
    const a = st.attributes; const run = st.state === 'cleaning'; const id = iv.main;
    const bs = c._dvS(F.battery); const bat = bs ? parseFloat(bs.state) : typeof a.battery_level === 'number' ? a.battery_level : null;
    const txt = (VAC[st.state] || st.state) + (bat !== null && !isNaN(bat) ? ` · ${Math.round(bat)} %` : '');
    const es = c._dvS(F.error); const bad = es && !/^(none|no_?error|ok|0|-|kein.*|no .*)$/.test(norm(es.state).trim());
    const err = bad || st.state === 'error' ? `<div class="dverr"><ha-icon icon="mdi:alert-circle"></ha-icon><div>${esc(bad ? c._state(es) : 'Fehler')}</div></div>` : '';
    const fans = Array.isArray(a.fan_speed_list) ? a.fan_speed_list : [];
    const fan = fans.length ? `<div class="dvf">${fans.map((f) => `<button class="pill ${a.fan_speed === f ? 'sel' : ''}" data-act="vfan" data-id="${id}" data-v="${esc(f)}">${esc(f)}</button>`).join('')}</div>` : '';
    const stat = (l, s2, d) => dvStat(c, l, s2, d);
    const ar = c._dvS(F.area); const tm = c._dvS(F.time); const mp = F.map && c._hass.states[F.map];
    const stats = [stat('Fläche', ar, 1), stat('Dauer', tm, 0), mp ? `<div data-act="info" data-id="${mp.entity_id}"><small>Karte</small><b>Öffnen</b></div>` : ''].join('');
    const mt = [['Filter', 'filter'], ['Hauptbürste', 'mainbrush'], ['Seitenbürste', 'sidebrush']].map(([l, k]) => {
      const s2 = c._dvS(F[k]); if (!s2) return '';
      const v = parseFloat(s2.state); const pc = s2.attributes.unit_of_measurement === '%' && !isNaN(v);
      return `<div data-act="info" data-id="${s2.entity_id}"><b>${l}</b><span>${c._dvVal(s2, 0)}</span>${pc ? `<i class="${v < 15 ? 'lo' : ''}"><u style="width:${Math.max(0, Math.min(100, v))}%"></u></i>` : ''}</div>`;
    }).join('');
    return `<div class="dvc ${run ? 'run' : ''}"><div class="dvh" data-act="info" data-id="${id}"><div class="ib"><ha-icon icon="mdi:robot-vacuum"></ha-icon></div><div class="tt"><b>${esc(iv.title || a.friendly_name || id)}</b><span>${esc(txt)}</span></div></div>${err}
      <div class="dvb"><button class="sq" data-act="vstart" data-id="${id}" aria-label="${run ? 'Pausieren' : 'Starten'}"><ha-icon icon="${run ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button><button class="sq" data-act="vdock" data-id="${id}" aria-label="Zur Station"><ha-icon icon="mdi:home-import-outline"></ha-icon></button><button class="sq" data-act="vlocate" data-id="${id}" aria-label="Finden"><ha-icon icon="mdi:map-marker-radius-outline"></ha-icon></button></div>
      ${fan}${stats ? `<div class="dvs">${stats}</div>` : ''}${mt ? `<div class="dvm">${mt}</div>` : ''}</div>`;
  },
});
registerDevice({
  type: 'pv', label: 'PV-Anlage', icon: 'mdi:solar-power-variant', desc: 'Leistung, Ertrag heute und gesamt, Strings, Prognose', size: 'w',
  main: { dom: 'sensor', dc: 'power', unit: ['W', 'kW'], prefer: new RegExp(`${PV}|inverter|wechselrichter|pv`) },
  fields: {
    today: { l: 'Ertrag heute', dom: 'sensor', dc: 'energy', re: /today|heute|daily|tages|day/, not: NOENERGY, wide: new RegExp(PV) },
    total: { l: 'Ertrag gesamt', dom: 'sensor', dc: 'energy', re: /total|gesamt|lifetime|cumul|insgesamt/, not: NOENERGY, wide: new RegExp(PV) },
    string1: { l: 'String 1', dom: 'sensor', dc: 'power', re: /(string|mppt|pv)_?1(?![0-9])/ },
    string2: { l: 'String 2', dom: 'sensor', dc: 'power', re: /(string|mppt|pv)_?2(?![0-9])/ },
    temp: { l: 'Temperatur Wechselrichter', dom: 'sensor', dc: 'temperature', re: /inverter|wechselrichter|temp|internal/ },
    status: { l: 'Status', dom: 'sensor', re: /status|state|betriebs|operating|work_?mode|zustand/, not: /battery|batter|charge|laden/ },
    forecast: { l: 'Prognose heute', dom: 'sensor', dc: 'energy', re: /(forecast|prognose|production|erzeugung).*(today|heute)|(today|heute).*(forecast|prognose)/, wide: /forecast|prognose|solar|energy_production_(today|heute)/ },
  },
  render: (c, iv, F, st) => {
    const w = c._dvPow(st); const id = iv.main;
    const stt = c._dvS(F.status); const sub = stt ? c._state(stt) : (w !== null && w > 5 ? 'Erzeugt Strom' : 'Keine Erzeugung');
    const stat = (l, s2, d) => dvStat(c, l, s2, d);
    const stats = [stat('Heute', c._dvS(F.today), 1), stat('Gesamt', c._dvS(F.total), 0), stat('Prognose', c._dvS(F.forecast), 1), stat('Wechselrichter', c._dvS(F.temp), 0)].join('');
    const strs = ['string1', 'string2'].map((k) => { const s2 = c._dvS(F[k]); const p = s2 ? c._dvPow(s2) : null; return p === null ? '' : `<div data-act="info" data-id="${s2.entity_id}"><b>${esc(DEVTPL.pv.fields[k].l)}</b><span>${c._w(p)}</span></div>`; }).join('');
    return `<div class="dvc"><div class="dvh" data-act="info" data-id="${id}"><div class="ib"><ha-icon icon="mdi:solar-power-variant"></ha-icon></div><div class="tt"><b>${esc(iv.title || st.attributes.friendly_name || id)}</b><span>${esc(sub)}</span></div><div class="big">${w === null ? '–' : esc(c._w(w))}</div></div>
      ${c._spark(c._hist(id, 24), 56, 'a')}${stats ? `<div class="dvs">${stats}</div>` : ''}${strs ? `<div class="dvm">${strs}</div>` : ''}</div>`;
  },
});
/* Proxmox: Entitäten der Integration proxmoxve (deutsche und englische Namen). Pro Gerät (Node, LXC, VM) werden sie am selben Gerät gesucht. */
const MAXS = 'maximal|maximum|max_|_max(?:[^a-z]|$)';
const MEMS = '(?:^|[^a-z])ram(?:[^a-z]|$)|arbeitsspeicher|memory';
const DSKS = 'massenspeicher|disk|storage';
const pxMax = (w) => new RegExp(`(?=.*(?:${w}))(?=.*(?:${MAXS}))`);
const PXF = {
  state: { l: 'Status', dom: 'sensor', dc: 'enum', re: /status|state|zustand/, not: /backup/ },
  cpu: { l: 'CPU-Auslastung', dom: 'sensor', unit: ['%'], re: /cpu/, not: new RegExp(MAXS) },
  cpumax: { l: 'CPU-Kerne', dom: 'sensor', re: pxMax('cpu') },
  ram: { l: 'RAM belegt', dom: 'sensor', dc: 'data_size', re: new RegExp(MEMS), not: new RegExp(MAXS) },
  ramp: { l: 'RAM in Prozent', dom: 'sensor', unit: ['%'], re: new RegExp(MEMS) },
  rammax: { l: 'RAM gesamt', dom: 'sensor', dc: 'data_size', re: pxMax(MEMS) },
  disk: { l: 'Speicher belegt', dom: 'sensor', dc: 'data_size', re: new RegExp(DSKS), not: new RegExp(`${MAXS}|${MEMS}`) },
  diskmax: { l: 'Speicher gesamt', dom: 'sensor', dc: 'data_size', re: pxMax(DSKS) },
  uptime: { l: 'Betriebszeit', dom: 'sensor', re: /betriebszeit|uptime/ },
  netin: { l: 'Netzwerk ein', dom: 'sensor', dc: 'data_size', re: /netzwerk.?eingang|network.?in(?:[^a-z]|$)|net.?in(?:[^a-z]|$)/ },
  netout: { l: 'Netzwerk aus', dom: 'sensor', dc: 'data_size', re: /netzwerk.?ausgang|network.?out|net.?out/ },
  backup: { l: 'Backup-Problem (Node)', dom: 'binary_sensor', re: /backup/ },
  lastbackup: { l: 'Letztes Backup (Node)', dom: 'sensor', re: /letztes.?backup|last.?backup/ },
  backupdur: { l: 'Backup-Dauer (Node)', dom: 'sensor', re: /backup.?dauer|backup.?duration/ },
};
const PX_KIND = { node: { l: 'Node', icon: 'mdi:server' }, lxc: { l: 'LXC', icon: 'mdi:cube-outline' }, vm: { l: 'VM', icon: 'mdi:monitor' } };
const PX_ST = { running: 'Läuft', stopped: 'Gestoppt', suspended: 'Pausiert', online: 'Online', offline: 'Offline', unknown: 'Unbekannt' };
const pxKind = (model, F) => (F.backup || F.lastbackup || /node|host/i.test(model || '') ? 'node' : /container|lxc/i.test(model || '') ? 'lxc' : 'vm');
registerDevice({
  type: 'proxmox', label: 'Proxmox (Node, LXC, VM)', icon: 'mdi:server', desc: 'Status, CPU, RAM, Speicher, Laufzeit, Netzwerk und Backup', size: 'w',
  main: { dom: 'binary_sensor', dc: 'running', platform: 'proxmoxve', prefer: /proxmox|pve|lxc/ },
  fields: PXF,
  render: (c, iv, F, st) => {
    const id = iv.main; const r0 = c._hass.entities && c._hass.entities[id]; const dd = r0 && r0.device_id && c._hass.devices && c._hass.devices[r0.device_id];
    const kind = pxKind(dd && dd.model, F); const K = PX_KIND[kind]; const S = c._pxState({ ...F, running: id });
    const name = iv.title || (dd && (dd.name_by_user || dd.name)) || st.attributes.friendly_name || id;
    const up = c._dvS(F.uptime); const upMs = up ? Date.now() - new Date(up.state).getTime() : NaN;
    const sub = [K.l, S.txt, S.on && !isNaN(upMs) ? `seit ${c._pxDur(upMs)}` : ''].filter(Boolean).join(' · ');
    const cpu = c._num(F.cpu); const cores = c._num(F.cpumax);
    const bar = (l, p, txt, eid) => (p === null ? '' : `<div data-act="info" data-id="${eid}"><b>${l}</b><span>${txt}</span><i class="${p >= 90 ? 'lo' : ''}"><u style="width:${Math.max(1, Math.min(100, p))}%"></u></i></div>`);
    const use = (k, kmax, kp, eid, l) => {
      const o = c._pxUse(F, k, kmax, kp); if (o.p === null) return '';
      const txt = o.u !== null && o.m ? `${c._de(o.u, 1)} von ${c._de(o.m, 1)} ${esc(o.unit)} · ${c._de(o.p)} %` : `${c._de(o.p)} %`;
      return bar(l, o.p, txt, eid);
    };
    const bars = S.on ? [
      cpu === null ? '' : bar('CPU', cpu, `${c._de(cpu, cpu < 10 ? 1 : 0)} %${cores ? ` · ${c._de(cores)} Kerne` : ''}`, F.cpu),
      use('ram', 'rammax', 'ramp', F.ram || F.ramp, 'Arbeitsspeicher'),
      use('disk', 'diskmax', null, F.disk, 'Speicher'),
    ].join('') : '';
    const stat = (l, s2, d) => dvStat(c, l, s2, d);
    const lb = c._dvS(F.lastbackup); const bd = c._dvS(F.backupdur);
    const stats = [
      S.on ? stat('Netzwerk ein', c._dvS(F.netin), 1) : '', S.on ? stat('Netzwerk aus', c._dvS(F.netout), 1) : '',
      lb ? `<div data-act="info" data-id="${lb.entity_id}"><small>Letztes Backup</small><b>${esc(c._pxAgo(lb.state))}</b></div>` : '',
      bd ? `<div data-act="info" data-id="${bd.entity_id}"><small>Backup-Dauer</small><b>${esc(c._state(bd))}</b></div>` : '',
    ].join('');
    const bp = F.backup && c._hass.states[F.backup];
    const err = bp && bp.state === 'on' ? '<div class="dverr"><ha-icon icon="mdi:alert-circle"></ha-icon><div>Backup-Problem</div></div>' : '';
    return `<div class="dvc ${S.on ? 'run' : 'pxoff'}"><div class="dvh" data-act="info" data-id="${id}"><div class="ib"><ha-icon icon="${K.icon}"></ha-icon></div><div class="tt"><b>${esc(name)}</b><span>${esc(sub)}</span></div>${S.on && cpu !== null ? `<div class="big">${c._de(cpu, cpu < 10 ? 1 : 0)} %</div>` : ''}</div>${err}
      ${S.on && F.cpu ? c._spark(c._hist(F.cpu, 24), 40, 'a') : ''}${bars ? `<div class="dvm">${bars}</div>` : ''}${stats ? `<div class="dvs">${stats}</div>` : ''}</div>`;
  },
});
registerCard({ id: 'proxmox', label: 'Proxmox', icon: 'mdi:server', size: 'w', items: (c) => {
  const l = c._pxDevices();
  return l.length ? [{ id: 'proxmox', html: c._pxHtml(l), size: 'w' }] : [];
} });
registerCard({ id: 'batt_all', label: 'Batterien Übersicht', icon: 'mdi:battery-heart-variant', size: 'w', items: (c) => {
  const l = c._batteries(true);
  return l.length ? [{ id: 'batt_all', html: c._battAllHtml(l), size: 'w' }] : [];
} });
registerCard({ id: 'dev', label: 'Gerätekarten', icon: 'mdi:view-grid-plus-outline', home: true, size: 'w', items: (c) => c._dvAll().map((iv) => {
  const tp = DEVTPL[iv.type]; const st = c._hass.states[iv.main];
  if (!st) return c._edit ? { id: iv.id, html: `<div class="dvc"><div class="dvh"><div class="ib"><ha-icon icon="${tp.icon}"></ha-icon></div><div class="tt"><b>${esc(iv.title || tp.label)}</b><span>${esc(iv.main)} nicht gefunden</span></div></div></div>`, size: tp.size, cfg: true } : null;
  return { id: iv.id, html: tp.render(c, iv, c._dvMap(iv), st), size: tp.size, cfg: true };
}).filter(Boolean) });

window.LumoraCards = { register: registerCard, list: () => REG.map((x) => ({ id: x.id, label: x.label })) };
window.LumoraDevices = { register: registerDevice, list: () => Object.values(DEVTPL).map((x) => ({ type: x.type, label: x.label })) };

if (!customElements.get('lumora-card')) customElements.define('lumora-card', LumoraCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'lumora-card', name: 'Lumora', description: `Startseite, Räume und Kameras (v${VERSION})` });
