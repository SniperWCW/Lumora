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
