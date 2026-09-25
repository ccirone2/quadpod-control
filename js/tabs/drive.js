// Drive tab: proportional joystick (up/down = vy forward/back, left/right = wz rotate, diagonals blend into an arc),
// strafe slider (vx, recentres on release), step-size slider (stride mm, U command), lift slider (step height per
// gait, B command), gait choice.
// Stick distance from centre is the only speed control.
import * as P from '../protocol.js';
import { h, card, slider, segmented, throttle, store } from '../ui.js';

const DEAD = 0.10;       // stick and strafe dead zone, fraction of full scale
const buzz = () => navigator.vibrate?.(10);   // haptic tick when a control leaves its dead zone (Android)
// Dead zone, then rescale so motion starts from 0 just past its edge: 0..1 in, 0..1 out.
const pastDead = m => m < DEAD ? 0 : (m - DEAD) / (1 - DEAD);

export default {
  id: 'drive', label: 'Drive',
  icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',

  mount(root, ctx) {
    let stride = +store.get('stride') || P.STRIDE.DEFAULT;
    const gaits = ctx.catalog.gaits.map(g => ({ id: g.id, label: P.label(g.name) }));
    // Lift per gait: what the page last set (remembered: the robot forgets B tuning on reboot), else the robot's own.
    const liftOf = id => +store.get('lift.' + id) || ctx.catalog.gaits.find(g => g.id === id)?.stepH || 20;
    const cycleOf = id => ctx.catalog.gaits.find(g => g.id === id)?.cycleMs || 1600;
    const sendLift = () => ctx.send(P.tune(s.gait, liftOf(s.gait), cycleOf(s.gait)), { quiet: true, key: 'lift' });
    const s = { gait: gaits[0]?.id ?? 1, sx: 0, sy: 0, strafe: 0, active: false, timer: null, stickDead: true, strafeDead: true };
    const readout = { vx: h('b', {}, '0'), vy: h('b', {}, '0'), wz: h('b', {}, '0') };

    const velocity = () => ({
      vx: s.strafe * P.SPEED.MAX_MM_S,    // body x is right: slider right = strafe right
      vy: s.sy * P.SPEED.MAX_MM_S,        // body y is forward: stick up = forward
      wz: -s.sx * P.SPEED.MAX_DEG_S,      // stick right = turn right (clockwise = negative wz)
    });
    const show = ({ vx, vy, wz }) => { readout.vx.textContent = Math.round(vx); readout.vy.textContent = Math.round(vy); readout.wz.textContent = Math.round(wz); };

    const push = quiet => { const v = velocity(); show(v); ctx.send(P.gait(s.gait, v.vx, v.vy, v.wz), { quiet, key: 'drive' }); };
    const pushThrottled = throttle(() => push(true), P.RESEND_MS);

    // Something is being touched: send now and keep resending (every 2 x RESEND_MS) until everything is released.
    const update = () => {
      const moving = s.sx || s.sy || s.strafe;
      if (moving && !s.active) {
        s.active = true; ctx.send(P.stride(stride), { quiet: true, key: 'stride' }); sendLift();
        push(false); s.timer = setInterval(() => push(true), P.RESEND_MS * 2);
      }
      else if (moving) pushThrottled();
      else stop();
    };
    // Zero everything. A released stick keeps the gait engaged at zero speed (G <gait> 0 0 0); the header
    // STOP (or any posture) leaves the gait.
    const stop = () => {
      pushThrottled.cancel(); clearInterval(s.timer); s.timer = null;
      s.sx = s.sy = s.strafe = 0; strafeSl?.set(0); show(velocity());
      if (s.active) ctx.send(P.stopGait(s.gait), { key: 'drive' });
      s.active = false;
    };

    // --- joystick ---
    const knob = h('div', { class: 'knob' });
    const stick = h('div', { class: 'joystick' }, knob);
    let pid = null;
    const setStick = e => {
      const r = stick.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      knob.style.transform = `translate(calc(-50% + ${dx * R * 0.6}px), calc(-50% + ${dy * R * 0.6}px))`;
      const mag = Math.min(m, 1);
      const k = mag < DEAD ? 0 : pastDead(mag) / mag;
      if (s.stickDead && mag >= DEAD) buzz();
      s.stickDead = mag < DEAD;
      s.sx = dx * k; s.sy = -dy * k;                               // up on screen = forward
      update();
    };
    const releaseStick = () => {
      if (pid === null) return;
      pid = null; stick.classList.remove('live'); s.stickDead = true;
      knob.style.transform = 'translate(-50%, -50%)';
      s.sx = s.sy = 0; update();
    };
    stick.addEventListener('pointerdown', e => {
      e.preventDefault(); pid = e.pointerId; stick.classList.add('live');
      try { stick.setPointerCapture(e.pointerId); } catch {}
      setStick(e);
    });
    stick.addEventListener('pointermove', e => { if (e.pointerId === pid) setStick(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(ev, e => { if (e.pointerId === pid) releaseStick(); });
    stick.addEventListener('contextmenu', e => e.preventDefault());

    // --- strafe slider: dead zone round the centre like the stick, recentres on release ---
    const strafeSl = slider('Strafe', { min: -100, max: 100, value: 0, format: v => v + '%',
      onInput: v => {
        const a = Math.abs(v / 100);
        if (s.strafeDead && a >= DEAD) buzz();
        s.strafeDead = a < DEAD;
        s.strafe = Math.sign(v) * pastDead(a); update();
      },
      onRelease: () => { strafeSl.set(0); s.strafe = 0; s.strafeDead = true; update(); } });

    // --- step size and gait ---
    const sendStride = throttle(() => ctx.send(P.stride(stride), { quiet: true, key: 'stride' }), P.RESEND_MS);
    const step = slider('Step', { min: P.STRIDE.MIN, max: P.STRIDE.MAX, value: stride, format: v => v + ' mm', onInput: v => {
      stride = v; store.set('stride', v);
      sendStride();
    } });
    const sendLiftThrottled = throttle(sendLift, P.RESEND_MS);
    const lift = slider('Lift', { min: P.LIFT.MIN, max: P.LIFT.MAX, value: liftOf(s.gait), format: v => v + ' mm', onInput: v => {
      store.set('lift.' + s.gait, v);
      sendLiftThrottled();
    } });
    const gaitSeg = segmented(gaits, s.gait, id => { s.gait = id; lift.set(liftOf(id)); if (s.active) { sendLift(); push(false); } });

    root.append(
      card('Drive', 'stick = speed and direction, step = stride length',
        h('div', { class: 'needs-link' },
          stick,
          h('div', { class: 'drive-row' }, strafeSl.el),
          ctx.dev ? h('div', { class: 'readout' },      // developer mode only
            h('span', {}, 'vx ', readout.vx), h('span', {}, 'vy ', readout.vy), h('span', {}, 'wz ', readout.wz)) : null,
        )),
      card('Settings', 'lift is kept per gait',
        h('div', { class: 'needs-link' }, step.el, lift.el,
          gaits.length ? h('div', { class: 'mt' }, gaitSeg.el) : h('p', { class: 'note' }, "Connect to load the robot’s gaits."))),
    );

    this.halt = () => { releaseStick(); stop(); };
  },

  onLeave() { this.halt?.(); },
  onHidden() { this.halt?.(); },
};
