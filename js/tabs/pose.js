// Pose tab: one Poses card (whole-body postures, then standing body presets), and the body height / roll /
// pitch / yaw sliders (feet stay planted) with x/y shift under "more".
import * as P from '../protocol.js';
import { h, card, slider, throttle, store } from '../ui.js';

// Ranges cover the legs' reach from the 60 mm standing height (the firmware IK clamps anything beyond).
// Player labels: Lean = roll (side down), Tilt = pitch (+ nose up), Turn = yaw; Sideways = x, Forward = y.
const AXES = [
  { key: 'z',     label: 'Height', min: -35, max: 45 },
  { key: 'roll',  label: 'Lean',   min: -40, max: 40 },
  { key: 'pitch', label: 'Tilt',   min: -40, max: 40 },
  { key: 'yaw',   label: 'Turn',   min: -45, max: 45 },
];
const EXTRA = [
  { key: 'x', label: 'Sideways', min: -35, max: 35 },
  { key: 'y', label: 'Forward',  min: -35, max: 35 },
];
// Whole-body postures (each one resets the sliders to zero). Stand is the H command: home stance, level.
const POSES = [
  { label: 'Stand', cmd: P.home, primary: true },
  { label: 'Rest',  cmd: P.rest },
  { label: 'Sit',   cmd: P.sit },
  { label: 'Lie',   cmd: P.lie },
  { label: 'Ball',  cmd: P.ball },
  { label: 'Splay', cmd: P.splay },
];
// Standing body-pose presets: set the sliders and send one P command. Add more here, they appear as chips.
const PRESETS = [
  { label: 'Tall',   pose: { z: 25 } },
  { label: 'Crouch', pose: { z: 17, pitch: -40 } },   // nose right down
  { label: 'Peek',   pose: { z: 10, pitch: 15 } },   // +pitch = nose up, like the peek animation
  { label: 'Lean',   pose: { roll: 15 } },
];

export default {
  id: 'pose', label: 'Pose',
  icon: '<path d="M4 14l4-6 4 6 4-6 4 6"/><path d="M4 18h16"/>',

  mount(root, ctx) {
    const cur = {};
    const sliders = {};
    let snap = store.get('snap') !== '0';
    const send = throttle(() => ctx.send(P.pose(cur), { quiet: true, key: 'pose' }), P.RESEND_MS);
    const make = a => {
      cur[a.key] = 0;
      sliders[a.key] = slider(a.label, { ...a,
        onInput: v => { cur[a.key] = v; send(); },
        onRelease: () => { if (snap && cur[a.key] !== 0) { cur[a.key] = 0; sliders[a.key].set(0); send(); } } });
      return sliders[a.key].el;
    };
    const snapBox = h('input', { type: 'checkbox', checked: snap, onchange: e => {
      snap = e.target.checked;
      store.set('snap', snap ? '1' : '0');
      if (snap) apply({});                       // turning it on centres everything now
    } });
    const apply = pose => {
      for (const k in cur) { cur[k] = pose[k] || 0; sliders[k].set(cur[k]); }
      send.cancel(); ctx.send(P.pose(cur), { key: 'pose' });
    };

    const reset = () => { for (const k in cur) { cur[k] = 0; sliders[k].set(0); } send.cancel(); };

    root.append(
      card('Poses', null,
        h('div', { class: 'grid cols5 needs-link' },
          POSES.map(p => h('button', { class: 'btn' + (p.primary ? '' : ' soft'), onclick: () => { reset(); ctx.send(p.cmd()); } }, p.label)),
          PRESETS.map(p => h('button', { class: 'btn soft', onclick: () => apply(p.pose) }, p.label)))),
      card('Body pose', h('label', { class: 'toggle' }, snapBox, 'Snap back'),
        h('div', { class: 'needs-link' },
          AXES.map(make),
          h('details', {}, h('summary', {}, 'More'), EXTRA.map(make)))),
    );
  },
};
