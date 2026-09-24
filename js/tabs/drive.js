// Drive tab: proportional joystick (up/down = vy forward/back, left/right = wz rotate, diagonals blend into an arc),
// strafe slider (vx, recentres on release), step-size slider (stride mm, U command), gait choice.
// Stick distance from centre is the only speed control.
import * as P from '../protocol.js';
import { h, card, slider, segmented, throttle, store } from '../ui.js';

const RESEND_MS = P.RESEND_MS;   // stick update throttle; while touched the drive line is also resent every 2x this
const DEAD = 0.10;       // stick dead zone, fraction of radius

export default {
  id: 'drive', label: 'Drive',
  icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',

  mount(root, ctx) {
    let stride = +store.get('stride') || P.STRIDE.DEFAULT;
    const s = { gait: P.GAIT.CREEP, sx: 0, sy: 0, strafe: 0, active: false, timer: null };
    const readout = { vx: h('b', {}, '0'), vy: h('b', {}, '0'), wz: h('b', {}, '0') };

    const velocity = () => ({
      vx: s.strafe * P.SPEED.MAX_MM_S,    // body x is right: slider right = strafe right
      vy: s.sy * P.SPEED.MAX_MM_S,        // body y is forward: stick up = forward
      wz: -s.sx * P.SPEED.MAX_DEG_S,      // stick right = turn right (clockwise = negative wz)
    });
    const show = ({ vx, vy, wz }) => { readout.vx.textContent = Math.round(vx); readout.vy.textContent = Math.round(vy); readout.wz.textContent = Math.round(wz); };

    const push = quiet => { const v = velocity(); show(v); ctx.send(P.gait(s.gait, v.vx, v.vy, v.wz), { quiet, key: 'drive' }); };
    const pushThrottled = throttle(() => push(true), RESEND_MS);

    // Something is being touched: send now and keep resending until everything is released.
    const update = () => {
      const moving = s.sx || s.sy || s.strafe;
      if (moving && !s.active) { s.active = true; ctx.send(P.stride(stride), { quiet: true, key: 'stride' }); push(false); s.timer = setInterval(() => push(true), RESEND_MS * 2); }
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
      const k = mag < DEAD ? 0 : (mag - DEAD) / (1 - DEAD) / mag;   // rescale past the dead zone
      s.sx = dx * k; s.sy = -dy * k;                               // up on screen = forward
      update();
    };
    const releaseStick = () => {
      if (pid === null) return;
      pid = null; stick.classList.remove('live');
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

    // --- strafe slider: recentres on release ---
    const strafeSl = slider('Strafe', { min: -100, max: 100, value: 0, format: v => v + '%',
      onInput: v => { s.strafe = v / 100; update(); },
      onRelease: () => { strafeSl.set(0); s.strafe = 0; update(); } });

    // --- step size and gait ---
    const sendStride = throttle(() => ctx.send(P.stride(stride), { quiet: true, key: 'stride' }), RESEND_MS);
    const step = slider('Step', { min: P.STRIDE.MIN, max: P.STRIDE.MAX, value: stride, format: v => v + ' mm', onInput: v => {
      stride = v; store.set('stride', v);
      sendStride();
    } });
    const gaitSeg = segmented(P.GAITS, s.gait, id => { s.gait = id; if (s.active) push(false); });

    root.append(
      card('Drive', 'stick = speed and direction, step = stride length',
        h('div', { class: 'needs-link' },
          stick,
          h('div', { class: 'drive-row' }, strafeSl.el),
          ctx.dev ? h('div', { class: 'readout' },      // developer mode only
            h('span', {}, 'vx ', readout.vx), h('span', {}, 'vy ', readout.vy), h('span', {}, 'wz ', readout.wz)) : null,
        )),
      card('Settings', null,
        h('div', { class: 'needs-link' }, step.el, h('div', { class: 'mt' }, gaitSeg.el))),
    );

    this.halt = () => { releaseStick(); stop(); };
  },

  onLeave() { this.halt?.(); },
  onHidden() { this.halt?.(); },
};
