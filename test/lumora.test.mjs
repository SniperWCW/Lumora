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
