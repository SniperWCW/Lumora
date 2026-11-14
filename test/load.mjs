// Lädt lumora.js in einer Minimal-Umgebung (ohne Browser) und gibt die Karten-Klasse zurück.
import fs from 'node:fs';
import vm from 'node:vm';

export function load() {
  const src = fs.readFileSync(new URL('../lumora.js', import.meta.url), 'utf8');
  const reg = {};
  class El { constructor() { this.style = { setProperty() {} }; this._a = {}; } attachShadow() { this.shadowRoot = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }; return this.shadowRoot; } setAttribute(k, v) { this._a[k] = v; } getAttribute(k) { return this._a[k]; } addEventListener() {} }
  const win = { customCards: [], matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, requestAnimationFrame() {}, devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 };
  const ctx = { window: win, document: { addEventListener() {}, hidden: false, createElement: () => new El() }, HTMLElement: El, customElements: { get: (n) => reg[n], define: (n, c) => { reg[n] = c; } }, localStorage: { getItem: () => null, setItem() {} }, console, setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame() {}, cancelAnimationFrame() {}, Intl, Date, Math, JSON };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // const-Deklarationen sichtbar machen, damit Hilfsfunktionen testbar sind
  vm.runInContext(`${src}\n;globalThis.__t = { parseYaml, embedConfig, cleanName, VERSION, DOM_ICON, NAME_ICON };`, ctx, { filename: 'lumora.js' });
  return { ...ctx.__t, card: reg['lumora-card'], win };
}
