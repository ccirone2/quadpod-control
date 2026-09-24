// Pose tab: a Postures card (whole-body positions the robot moves into: stand, rest, lie...) and a Poses card
// (body pose over planted feet: preset chips, then the height / roll / pitch / yaw sliders with x/y shift
// under "more"). A preset just sets the sliders.
import * as P from '../protocol.js';
import { h, card, slider, throttle, store } from '../ui.js';

// Ranges cover the legs' reach from the 60 mm standing height (the firmware IK clamps anything beyond).
// Player labels: Lean = roll (side down), Tilt = pitch (+ nose up), Turn = yaw; Sideways = x, Forward = y.
// Turn is flipped (flip: true) so the slider's right end turns the body right: firmware +yaw turns it left.
const AXES = [
  { key: 'z',     label: 'Height', min: -35, max: 45 },
  { key: 'roll',  label: 'Lean',   min: -40, max: 40 },
  { key: 'pitch', label: 'Tilt',   min: -40, max: 40 },
  { key: 'yaw',   label: 'Turn',   min: -45, max: 45, flip: true },
];
const EXTRA = [
  { key: 'x', label: 'Sideways', min: -35, max: 35 },
  { key: 'y', label: 'Forward',  min: -35, max: 35 },
];
const FLIP = new Set([...AXES, ...EXTRA].filter(a => a.flip).map(a => a.key));
// Whole-body postures (each one resets the sliders to zero): the robot's catalog entries tagged posture, minus
// P.OFF_PAGE. Stand is the H command (home stance, level) and rest the R command; the rest play as animations.
const postures = ctx => ctx.catalog.anims.filter(a => a.posture && !P.OFF_PAGE.includes(a.name)).map(a => ({
  label: POSTURE_LABELS[a.name] ?? P.label(a.name), primary: a.name === 'stand',
  cmd: a.name === 'stand' ? P.home : a.name === 'rest' ? P.rest : () => P.anim(a.id),
}));
const POSTURE_LABELS = { lie: 'Lie' };   // short on this grid ("Lie down" in the status line)
// Body-pose presets (feet planted): set the sliders and send one P command; unlisted axes go to 0. Add more
// here, they appear as chips.
const PRESETS = [
  { label: 'Sit',    pose: { z: -35, pitch: 40 } },   // low, nose up: sitting on the tail
  { label: 'Tall',   pose: { z: 45, pitch: -10 } },
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
    // cur holds slider values; body() turns them into the firmware's pose (flipped axes negated).
    const body = () => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, FLIP.has(k) ? -v : v]));
    const send = throttle(() => ctx.send(P.pose(body()), { quiet: true, key: 'pose' }), P.RESEND_MS);
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
      send.cancel(); ctx.send(P.pose(body()), { key: 'pose' });
    };

    const list = postures(ctx);
    const reset = () => { for (const k in cur) { cur[k] = 0; sliders[k].set(0); } send.cancel(); };

    root.append(
      card('Postures', 'whole body',
        list.length ? h('div', { class: 'grid cols5 needs-link' },
          list.map(p => h('button', { class: 'btn' + (p.primary ? '' : ' soft'), onclick: () => { reset(); ctx.send(p.cmd()); } }, p.label)))
          : h('p', { class: 'note' }, "Connect to load the robot’s postures.")),
      card('Poses', h('label', { class: 'toggle' }, snapBox, 'Snap back'),
        h('div', { class: 'needs-link' },
          h('div', { class: 'grid cols5' },
            PRESETS.map(p => h('button', { class: 'btn soft', onclick: () => apply(p.pose) }, p.label))),
          h('div', { class: 'mt' }, AXES.map(make)),
          h('details', {}, h('summary', {}, 'More'), EXTRA.map(make)))),
    );
  },
};
