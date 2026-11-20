import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const L = load();

test('Karte wird registriert', () => {
  assert.ok(L.card);
  assert.equal(L.win.customCards[0].type, 'lumora-card');
});

test('Entwicklungsstand trägt eine erkennbare Version (Release-Action ersetzt sie)', () => {
  assert.match(L.VERSION, /^\d+\.\d+\.\d+(-dev)?$/);
});

test('cleanName: Doppelungen und Suffixe', () => {
  assert.equal(L.cleanName('Küche Bewegung'), 'Küche');
  assert.equal(L.cleanName('C200C minorStream'), 'C200C minorStream');
  assert.equal(L.cleanName('C720 Haustür C720 Haustür Latest Thumbnail'), 'C720 Haustür · Letztes Ereignis');
  assert.equal(L.cleanName('C200C Kinderzimmer C200C Kinderzimmer Latest Object Detector Snapshot'), 'C200C Kinderzimmer · Letzte Erkennung');
  assert.equal(L.cleanName(null), '');
});

test('Tasten haben ein Icon und Stummschalten bekommt die Glocke', () => {
  assert.equal(L.DOM_ICON.button, 'mdi:gesture-tap-button');
  assert.ok(L.NAME_ICON.some(([re, ic]) => re.test('Alarmsystem Alarm stummschalten') && ic === 'mdi:bell-off'));
});

test('setConfig: theme auto folgt prefers-color-scheme', () => {
  const c = Object.create(L.card.prototype);
  c._a = {}; c.style = { setProperty() {} };
  c.setConfig({ theme: 'auto' });
  assert.equal(c.getAttribute('theme'), 'sand');
});

function fake(states, door) {
  const c = Object.create(L.card.prototype);
  c._set = { door: { bell: [], motion: [], cam: '', secs: 30, ...door } };
  Object.keys(states).forEach((k) => { states[k].entity_id = k; });
  c._hass = { states };
  c.shown = [];
  c._doorShow = (id, kind) => c.shown.push([id, kind]);
  c._areaOf = (id) => (states[id] || {}).area;
  return c;
}
const st = (state, extra = {}) => ({ state, last_changed: new Date().toISOString(), attributes: {}, ...extra });

test('Türklingel: erster Stand löst nichts aus, Wechsel auf "on" schon', () => {
  const s = { 'binary_sensor.klingel': st('off') };
  const c = fake(s, { bell: ['binary_sensor.klingel'] });
  c._doorCheck(); assert.deepEqual(c.shown, []);
  s['binary_sensor.klingel'] = st('on'); c._doorCheck();
  assert.deepEqual(c.shown, [['binary_sensor.klingel', 'bell']]);
  s['binary_sensor.klingel'] = st('off'); c._doorCheck();
  assert.equal(c.shown.length, 1);
});

test('Ereignis-Entität: neuer Zeitstempel löst aus, "unavailable" davor nicht', () => {
  const s = { 'event.klingel': st('2026-11-08T10:00:00.000+00:00') };
  const c = fake(s, { bell: ['event.klingel'] });
  c._doorCheck();
  s['event.klingel'] = st('2026-11-08T10:05:00.000+00:00'); c._doorCheck();
  assert.equal(c.shown.length, 1);
  s['event.klingel'] = st('unavailable'); c._doorCheck();
  s['event.klingel'] = st('2026-11-08T10:06:00.000+00:00'); c._doorCheck();
  assert.equal(c.shown.length, 1);
});

test('Alter Zustand (vor über 30 s geändert) löst nicht aus', () => {
  const s = { 'binary_sensor.bew': st('off') };
  const c = fake(s, { motion: ['binary_sensor.bew'] });
  c._doorCheck();
  s['binary_sensor.bew'] = st('on', { last_changed: new Date(Date.now() - 120000).toISOString() }); c._doorCheck();
  assert.deepEqual(c.shown, []);
});

test('Kamera-Wahl: Klingel nimmt Standard-Kamera, Bewegung die Kamera im Raum', () => {
  const s = {
    'camera.tuer': st('idle'), 'camera.kind': st('idle', { area: 'kinderzimmer' }),
    'camera.kind_latest_thumbnail': st('idle', { area: 'kinderzimmer' }),
    'binary_sensor.bew_kind': st('off', { area: 'kinderzimmer' }), 'binary_sensor.klingel': st('off', { area: 'kinderzimmer' }),
  };
  const c = fake(s, { cam: 'camera.tuer' });
  c._doorShow = L.card.prototype._doorShow;
  assert.equal(c._doorCam('binary_sensor.klingel', 'bell'), 'camera.tuer');
  assert.equal(c._doorCam('binary_sensor.bew_kind', 'motion'), 'camera.kind');
  assert.equal(fake({ 'camera.tuer': st('idle') }, {})._doorCam('', 'bell'), '');
});

test('Packstation: Sensoren werden pro Station gefunden und gezeichnet', () => {
  const a = { address: 'Heimsheimer Str. 34, 70499 Stuttgart', source_timestamp: new Date().toISOString() };
  const mk = (k, v, n) => [`sensor.dhl_packstation_aldi_markt_freie_facher_${k}`, st(v, { attributes: { ...a, friendly_name: `DHL Packstation ALDI Markt Freie Fächer ${n}` } })];
  const states = Object.fromEntries([mk('gesamt', '115', 'gesamt'), mk('s', '30', 'S'), mk('m', '66', 'M'), mk('l', '0', 'L'), mk('xl', '1', 'XL')]);
  const c = fake(states, {});
  const l = c._psStations();
  assert.equal(l.length, 1);
  assert.equal(l[0].name, 'ALDI Markt');
  assert.equal(l[0].total, 115);
  const html = c._psHtml(l);
  assert.match(html, /ALDI Markt/);
  assert.match(html, /115 frei/);
  assert.match(html, /class="lo"[^>]*data-id="sensor\.dhl_packstation_aldi_markt_freie_facher_l"/);
  assert.match(html, /class="wn"[^>]*data-id="sensor\.dhl_packstation_aldi_markt_freie_facher_xl"/);
});

test('Packstation: ohne Sensoren oder nur "unavailable" bleibt die Karte leer', () => {
  assert.equal(fake({}, {})._psStations().length, 0);
  const s = { 'sensor.dhl_packstation_x_freie_facher_gesamt': st('unavailable') };
  assert.equal(fake(s, {})._psStations().length, 0);
});

function poolCard(states, dev = {}) {
  Object.keys(states).forEach((k) => { states[k].entity_id = k; });
  const c = Object.create(L.card.prototype);
  c._set = { devices: [{ id: 'dv1', type: 'pool', main: 'sensor.pool_empfehlung', map: {}, title: '', ...dev }], sources: {}, size: {}, hidden: [], place: {}, custom: [], pinned: [], quick: [] };
  c._hass = { states, entities: {}, devices: {} };
  c._cfg = {};
  return c;
}

test('Pool-Gerätekarte: Vorlage ist registriert, Felder werden gefunden und belegen die Pool-Slots', () => {
  assert.ok(L.win.LumoraDevices.list().some((x) => x.type === 'pool'));
  const c = poolCard({
    'sensor.pool_empfehlung': st('ok', { attributes: { temp_ist: 24.5, chlor_ist: 1, ph_ist: 7.2 } }),
    'switch.layzspa_pump': st('on', { attributes: { friendly_name: 'Poolpumpe' } }),
    'switch.layzspa_heat_regulation': st('off', { attributes: { friendly_name: 'Poolheizung' } }),
    'sensor.layzspa_temp_c': st('24.5', { attributes: { friendly_name: 'Pooltemperatur', unit_of_measurement: '°C', device_class: 'temperature' } }),
    'input_boolean.pool_winterschlaf': st('off', { attributes: { friendly_name: 'Pool Winterschlaf' } }),
  });
  const F = c._dvMap(c._set.devices[0]);
  assert.equal(F.pool_pump, 'switch.layzspa_pump');
  assert.equal(F.pool_heat, 'switch.layzspa_heat_regulation');
  assert.equal(F.lz_temp, 'sensor.layzspa_temp_c');
  assert.equal(F.pool_winter, 'input_boolean.pool_winterschlaf');
  c._pdv = { ...F, pool_rec: 'sensor.pool_empfehlung' };
  assert.equal(c._slot('pool_rec'), 'sensor.pool_empfehlung');
  assert.equal(c._slot('pool_pump'), 'switch.layzspa_pump');
});

test('Pool-Gerätekarte: Winterschlaf blendet die Karte aus', () => {
  const c = poolCard({
    'sensor.pool_empfehlung': st('ok', { attributes: {} }),
    'input_boolean.pool_winterschlaf': st('on', { attributes: { friendly_name: 'Pool Winterschlaf' } }),
  });
  c._edit = false;
  c._pdv = { ...c._dvMap(c._set.devices[0]), pool_rec: 'sensor.pool_empfehlung' };
  assert.equal(c._poolHtml('dv1'), '');
});

test('Adventskalender: 24 Türchen, Sperre vor Dezember, Testmodus öffnet alle', () => {
  const c = Object.create(L.card.prototype);
  c._hass = { states: { 'input_text.advent_geoffnet': { state: '1,2' }, 'input_text.advent_gefunden': { state: '1' }, 'input_boolean.advent_testmodus': { state: 'off' } } };
  c._advToday = () => 3;
  assert.deepEqual([...c._advList('input_text.advent_geoffnet')], [1, 2]);
  assert.equal(c._advOk(3), true);
  assert.equal(c._advOk(4), false);
  const html = c._advHtml();
  assert.equal((html.match(/class="advd /g) || []).length, 24);
  assert.match(html, /1 von 24 gefunden/);
  c._hass.states['input_boolean.advent_testmodus'].state = 'on';
  assert.equal(c._advOk(24), true);
  c._hass.states = {};
  assert.equal(c._advHtml(), '');
});

test('Fremdkarten: YAML-Parser liest Maps, Listen, Flow-Syntax, Block-Text und Kommentare', () => {
  const { parseYaml } = load();
  const y = `# Kommentar
type: custom:mushroom-chips-card
alignment: center
chips:
  - type: entity
    entity: light.wohnzimmer   # Licht
    tap_action: { action: toggle }
  - type: template
    content: "Hallo: {{ states('sensor.x') }}"
    icon_color: [255, 0, 'a']
  - weather
template: |
  Zeile 1
    Zeile 2
count: 3
on: true
none:
`;
  assert.deepEqual(JSON.parse(JSON.stringify(parseYaml(y))), {
    type: 'custom:mushroom-chips-card', alignment: 'center',
    chips: [{ type: 'entity', entity: 'light.wohnzimmer', tap_action: { action: 'toggle' } }, { type: 'template', content: "Hallo: {{ states('sensor.x') }}", icon_color: [255, 0, 'a'] }, 'weather'],
    template: 'Zeile 1\n  Zeile 2\n', count: 3, on: true, none: null,
  });
});

test('Fremdkarten: Liste auf gleicher Ebene wie der Schlüssel, JSON und Fehler', () => {
  const { parseYaml, embedConfig } = load();
  assert.deepEqual(JSON.parse(JSON.stringify(parseYaml('entities:\n- sensor.a\n- entity: sensor.b\n  name: B\nx: 1'))), { entities: ['sensor.a', { entity: 'sensor.b', name: 'B' }], x: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(parseYaml('{"type":"entities","entities":["a"]}'))), { type: 'entities', entities: ['a'] });
  assert.ok(embedConfig('type: x\n\tfoo: 1').err.includes('Tabulator'));
  assert.ok(embedConfig('foo: 1').err.includes('type'));
  assert.ok(embedConfig('- a\n- b').err);
  assert.ok(embedConfig('   ').empty);
  assert.equal(embedConfig('type: gauge\nentity: sensor.x').cfg.type, 'gauge');
  assert.throws(() => parseYaml('a: "offen'));
});

test('Fremdkarten: Kachel ist registriert, leere Karte versteckt, Fehler sichtbar', () => {
  const { card } = load();
  const c = Object.create(card.prototype);
  c._edit = false;
  assert.equal(c._embHtml({ id: 'em1', yaml: '' }), '');
  assert.ok(c._embHtml({ id: 'em1', yaml: 'foo: 1' }).includes('YAML fehlerhaft'));
  assert.ok(c._embHtml({ id: 'em1', yaml: 'type: gauge' }).includes('data-emb="em1"'));
});

function kobraCard(states) {
  Object.keys(states).forEach((k) => { states[k].entity_id = k; });
  const c = Object.create(L.card.prototype);
  c._set = { devices: [{ id: 'dv9', type: 'kobrax', main: 'sensor.kobra_x_print_status', map: {}, title: '' }], sources: {}, size: {}, hidden: [], place: {}, custom: [], pinned: [], quick: [] };
  const entities = {}; Object.keys(states).forEach((k) => { entities[k] = { device_id: 'dev1' }; });
  c._hass = { states, entities, devices: { dev1: { name: 'Anycubic Kobra X' } } };
  c._cfg = {};
  return c;
}
const KOBRA = () => ({
  'sensor.kobra_x_print_status': st('printing', { attributes: { friendly_name: 'Print status' } }),
  'sensor.kobra_x_printer_state': st('busy', { attributes: { friendly_name: 'Printer state' } }),
  'sensor.kobra_x_print_task': st('Benchy.gcode', { attributes: { friendly_name: 'Print task' } }),
  'sensor.kobra_x_print_progress': st('77', { attributes: { friendly_name: 'Print progress', unit_of_measurement: '%' } }),
  'sensor.kobra_x_current_layer': st('12', { attributes: { friendly_name: 'Current layer' } }),
  'sensor.kobra_x_total_layers': st('16', { attributes: { friendly_name: 'Total layers' } }),
  'sensor.kobra_x_remaining_print_time': st('95', { attributes: { friendly_name: 'Remaining print time', unit_of_measurement: 'min' } }),
  'sensor.kobra_x_nozzle_temperature': st('221', { attributes: { friendly_name: 'Nozzle temperature', unit_of_measurement: '°C', device_class: 'temperature' } }),
  'sensor.kobra_x_target_nozzle_temperature': st('220', { attributes: { friendly_name: 'Target nozzle temperature', unit_of_measurement: '°C', device_class: 'temperature' } }),
  'sensor.kobra_x_bed_temperature': st('60', { attributes: { friendly_name: 'Bed temperature', unit_of_measurement: '°C', device_class: 'temperature' } }),
  'number.kobra_x_target_nozzle_temperature': st('220', { attributes: { friendly_name: 'Target nozzle temperature', min: 0, max: 300, unit_of_measurement: '°C' } }),
  'number.kobra_x_target_bed_temperature': st('60', { attributes: { friendly_name: 'Target bed temperature', min: 0, max: 120, unit_of_measurement: '°C' } }),
  'sensor.kobra_x_fan_speed': st('100', { attributes: { friendly_name: 'Fan speed', unit_of_measurement: '%' } }),
  'sensor.kobra_x_aux_fan_speed': st('50', { attributes: { friendly_name: 'Aux fan speed', unit_of_measurement: '%' } }),
  'light.kobra_x_camera_light': st('off', { attributes: { friendly_name: 'Camera light' } }),
  'sensor.kobra_x_loaded_slot': st('2', { attributes: { friendly_name: 'Loaded slot' } }),
  'sensor.kobra_x_box_1_slot_1': st('PLA', { attributes: { friendly_name: 'Box 1 slot 1', color_hex: '#ff0000' } }),
  'sensor.kobra_x_box_1_slot_2': st('PETG', { attributes: { friendly_name: 'Box 1 slot 2', color: [0, 128, 255] } }),
});

test('Kobra-X-Gerätekarte: Vorlage ist registriert und findet die Felder der Integration', () => {
  assert.ok(L.win.LumoraDevices.list().some((x) => x.type === 'kobrax'));
  const F = kobraCard(KOBRA())._dvMap({ id: 'dv9', type: 'kobrax', main: 'sensor.kobra_x_print_status', map: {} });
  assert.equal(F.state, 'sensor.kobra_x_printer_state');
  assert.equal(F.progress, 'sensor.kobra_x_print_progress');
  assert.equal(F.left, 'sensor.kobra_x_remaining_print_time');
  assert.equal(F.nozzle, 'sensor.kobra_x_nozzle_temperature');
  assert.equal(F.nozt, 'number.kobra_x_target_nozzle_temperature');
  assert.equal(F.bedt, 'number.kobra_x_target_bed_temperature');
  assert.equal(F.fan, 'sensor.kobra_x_fan_speed');
  assert.equal(F.aux, 'sensor.kobra_x_aux_fan_speed');
  assert.equal(F.b1s2, 'sensor.kobra_x_box_1_slot_2');
  assert.equal(F.light, 'light.kobra_x_camera_light');
});

test('Kobra-X-Gerätekarte: Druck läuft mit Fortschritt, Zieltemperaturen, aktivem Slot und Slot-Farben', () => {
  const c = kobraCard(KOBRA());
  const iv = c._set.devices[0];
  const html = L.DEVTPL.kobrax.render(c, iv, c._dvMap(iv), c._hass.states[iv.main]);
  assert.match(html, /Druckt · noch 1 h 35 min/);
  assert.match(html, /77 %/);
  assert.match(html, /Schicht 12 von 16/);
  assert.match(html, /221 \/ 220 °C/);
  assert.match(html, /class="on"[^>]*data-id="sensor\.kobra_x_box_1_slot_2"/);
  assert.match(html, /background:#ff0000/);
  assert.match(html, /background:rgb\(0,128,255\)/);
  assert.match(html, /data-act="knum"[^>]*data-id="number\.kobra_x_target_nozzle_temperature"/);
});

test('Kobra-X-Gerätekarte: Leerlauf ohne Druckdaten zeigt Bereit statt Fortschritt', () => {
  const s = KOBRA();
  s['sensor.kobra_x_print_status'] = st('unknown'); s['sensor.kobra_x_printer_state'] = st('free', { attributes: { friendly_name: 'Printer state' } });
  const c = kobraCard(s); const iv = c._set.devices[0];
  const html = L.DEVTPL.kobrax.render(c, iv, c._dvMap(iv), c._hass.states[iv.main]);
  assert.match(html, /Bereit/);
  assert.doesNotMatch(html, /Schicht/);
});

test('Kobra-X-Gerätekarte: Ziel-Tasten setzen number.set_value mit Grenzen und Startwert', () => {
  const calls = [];
  const c = kobraCard({ 'number.kobra_x_target_nozzle_temperature': st('0', { attributes: { min: 0, max: 300 } }), 'number.b': st('118', { attributes: { min: 0, max: 120 } }) });
  c._hass.callService = (d, s, data) => calls.push([d, s, data]);
  c._edit = false; c._set.embeds = [];
  const click = (id, ds) => c._click({ target: { closest: () => ({ dataset: { act: 'knum', id, ...ds } }) }, stopPropagation() {} });
  click('number.kobra_x_target_nozzle_temperature', { d: '5', s: '200' });
  click('number.b', { d: '5', s: '60' });
  click('number.b', { v: '0' });
  assert.deepEqual(calls.map((x) => x[2].value), [205, 120, 0]);
  assert.ok(calls.every((x) => x[0] === 'number' && x[1] === 'set_value'));
});

function smartdomeCard(attrs, state = 'idle') {
  const c = Object.create(L.card.prototype);
  c._set = { devices: [{ id: 'dv7', type: 'smartdome', main: 'sensor.bad_status', map: {}, title: '' }], sources: {}, size: {}, hidden: [], place: {}, custom: [], pinned: [], quick: [] };
  const states = { 'sensor.bad_status': st(state, { attributes: { friendly_name: 'Bad – Status', device_class: 'enum', ...attrs } }) };
  states['sensor.bad_status'].entity_id = 'sensor.bad_status';
  c._hass = { states, entities: { 'sensor.bad_status': { platform: 'smartdome_heat_control' } }, devices: {} };
  c._cfg = {};
  return c;
}

test('Smartdome-Gerätekarte: Fensterpause zeigt Status, Pausenzeit, Gas und Verlauf', () => {
  assert.ok(L.win.LumoraDevices.list().some((x) => x.type === 'smartdome'));
  const c = smartdomeCard({
    control_reason: 'window_pause', window_open: true, window_pause_active: true, current_temperature: 20.4, target_temperature: 21,
    window_pause_today_min: 95, gas_saved_today_m3: 0.12, gas_saved_month_m3: 1.5, gas_saved_year_m3: 12.25, gas_saved_total_m3: 12.25,
    window_pause_history: [0, 10, 40, 95],
  });
  const iv = c._set.devices[0];
  assert.deepEqual([...c._dvMains(L.DEVTPL.smartdome).map((x) => x.id)], ['sensor.bad_status']);
  const html = L.DEVTPL.smartdome.render(c, iv, c._dvMap(iv), c._hass.states[iv.main]);
  assert.match(html, /<b>Bad<\/b>/);
  assert.match(html, /Pausiert, Fenster offen/);
  assert.match(html, /Fenster offen, Heizung pausiert/);
  assert.match(html, /1 h 35 min/);
  assert.match(html, /0,12 m³/);
  assert.match(html, /20,4 °/);
  assert.match(html, /class="sdh"/);
});

test('Smartdome-Gerätekarte: ältere Version ohne Statistik zeigt nur Status', () => {
  const c = smartdomeCard({ control_reason: 'heating', current_temperature: 19, target_temperature: 21 }, 'heating');
  const iv = c._set.devices[0];
  const html = L.DEVTPL.smartdome.render(c, iv, c._dvMap(iv), c._hass.states[iv.main]);
  assert.match(html, /Heizt/);
  assert.match(html, /class="dvc run"/);
  assert.doesNotMatch(html, /Pause heute|sdh/);
});

test('Smartdome-Gerätekarte: Thermostat wird gefunden und lässt sich steuern', () => {
  const c = smartdomeCard({ control_reason: 'normal_idle', current_temperature: 21.9, target_temperature: 21 });
  c._hass.states['climate.bad_heizung'] = { entity_id: 'climate.bad_heizung', state: 'heat', attributes: { friendly_name: 'Bad – Heizung', temperature: 21, target_temp_step: 0.5, min_temp: 5, max_temp: 30, current_temperature: 21.9 } };
  c._hass.entities['climate.bad_heizung'] = { platform: 'smartdome_heat_control' };
  const iv = c._set.devices[0];
  const F = c._dvMap(iv);
  assert.equal(c._hass.states['climate.bad_heizung'].entity_id, 'climate.bad_heizung');
  const html = L.DEVTPL.smartdome.render(c, iv, F, c._hass.states[iv.main]);
  assert.match(html, /data-act="sdt" data-id="climate.bad_heizung" data-d="0.5"/);
  assert.match(html, /<b>21 °C<\/b>/);
  assert.doesNotMatch(html, /<small>Soll<\/small>/);
  assert.match(html, /Ausschalten/);
  const off = { ...c._hass.states['climate.bad_heizung'], state: 'off' };
  c._hass.states['climate.bad_heizung'] = off;
  assert.match(L.DEVTPL.smartdome.render(c, iv, F, c._hass.states[iv.main]), /Einschalten/);
});

test('PTZ: nur ONVIF-Kameras, gewählte Kamera mit Rückfall auf die erste', () => {
  const c = Object.create(L.card.prototype);
  const calls = [];
  c._set = { ptz: { cam: 'camera.alt' } };
  c._hass = {
    services: { onvif: { ptz: {} } },
    states: { 'camera.a': { entity_id: 'camera.a', state: 'idle', attributes: { friendly_name: 'C200C minorStream' } }, 'camera.b': { entity_id: 'camera.b', state: 'unavailable', attributes: {} }, 'camera.g': { entity_id: 'camera.g', state: 'idle', attributes: {} } },
    entities: { 'camera.a': { platform: 'onvif' }, 'camera.b': { platform: 'onvif' }, 'camera.g': { platform: 'generic' } },
    callService: (...a) => { calls.push(a); return Promise.resolve(); },
  };
  assert.deepEqual([...c._ptzCams().map((x) => x.entity_id)], ['camera.a']);
  assert.equal(c._ptzCam(), 'camera.a');
  c._ptzMove('LEFT'); c._ptzMove('UP');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['onvif', 'ptz', { move_mode: 'ContinuousMove', distance: 0.3, pan: 'LEFT' }, { entity_id: 'camera.a' }]);
  assert.equal(calls[1][2].tilt, 'UP');
  assert.match(c._ptzHtml(), /data-act="ptz" data-d="DOWN"/);
  c._hass.services = {}; assert.equal(c._ptzHtml(), '');
});

/* ---------- Familienplaner ---------- */
const { FP } = L;
const iso = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
const PERSONS = [{ id: 'papa', name: 'Papa', color: '#2F6FDE', initial: 'P' }, { id: 'mama', name: 'Mama', color: '#E8782B', initial: 'M' }];
function fpCard(events, { now = new Date(), admin = false, ws } = {}) {
  const c = Object.create(L.card.prototype);
  const calls = [];
  c._set = {};
  c._view = 'home';
  c._hass = {
    states: { 'sensor.familienplaner_papa_termine_heute': { entity_id: 'sensor.familienplaner_papa_termine_heute', state: '1', last_updated: 'x', attributes: {} } },
    entities: { 'sensor.familienplaner_papa_termine_heute': { platform: 'familienplaner' } },
    user: { is_admin: admin },
    callWS: (m) => { calls.push(m); return ws ? ws(m) : Promise.resolve({ persons: PERSONS, events }); },
  };
  c._render = () => { c.rendered = (c.rendered || 0) + 1; };
  c.calls = calls;
  return c;
}
const tick = () => new Promise((r) => setTimeout(r, 300));

test('FP.norm: ganztägig bekommt exklusives Ende, Termine ohne Dauer 30 Minuten', () => {
  const a = FP.norm({ all_day: true, start: '2026-11-16', end: '2026-11-17', persons: [] });
  assert.equal(FP.key(a.s), '2026-11-16'); assert.equal(FP.key(a.e), '2026-11-18');
  const b = FP.norm({ all_day: false, start: '2026-11-16T10:00:00+01:00', end: '2026-11-16T10:00:00+01:00', persons: [] });
  assert.equal(b.e - b.s, 30 * 60000);
});

test('FP: Wochenstart, Kalenderwoche und Farben', () => {
  assert.equal(FP.key(FP.monday(new Date(2026, 10, 15))), '2026-11-09'); // Sonntag
  assert.equal(FP.key(FP.monday(new Date(2026, 10, 16))), '2026-11-16'); // Montag
  assert.equal(FP.isoWeek(new Date(2026, 10, 16)), 47);
  assert.equal(FP.color('javascript:x'), '#6B7280');
  assert.equal(FP.rgba('#fff', 0.5), 'rgba(255,255,255,0.5)');
  assert.match(FP.vars('#2F6FDE'), /--c:#2F6FDE;--cb:rgba\(47,111,222,0\.2\)/);
});

test('FP.cmp und FP.on: ganztägig zuerst, Mehrtagestermine zählen an jedem Tag', () => {
  const d = new Date(2026, 10, 16);
  const ev = [FP.norm({ id: 'a', summary: 'B', all_day: false, start: iso(d, 9), end: iso(d, 10), persons: [] }), FP.norm({ id: 'b', summary: 'A', all_day: true, start: '2026-11-16', end: '2026-11-17', persons: [] })];
  assert.deepEqual(ev.slice().sort(FP.cmp).map((e) => e.id), ['b', 'a']);
  assert.equal(FP.on(ev, new Date(2026, 10, 17)).length, 1);
  assert.equal(FP.on(ev, new Date(2026, 10, 18)).length, 0);
});

test('Familienplaner-Karte: Datenabruf einmal, Neuzeichnen aus dem Zwischenspeicher', async () => {
  const d = FP.day(new Date());
  const ev = [{ id: 'e1', summary: 'Kita', location: '', all_day: false, start: iso(d, 23, 0), end: iso(d, 23, 30), persons: ['papa'] }, { id: 'e2', summary: 'Zahnarzt', all_day: true, start: FP.key(d), end: FP.key(d), persons: [] }];
  const c = fpCard(ev);
  assert.equal(c._fpOn(), true);
  assert.equal(c._fpHtml(), ''); // bis zur ersten Antwort bleibt die Karte unsichtbar, kein Flackern
  await tick();
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].type, 'familienplaner/events');
  const h = c._fpHtml(); assert.equal(c.calls.length, 1); // gecacht, kein zweiter Abruf
  assert.match(h, /data-act="fp-open"/); assert.match(h, /Kita/); assert.match(h, /1 Termin nicht zugeordnet/);
  assert.ok(c.rendered >= 1);
  const again = c._fpHtml(); assert.equal(again, h);
  assert.doesNotMatch(h, /<script|onerror/i);
});

test('Familienplaner-Karte: ohne Integration keine Karte, Fehler lässt alte Daten stehen', async () => {
  const off = fpCard([]); off._hass.entities = {}; off._hass.states = {};
  assert.equal(off._fpOn(), false);
  const calls = { n: 0 };
  const c = fpCard([], { ws: () => (calls.n++ === 0 ? Promise.resolve({ persons: PERSONS, events: [] }) : Promise.reject(new Error('not_configured'))) });
  c._fpHtml(); await tick();
  const first = c._fpHtml();
  const n = Object.values(c._fpc)[0]; n.at = 0; // abgelaufen
  c._fpHtml(); await tick();
  assert.equal(c._fpHtml(), first); // Daten bleiben trotz Fehler sichtbar
  assert.equal(n.err, 'not_configured');
});

test('Familienplaner-Detailansicht: Tag, Woche, Zuordnung nur für Admins', async () => {
  const d = FP.day(new Date());
  const ev = [{ id: 'e1', summary: 'Sport <b>', location: 'Halle', all_day: false, start: iso(d, 18), end: iso(d, 19), persons: ['mama'] }, { id: 'e2', summary: 'Elternabend', all_day: false, start: iso(d, 23, 30), end: iso(d, 23, 59), persons: [] }];
  const c = fpCard(ev, { admin: true });
  c._fpClick({ dataset: {} }, 'fp-open'); assert.equal(c._sheet, 'fp');
  c._fpSheet(); await tick();
  let h = c._fpSheet();
  assert.match(h, /Sport &lt;b&gt;/); assert.match(h, /Halle/); assert.match(h, /data-act="fp-assign" data-e="e2" data-p="papa"/);
  c._hass.user.is_admin = false;
  assert.doesNotMatch(c._fpSheet(), /fp-assign/);
  c._fpClick({ dataset: { v: 'week' } }, 'fp-view'); c._fpSheet(); await tick();
  h = c._fpSheet(); assert.match(h, /KW \d+/); assert.match(h, /data-act="fp-goto"/);
  const week = c.calls.at(-1); assert.equal(new Date(week.end) - new Date(week.start) > 6 * 86400000, true);
  c._fpClick({ dataset: {} }, 'fp-next'); assert.equal(FP.monday(c._fpD).getTime() > FP.monday(new Date()).getTime() - 1, true);
});

test('Familienplaner: Zuordnen legt eine Regel an und lädt danach neu', async () => {
  const d = FP.day(new Date());
  const ev = [{ id: 'e2', summary: 'Elternabend', all_day: false, start: iso(d, 23), end: iso(d, 23, 30), persons: [] }];
  const c = fpCard(ev, { admin: true });
  c._fpClick({ dataset: {} }, 'fp-open'); c._fpSheet(); await tick(); c._fpSheet();
  c._fpAssign('e2', 'papa'); await tick();
  const rule = c.calls.find((m) => m.type === 'familienplaner/add_rule');
  assert.deepEqual({ ...rule, persons: [...rule.persons] }, { type: 'familienplaner/add_rule', field: 'summary', operator: 'equals', pattern: 'Elternabend', persons: ['papa'] });
});

/* ---------- Anycubic Cloud & LAN (Nino6689/hass-anycubic): Entitäten wie in einer echten deutschen Installation ---------- */
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const AP = 'keller_ug_anycubic_kobra_x_';
const ACY = (over = {}) => {
  const s = {
    [`sensor.${AP}druckstatus`]: ['printing', { friendly_name: 'Anycubic Kobra X Druckstatus' }, 'job_state'],
    [`sensor.${AP}aktueller_status`]: ['busy', { friendly_name: 'Anycubic Kobra X Aktueller Status' }, 'current_status'],
    [`binary_sensor.${AP}drucker_online`]: ['on', { friendly_name: 'Anycubic Kobra X Drucker online' }, 'printer_online'],
    [`binary_sensor.${AP}druck_fehlgeschlagen`]: ['off', { friendly_name: 'Anycubic Kobra X Druck fehlgeschlagen' }, 'job_failed'],
    [`binary_sensor.${AP}filament_reicht_nicht_fur_auftrag`]: ['off', { friendly_name: 'Anycubic Kobra X Filament reicht nicht für Auftrag' }, 'job_filament_insufficient'],
    [`sensor.${AP}druckauftrag`]: ['1117-1319-Kobra X_plate(01)_PETG_0.2_2h9m42s', { friendly_name: 'Anycubic Kobra X Druckauftrag' }, 'job_name'],
    [`sensor.${AP}druckfortschritt`]: ['32', { friendly_name: 'Anycubic Kobra X Druckfortschritt %', unit_of_measurement: '%' }, 'job_progress'],
    [`sensor.${AP}restzeit`]: ['78', { friendly_name: 'Anycubic Kobra X Restzeit', unit_of_measurement: 'min', device_class: 'duration' }, 'job_time_remaining'],
    [`sensor.${AP}verstrichene_zeit`]: ['38', { friendly_name: 'Anycubic Kobra X Verstrichene Zeit', unit_of_measurement: 'min', device_class: 'duration' }, 'job_time_elapsed'],
    [`sensor.${AP}voraussichtliches_ende`]: [new Date(Date.now() + 78 * 60000).toISOString(), { friendly_name: 'Anycubic Kobra X Voraussichtliches Ende', device_class: 'timestamp' }, 'job_eta'],
    [`sensor.${AP}aktuelle_schicht`]: ['38', { friendly_name: 'Anycubic Kobra X Aktuelle Schicht' }, 'job_current_layer'],
    [`sensor.${AP}schichten_gesamt`]: ['214', { friendly_name: 'Anycubic Kobra X Schichten gesamt' }, 'job_total_layers'],
    [`sensor.${AP}verbrauchtes_filament`]: ['5876', { friendly_name: 'Anycubic Kobra X Verbrauchtes Filament', unit_of_measurement: 'mm' }, 'job_filament_used'],
    [`sensor.${AP}dusentemperatur`]: ['230.0', { friendly_name: 'Anycubic Kobra X Düsentemperatur', unit_of_measurement: '°C', device_class: 'temperature' }, 'curr_nozzle_temp'],
    [`sensor.${AP}betttemperatur`]: ['75.0', { friendly_name: 'Anycubic Kobra X Betttemperatur', unit_of_measurement: '°C', device_class: 'temperature' }, 'curr_hotbed_temp'],
    [`sensor.${AP}solltemperatur_duse`]: ['230.0', { friendly_name: 'Anycubic Kobra X Solltemperatur Düse', unit_of_measurement: '°C', device_class: 'temperature' }, 'target_nozzle_temp'],
    [`number.${AP}dusentemperatur_einstellen`]: ['230.0', { friendly_name: 'Anycubic Kobra X Düsentemperatur einstellen', min: 0, max: 320, step: 1, unit_of_measurement: '°C' }, 'set_target_nozzle_temp'],
    [`number.${AP}betttemperatur_einstellen`]: ['75.0', { friendly_name: 'Anycubic Kobra X Betttemperatur einstellen', min: 0, max: 120, step: 1, unit_of_measurement: '°C' }, 'set_target_hotbed_temp'],
    [`number.${AP}luftergeschwindigkeit_einstellen`]: ['29.0', { friendly_name: 'Anycubic Kobra X Lüftergeschwindigkeit einstellen', min: 0, max: 100, step: 1, unit_of_measurement: '%' }, 'set_fan_speed_pct'],
    [`number.${AP}hilfslufter_einstellen`]: ['100.0', { friendly_name: 'Anycubic Kobra X Hilfslüfter einstellen', min: 0, max: 100, step: 1, unit_of_measurement: '%' }, 'set_aux_fan_speed_pct'],
    [`select.${AP}druckgeschwindigkeitsmodus`]: ['Sport', { friendly_name: 'Anycubic Kobra X Druckgeschwindigkeitsmodus', options: ['Silent', 'Standard', 'Sport'] }, 'set_speed_mode'],
    [`select.${AP}schrittweite_achsen`]: ['1 mm', { friendly_name: 'Anycubic Kobra X Schrittweite Achsen', options: ['1 mm', '15 mm', '50 mm'] }, 'axis_step'],
    [`light.${AP}druckerbeleuchtung`]: ['off', { friendly_name: 'Anycubic Kobra X Druckerbeleuchtung' }, 'printer_light'],
    [`button.${AP}druck_pausieren`]: ['unknown', { friendly_name: 'Anycubic Kobra X Druck pausieren' }, 'pause_print'],
    [`button.${AP}druck_fortsetzen`]: ['unknown', { friendly_name: 'Anycubic Kobra X Druck fortsetzen' }, 'resume_print'],
    [`button.${AP}druck_abbrechen`]: ['unknown', { friendly_name: 'Anycubic Kobra X Druck abbrechen' }, 'cancel_print'],
    [`button.${AP}alle_achsen_referenzieren`]: ['unknown', { friendly_name: 'Anycubic Kobra X Alle Achsen referenzieren' }, 'axis_home_all'],
    [`button.${AP}x_plus_bewegen`]: ['unknown', { friendly_name: 'Anycubic Kobra X X plus bewegen' }, 'axis_move_x_plus'],
    [`button.${AP}feeder_trocknung_starten`]: ['unknown', { friendly_name: 'Anycubic Kobra X Feeder Trocknung starten' }, 'drying_start'],
    [`button.${AP}feeder_trocknen_stoppen`]: ['unknown', { friendly_name: 'Anycubic Kobra X Feeder Trocknen stoppen' }, 'drying_stop'],
    [`binary_sensor.${AP}feeder_trocknen_aktiv`]: ['off', { friendly_name: 'Anycubic Kobra X Feeder Trocknen aktiv' }, 'dry_status_is_drying'],
    [`number.${AP}feeder_trocknungsdauer`]: ['360.0', { friendly_name: 'Anycubic Kobra X Feeder Trocknungsdauer', min: 1, max: 720, step: 1, unit_of_measurement: 'min' }, 'drying_set_duration'],
    [`number.${AP}feeder_trocknungstemperatur`]: ['65.0', { friendly_name: 'Anycubic Kobra X Feeder Trocknungstemperatur', min: 35, max: 70, step: 1, unit_of_measurement: '°C' }, 'drying_set_temperature'],
    [`sensor.${AP}feeder_geladenes_ace_fach`]: ['1', { friendly_name: 'Anycubic Kobra X Feeder Geladenes ACE-Fach' }, 'ace_loaded_slot'],
    [`sensor.${AP}feeder_ace_fach_1`]: ['PETG', { friendly_name: 'Anycubic Kobra X Feeder ACE-Fach 1', color_hex: '#75787B' }, 'ace_slot_1'],
    [`sensor.${AP}feeder_ace_fach_2`]: ['PLA', { friendly_name: 'Anycubic Kobra X Feeder ACE-Fach 2', color_hex: '#ff0000' }, 'ace_slot_2'],
    [`sensor.${AP}feeder_ace_fach_4`]: ['unavailable', { friendly_name: 'Anycubic Kobra X Feeder ACE-Fach 4' }, 'ace_slot_4'],
    [`sensor.${AP}feeder_ace_fach_1_filament_verbleibend`]: ['64', { friendly_name: 'Anycubic Kobra X Feeder ACE Slot 1 Filament verbleibend %', unit_of_measurement: '%' }, 'ace_slot_1_filament_remaining_percent'],
    [`switch.${AP}ki_fehlererkennung`]: ['off', { friendly_name: 'Anycubic Kobra X KI-Fehlererkennung' }, 'ai_detection_enabled'],
    [`update.keller_ug_anycubic_kobra_x_drucker_firmware`]: ['on', { friendly_name: 'Anycubic Kobra X Drucker-Firmware' }, 'fw_version'],
    [`sensor.${AP}kosten_letzter_auftrag`]: ['1.42', { friendly_name: 'Anycubic Kobra X Kosten letzter Auftrag', unit_of_measurement: 'EUR' }, 'last_job_cost'],
    [`sensor.${AP}dusenverschleiss`]: ['3.0', { friendly_name: 'Anycubic Kobra X Düsenverschleiß', unit_of_measurement: '%' }, 'nozzle_wear_percent'],
    'switch.keller_ug_anycubic': ['on', { friendly_name: 'Anycubic', device_class: 'outlet' }, null],
    'button.keller_ug_anycubic_identifizieren': ['unknown', { friendly_name: 'Anycubic Identifizieren' }, null],
    ...over,
  };
  return s;
};
function acyCard(raw, { tk = true, set = {} } = {}) {
  const states = {}; const entities = {};
  Object.keys(raw).forEach((id) => {
    const [state, attributes, key] = raw[id]; states[id] = { entity_id: id, state, last_changed: new Date().toISOString(), attributes };
    entities[id] = { platform: raw[id][2] === null && id.includes('_kobra_x_') === false ? 'zha' : 'anycubic_cloud', device_id: key === null ? 'plug' : id.includes('feeder') ? 'ace' : 'prn', translation_key: tk ? key || undefined : undefined };
  });
  const c = Object.create(L.card.prototype);
  c._set = { sources: {}, size: { printer: 'f', ...set.size }, hidden: [], place: {}, custom: [], pinned: [], quick: [], devices: [], chips: {} };
  c._hass = { states, entities, devices: { prn: { name: 'Anycubic Kobra X' }, ace: { name: 'ACE', via_device_id: 'prn' }, plug: { name: 'Anycubic' } }, callService(d, s, data) { c.svc.push([d, s, data]); } };
  c._cfg = {}; c.svc = []; c._save = () => {}; c._render = () => {}; c.dispatchEvent = () => {};
  return c;
}

test('Anycubic: Entitäten werden über translation_key gefunden, auch das ACE-Kinder-Gerät', () => {
  const c = acyCard(ACY());
  const A = c._acx();
  assert.equal(A.status, `sensor.${AP}druckstatus`);
  assert.equal(A.progress, `sensor.${AP}druckfortschritt`);
  assert.equal(A.nozt, `number.${AP}dusentemperatur_einstellen`);
  assert.equal(A.nozzle, `sensor.${AP}dusentemperatur`);
  assert.equal(A.speed, `select.${AP}druckgeschwindigkeitsmodus`);
  assert.equal(A.ace1, `sensor.${AP}feeder_ace_fach_1`);
  assert.equal(A.acep1, `sensor.${AP}feeder_ace_fach_1_filament_verbleibend`);
  assert.equal(c._xid('printer_progress'), `sensor.${AP}druckfortschritt`);
  assert.equal(c._xid('printer_nozt'), `number.${AP}dusentemperatur_einstellen`);
  assert.equal(c._xid('printer_plug'), 'switch.keller_ug_anycubic'); // Steckdose, nicht die KI-Erkennung
});

test('Anycubic: ohne translation_key greift die Namens-Zuordnung (deutsch)', () => {
  const A = acyCard(ACY(), { tk: false })._acx();
  assert.equal(A.progress, `sensor.${AP}druckfortschritt`);
  assert.equal(A.nozzle, `sensor.${AP}dusentemperatur`);
  assert.equal(A.nozt, `number.${AP}dusentemperatur_einstellen`);
  assert.equal(A.bedt, `number.${AP}betttemperatur_einstellen`);
  assert.equal(A.fan, `number.${AP}luftergeschwindigkeit_einstellen`);
  assert.equal(A.ace2, `sensor.${AP}feeder_ace_fach_2`);
  assert.equal(A.drystart, `button.${AP}feeder_trocknung_starten`);
  assert.equal(A.pause, `button.${AP}druck_pausieren`);
});

test('Anycubic-Karte: laufender Druck zeigt Auftrag, Fortschritt, Ende, Geschwindigkeit, ACE mit Farbe und Restmenge', () => {
  const c = acyCard(ACY());
  const html = c._printerHtml();
  assert.match(html, /Druckt/); assert.match(html, /32 %/); assert.match(html, /Layer 38 \/ 214/);
  assert.match(html, /1117-1319-Kobra X_plate/); assert.match(html, /noch 1 h 18 min/); assert.match(html, /seit 38 min/);
  assert.match(html, /data-act="pr-btn" data-k="pause"/); assert.match(html, /data-k="stop"/); assert.match(html, /data-k="light"/);
  assert.match(html, /data-act="pr-sel"[^>]*data-v="Standard"/); assert.match(html, />Leise</);
  assert.match(html, /background:#75787B/i); assert.match(html, /~64 %/); assert.match(html, /class="on"[^>]*data-id="sensor\.keller_ug_anycubic_kobra_x_feeder_ace_fach_1"/);
  assert.match(html, /Lüfter/); assert.match(html, /Zusatzlüfter/); assert.match(html, /Update verfügbar/); assert.match(html, /Düsenverschleiß/);
  assert.doesNotMatch(html, /Achsen und Referenzfahrt/); // keine Achsen während des Drucks
  assert.doesNotMatch(html, /Trocknung starten/);
});

test('Anycubic-Karte: Stopp braucht Bestätigung, Pause und Geschwindigkeit rufen die richtigen Dienste auf', () => {
  const c = acyCard(ACY());
  c._printClick({ dataset: { k: 'pause' } }, 'pr-btn');
  same(c.svc.pop(), ['button', 'press', { entity_id: `button.${AP}druck_pausieren` }]);
  c._printClick({ dataset: { k: 'stop' } }, 'pr-btn'); assert.equal(c.svc.length, 0);
  c._printClick({ dataset: { k: 'stop' } }, 'pr-btn');
  same(c.svc.pop(), ['button', 'press', { entity_id: `button.${AP}druck_abbrechen` }]);
  c._printClick({ dataset: { id: `select.${AP}druckgeschwindigkeitsmodus`, v: 'Standard' } }, 'pr-sel');
  same(c.svc.pop(), ['select', 'select_option', { entity_id: `select.${AP}druckgeschwindigkeitsmodus`, option: 'Standard' }]);
  c._printClick({ dataset: { id: `number.${AP}luftergeschwindigkeit_einstellen`, d: '1', st: '0' } }, 'pr-adj');
  same(c.svc.pop(), ['number', 'set_value', { entity_id: `number.${AP}luftergeschwindigkeit_einstellen`, value: 34 }]);
  c._printClick({ dataset: { k: 'light' } }, 'pr-btn');
  same(c.svc.pop(), ['light', 'toggle', { entity_id: `light.${AP}druckerbeleuchtung` }]);
  c._printClick({ dataset: { k: 'home_all' } }, 'pr-btn'); c._printClick({ dataset: { k: 'jx_p' } }, 'pr-btn');
  assert.equal(c.svc.length, 0); // Achsen bewegen sich nicht während eines Drucks
});

test('Anycubic-Karte: im Stillstand Achsen hinter Schalter, Trocknen mit Start, Fehlerbanner bei fehlgeschlagen', () => {
  const c = acyCard(ACY({
    [`sensor.${AP}druckstatus`]: ['free', { friendly_name: 'Anycubic Kobra X Druckstatus' }, 'job_state'],
    [`binary_sensor.${AP}druck_fehlgeschlagen`]: ['on', { friendly_name: 'Anycubic Kobra X Druck fehlgeschlagen' }, 'job_failed'],
    [`select.${AP}druckgeschwindigkeitsmodus`]: ['unavailable', { friendly_name: 'Anycubic Kobra X Druckgeschwindigkeitsmodus' }, 'set_speed_mode'],
  }));
  let html = c._printerHtml();
  assert.match(html, /Bereit/); assert.match(html, /Druck fehlgeschlagen/); assert.match(html, /Achsen und Referenzfahrt/); assert.doesNotMatch(html, /data-k="jx_p"/);
  assert.match(html, /Trocknung starten/); assert.match(html, /6 h/); assert.doesNotMatch(html, /data-act="pr-sel"[^>]*Standard/);
  assert.equal(c._printClick({ dataset: {} }, 'pr-axes'), true);
  html = c._printerHtml();
  assert.match(html, /data-k="jx_p"/); assert.match(html, /Erst referenzieren/); assert.match(html, /data-v="15 mm"/);
  c._printClick({ dataset: { k: 'home_all' } }, 'pr-btn');
  same(c.svc.pop(), ['button', 'press', { entity_id: `button.${AP}alle_achsen_referenzieren` }]);
  c._printClick({ dataset: { k: 'drystart' } }, 'pr-btn');
  same(c.svc.pop(), ['button', 'press', { entity_id: `button.${AP}feeder_trocknung_starten` }]);
});

test('Anycubic-Karte: ausgeschaltete Steckdose und Offline-Zustand', () => {
  let c = acyCard(ACY({ 'switch.keller_ug_anycubic': ['off', { friendly_name: 'Anycubic', device_class: 'outlet' }, null] }));
  assert.match(c._printerHtml(), /Ausgeschaltet/);
  c = acyCard(ACY({ [`binary_sensor.${AP}drucker_online`]: ['off', { friendly_name: 'Anycubic Kobra X Drucker online' }, 'printer_online'] }));
  const h = c._printerHtml(); assert.match(h, /Offline/); assert.doesNotMatch(h, /data-k="pause"/);
});

test('Karten-Liste: Gerätekarten tragen Typ und Gerätename, damit sie unterscheidbar sind', () => {
  const c = kobraCard(KOBRA());
  const it = c._allReg().find((x) => x.id === 'dv9');
  assert.equal(it.name, '3D-Drucker Anycubic Kobra X: Anycubic Kobra X');
});

test('Kobra-X-Gerätekarte findet auch die Entitäten von Anycubic Cloud & LAN (deutsche Namen, ACE als eigenes Gerät)', () => {
  const c = acyCard(ACY()); c._dvP = null; c._dvR = null;
  const iv = { id: 'dvA', type: 'kobrax', main: `sensor.${AP}aktueller_status`, map: {}, title: '' };
  c._set.devices = [iv];
  const F = c._dvMap(iv);
  assert.equal(F.status, `sensor.${AP}druckstatus`);
  assert.equal(F.task, `sensor.${AP}druckauftrag`);
  assert.equal(F.progress, `sensor.${AP}druckfortschritt`);
  assert.equal(F.layer, `sensor.${AP}aktuelle_schicht`); assert.equal(F.layers, `sensor.${AP}schichten_gesamt`);
  assert.equal(F.left, `sensor.${AP}restzeit`); assert.equal(F.ptime, `sensor.${AP}verstrichene_zeit`);
  assert.equal(F.filament, `sensor.${AP}verbrauchtes_filament`);
  assert.equal(F.nozzle, `sensor.${AP}dusentemperatur`); assert.equal(F.bed, `sensor.${AP}betttemperatur`);
  assert.equal(F.nozt, `number.${AP}dusentemperatur_einstellen`); assert.equal(F.bedt, `number.${AP}betttemperatur_einstellen`);
  assert.equal(F.light, `light.${AP}druckerbeleuchtung`);
  assert.equal(F.loaded, `sensor.${AP}feeder_geladenes_ace_fach`);
  assert.equal(F.b1s1, `sensor.${AP}feeder_ace_fach_1`); assert.equal(F.b1s2, `sensor.${AP}feeder_ace_fach_2`);
  assert.equal(c._dvMains(L.DEVTPL.kobrax)[0].id, `sensor.${AP}druckstatus`);
  const html = L.DEVTPL.kobrax.render(c, iv, F, c._hass.states[iv.main]);
  assert.match(html, /Druckt/); assert.match(html, /32 %/); assert.match(html, /background:#75787B/i);
});

/* ---------- Abfall-Karte ---------- */
const day = (y, m, d) => new Date(y, m - 1, d);
const wcEv = (s, y, m, d) => ({ s, d: day(y, m, d).getTime() });

test('Abfall: Art der Abholung wird am Terminnamen erkannt', () => {
  const k = (s) => L.WC.kind(s).k;
  assert.equal(k('Bio'), 'bio'); assert.equal(k('Biotonne'), 'bio');
  assert.equal(k('Restmüll'), 'rest'); assert.equal(k('Altpapier'), 'paper');
  assert.equal(k('Gelber Sack'), 'yellow'); assert.equal(k('Sperrmüll'), 'bulky');
  assert.equal(L.WC.kind('Glas').l, 'Glas');
});

test('Abfall: nächster Termin je Art, vergangene werden übersprungen', () => {
  const ev = [wcEv('Bio', 2026, 11, 17), wcEv('Bio', 2026, 11, 18), wcEv('Bio', 2026, 11, 25), wcEv('Restmüll', 2026, 11, 19), wcEv('Altpapier', 2026, 12, 8)];
  const l = L.WC.next(ev, day(2026, 11, 18));
  assert.deepEqual([...l.map((x) => x.k)], ['bio', 'rest', 'paper']);
  assert.equal(l[0].d, day(2026, 11, 18).getTime());
});

test('Abfall: Kalender-Antworten (WebSocket und REST) werden gelesen', () => {
  const ws = { response: { 'calendar.abfall': { events: [{ start: '2026-11-18', end: '2026-11-19', summary: 'Bio' }] } } };
  assert.deepEqual(JSON.parse(JSON.stringify(L.WC.norm(ws, 'calendar.abfall'))), [wcEv('Bio', 2026, 11, 18)]);
  const rest = [{ summary: 'Restmüll', start: { date: '2026-11-19' }, end: { date: '2026-11-20' } }];
  assert.deepEqual(JSON.parse(JSON.stringify(L.WC.norm(rest, 'calendar.abfall'))), [wcEv('Restmüll', 2026, 11, 19)]);
  assert.equal(L.WC.norm({}, 'calendar.abfall'), null);
});

test('Abfall: Tonnenerkennung (present/missing und Binärsensoren)', () => {
  assert.equal(L.WC.bin('present'), 'in'); assert.equal(L.WC.bin('missing'), 'out');
  assert.equal(L.WC.bin('on'), 'in'); assert.equal(L.WC.bin('off'), 'out'); assert.equal(L.WC.bin('keine Ahnung'), null);
});

test('Abfall: Gerätekarte erkennt Kalender und Tonnensensoren automatisch', () => {
  const T = L.DEVTPL.waste; assert.ok(T);
  const mk = (states) => {
    const c = Object.create(L.card.prototype); Object.keys(states).forEach((k) => { states[k].entity_id = k; });
    c._hass = { states, entities: {} }; c._dvP = null; c._dvR = null; return c;
  };
  const S = (state, fn) => ({ state, attributes: { friendly_name: fn } });
  const c = mk({
    'calendar.abfall_stuttgart': S('on', 'Waste Collection Schedule Abfall Stuttgart'),
    'sensor.mulltonnen_erkennung_mulltonne_braun': S('present', 'Mülltonnen Erkennung Mülltonne Braun'),
    'sensor.mulltonnen_erkennung_mulltonne_grun': S('missing', 'Mülltonnen Erkennung Mülltonne Grün'),
    'sensor.mulltonnen_erkennung_mulltonne_schwarz': S('present', 'Mülltonnen Erkennung Mülltonne Schwarz'),
    'sensor.nachste_biotonne': S('Heute', 'Waste Collection Schedule Nächste Biotonne'),
    'binary_sensor.mulltonnen_erkennung_mulltonnen_szene_gultig': S('on', 'Mülltonnen Erkennung Mülltonnen Szene gültig'),
  });
  assert.equal(c._dvMains(T)[0].id, 'calendar.abfall_stuttgart');
  const iv = { id: 'w1', type: 'waste', main: 'calendar.abfall_stuttgart', map: {}, title: '' };
  const F = c._dvMap(iv);
  assert.equal(F.bin_bio, 'sensor.mulltonnen_erkennung_mulltonne_braun');
  assert.equal(F.bin_paper, 'sensor.mulltonnen_erkennung_mulltonne_grun');
  assert.equal(F.bin_rest, 'sensor.mulltonnen_erkennung_mulltonne_schwarz');
  assert.equal(F.bin_yellow, null);
  iv.map.bin_paper = '-'; c._dvR = null;
  assert.equal(c._dvMap(iv).bin_paper, null);
});

test('Abfall: Karte zeigt nächste Abholung, Tonnenstatus und Erinnerungen', () => {
  const T = L.DEVTPL.waste; const now = new Date(); const t0 = L.WC.day(now);
  const at = (n) => new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + n).getTime();
  const c = Object.create(L.card.prototype);
  const st = (state, fn) => ({ state, entity_id: fn, attributes: { friendly_name: fn } });
  c._hass = { states: {} };
  c._wcc = { 'calendar.a': { at: Date.now(), dk: now.toDateString(), busy: false, h: '', ev: [{ s: 'Bio', d: at(0) }, { s: 'Altpapier', d: at(20) }, { s: 'Restmüll', d: at(1) }] } };
  const html = T.render(c, { id: 'w', main: 'calendar.a', title: '' }, {
    bin_bio: 'sensor.b', bin_paper: 'sensor.g', bin_rest: 'sensor.s', bin_yellow: null,
  }, st('on', 'calendar.a'));
  assert.match(html, /Nächste Abholung/); assert.match(html, /Bioabfall/); assert.match(html, />Heute</);
  assert.equal((html.match(/class="wct"/g) || []).length, 3);
});

test('Abfall: Rausstellen am Abholtag bis mittags und am Vorabend ab 16 Uhr', () => {
  assert.equal(L.WC.due(0, 7), true); assert.equal(L.WC.due(0, 13), false);
  assert.equal(L.WC.due(1, 8), false); assert.equal(L.WC.due(1, 16), true);
  assert.equal(L.WC.due(2, 18), false);
});

test('Design: mergeLook ergänzt fehlende Blöcke und verwirft Ungültiges', () => {
  const d = L.mergeLook({});
  assert.equal(d.blocks.map((b) => b.id).join(), L.BLOCK_DEF.map((b) => b[0]).join());
  assert.equal(d.layout, 'classic');
  assert.equal(d.blocks.find((b) => b.id === 'reg').on, true);
  const m = L.mergeLook({ v: 3, blocks: [{ id: 'greeting', w: 6, on: true }, { id: 'unbekannt', w: 4 }, { id: 'head', w: 99, on: false }], kpis: ['temp', 'quatsch', { k: 'entity', id: 'sensor.x', title: 'X' }], roomMax: 99, evMax: 0 });
  assert.equal(JSON.stringify(m.blocks.slice(0, 2).map((b) => [b.id, b.w, b.on])), JSON.stringify([['greeting', 6, true], ['head', 12, false]]));
  assert.equal(m.blocks.length, L.BLOCK_DEF.length);
  assert.equal(JSON.stringify(m.kpis), JSON.stringify([{ k: 'temp', id: '', title: '' }, { k: 'entity', id: 'sensor.x', title: 'X' }]));
  assert.equal(m.roomMax, 12);
  assert.equal(m.evMax, 3);
});

test('Design: alte Block-Anordnung (vor Version 2) wird auf die neuen Standardwerte gesetzt, Kennzahlen bleiben', () => {
  const m = L.mergeLook({ blocks: [{ id: 'greeting', w: 6, on: true }], kpis: ['hum', 'open'] });
  assert.equal(m.blocks[0].id, 'head');
  assert.equal(m.kpis.map((x) => x.k).join(), 'hum,open');
});

test('Design: Vorlage Salbei schaltet auf Kacheln', () => {
  assert.equal(L.LOOK_PRESETS.sage.layout, 'tiles');
  assert.equal(L.LOOK_PRESETS.sage.theme, 'sage');
  assert.equal(L.LOOK_PRESETS.sand.layout, 'classic');
});

test('Design: eigene Themenwahl hat Vorrang vor der Karten-YAML, Kartenstil folgt dem Thema', () => {
  const c = new L.card();
  c.setConfig({ theme: 'sand' });
  assert.equal(c.getAttribute('theme'), 'sand');
  assert.equal(c.getAttribute('data-cs'), 'flat');
  c._set.look.theme = 'sage'; c._applyLook();
  assert.equal(c.getAttribute('theme'), 'sage');
  assert.equal(c.getAttribute('data-cs'), 'soft');
  c._set.look.cards = 'glass'; c._applyLook();
  assert.equal(c.getAttribute('data-cs'), 'glass');
});

test('Raumsymbole nach Namen', () => {
  assert.equal(L.roomIcon('Wohnzimmer'), 'mdi:sofa-outline');
  assert.equal(L.roomIcon('Büro'), 'mdi:briefcase-outline');
  assert.equal(L.roomIcon('Irgendwas'), 'mdi:door-open');
});

function tilesCard(extra = {}) {
  const c = new L.card(); c.setConfig({});
  const st = (id, state, attributes = {}) => ({ entity_id: id, state, attributes });
  const states = {
    'light.a': st('light.a', 'on', { friendly_name: 'A' }), 'light.b': st('light.b', 'off', { friendly_name: 'B' }),
    'climate.w': st('climate.w', 'heat', { friendly_name: 'Wohnzimmer', current_temperature: 20, temperature: 21.5, hvac_action: 'heating' }),
    'climate.k': st('climate.k', 'heat', { friendly_name: 'Kinderzimmer', current_temperature: 21, temperature: 19.5, hvac_action: 'idle' }),
    'sensor.x': st('sensor.x', '42.5', { friendly_name: 'Wert X', unit_of_measurement: 'kWh' }),
    'weather.h': st('weather.h', 'cloudy', { temperature: 18 }), 'person.s': st('person.s', 'home', { friendly_name: 'S' }), 'calendar.k': st('calendar.k', 'off', { friendly_name: 'Familie' }),
    ...extra,
  };
  const day = new Date(Date.now() + 3600e3).toISOString();
  c._hass = { states, entities: { 'light.a': { area_id: 'wz' }, 'light.b': { area_id: 'wz' }, 'climate.w': { area_id: 'wz' }, 'climate.k': { area_id: 'kz' } }, devices: {}, areas: { wz: { name: 'Wohnzimmer', floor_id: 'eg' }, kz: { name: 'Kinderzimmer', floor_id: 'eg' } }, floors: { eg: { name: 'EG', level: 0 } },
    locale: { language: 'de' }, user: { id: 'u', is_admin: true }, callApi: async () => [],
    callWS: async () => ({ response: { 'calendar.k': { events: [{ start: day, end: day, summary: 'Training' }] } } }) };
  c._loaded = true; c._set.look.layout = 'tiles';
  return c;
}

test('Kachel-Startseite: Blöcke, Kennzahlen, Räume, Termine und Reihenfolge', async () => {
  const c = tilesCard();
  c._home(); await new Promise((r) => setTimeout(r, 30));
  let html = c._home();
  assert.match(html, /class="b w12"><div class="hd2"/);
  assert.match(html, /class="kp lights"[\s\S]*1<small> \/ 2<\/small>/);
  assert.match(html, /class="rm "[\s\S]*Wohnzimmer[\s\S]*>AN</);
  assert.match(html, /Training/);
  assert.match(html, /Alles in Ordnung/);
  /* Block ausblenden und Reihenfolge per Ordnung ändern */
  c._set.look.blocks.find((b) => b.id === 'greeting').on = false;
  c._set.order.lookb = ['kpis', 'head'];
  html = c._home();
  assert.ok(!html.includes('class="gt'));
  assert.ok(html.indexOf('class="kps"') < html.indexOf('class="hd2"'));
  /* Klassisch bleibt unverändert */
  c._set.look.layout = 'classic';
  assert.match(c._home(), /class="hello"/);
});

test('Kachel-Startseite: Heizung automatisch als Durchschnitt, wählbarer Thermostat, eigene Kennzahl', () => {
  const c = tilesCard(); const K = c._set.look.kpis;
  let html = c._home();
  assert.match(html, /class="kp heat"[\s\S]*20,5°[\s\S]*Ø Soll · 1 von 2 heizen/);
  K.find((x) => x.k === 'heat').id = 'climate.k';
  html = c._home();
  assert.match(html, /class="kp heat"[\s\S]*19,5°[\s\S]*Kinderzimmer/);
  K.push({ k: 'entity', id: 'sensor.x', title: '' });
  assert.match(c._home(), /class="kp entity"[\s\S]*Wert X[\s\S]*42,5<small> kWh/);
});

test('Kachel-Startseite: Meldungen-Block nur bei Inhalt, keine doppelten Chips', () => {
  const c = tilesCard();
  let html = c._home();
  assert.ok(!html.includes('class="note'), 'kein "Alles in Ordnung"-Hinweis im Meldungsblock');
  assert.ok(!html.includes('data-act="lights"><ha-icon icon="mdi:lamp"'), 'Lichter-Chip entfällt (Kennzahl zeigt es)');
  assert.ok(!html.includes('Aktiv jetzt'), 'den Bereich Aktiv jetzt gibt es nicht mehr');
});

test('Aktiv jetzt entfällt, Wald entfällt, eigene Chips mit „nur bei aktiv“', () => {
  assert.ok(!L.BLOCK_DEF.some((d) => d[0] === 'active'));
  assert.ok(!L.mergeLook({ v: 3, blocks: [{ id: 'active', w: 12, on: true }] }).blocks.some((b) => b.id === 'active'));
  assert.ok(!L.LOOK_PRESETS.forest);
  const c = new L.card(); c.setConfig({ theme: 'forest' });
  assert.equal(c.getAttribute('theme'), 'sand', 'gespeichertes Wald-Thema fällt auf Sand zurück');
  const c2 = tilesCard();
  const S = (state, fn) => ({ entity_id: '', state, attributes: { friendly_name: fn } });
  c2._hass.states['binary_sensor.waschmaschine'] = { ...S('off', 'Waschmaschine'), entity_id: 'binary_sensor.waschmaschine' };
  c2._hass.states['sensor.aussen'] = { ...S('12', 'Außen'), entity_id: 'sensor.aussen' };
  c2._set.pinned = [{ entity: 'binary_sensor.waschmaschine', only: true }, { entity: 'sensor.aussen', only: false }];
  let chips = c2._pinChips();
  assert.ok(!chips.includes('Waschmaschine'), 'inaktiv + nur bei aktiv: Chip bleibt weg');
  assert.match(chips, /Außen/);
  c2._hass.states['binary_sensor.waschmaschine'].state = 'on';
  assert.match(c2._pinChips(), /Waschmaschine/);
  c2._hass.states['binary_sensor.waschmaschine'].state = 'off'; c2._edit = true;
  assert.match(c2._pinChips(), /class="pill hid"[^>]*binary_sensor\.waschmaschine/);
  c2._sheet = 'chips'; assert.match(c2._sheetHtml(), /Eigene Chips[\s\S]*data-act="ponly"[\s\S]*data-act="chipadd"/);
});

test('Kachel-Startseite: Bearbeiten zeigt Werkzeuge an jedem Block, auch an ausgeblendeten', () => {
  const c = tilesCard(); c._edit = true;
  c._set.look.blocks.find((b) => b.id === 'cams').on = false;
  const html = c._home();
  assert.ok((html.match(/class="mini t" data-act="blkw"/g) || []).length >= L.BLOCK_DEF.length - 1);
  assert.match(html, /data-s="lookb" data-id="head"/);
  assert.match(html, /class="b w12 ed hid"/);
  assert.match(html, /data-act="lkblk" data-id="kpis"/);
  assert.ok(!html.includes('data-act="fx"') && !html.includes('data-act="door"'), 'Effekte und Klingel liegen im Design-Dialog');
  assert.match(c._lookSheet(), /data-act="fx"[\s\S]*data-act="door"/);
  c._edit = false;
  assert.ok(!c._home().includes('data-act="blkw"'));
});

test('Design: Block-Dialoge lassen sich erzeugen', () => {
  const c = tilesCard();
  for (const d of L.BLOCK_DEF) { c._lkb = d[0]; assert.ok(c._blkSheet().includes(d[1]), d[0]); }
  assert.match(c._lookSheet(), /data-s="lookb"/);
});

test('Karten als eigene Blöcke: hinzufügen, platzieren, keine Doppelung, entfernen', () => {
  const c = tilesCard({ 'sensor.pv': { entity_id: 'sensor.pv', state: '1500', attributes: { friendly_name: 'PV Leistung', device_class: 'power', unit_of_measurement: 'W' } }, 'sensor.last': { entity_id: 'sensor.last', state: '700', attributes: { friendly_name: 'Hausverbrauch', device_class: 'power', unit_of_measurement: 'W' } } });
  c._set.custom.push({ id: 'cu1', entity: 'sensor.x', title: 'Mein Wert', kind: 'value' });
  const cat = c._cardCat(); const it = cat.find((x) => x.id === 'cu1'); assert.ok(it, 'eigene Karte im Katalog');
  /* vor dem Hinzufügen: in der Sammel-Gruppe */
  assert.match(c._home(), /class="grid reg"/);
  c._lkAddCard('cu1'); c._lkAddCard('cu1');
  assert.equal(c._set.look.blocks.filter((b) => b.id === 'c:cu1').length, 1, 'nur einmal');
  c._set.order.lookb = ['c:cu1', 'head'];
  const html = c._home();
  assert.ok(html.indexOf('Mein Wert') < html.indexOf('class="hd2"'), 'Karte steht per Ordnung vor der Kopfzeile');
  assert.equal((html.match(/Mein Wert/g) || []).length, 1, 'nicht doppelt in der Sammel-Gruppe');
  /* Bearbeiten: Kreuz zum Entfernen, Hinzufügen-Knopf */
  c._edit = true;
  const ed = c._home();
  assert.match(ed, /data-act="lkcdel" data-id="c:cu1"/);
  assert.match(ed, /data-act="lkcards"/);
  /* Dialoge */
  assert.match(c._cardsSheet(), /Im Layout/);
  assert.match(c._cardsSheet(), /data-act="adddv"[\s\S]*data-act="addemb"[\s\S]*data-act="addcustroom"/);
  c._lkb = 'c:cu1'; assert.match(c._blkSheet(), /Aus dem Layout entfernen/);
  assert.match(c._lookSheet(), /data-act="lkcdel" data-id="c:cu1"/);
  /* Neue Karte aus der Startseite wird automatisch Block */
  c._edit = false; c._view = 'home'; c._placeNew('em99');
  assert.ok(c._set.look.blocks.some((b) => b.id === 'c:em99'));
  /* Block mit fehlender Karte bleibt unsichtbar, im Bearbeiten-Modus mit Hinweis */
  assert.ok(!c._home().includes('Karte nicht verfügbar'));
  c._edit = true; assert.match(c._home(), /Karte nicht verfügbar/);
});

test('Design: mergeLook behält Karten-Blöcke', () => {
  const m = L.mergeLook({ v: 3, blocks: [{ id: 'c:abc', w: 6, on: true }, { id: 'x:foo', w: 4 }] });
  assert.equal(m.blocks[0].id, 'c:abc');
  assert.ok(!m.blocks.some((b) => b.id === 'x:foo'));
});

test('PV-Anlage: Gerätekarte enthält Stromverbrauch und Energie-Verlauf mit automatischer Erkennung', () => {
  const T = L.DEVTPL.pv; assert.ok(T);
  const S = (state, fn, a = {}) => ({ state, attributes: { friendly_name: fn, device_class: 'power', unit_of_measurement: 'W', ...a } });
  const states = {
    'sensor.foxess_pv_power': S('0', 'FoxESS - Modbus (Solarwatt) PV Power'),
    'sensor.hausverbrauch': S('344', 'Hausverbrauch'),
    'sensor.netzbezug': S('22', 'Netzbezug'),
    'sensor.batterie_entladen': S('333', 'Batterie entladen'),
    'sensor.batterie_ladestand': S('33', 'Batterie Ladestand', { device_class: 'battery', unit_of_measurement: '%' }),
    'sensor.pv_prognose_heute_leistung': S('996', 'PV Prognose heute Leistung'),
  };
  Object.keys(states).forEach((k) => { states[k].entity_id = k; });
  const c = Object.create(L.card.prototype);
  c._hass = { states, entities: {}, callWS: () => new Promise(() => {}) }; c._set = { sources: {}, hidden: [], size: {}, place: {}, devices: [] }; c._cfg = {}; c._dvP = null; c._dvR = null; c._hc = {};
  const iv = { id: 'pv1', type: 'pv', main: 'sensor.foxess_pv_power', map: {}, title: '' };
  const F = c._dvMap(iv);
  assert.equal(F.cons, 'sensor.hausverbrauch');
  assert.equal(F.gridin, 'sensor.netzbezug');
  assert.equal(F.batout, 'sensor.batterie_entladen');
  assert.equal(F.soc, 'sensor.batterie_ladestand');
  const html = T.render(c, iv, F, states['sensor.foxess_pv_power']);
  assert.match(html, /Stromverbrauch/); assert.match(html, /344 W/); assert.match(html, /Prognose heute bis 996 W/);
  assert.match(html, /Netz · Bezug/); assert.match(html, /Batterie · entlädt · 33 %/); assert.match(html, /Energie-Verlauf/);
  /* manuell abwählbar */
  iv.map.cons = '-'; c._dvR = null;
  const h2 = T.render(c, iv, c._dvMap(iv), states['sensor.foxess_pv_power']);
  assert.ok(!h2.includes('Energie-Verlauf'));
  /* ohne Energie-Sensoren bleibt die Karte unverändert schlank */
  const c2 = Object.create(L.card.prototype); const only = { 'sensor.foxess_pv_power': states['sensor.foxess_pv_power'] };
  c2._hass = { states: only, entities: {}, callWS: () => new Promise(() => {}) }; c2._set = c._set; c2._cfg = {}; c2._dvP = null; c2._dvR = null; c2._hc = {};
  const h3 = T.render(c2, { id: 'pv2', type: 'pv', main: 'sensor.foxess_pv_power', map: {}, title: '' }, c2._dvMap({ id: 'pv2', type: 'pv', main: 'sensor.foxess_pv_power', map: {}, title: '' }), only['sensor.foxess_pv_power']);
  assert.ok(!h3.includes('Stromverbrauch') && !h3.includes('Energie-Verlauf'));
});

test('Energie: alte Einzelkarten sind entfernt, alte Kachel-Blöcke verschwinden', () => {
  assert.ok(!L.win.LumoraCards.list().some((x) => x.id === 'energy' || x.id === 'espark'));
  const m = L.mergeLook({ v: 3, blocks: [{ id: 'c:energyhome', w: 6, on: true }, { id: 'c:espark', w: 12, on: true }, { id: 'c:abc', w: 6, on: true }] });
  assert.ok(!m.blocks.some((b) => b.id === 'c:energyhome' || b.id === 'c:espark'));
  assert.ok(m.blocks.some((b) => b.id === 'c:abc'));
});

test('Gerätekarten: Packstation und Familienplaner, automatische Sammelkarten entfallen', () => {
  assert.ok(L.DEVTPL.packstation && L.DEVTPL.family);
  const S = (state, fn, a = {}) => ({ state, attributes: { friendly_name: fn, ...a } });
  const states = {
    'sensor.dhl_packstation_stuttgart_freie_facher_gesamt': S('7', 'DHL Packstation Stuttgart Freie Fächer Gesamt', { address: 'Hauptstr. 1' }),
    'sensor.dhl_packstation_stuttgart_freie_facher_s': S('3', 'DHL Packstation Stuttgart Freie Fächer S'),
    'sensor.dhl_packstation_stuttgart_freie_facher_m': S('4', 'DHL Packstation Stuttgart Freie Fächer M'),
    'sensor.dhl_packstation_esslingen_freie_facher_gesamt': S('1', 'DHL Packstation Esslingen Freie Fächer Gesamt'),
    'sensor.familienplaner_heute': S('2', 'Familienplaner Heute'),
    'sensor.temperatur': S('20', 'Temperatur'),
  };
  Object.keys(states).forEach((k) => { states[k].entity_id = k; });
  const c = Object.create(L.card.prototype);
  c._hass = { states, entities: {}, callWS: () => new Promise(() => {}) }; c._cfg = {}; c._dvP = null; c._dvR = null;
  c._set = { sources: {}, hidden: [], size: {}, place: {}, devices: [] };
  assert.deepEqual([...c._dvMains(L.DEVTPL.packstation).map((x) => x.id)].sort(), ['sensor.dhl_packstation_esslingen_freie_facher_gesamt', 'sensor.dhl_packstation_stuttgart_freie_facher_gesamt']);
  assert.deepEqual([...c._dvMains(L.DEVTPL.family).map((x) => x.id)], ['sensor.familienplaner_heute']);
  /* eine Karte je Station */
  const iv = { id: 'ps1', type: 'packstation', main: 'sensor.dhl_packstation_stuttgart_freie_facher_gesamt', map: {}, title: '' };
  const html = L.DEVTPL.packstation.render(c, iv, {}, states[iv.main]);
  assert.match(html, /Stuttgart/); assert.ok(!html.includes('Esslingen'));
  /* mit Gerätekarte entfallen die automatischen Karten */
  c._set.devices = [iv];
  const reg = (id) => c._allReg().filter((x) => x.def.id === id);
  assert.equal(reg('packstation').length, 0);
  c._set.devices = [];
  assert.equal(reg('packstation').length, 1);
});

test('Gerätekarten: Pakete zeigt Sendungen des gewählten Sensors, automatische Karte entfällt', () => {
  assert.ok(L.DEVTPL.pkg);
  const st = { entity_id: 'sensor.paketverfolgung', state: '2', attributes: { friendly_name: 'Paketverfolgung', today_count: 1, dhl: [{ tracking_id: '123', short_status: 'In Zustellung', progress: 4 }], amazon: [{ tracking_id: 'A1', custom_name: 'Kabel', status: 'Unterwegs' }] } };
  const c = Object.create(L.card.prototype);
  c._hass = { states: { [st.entity_id]: st, 'sensor.temperatur': { entity_id: 'sensor.temperatur', state: '20', attributes: {} } }, entities: {}, callWS: () => new Promise(() => {}) };
  c._cfg = {}; c._dvP = null; c._dvR = null; c._set = { sources: {}, hidden: [], size: {}, place: {}, devices: [] };
  assert.deepEqual([...c._dvMains(L.DEVTPL.pkg).map((x) => x.id)], ['sensor.paketverfolgung']);
  const html = L.DEVTPL.pkg.render(c, { id: 'p1', type: 'pkg', main: st.entity_id, map: {}, title: '' }, {}, st);
  assert.match(html, /DHL 123/); assert.match(html, /Kabel/); assert.match(html, /1 heute in Zustellung/);
  c._set.devices = [{ id: 'p1', type: 'pkg', main: st.entity_id, map: {}, title: '' }];
  assert.equal(c._allReg().filter((x) => x.def.id === 'pkg').length, 0);
});

test('Gerätekarten: Pakete mit einstellbarer Anzahl und Tagen für Zugestelltes', () => {
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
  const dhl = [1, 2, 3].map((i) => ({ tracking_id: `T${i}`, short_status: 'In Zustellung' }));
  dhl.push({ tracking_id: 'OLD3', short_status: 'DELIVERED', event_time: day(3) }, { tracking_id: 'OLD10', short_status: 'DELIVERED', event_time: day(10) });
  const st = { entity_id: 'sensor.paketverfolgung', state: '5', attributes: { friendly_name: 'Paketverfolgung', dhl, amazon: [] } };
  const c = Object.create(L.card.prototype);
  c._hass = { states: { [st.entity_id]: st }, entities: {}, callWS: () => new Promise(() => {}) };
  c._cfg = {}; c._dvP = null; c._dvR = null; c._set = { sources: {}, hidden: [], size: {}, place: {}, devices: [] };
  const iv = (opts) => ({ id: 'p1', type: 'pkg', main: st.entity_id, map: {}, title: '', opts });
  const r = (opts) => L.DEVTPL.pkg.render(c, iv(opts), {}, st);
  const rows = (h) => (h.match(/class="pkr"/g) || []).length;
  assert.equal(rows(r()), 4); // Standard 5 Tage: OLD10 entfällt
  assert.equal(rows(r({ days: 30 })), 5);
  assert.equal(rows(r({ days: 1 })), 3);
  const h = r({ count: 2 });
  assert.equal(rows(h), 2); assert.match(h, /\+ 2 weitere/);
});

/* ---------- Mealie Grocy Bridge: drei Gerätekarten ---------- */
function mgCard(type, id, attrs, opts) {
  const states = { [id]: st('3', { entity_id: id, last_updated: 'u1', attributes: { friendly_name: 'Mealie Grocy Bridge', ...attrs } }) };
  const c = Object.create(L.card.prototype);
  c._set = { devices: [{ id: 'dvm', type, main: id, map: {}, title: '', opts }], sources: {}, size: {}, hidden: [], place: {}, custom: [], pinned: [], quick: [], embeds: [] };
  c._hass = { states, entities: { [id]: { platform: 'mealie_grocy_bridge', device_id: 'dm' } }, devices: { dm: { name: 'Mealie Grocy Bridge' } } };
  c._cfg = {}; c._edit = false; c.shadowRoot = { querySelectorAll: () => [], querySelector: () => null };
  c._render = () => {};
  return c;
}
const mgHtml = (c) => { const iv = c._set.devices[0]; return L.DEVTPL[iv.type].render(c, iv, c._dvMap(iv), c._hass.states[iv.main]); };
const RECIPES = [
  { recipeId: 'r-1', recipeName: 'Spaghetti Bolognese', url: 'https://mealie.local/g/home/r/spaghetti', matchScore: 80, hasExpiring: true, matchingIngredients: [{ name: 'nudeln', status: 'normal' }, { name: 'hackfleisch', status: 'expiring' }, { name: 'zwiebel', status: 'expired' }], missingIngredients: ['parmesan'], basicIngredients: ['salz'] },
  { recipeId: 'r-2', recipeName: 'Linsensuppe', matchScore: 35, hasExpiring: false, matchingIngredients: [], missingIngredients: [], basicIngredients: [] },
  { recipeId: 'r-3', recipeName: 'Pfannkuchen', matchScore: 60, matchingIngredients: [], missingIngredients: ['eier'], basicIngredients: [] },
  { recipeId: 'r-4', recipeName: 'Gulasch', matchScore: 50, matchingIngredients: [], missingIngredients: [], basicIngredients: [] },
];

test('Mealie Grocy Bridge: drei Vorlagen sind registriert und finden ihren Sensor über das Attribut', () => {
  const t = L.win.LumoraDevices.list().map((x) => x.type);
  ['mgrecipe', 'mgstock', 'mgreserve'].forEach((x) => assert.ok(t.includes(x), x));
  const c = mgCard('mgrecipe', 'sensor.mealie_grocy_kochvorschlage', { recipes: [] });
  const add = (id, attrs) => { c._hass.states[id] = st('1', { entity_id: id, attributes: attrs }); c._hass.entities[id] = { platform: 'mealie_grocy_bridge' }; };
  add('sensor.mealie_grocy_bestand', { items: [] }); add('sensor.mealie_grocy_vorrat', { stock_items: [] });
  const ids = (type) => c._dvMains(L.DEVTPL[type]).map((x) => x.id);
  const J = (v) => JSON.stringify(v);
  assert.equal(J(ids('mgrecipe')), J(['sensor.mealie_grocy_kochvorschlage']));
  assert.equal(J(ids('mgstock')), J(['sensor.mealie_grocy_bestand']));
  assert.equal(J(ids('mgreserve')), J(['sensor.mealie_grocy_vorrat']));
});

test('Rezeptkarte: Score, Zutaten mit MHD-Farben, Einkauf und Seitenwechsel', () => {
  const c = mgCard('mgrecipe', 'sensor.k', { recipes: RECIPES, mealplan: [], mealplan_range: {} }, { count: 2 });
  let html = mgHtml(c);
  assert.match(html, /4 Vorschläge/); assert.match(html, />80<span class="mgu"> %/);
  assert.match(html, /Spaghetti Bolognese/); assert.match(html, /href="https:\/\/mealie\.local\/g\/home\/r\/spaghetti"/);
  assert.match(html, /class="mgc ex">Zwiebel/); assert.match(html, /class="mgc wn">Hackfleisch/); assert.match(html, /class="mgc mi">Parmesan/);
  assert.match(html, /mdi:fire/); assert.match(html, /Seite 1 von 2/);
  assert.doesNotMatch(html, /Pfannkuchen/);
  c._mgClick({ dataset: { id: 'dvm', d: '1' } }, 'mg-page');
  html = mgHtml(c);
  assert.match(html, /Pfannkuchen/); assert.match(html, /Seite 2 von 2/); assert.doesNotMatch(html, /Spaghetti Bolognese/);
  c._mgClick({ dataset: { id: 'dvm', d: '5' } }, 'mg-page'); assert.match(mgHtml(c), /Seite 2 von 2/);
});

test('Rezeptkarte: Einplanen und Einkaufsliste rufen die Dienste der Integration mit Rezept-ID, Datum und Mahlzeit', async () => {
  const calls = [];
  const c = mgCard('mgrecipe', 'sensor.k', { recipes: RECIPES });
  c._hass.callService = (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); };
  c.shadowRoot = { querySelectorAll: () => [{ dataset: { pk: 'mgd|dvm|r-1' }, value: '2026-11-25' }, { dataset: { pk: 'mgd|dvm|r-3' }, value: '2026-11-26' }] };
  c._mgClick({ dataset: { id: 'dvm', r: 'r-1', n: '0', t: 'lunch' } }, 'mg-type');
  c._mgClick({ dataset: { id: 'dvm', r: 'r-1', n: '0' } }, 'mg-plan');
  c._mgClick({ dataset: { id: 'dvm', r: 'r-3', n: '2' } }, 'mg-plan');
  c._mgClick({ dataset: { id: 'dvm', r: 'r-1', n: '0' } }, 'mg-cart');
  c._mgClick({ dataset: { id: 'dvm', r: '', n: '7' } }, 'mg-cart');
  assert.deepEqual(calls.map((x) => [x[0], x[1]]), [['mealie_grocy_bridge', 'set_to_next_free_day'], ['mealie_grocy_bridge', 'set_to_next_free_day'], ['mealie_grocy_bridge', 'add_missing_ingredients'], ['mealie_grocy_bridge', 'add_missing_ingredients']]);
  const J = (v) => JSON.stringify(v);
  assert.equal(J(calls[0][2]), J({ recipe_id: 'r-1', selected_date: '2026-11-25', entry_type: 'lunch' }));
  assert.equal(J(calls[1][2]), J({ recipe_id: 'r-3', selected_date: '2026-11-26', entry_type: 'dinner' }));
  assert.equal(J(calls[2][2]), J({ recipe_id: 'r-1' }));
  assert.equal(J(calls[3][2]), J({ recipe_index: 7 }));
  c._mgClick({ dataset: { id: 'dvm', r: 'r-1', n: '0' } }, 'mg-cart');
  await new Promise((r) => setTimeout(r, 0));
  assert.match(mgHtml(c), /mgk[^>]*><ha-icon icon="mdi:check-circle"><\/ha-icon>Auf die Einkaufsliste gesetzt/); // Rückmeldung unter dem Rezept
  c._hass.callService = () => Promise.reject(new Error('x'));
  c._mgClick({ dataset: { id: 'dvm', r: 'r-1', n: '0' } }, 'mg-plan');
  await new Promise((r) => setTimeout(r, 0));
  assert.match(mgHtml(c), /mgk bad/);
});

test('Rezeptkarte: im Bearbeiten-Modus passiert beim Tippen nichts, Speiseplan lässt sich abschalten', () => {
  const calls = [];
  const c = mgCard('mgrecipe', 'sensor.k', { recipes: RECIPES, mealplan: [{ date: '2026-11-21', entryType: 'dinner', recipeName: 'Gulasch', totalTime: '1 Std' }], mealplan_range: { start: '2026-11-21', end: '2026-11-28', label: 'Aktuelle Woche' } });
  c._hass.callService = (...a) => calls.push(a); c._edit = true;
  c._click({ target: { closest: () => ({ dataset: { act: 'mg-plan', id: 'dvm', r: 'r-1', n: '0' } }) }, stopPropagation() {} });
  assert.equal(calls.length, 0);
  const html = mgHtml(c);
  assert.match(html, /Aktuelle Woche: 21\.11\.2026 bis 28\.11\.2026/); assert.match(html, /Abendessen/); assert.match(html, /1 Std/);
  c._set.devices[0].opts = { plan: 0 }; assert.doesNotMatch(mgHtml(c), /Speiseplan ·/);
});

const MG_ITEMS = [
  { name: 'Spaghetti', amount: 3, unit: 'Packung', status: 'normal', location: 'Vorratsschrank', product_group: 'Nudeln', best_before_date: '2999-12-31' },
  { name: 'Joghurt', amount: 2, unit: 'Stück', status: 'expiring', location: 'Kühlschrank', best_before_date: '2026-11-22' },
  { name: 'Milch', amount: 1.5, unit: 'l', status: 'expired', location: 'Kühlschrank', best_before_date: '2026-11-10' },
  { name: 'Schraubenzieher', amount: 1, unit: 'Stück', status: 'normal', location: 'Nicht zugeordnet' },
];
const MG_STOCK = { items: MG_ITEMS, product_count: 4, location_count: 3, expiring_count: 1, expired_count: 1 };

test('Bestandskarte: Lagerorte eingeklappt, Antippen klappt auf, MHD und Status werden gezeigt', () => {
  const c = mgCard('mgstock', 'sensor.b', MG_STOCK);
  let html = mgHtml(c);
  assert.match(html, /4 Positionen/); assert.match(html, /Kühlschrank/); assert.match(html, /Vorratsschrank/);
  assert.doesNotMatch(html, /Joghurt/);
  c._mgClick({ dataset: { id: 'dvm', k: 'Kühlschrank' } }, 'mg-loc');
  html = mgHtml(c);
  assert.match(html, /Joghurt/); assert.match(html, /läuft bald ab/); assert.match(html, /MHD 22\.11\.2026/); assert.match(html, /abgelaufen/); assert.match(html, /1,5 l/);
  assert.doesNotMatch(html, /Spaghetti/);
  c._mgClick({ dataset: { id: 'dvm', k: 'Vorratsschrank' } }, 'mg-loc');
  assert.doesNotMatch(mgHtml(c), /MHD 31\.12\.2999/); // „kein MHD“ bleibt unsichtbar
});

test('Bestandskarte: Suche über Name, Lagerort und Status klappt alle Treffer auf; nicht zugeordnet lässt sich ausblenden', () => {
  const c = mgCard('mgstock', 'sensor.b', MG_STOCK);
  mgS_set(c, 'milch');
  let html = mgHtml(c);
  assert.match(html, /Milch/); assert.doesNotMatch(html, /Joghurt/); assert.match(html, />1<\/div>/);
  mgS_set(c, 'abgelaufen'); assert.match(mgHtml(c), /Milch/);
  mgS_set(c, 'kuehlschrank'); mgS_set(c, 'kühlschrank'); assert.match(mgHtml(c), /Joghurt/);
  mgS_set(c, 'zzz'); assert.match(mgHtml(c), /Keine Artikel für „zzz“ gefunden/);
  mgS_set(c, ''); assert.match(mgHtml(c), /Nicht zugeordnet/);
  c._set.devices[0].opts = { empty: 0 }; assert.doesNotMatch(mgHtml(c), /Nicht zugeordnet/);
});
function mgS_set(c, v) { L.mgS(c).q.dvm = v; }

const MG_RESERVE = [
  { name: 'Spaghetti', amount: 4, unit: 'Stück', status: 'normal', product_group: 'Nudeln', calories: 3.5 },
  { name: 'Reis', amount: 2, unit: 'kg', status: 'normal', calories: 3.6 },
  { name: 'Mineralwasser', amount: 12, unit: 'l', status: 'normal' },
  { name: 'Eier', amount: 10, unit: 'Stück', status: 'expired' },
  { name: 'Spülmittel', amount: 2, unit: 'Stück', status: 'normal' },
];

test('Vorratskarte: rechnet wie die Karte der Integration (Gruppen, Packungsgrößen, Kalorien, abgelaufene zählen nicht)', () => {
  const r = L.vrBuild(MG_RESERVE, { adults: 2, children: 0, days: 10, water: 0, kcal: 2200 });
  const g = (id) => r.cats.find((x) => x.id === id);
  assert.equal(Math.round(g('grain').actual), 4000); // 4 x 500 g Nudeln + 2 kg Reis
  assert.equal(Math.round(g('grain').target), 6600);
  assert.equal(Math.round(g('grain').score), 61);
  assert.equal(g('drinks').actual, 12); assert.equal(g('drinks').target, 40);
  assert.equal(g('protein').actual, 0); // abgelaufene Eier zählen nicht
  assert.equal(r.expired, 1); assert.equal(r.zero.length, 5); // Spülmittel zählt nirgends
  assert.equal(Math.round(r.kcal.total), 21); // Menge x kcal je Lagereinheit: 4 x 3,5 + 2 x 3,6
  assert.equal(r.kcal.counted, 2);
});

test('Vorratskarte: Wasser extern, Kinder mit 70 %, Einstellungen mit Grenzen und Zahnrad-Schalter', () => {
  const a = L.vrBuild(MG_RESERVE, { adults: 2, children: 1, days: 10, water: 0, kcal: 2200 });
  const w = L.vrBuild(MG_RESERVE, { adults: 2, children: 1, days: 10, water: 30, kcal: 2200 });
  assert.equal(a.cats.find((x) => x.id === 'grain').target, 330 * 2 * 10 + 330 * 0.7 * 10);
  assert.equal(a.cats.find((x) => x.id === 'drinks').target, 2 * 2 * 10 + 1 * 10);
  assert.equal(w.cats.find((x) => x.id === 'drinks').actual, 42);
  const c = mgCard('mgreserve', 'sensor.v', { stock_items: MG_RESERVE });
  const iv = c._set.devices[0];
  assert.equal(L.dvOpt(iv, 'days'), 10); assert.equal(L.dvOpt(iv, 'adults'), 2); assert.equal(L.dvOpt(iv, 'kcal'), 2200);
  iv.opts = { days: 999, adults: 0, children: 'x' }; assert.equal(L.dvOpt(iv, 'days'), 60); assert.equal(L.dvOpt(iv, 'adults'), 1); assert.equal(L.dvOpt(iv, 'children'), 0);
  iv.opts = {}; c._set.devices[0].opts = undefined; c._dvId = 'dvm'; c._save = () => {};
  const click = (k, d) => c._click({ target: { closest: () => ({ dataset: { act: 'dvopt', k, d } }) }, stopPropagation() {} });
  click('children', '1'); click('children', '1'); click('days', '-1'); click('adults', '-5');
  assert.equal(JSON.stringify(c._set.devices[0].opts), JSON.stringify({ children: 2, days: 9, adults: 1 }));
  assert.match(mgHtml(c), /1 Erwachsener, 2 Kinder, 9 Tage/);
});

test('Vorratskarte: Anzeige mit Reichweite, Gruppen, Warnungen und aufklappbarer Gruppe', () => {
  const c = mgCard('mgreserve', 'sensor.v', { stock_items: MG_RESERVE });
  let html = mgHtml(c);
  assert.match(html, /Notvorrat/); assert.match(html, /2 Erwachsene, 10 Tage/); assert.match(html, /Kein Vorrat erkannt bei: .*Fleisch, Fisch, Eier, Ersatz/);
  assert.match(html, /1 abgelaufene Artikel werden nicht mitgezählt/); assert.match(html, /Gruppen im Ziel/); assert.match(html, /61 %/);
  assert.doesNotMatch(html, /Ist 4,0 kg von 6,6 kg/);
  c._mgClick({ dataset: { id: 'dvm', k: 'grain' } }, 'mg-cat');
  html = mgHtml(c); assert.match(html, /Ist 4,0 kg von 6,6 kg/); assert.match(html, /Reis/);
});

test('Gerätekarten mit Attributdaten zeichnen bei jeder Sensor-Aktualisierung neu (Signatur)', () => {
  ['mgrecipe', 'mgstock', 'mgreserve'].forEach((t) => assert.equal(L.DEVTPL[t].attrSig, true, t));
  assert.ok(!L.DEVTPL.kobrax.attrSig);
});

/* ---------- Angebote (Preisdienst): Gerätekarte ---------- */
const OFFERS = [
  { name: 'zitronen', store: 'Lidl', price: 1.29, valid_until: '2026-11-22', note: '500 g Netz' },
  { name: 'bananen', store: 'Lidl', price: 1.09, regular_price: 1.49, hint: 'günstiger als sonst', on_list: true },
  { name: 'Hähnchenbrust', store: 'Selgros', price: '7,99', regular_price: '9,99', valid_until: '2026-11-25' },
];

test('Angebotskarte: Vorlage ist registriert und findet ihren Sensor über das Attribut offers', () => {
  assert.ok(L.win.LumoraDevices.list().some((x) => x.type === 'offers'));
  const c = mgCard('offers', 'sensor.preisdienst_angebote', { offers: [] });
  c._hass.states['sensor.haus_nur_wenn_im_angebot'] = st('0', { entity_id: 'sensor.haus_nur_wenn_im_angebot', attributes: {} });
  assert.equal(JSON.stringify(c._dvMains(L.DEVTPL.offers).map((x) => x.id)), JSON.stringify(['sensor.preisdienst_angebote']));
});

test('Angebotskarte: Artikel je Markt, Preis, Normalpreis, Ersparnis, Hinweis und Listen-Treffer zuerst', () => {
  const html = mgHtml(mgCard('offers', 'sensor.preisdienst_angebote', { offers: OFFERS }));
  assert.match(html, /3 Angebote/); assert.match(html, /1 von deiner Liste/); assert.match(html, /bis 22\.11\.2026/);
  assert.match(html, /Lidl/); assert.match(html, /Selgros/); assert.match(html, /Zitronen/); assert.match(html, /1,29 €/);
  assert.match(html, /günstiger als sonst/); assert.match(html, /1,49 €/); assert.match(html, /−20 %/);
  assert.ok(html.indexOf('Bananen') < html.indexOf('Zitronen'), 'Treffer der Liste stehen oben');
});

test('Angebotskarte: Anzahl pro Markt begrenzt, ohne Angebote und ohne Daten sinnvolle Texte', () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ name: `Artikel ${i}`, store: 'Lidl', price: 1 + i }));
  assert.match(mgHtml(mgCard('offers', 'sensor.o', { offers: many }, { count: 3 })), /2 weitere in der Preisdienst-App/);
  assert.match(mgHtml(mgCard('offers', 'sensor.o', { offers: [] })), /keine Angebote/);
  assert.match(mgHtml(mgCard('offers', 'sensor.o', {})), /Warte auf Daten/);
});

test('Neuaufbau wartet, solange gescrollt wird (kein Springen der Ansicht)', () => {
  const c = Object.create(L.card.prototype);
  let renders = 0; c._render = () => { renders++; };
  c._scAt = 0; c._renderIdle(); assert.equal(renders, 1);
  c._scAt = Date.now(); c._renderIdle(); assert.equal(renders, 1, 'beim Scrollen verschoben');
  clearTimeout(c._rt);
});

test('Kamera-Popup: Statusanzeige unterscheidet Live, Standbild und ältere Aufnahme', () => {
  const mk = (db, img, states = {}) => {
    const badge = { className: '', textContent: '' };
    const v = { querySelector: (q) => (q === '.dbs' ? badge : q === 'img' ? img : null), appendChild() {} };
    const c = Object.create(L.card.prototype); c._dbEl = { querySelector: () => v }; c._db = db; c._hass = { states };
    c._doorBadge(); return badge;
  };
  assert.equal(mk({ live: true }, null).textContent, 'Live');
  assert.match(mk({ live: false }, { _at: Date.now() }).textContent, /^Standbild/);
  const old = mk({ live: false, altId: 'camera.x' }, { _at: Date.now(), _alt: true }, { 'camera.x': { last_updated: '2026-11-19T06:20:55+00:00', attributes: { updated_at: '2026-11-19T06:20:55+00:00' } } });
  assert.match(old.textContent, /^Ältere Aufnahme/); assert.match(old.className, /old/);
});

test('Startseiten-Kameras: Breite je Kamera (Auto, ¼ bis Voll), ungültige Werte werden ignoriert', () => {
  const c = Object.create(L.card.prototype);
  c._set = { camW: { 'camera.a': 3, 'camera.b': 99 }, hidden: [], homeCams: ['camera.a', 'camera.b'], order: {} };
  c._edit = false;
  assert.equal(c._camW('camera.a'), 3);
  assert.equal(c._camW('camera.b'), 0);
  assert.equal(c._camWL('camera.a'), '¼');
  assert.equal(c._camWL('camera.c'), 'Auto');
  const html = c._camHtml({ entity_id: 'camera.a', attributes: { friendly_name: 'A' } }, 'homecams');
  assert.match(html, /data-w="3"/);
  assert.doesNotMatch(c._camHtml({ entity_id: 'camera.b', attributes: {} }, 'homecams'), /data-w/);
});

/* ---------- Dreo (hass-dreo) ---------- */
function dreoCard(states, main, reg = {}) {
  const c = Object.create(L.card.prototype);
  c._set = { devices: [{ id: 'dvD', type: 'dreo', main, map: {}, title: '' }], sources: {}, size: {}, hidden: [], place: {}, custom: [], pinned: [], quick: [] };
  Object.keys(states).forEach((k) => { states[k].entity_id = k; });
  const entities = { [main]: { platform: 'dreo', device_id: 'dev1' } };
  Object.keys(states).forEach((k) => { if (k !== main) entities[k] = { platform: 'dreo', device_id: 'dev1' }; });
  c._hass = { states, entities: { ...entities, ...reg }, devices: {} };
  c._cfg = {};
  return c;
}
const DREO_HUM = () => ({
  'humidifier.schlafzimmer': st('on', { attributes: { friendly_name: 'Schlafzimmer Befeuchter', humidity: 55, min_humidity: 30, max_humidity: 90, available_modes: ['auto', 'manual', 'sleep'], mode: 'auto' } }),
  'sensor.schlafzimmer_luftfeuchte': st('48', { attributes: { friendly_name: 'Schlafzimmer Luftfeuchte', device_class: 'humidity', unit_of_measurement: '%' } }),
  'sensor.schlafzimmer_temperatur': st('21.5', { attributes: { friendly_name: 'Schlafzimmer Temperatur', device_class: 'temperature', unit_of_measurement: '°C' } }),
  'binary_sensor.schlafzimmer_wasser_leer': st('on', { attributes: { friendly_name: 'Schlafzimmer Wasser leer' } }),
  'switch.schlafzimmer_kindersicherung': st('off', { attributes: { friendly_name: 'Schlafzimmer Kindersicherung' } }),
  'light.schlafzimmer_nachtlicht': st('on', { attributes: { friendly_name: 'Schlafzimmer Nachtlicht' } }),
});

test('Dreo-Gerätekarte: Vorlage ist registriert, Auswahl nur Dreo-Geräte, Felder am selben Gerät gefunden', () => {
  assert.ok(L.win.LumoraDevices.list().some((x) => x.type === 'dreo'));
  const s = DREO_HUM(); s['fan.fremd'] = st('on'); 
  const c = dreoCard(s, 'humidifier.schlafzimmer', { 'fan.fremd': { platform: 'andere' } });
  assert.deepEqual([...c._dvMains(L.DEVTPL.dreo).map((x) => x.id)], ['humidifier.schlafzimmer']);
  const F = c._dvMap(c._set.devices[0]);
  assert.equal(F.hum, 'sensor.schlafzimmer_luftfeuchte');
  assert.equal(F.temp, 'sensor.schlafzimmer_temperatur');
  assert.equal(F.water, 'binary_sensor.schlafzimmer_wasser_leer');
  assert.equal(F.lock, 'switch.schlafzimmer_kindersicherung');
  assert.equal(F.light, 'light.schlafzimmer_nachtlicht');
});

test('Dreo-Gerätekarte: Befeuchter zeigt Feuchte, Zielwert, Modi, Wasserwarnung und Schalter', () => {
  const c = dreoCard(DREO_HUM(), 'humidifier.schlafzimmer'); const iv = c._set.devices[0];
  const html = L.DEVTPL.dreo.render(c, iv, c._dvMap(iv), c._hass.states[iv.main]);
  assert.match(html, /An · Auto/);
  assert.match(html, /48 %/);
  assert.match(html, /data-act="drh" data-id="humidifier.schlafzimmer" data-d="5"/);
  assert.match(html, /<b>55 %<\/b>/);
  assert.match(html, /data-act="drm"[^>]*data-v="sleep"/);
  assert.match(html, /Wassertank leer oder fehlt/);
  assert.match(html, /data-act="toggle" data-id="switch.schlafzimmer_kindersicherung"/);
  assert.match(html, /class="dvc run"/);
});

test('Dreo-Gerätekarte: Klicks rufen die passenden Dienste mit Grenzen auf', () => {
  const calls = [];
  const s = {
    'humidifier.h': st('on', { attributes: { humidity: 88, max_humidity: 90, min_humidity: 30 } }),
    'fan.f': st('on', { attributes: { percentage: 5, oscillating: false } }),
    'climate.k': st('heat', { attributes: {} }),
  };
  const c = dreoCard(s, 'humidifier.h'); c._hass.callService = (d, sv, data) => calls.push([d, sv, data]); c._edit = false;
  const click = (act, id, ds = {}) => c._click({ target: { closest: () => ({ dataset: { act, id, ...ds } }) }, stopPropagation() {} });
  click('drh', 'humidifier.h', { d: '5' });
  click('drm', 'humidifier.h', { v: 'sleep' });
  click('drp', 'fan.f', { d: '-10' });
  click('drp', 'fan.f', { d: '10' });
  click('dro', 'fan.f');
  click('drm', 'fan.f', { v: 'turbo' });
  click('drc', 'climate.k', { v: 'off' });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['humidifier', 'set_humidity', { entity_id: 'humidifier.h', humidity: 90 }],
    ['humidifier', 'set_mode', { entity_id: 'humidifier.h', mode: 'sleep' }],
    ['fan', 'turn_off', { entity_id: 'fan.f' }],
    ['fan', 'set_percentage', { entity_id: 'fan.f', percentage: 15 }],
    ['fan', 'oscillate', { entity_id: 'fan.f', oscillating: true }],
    ['fan', 'set_preset_mode', { entity_id: 'fan.f', preset_mode: 'turbo' }],
    ['climate', 'set_hvac_mode', { entity_id: 'climate.k', hvac_mode: 'off' }],
  ]);
});

test('Dreo-Gerätekarte: Heizung mit Soll-Tasten und Modi, nicht verfügbares Gerät bleibt ruhig', () => {
  const s = { 'climate.heizer': st('heat', { attributes: { friendly_name: 'Heizlüfter', temperature: 22, current_temperature: 19.5, target_temp_step: 1, hvac_modes: ['off', 'heat'], hvac_action: 'heating', preset_modes: ['eco', 'normal'], preset_mode: 'eco' } }) };
  const c = dreoCard(s, 'climate.heizer'); const iv = c._set.devices[0];
  const html = L.DEVTPL.dreo.render(c, iv, c._dvMap(iv), s['climate.heizer']);
  assert.match(html, /19,5 °/);
  assert.match(html, /data-act="sdt" data-id="climate.heizer" data-d="1"/);
  assert.match(html, /data-act="drc"[^>]*data-v="heat"/);
  assert.match(html, /Heizen/);
  s['climate.heizer'] = st('unavailable', { attributes: { friendly_name: 'Heizlüfter' } }); s['climate.heizer'].entity_id = 'climate.heizer';
  const off = L.DEVTPL.dreo.render(c, iv, c._dvMap(iv), s['climate.heizer']);
  assert.match(off, /Nicht verfügbar/);
  assert.doesNotMatch(off, /data-act="drc"/);
});

test('Dreo-Gerätekarte: echte Entitäten des DR-HHM001S werden richtig zugeordnet', () => {
  const P = 'luftbefeuchter_buro';
  const s = {
    [`humidifier.${P}`]: st('on', { attributes: { friendly_name: 'Luftbefeuchter Büro', min_humidity: 30, max_humidity: 90, available_modes: ['normal', 'auto', 'sleep'], current_humidity: 46, humidity: 60, mode: 'sleep' } }),
    [`sensor.${P}_luftfeuchtigkeit`]: st('46', { attributes: { friendly_name: 'Luftbefeuchter Büro Luftfeuchtigkeit', device_class: 'humidity', unit_of_measurement: '%' } }),
    [`sensor.${P}_filter_aktiv`]: st('inactive', { attributes: { friendly_name: 'Luftbefeuchter Büro Filter aktiv', device_class: 'enum' } }),
    [`sensor.${P}_filterlebensdauer`]: st('100', { attributes: { friendly_name: 'Luftbefeuchter Büro Filterlebensdauer', unit_of_measurement: '%' } }),
    [`sensor.${P}_nutzung_seit_reinigung`]: st('0', { attributes: { friendly_name: 'Luftbefeuchter Büro Nutzung seit Reinigung', device_class: 'duration', unit_of_measurement: 'h' } }),
    [`sensor.${P}_ziel_luftfeuchtigkeit_erreicht`]: st('yes', { attributes: { friendly_name: 'Luftbefeuchter Büro Ziel-Luftfeuchtigkeit erreicht', device_class: 'enum' } }),
    [`binary_sensor.${P}_wasserstand`]: st('off', { attributes: { friendly_name: 'Luftbefeuchter Büro Wasserstand', device_class: 'problem' } }),
    [`number.${P}_nebelstufe`]: st('4', { attributes: { friendly_name: 'Luftbefeuchter Büro Nebelstufe', min: 0, max: 6 } }),
    [`number.${P}_ziel_luftfeuchtigkeit_schlafmodus`]: st('70', { attributes: { friendly_name: 'Luftbefeuchter Büro Ziel-Luftfeuchtigkeit (Schlafmodus)', min: 30, max: 90 } }),
    [`number.${P}_umgebungslicht_feuchtigkeitsschwelle_niedrig`]: st('30', { attributes: { friendly_name: 'Luftbefeuchter Büro Umgebungslicht Feuchtigkeitsschwelle niedrig' } }),
    [`switch.${P}_bedienfeld_ton`]: st('off', { attributes: { friendly_name: 'Luftbefeuchter Büro Bedienfeld-Ton' } }),
    [`switch.${P}_display_beleuchtung`]: st('on', { attributes: { friendly_name: 'Luftbefeuchter Büro Display-Beleuchtung' } }),
    [`switch.${P}_zeitplan`]: st('off', { attributes: { friendly_name: 'Luftbefeuchter Büro Zeitplan' } }),
    [`light.${P}_umgebungslicht`]: st('off', { attributes: { friendly_name: 'Luftbefeuchter Büro Umgebungslicht' } }),
  };
  const c = dreoCard(s, `humidifier.${P}`); const iv = c._set.devices[0]; const F = c._dvMap(iv);
  assert.equal(F.filter, `sensor.${P}_filterlebensdauer`);
  assert.equal(F.clean, `sensor.${P}_nutzung_seit_reinigung`);
  assert.equal(F.water, `binary_sensor.${P}_wasserstand`);
  assert.equal(F.fog, `number.${P}_nebelstufe`);
  assert.equal(F.sleeptgt, `number.${P}_ziel_luftfeuchtigkeit_schlafmodus`);
  assert.equal(F.display, `switch.${P}_display_beleuchtung`);
  assert.equal(F.mute, `switch.${P}_bedienfeld_ton`);
  assert.equal(F.sched, `switch.${P}_zeitplan`);
  assert.equal(F.light, `light.${P}_umgebungslicht`);
  assert.equal(F.lock, null);
  const html = L.DEVTPL.dreo.render(c, iv, F, s[`humidifier.${P}`]);
  assert.match(html, /An · Schlaf · Zielfeuchte erreicht/);
  assert.match(html, /Ziel Schlafmodus/);
  assert.match(html, /Seit Reinigung/);
  assert.doesNotMatch(html, /Wassertank leer/);
  assert.doesNotMatch(html, /Schlafmodus<\/span><div>.*Umgebungslicht/);
});

/* ---------- Raumklima (Integration room_climate) ---------- */
function rcCard(states, main, view = {}) {
  const c = Object.create(L.card.prototype);
  c._set = { devices: [{ id: 'dvR', type: 'roomclimate', main, map: {}, title: '' }], sources: {}, size: {}, hidden: [], place: {}, custom: [], pinned: [], quick: [] };
  Object.keys(states).forEach((k) => { states[k].entity_id = k; });
  c._hass = { states, entities: {}, devices: {}, areas: {} };
  c._cfg = {}; Object.assign(c, view);
  return c;
}
const RC_STATES = () => ({
  'sensor.room_climate_kuche_score': st('87', { attributes: { friendly_name: 'Room Climate Küche Score', room_name: 'Küche', level: 'Angenehm', level_class: 'good', humidex_felt: 'comfortable', description: 'Küche: angenehmes Raumklima.', temperature: 22.26, humidity: 45.45, outside_temperature: 9.5, wall_surface_humidity: 57.6, mold_risk: 'low', ventilate_now: true, close_window: false, climate_entity: 'climate.room_climate_kuche' } }),
  'sensor.room_climate_kuche_recommendation': st('good', { attributes: { recommendation: 'Frischluft: Fenster ist offen | Abkühlung: nicht nötig' } }),
  'climate.room_climate_kuche': st('heat', { attributes: { temperature: 21, current_temperature: 21.3, hvac_action: 'idle', target_temp_step: 0.5 } }),
  'sensor.room_climate_buro_score': st('90', { attributes: { friendly_name: 'Room Climate Büro Score', humidex_felt: 'comfortable', level: 'Ideal' } }),
  'sensor.room_climate_buro_recommendation': st('excellent', { attributes: {} }),
  'sensor.anderer_sensor': st('5', { attributes: {} }),
});
test('Raumklima-Gerätekarte: Vorlage registriert, Auswahl nur Score-Sensoren, Felder aus dem Raumnamen abgeleitet', () => {
  assert.ok(L.win.LumoraDevices.list().some((x) => x.type === 'roomclimate'));
  const c = rcCard(RC_STATES(), 'sensor.room_climate_kuche_score');
  assert.deepEqual([...c._dvMains(L.DEVTPL.roomclimate).map((x) => x.id)].sort(), ['sensor.room_climate_buro_score', 'sensor.room_climate_kuche_score']);
  const F = c._dvMap(c._set.devices[0]);
  assert.equal(F.reco, 'sensor.room_climate_kuche_recommendation');
  assert.equal(F.climate, 'climate.room_climate_kuche');
});
test('Raumklima-Gerätekarte: im Raum steht der Score-Sensor dieses Raums oben', () => {
  const c = rcCard(RC_STATES(), 'sensor.room_climate_kuche_score', { _view: 'rooms', _area: 'buro' });
  c._areaOf = (id) => (id.includes('buro') ? 'buro' : 'kuche');
  assert.equal(c._dvMains(L.DEVTPL.roomclimate)[0].id, 'sensor.room_climate_buro_score');
});
test('Raumklima-Gerätekarte: zeigt Bewertung, Messwerte, Hinweise und Thermostat; Empfehlungstexte nur per Option', () => {
  const c = rcCard(RC_STATES(), 'sensor.room_climate_kuche_score'); const iv = c._set.devices[0];
  let html = L.DEVTPL.roomclimate.render(c, iv, c._dvMap(iv), c._hass.states[iv.main]);
  assert.match(html, /Küche · Angenehm/);
  assert.match(html, /angenehmes Raumklima/);
  assert.match(html, /22,3 °C/);
  assert.match(html, /45 %/);
  assert.match(html, /Jetzt lüften/);
  assert.match(html, /data-act="sdt" data-id="climate.room_climate_kuche" data-d="0.5"/);
  assert.match(html, /class="dvc run"/);
  assert.doesNotMatch(html, /class="rcr"/);
  iv.opts = { reco: 1, stats: 0, hints: 0, climate: 0 };
  html = L.DEVTPL.roomclimate.render(c, iv, c._dvMap(iv), c._hass.states[iv.main]);
  assert.match(html, /class="rcr"/);
  assert.match(html, /<b>Frischluft<\/b> Fenster ist offen/);
  assert.doesNotMatch(html, /Jetzt lüften|class="dvs"|data-act="sdt"/);
});
test('Raumklima-Gerätekarte: Schimmelrisiko hoch und Fenster schließen als Warnung', () => {
  const s = RC_STATES(); Object.assign(s['sensor.room_climate_kuche_score'].attributes, { mold_risk: 'high', close_window: true, close_window_reason: 'Außenluft zu feucht' });
  s['sensor.room_climate_kuche_recommendation'].state = 'bad';
  const c = rcCard(s, 'sensor.room_climate_kuche_score'); const iv = c._set.devices[0];
  const html = L.DEVTPL.roomclimate.render(c, iv, c._dvMap(iv), s['sensor.room_climate_kuche_score']);
  assert.match(html, /Schimmelrisiko hoch/);
  assert.match(html, /Fenster schließen: Außenluft zu feucht/);
  assert.doesNotMatch(html, /class="dvc run"/);
});
