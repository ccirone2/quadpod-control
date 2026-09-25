// The robot's own list of animations and gaits (the # command), so the page keeps no copy of the firmware's
// tables. app.js asks for it on every connect and feeds it the reply lines; the last complete one is remembered
// so the menus show before the link is up. Player labels come from LABELS in protocol.js.
import { store } from './ui.js';

const EMPTY = { anims: [], gaits: [] };

function load() {
  try { const c = JSON.parse(store.get('catalog')); if (c && Array.isArray(c.anims) && Array.isArray(c.gaits)) return c; } catch {}
  return EMPTY;
}

export class Catalog {
  constructor(onChange) {
    this.current = load();
    this.onChange = onChange;
    this.pending = null;       // listing in progress: { nAnims, nGaits, anims, gaits }
  }

  get anims() { return this.current.anims; }
  get gaits() { return this.current.gaits; }

  // Returns true if the line was part of a catalog listing.
  //   catalog <nAnims> <nGaits> | anim <id> <name> <kind> [tags...] | gait <id> <name> <stepH> <cycleMs> | catalog end
  feed(text) {
    const w = text.trim().split(/\s+/);
    if (w[0] === 'catalog' && w[1] === 'end') { this.finish(); return true; }
    if (w[0] === 'catalog') { this.pending = { nAnims: +w[1], nGaits: +w[2], anims: [], gaits: [] }; return true; }
    if (!this.pending) return false;
    if (w[0] === 'anim') {
      const tags = new Set(w.slice(4));
      this.pending.anims.push({ id: +w[1], name: w[2], kind: w[3],
        posture: tags.has('posture'), offFeet: tags.has('offfeet'), idle: tags.has('idle'), demo: tags.has('demo') });
      return true;
    }
    if (w[0] === 'gait') {
      this.pending.gaits.push({ id: +w[1], name: w[2], stepH: +w[3], cycleMs: +w[4] });   // live B tuning
      return true;
    }
    return false;
  }

  // A listing counts only if every line arrived (a dropped BLE line would leave a hole in the menus).
  finish() {
    const p = this.pending;
    this.pending = null;
    if (!p || p.anims.length !== p.nAnims || p.gaits.length !== p.nGaits) return;
    const next = { anims: p.anims, gaits: p.gaits };
    const json = JSON.stringify(next);
    if (json === JSON.stringify(this.current)) return;
    this.current = next;
    store.set('catalog', json);
    this.onChange?.();
  }
}
