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
  const ev = [{ id: 'e1', summary: 'Sport <b>', location: 'Halle', all_day: false, start: iso(d, 18), end: iso(d, 19), persons: ['mama'] }, { id: 'e2', summary: 'Elternabend', all_day: false, start: iso(d, 20), end: iso(d, 21), persons: [] }];
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
