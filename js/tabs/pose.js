// Pose tab: one Poses card (whole-body postures, then standing body presets), and the body height / roll /
// pitch / yaw sliders (feet stay planted) with x/y shift under "more".
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

    const reset = () => { for (const k in cur) { cur[k] = 0; sliders[k].set(0); } send.cancel(); };

    root.append(
      card('Poses', null,
        h('div', { class: 'grid tight needs-link' },
          POSES.map(p => h('button', { class: 'btn' + (p.primary ? '' : ' soft'), onclick: () => { reset(); ctx.send(p.cmd()); } }, p.label))),
        h('div', { class: 'chips needs-link', style: 'margin-top:10px' },
          PRESETS.map(p => h('button', { class: 'btn soft', onclick: () => apply(p.pose) }, p.label)))),
      card('Body pose', 'feet stay planted',
        h('div', { class: 'needs-link' },
          AXES.map(make),
          h('details', {}, h('summary', {}, 'more'), EXTRA.map(make)))),
    );
  },
};
