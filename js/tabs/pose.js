// Pose tab: a Postures card (whole-body positions the robot moves into: stand, rest, lie...), a Poses card (body
// pose over planted feet: preset chips, then the height / roll / pitch / yaw sliders with x/y shift under "more"),
// a Legs card (raise a leg and set its joints; the body pose keeps it raised, so a pose is built body first, then
// leg by leg) and a Saved card (poses kept on this device, js/poses.js). A preset just sets the sliders.
import * as P from '../protocol.js';
import * as Saved from '../poses.js';
import { h, card, slider, throttle, store } from '../ui.js';

// Ranges cover the legs' reach from the 60 mm standing height (the firmware stops a pose at the edge of reach).
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
// Whole-body postures (each one resets the sliders and plants every leg): the robot's catalog entries tagged
// posture, minus P.OFF_PAGE. Stand is the H command (home stance, level) and rest the R command; the rest play as
// animations.
const POSTURE_LABELS = { lie: 'Lie' };   // short on this grid ("Lie down" in the status line)
const postures = ctx => ctx.catalog.anims.filter(a => a.posture && !P.OFF_PAGE.includes(a.name)).map(a => ({
  label: POSTURE_LABELS[a.name] ?? P.label(a.name), primary: a.name === 'stand',
  cmd: a.name === 'stand' ? P.home : a.name === 'rest' ? P.rest : () => P.anim(a.id),
}));
// Body-pose presets (feet planted): set the sliders and send one P command; unlisted axes go to 0 (the sideways and
// forward shift stay put while a leg is raised, it is what balances it). Add more here, they appear as chips.
const PRESETS = [
  { label: 'Sit',    pose: { z: -35, pitch: 40 } },   // low, nose up: sitting on the tail
  { label: 'Tall',   pose: { z: 45, pitch: -10 } },
  { label: 'Crouch', pose: { z: 17, pitch: -40 } },   // nose right down
  { label: 'Chin up', pose: { z: 10, pitch: 15 } },  // +pitch = nose up (not "Peek": that is an animation)
  { label: 'Lean',   pose: { roll: 15 } },
];

// Legs in firmware order (0 FL, 1 FR, 2 RL, 3 RR), drawn as the robot seen from above, front at the top. `lean` is
// the body shift (x right, y forward, mm) toward the other three feet that Balance applies before the first leg
// rises: the firmware gestures' SHIFT.
const BALANCE_MM = 22, BALANCE_MS = 600;   // shift, then lift once the body is over the other three feet
const LEGS = [
  { label: 'Front left',  lean: { x:  BALANCE_MM, y: -BALANCE_MM } },
  { label: 'Front right', lean: { x: -BALANCE_MM, y: -BALANCE_MM } },
  { label: 'Back left',   lean: { x:  BALANCE_MM, y:  BALANCE_MM } },
  { label: 'Back right',  lean: { x: -BALANCE_MM, y:  BALANCE_MM } },
];
// Joint sliders, firmware conventions (config.h): Swing + = foot forward, Raise + = up, Knee + = opens.
const JOINTS = [
  { key: 'coxa',  label: 'Swing', min: -60, max: 60 },
  { key: 'femur', label: 'Raise', min: -30, max: 90 },
  { key: 'tibia', label: 'Knee',  min: -55, max: 90 },
];
const STAND = { coxa: 0, femur: 22, tibia: -28 };   // a planted leg at the home stance (IK of the firmware's HOME_*)
const LIFT = { coxa: 0, femur: 60, tibia: -20 };    // the Raise button: clear of the floor, knee tucked

export default {
  id: 'pose', label: 'Pose',
  icon: '<path d="M4 14l4-6 4 6 4-6 4 6"/><path d="M4 18h16"/>',

  mount(root, ctx) {
    const cur = {};
    const sliders = {};
    let snap = store.get('snap') !== '0';
    let balance = store.get('balance') !== '0';
    // cur holds slider values; body() turns them into the firmware's pose (flipped axes negated).
    const body = () => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, FLIP.has(k) ? -v : v]));
    const sendPose = () => { send.cancel(); ctx.send(P.pose(body()), { key: 'pose' }); };
    const send = throttle(() => ctx.send(P.pose(body()), { quiet: true, key: 'pose' }), P.RESEND_MS);
    const setAxis = (k, v) => { cur[k] = v; sliders[k].set(v); };
    const make = a => {
      cur[a.key] = 0;
      sliders[a.key] = slider(a.label, { ...a,
        onInput: v => { cur[a.key] = v; send(); },
        onRelease: () => { if (snap && cur[a.key] !== 0) { setAxis(a.key, 0); send(); } } });
      return sliders[a.key].el;
    };
    const snapBox = h('input', { type: 'checkbox', checked: snap, onchange: e => {
      snap = e.target.checked;
      store.set('snap', snap ? '1' : '0');
      if (snap) apply({});                       // turning it on centres everything now
    } });
    const anyUp = () => legs.some(l => l.up);
    const apply = pose => {
      const keepShift = anyUp();                 // the shift is what holds a raised leg up
      for (const k in cur) if (!(keepShift && (k === 'x' || k === 'y'))) setAxis(k, pose[k] || 0);
      sendPose();
    };

    // ---- legs: up = raised (the robot holds it at a), sel = the one the sliders drive ----
    const legs = LEGS.map(() => ({ up: false, a: { ...STAND } }));
    let sel = 0, shiftBefore = null, liftTimer = null;
    const legSliders = {};
    const sendLeg = i => ctx.send(P.limb(i, legs[i].a), { quiet: true, key: 'leg' + i });
    const sendSel = throttle(i => sendLeg(i), P.RESEND_MS);   // the selected leg's sliders, while it is dragged
    const legBtns = LEGS.map((l, i) => h('button', { class: 'btn soft', onclick: () => pick(i) }, l.label, h('small', {}, '')));
    const showLegs = () => legBtns.forEach((b, i) => {
      b.classList.toggle('sel', i === sel); b.setAttribute('aria-pressed', String(i === sel));
      b.classList.toggle('up', legs[i].up); b.lastChild.textContent = legs[i].up ? 'raised' : 'down';
    });
    const pick = i => {
      sendSel.cancel();
      if (i !== sel && legs[sel].up && !liftTimer) sendLeg(sel);   // the last drag of the leg we are leaving
      sel = i; for (const j of JOINTS) legSliders[j.key].set(legs[i].a[j.key]); showLegs();
    };
    // Balance: before the first leg leaves the floor, shift the body over the other three feet and wait for it.
    const lean = i => {
      shiftBefore = { x: cur.x, y: cur.y };
      setAxis('x', LEGS[i].lean.x); setAxis('y', LEGS[i].lean.y); sendPose();
    };
    const raise = i => {
      if (legs[i].up) { if (!liftTimer) sendSel(i); return; }
      const first = !anyUp();
      legs[i].up = true; showLegs();
      if (!first) ctx.toast('Two legs up: it can tip over');   // Balance only covers standing on three
      if (first && balance) {
        lean(i);
        liftTimer = setTimeout(() => { liftTimer = null; legs.forEach((l, j) => l.up && sendLeg(j)); }, BALANCE_MS);
      } else if (!liftTimer) sendLeg(i);
    };
    const plant = i => {
      if (!legs[i].up) return;
      if (i === sel) sendSel.cancel();
      legs[i].up = false; legs[i].a = { ...STAND };
      if (i === sel) pick(i); else showLegs();
      ctx.send(P.plant(i), { key: 'leg' + i });  // replaces a raise still waiting to go
      if (!anyUp()) {
        clearTimeout(liftTimer); liftTimer = null;
        if (shiftBefore) { setAxis('x', shiftBefore.x); setAxis('y', shiftBefore.y); shiftBefore = null; sendPose(); }
      }
    };
    for (const j of JOINTS) legSliders[j.key] = slider(j.label, { ...j, value: STAND[j.key],
      onInput: v => { legs[sel].a[j.key] = v; raise(sel); } });
    const balanceBox = h('input', { type: 'checkbox', checked: balance, onchange: e => {
      balance = e.target.checked; store.set('balance', balance ? '1' : '0');
    } });
    // The robot plants every leg for anything else (a posture, a walk, an animation): forget ours too.
    const resetLegs = () => {
      clearTimeout(liftTimer); liftTimer = null; sendSel.cancel(); shiftBefore = null;
      legs.forEach(l => { l.up = false; l.a = { ...STAND }; }); pick(sel);
    };

    // ---- saved poses ----
    const savedList = h('div', { class: 'saved' });
    const nameIn = h('input', { class: 'field grow', type: 'text', maxlength: 40, placeholder: 'Name this pose',
      'aria-label': 'Pose name', onkeydown: e => { if (e.key === 'Enter') saveNow(); } });
    const snapshot = name => ({ name, body: body(), legs: legs.map(l => l.up ? { ...l.a } : null) });
    const saveNow = () => {
      const name = nameIn.value.trim() || `Pose ${Saved.list().length + 1}`;
      Saved.save(snapshot(name)); nameIn.value = ''; showSaved();
      ctx.toast(`Saved “${name}”`);
    };
    // Recall: body first with the legs that stay down, then the raised legs once the body has shifted over.
    const recall = p => {
      clearTimeout(liftTimer); liftTimer = null; sendSel.cancel(); shiftBefore = null;
      for (const k in cur) setAxis(k, FLIP.has(k) ? -p.body[k] : p.body[k]);
      const wasUp = anyUp();
      legs.forEach((l, i) => { l.up = !!p.legs[i]; l.a = p.legs[i] ? { ...p.legs[i] } : { ...STAND }; });
      pick(sel);
      sendPose();
      legs.forEach((l, i) => { if (!l.up) ctx.send(P.plant(i), { key: 'leg' + i }); });
      const lift = () => { liftTimer = null; legs.forEach((l, i) => l.up && sendLeg(i)); };
      if (anyUp() && !wasUp) liftTimer = setTimeout(lift, BALANCE_MS); else lift();
    };
    const copy = p => navigator.clipboard?.writeText(Saved.code(p)).then(() => ctx.toast('Copied as commands'), () => ctx.toast('Copy failed', 'err'));
    const showSaved = () => {
      const all = Saved.list();
      savedList.replaceChildren(...(all.length ? all.map(p => h('div', { class: 'row' },
        h('button', { class: 'btn soft grow', onclick: () => recall(p) }, p.name),
        ctx.dev ? h('button', { class: 'btn soft sm', onclick: () => copy(p) }, 'Copy') : null,
        h('button', { class: 'btn soft sm', 'aria-label': `Delete ${p.name}`, onclick: () => {
          if (confirm(`Delete “${p.name}”?`)) { Saved.remove(p.name); showSaved(); }
        } }, '✕'))) : [h('p', { class: 'note' }, 'Nothing saved yet. Set the body, raise legs, then save.')]));
    };
    const exportAll = () => navigator.clipboard?.writeText(Saved.text()).then(() => ctx.toast('Poses copied as text'), () => ctx.toast('Copy failed', 'err'));
    const importAll = () => {
      const text = prompt('Paste poses copied with Export:');
      if (!text) return;
      const n = Saved.merge(text);
      ctx.toast(n < 0 ? 'That is not a list of poses' : `Added ${n} pose${n === 1 ? '' : 's'}`, n < 0 ? 'err' : '');
      showSaved();
    };

    const list = postures(ctx);
    const reset = () => { for (const k in cur) setAxis(k, 0); send.cancel(); resetLegs(); };
    this.halt = () => { clearTimeout(liftTimer); liftTimer = null; send.cancel(); sendSel.cancel(); };

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
      card('Legs', h('label', { class: 'toggle' }, balanceBox, 'Balance'),
        h('div', { class: 'needs-link' },
          h('div', { class: 'legs' }, legBtns),
          JOINTS.map(j => legSliders[j.key].el),
          h('div', { class: 'grid cols3' },
            h('button', { class: 'btn soft', onclick: () => { legs[sel].a = { ...LIFT }; pick(sel); raise(sel); } }, 'Raise'),
            h('button', { class: 'btn soft', onclick: () => plant(sel) }, 'Plant'),
            h('button', { class: 'btn soft', onclick: () => legs.forEach((l, i) => plant(i)) }, 'Plant all')),
          h('p', { class: 'note' }, 'Set the body first (Snap back off), then raise legs. Balance leans the body away before the first leg lifts.'))),
      card('Saved', 'on this phone',
        h('div', { class: 'row' }, nameIn, h('button', { class: 'btn', onclick: saveNow }, 'Save')),
        savedList,
        h('details', {}, h('summary', {}, 'Move to another device'),
          h('div', { class: 'grid mt' },
            h('button', { class: 'btn soft sm', onclick: exportAll }, 'Export'),
            h('button', { class: 'btn soft sm', onclick: importAll }, 'Import')))),
    );
    showLegs(); showSaved();
  },

  onLeave() { this.halt?.(); },
  onHidden() { this.halt?.(); },
};
