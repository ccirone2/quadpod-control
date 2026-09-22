// Pose tab: body height / roll / pitch / yaw sliders (feet stay planted), x/y shift under "more", presets.
import * as P from '../protocol.js';
import { h, card, slider, throttle } from '../ui.js';

const AXES = [
  { key: 'z',     label: 'height', min: -30, max: 30 },
  { key: 'roll',  label: 'roll',   min: -25, max: 25 },
  { key: 'pitch', label: 'pitch',  min: -25, max: 25 },
  { key: 'yaw',   label: 'yaw',    min: -30, max: 30 },
];
const EXTRA = [
  { key: 'x', label: 'shift x', min: -20, max: 20 },
  { key: 'y', label: 'shift y', min: -20, max: 20 },
];
// Named poses: add more here, they appear as chips.
const PRESETS = [
  { label: 'level',  pose: {} },
  { label: 'tall',   pose: { z: 25 } },
  { label: 'crouch', pose: { z: -25 } },
  { label: 'peek',   pose: { z: 10, pitch: -15 } },
  { label: 'lean',   pose: { roll: 15 } },
];

export default {
  id: 'pose', label: 'Pose',
  icon: '<path d="M4 14l4-6 4 6 4-6 4 6"/><path d="M4 18h16"/>',

  mount(root, ctx) {
    const cur = {};
    const sliders = {};
    const send = throttle(() => ctx.send(P.pose(cur), { quiet: true }), 100);
    const make = a => { cur[a.key] = 0; sliders[a.key] = slider(a.label, { ...a, onInput: v => { cur[a.key] = v; send(); } }); return sliders[a.key].el; };
    const apply = pose => {
      for (const k in cur) { cur[k] = pose[k] || 0; sliders[k].set(cur[k]); }
      send.cancel(); ctx.send(P.pose(cur));
    };

    root.append(
      card('Body pose', 'feet stay planted',
        h('div', { class: 'needs-link' },
          AXES.map(make),
          h('details', {}, h('summary', {}, 'more'), EXTRA.map(make)))),
      card('Presets', null,
        h('div', { class: 'chips needs-link' },
          PRESETS.map(p => h('button', { class: 'btn soft', onclick: () => apply(p.pose) }, p.label)))),
    );
  },
};
