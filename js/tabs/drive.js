// Drive tab: proportional joystick (vx, vy), hold-to-turn buttons (wz), speed limiter, gait choice.
import * as P from '../protocol.js';
import { h, card, holdButton, slider, segmented, throttle } from '../ui.js';

const RESEND_MS = 100;   // keep sending while touched (future firmware watchdog), throttle stick updates
const DEAD = 0.10;       // stick dead zone, fraction of radius

export default {
  id: 'drive', label: 'Drive',
  icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',

  mount(root, ctx) {
    const s = { gait: P.GAIT.CREEP, speed: 0.75, sx: 0, sy: 0, turn: 0, active: false, timer: null };
    const readout = { vx: h('b', {}, '0'), vy: h('b', {}, '0'), wz: h('b', {}, '0') };

    const velocity = () => ({
      vx: s.sx * P.SPEED.MAX_MM_S * s.speed,
      vy: s.sy * P.SPEED.MAX_MM_S * s.speed,
      wz: s.turn * P.SPEED.MAX_DEG_S * s.speed,
    });
    const show = ({ vx, vy, wz }) => { readout.vx.textContent = Math.round(vx); readout.vy.textContent = Math.round(vy); readout.wz.textContent = Math.round(wz); };

    const push = quiet => { const v = velocity(); show(v); ctx.send(P.gait(s.gait, v.vx, v.vy, v.wz), { quiet }); };
    const pushThrottled = throttle(() => push(true), RESEND_MS);

    // Something is being touched: send now and keep resending until everything is released.
    const update = () => {
      const moving = s.sx || s.sy || s.turn;
      if (moving && !s.active) { s.active = true; push(false); s.timer = setInterval(() => push(true), RESEND_MS * 2); }
      else if (moving) pushThrottled();
      else stop();
    };
    const stop = () => {
      pushThrottled.cancel(); clearInterval(s.timer); s.timer = null;
      s.sx = s.sy = s.turn = 0; show(velocity());
      if (s.active) { s.active = false; ctx.send(P.stopGait(s.gait)); }
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

    // --- turn buttons ---
    const turnBtn = (label, dir) => {
      const b = h('button', { class: 'btn soft needs-link' }, label);
      const release = holdButton(b, () => { s.turn = dir; update(); }, () => { if (s.turn === dir) { s.turn = 0; update(); } });
      b.release = release;
      return b;
    };
    const left = turnBtn('↺ turn', 1), right = turnBtn('turn ↻', -1);
    const stopBtn = h('button', { class: 'btn soft needs-link', onclick: () => { releaseStick(); left.release(); right.release(); stop(); ctx.send(P.stopGait()); } }, 'stop');

    // --- speed and gait ---
    const speed = slider('speed', { min: 25, max: 100, value: 75, format: v => v + '%', onInput: v => { s.speed = v / 100; if (s.active) pushThrottled(); } });
    const gaitSeg = segmented(P.GAITS, s.gait, id => { s.gait = id; if (s.active) push(false); });
    const idleSeg = segmented([{ id: 1, label: 'fidgets on' }, { id: 0, label: 'fidgets off' }], 1, id => ctx.send(P.idle(id)));

    root.append(
      card('Drive', 'move the stick to walk',
        h('div', { class: 'needs-link' },
          stick,
          h('div', { class: 'drive-row' }, left, stopBtn, right),
          h('div', { class: 'readout' },
            h('span', {}, 'vx ', readout.vx), h('span', {}, 'vy ', readout.vy), h('span', {}, 'wz ', readout.wz)),
        )),
      card('Settings', null,
        h('div', { class: 'needs-link' }, speed.el, h('div', { style: 'margin-top:8px' }, gaitSeg.el), h('div', { style: 'margin-top:8px' }, idleSeg.el))),
      card('Quick', null,
        h('div', { class: 'grid tight needs-link' },
          h('button', { class: 'btn', onclick: () => P.run(P.standUp(), ctx.send) }, 'Stand up'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.home()) }, 'Home'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.rest()) }, 'Rest'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.ball()) }, 'Ball'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.splay()) }, 'Splay'))),
    );

    this.halt = () => { releaseStick(); left.release(); right.release(); stop(); };
  },

  onLeave() { this.halt?.(); },
  onHidden() { this.halt?.(); },
};
