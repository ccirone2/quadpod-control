// Poses saved on this device from the Pose tab: a name, the body pose (firmware numbers, as P sends them) and each
// leg's raised joint angles (null = planted). Kept in localStorage under 'quadpod.poses', newest first; text() and
// merge() move them between devices as JSON.
import { store } from './ui.js';

const KEY = 'poses';
const NUMS = ['x', 'y', 'z', 'roll', 'pitch', 'yaw'];
const JOINTS = ['coxa', 'femur', 'tibia'];

const num = v => typeof v === 'number' && Number.isFinite(v);
const valid = p => p && typeof p.name === 'string' && p.name.trim() && p.body && NUMS.every(k => num(p.body[k])) &&
  Array.isArray(p.legs) && p.legs.length === 4 && p.legs.every(l => l === null || JOINTS.every(k => num(l[k])));
const clean = p => ({ name: p.name.trim().slice(0, 40),
  body: Object.fromEntries(NUMS.map(k => [k, Math.round(p.body[k])])),
  legs: p.legs.map(l => l && Object.fromEntries(JOINTS.map(k => [k, Math.round(l[k])]))) });

export function list() {
  try { const a = JSON.parse(store.get(KEY)); return Array.isArray(a) ? a.filter(valid) : []; } catch { return []; }
}
const keep = all => { store.set(KEY, JSON.stringify(all)); return all; };

// Saving under an existing name replaces that pose.
export function save(pose) { const p = clean(pose); return keep([p, ...list().filter(q => q.name !== p.name)]); }
export function remove(name) { return keep(list().filter(q => q.name !== name)); }

export const text = () => JSON.stringify(list());
// Adds the poses in a text() string (same name = replaced); returns how many it took, or -1 if it is not one.
export function merge(json) {
  let a;
  try { a = JSON.parse(json); } catch { return -1; }
  if (!Array.isArray(a)) return -1;
  const got = a.filter(valid).map(clean);
  const names = new Set(got.map(p => p.name));
  keep([...got, ...list().filter(q => !names.has(q.name))]);
  return got.length;
}

// The robot commands for a pose (developer mode), plus a firmware gesture key when at most one leg is raised,
// ready to paste into a G_ sequence in animation.cpp.
export function code(p) {
  const b = p.body, lines = [`P ${NUMS.map(k => b[k]).join(' ')}`];
  p.legs.forEach((l, i) => lines.push(l ? `^ ${i} ${l.coxa} ${l.femur} ${l.tibia}` : `^ ${i}`));
  const up = p.legs.map((l, i) => l && i).filter(i => i !== null);
  if (up.length <= 1) {
    const leg = up.length ? ['FL', 'FR', 'RL', 'RR'][up[0]] : 'NO_LEG', l = up.length ? p.legs[up[0]] : { coxa: 0, femur: 0, tibia: 0 };
    lines.push(`{  600, { ${NUMS.map(k => b[k]).join(', ')} }, ${leg}, { ${JOINTS.map(k => l[k]).join(', ')} } },`);
  }
  return lines.join('\n');
}
