// App shell: header (status, connect, STOP), tab registry and bottom nav, shared log buffer, toasts,
// and a screen wake lock while connected (a sleeping phone would otherwise stop a walk silently).
// To add a feature: create js/tabs/<name>.js exporting {id, label, icon, mount(root, ctx), onLeave?, onHidden?,
// dev?} and add it to TABS. dev: true tabs only show in developer mode (long-press the title for DEV_HOLD_MS).
import { Link } from './ble.js';
import * as P from './protocol.js';
import { h, store } from './ui.js';
import drive from './tabs/drive.js';
import pose from './tabs/pose.js';
import actions from './tabs/actions.js';
import console_ from './tabs/console.js';

const TABS = [drive, pose, actions, console_];
const LOG_MAX = 300;

const $ = s => document.querySelector(s);
const link = new Link();
const view = $('#view'), nav = $('#tabs'), dot = $('#dot'), status = $('#status'), connectBtn = $('#connect');
const TOAST_MS = 3500;
const DEV_HOLD_MS = 1000;

// ---- toast: every error and link event, so nothing important hides in the Console log ----
const toastEl = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
document.body.append(toastEl);
let toastTimer = null;
function toast(text, cls = '') {
  toastEl.textContent = text;
  toastEl.className = 'show ' + cls;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = cls; }, TOAST_MS);
}

// ---- wake lock: held while connected and visible; the browser drops it when the page is hidden ----
let wake = null;
async function holdWake() {
  if (wake || !link.connected || document.hidden || !navigator.wakeLock) return;
  try {
    wake = await navigator.wakeLock.request('screen');
    wake.addEventListener('release', () => { wake = null; });
  } catch {}
}
function dropWake() { wake?.release().catch(() => {}); wake = null; }

// ---- shared log buffer (survives tab switches) ----
const entries = [];
const logSubs = new Set();
function log(text, cls) {
  const t = new Date();
  const stamp = [t.getHours(), t.getMinutes(), t.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  entries.push({ text: `${stamp} ${text}`, cls });
  if (entries.length > LOG_MAX) entries.splice(0, entries.length - LOG_MAX);
  for (const fn of logSubs) fn();
}
const send = (cmd, opts) => link.send(cmd, opts);

// ---- what the robot is doing: its own "animation: <name> (<id>)" / "animation: done" replies ----
let playing = null;
const playSubs = new Set();
function setPlaying(name) {
  if (name === playing) return;
  playing = name;
  showStatus();
  for (const fn of playSubs) fn(playing);
}

// ---- developer mode: the Console tab and raw numbers; off for players ----
let dev = store.get('dev') === '1';

const ctx = {
  link, send, log,
  get dev() { return dev; },
  playing: () => playing,
  onPlaying: fn => { playSubs.add(fn); return () => playSubs.delete(fn); },
  entries: () => entries,
  clearLog: () => { entries.length = 0; for (const fn of logSubs) fn(); },
  onLog: fn => { logSubs.add(fn); return () => logSubs.delete(fn); },
};

// ---- header status line ----
let linkState = { state: 'off', name: 'quadpod', reconnecting: false };
function showStatus() {
  const { state, name, reconnecting } = linkState;
  status.textContent = state === 'on' ? (playing ? 'playing ' + P.animLabel(playing) : 'connected to ' + name)
    : state === 'busy' ? (reconnecting ? 'reconnecting…' : 'connecting…') : 'not connected';
}

// ---- link events ----
link.addEventListener('tx', e => log('> ' + e.detail.text, 'tx'));
link.addEventListener('line', e => {
  const text = e.detail.text;
  log('< ' + text, text.startsWith('error:') ? 'err' : undefined);
  const m = /^animation: (\w+)/.exec(text);
  if (m) setPlaying(m[1] === 'done' ? null : m[1]);
});
link.addEventListener('error', e => { log(e.detail.text, 'err'); toast(e.detail.text, 'err'); });
link.addEventListener('info', e => { log(e.detail.text, 'sys'); toast(e.detail.text); });
let wasOn = false;
link.addEventListener('state', e => {
  const { state, name } = e.detail;
  linkState = e.detail;
  if (state !== 'on') setPlaying(null);           // unknown until the robot reports again
  showStatus();
  dot.className = 'dot' + (state === 'on' ? ' on' : state === 'busy' ? ' busy' : '');
  connectBtn.textContent = state === 'on' ? 'Disconnect' : 'Connect';
  connectBtn.disabled = state === 'busy';
  view.dataset.locked = state === 'on' ? 'false' : 'true';
  if (state === 'on') { log('connected to ' + name, 'sys'); holdWake(); }
  else if (wasOn) current?.onHidden?.();          // link down or reconnecting: stop every continuous control
  if (state === 'off') { dropWake(); if (wasOn) log('disconnected', 'sys'); }
  wasOn = state === 'on';
});
connectBtn.addEventListener('click', () => link.connected ? link.disconnect() : link.connect());

// ---- STOP: tap = halt and hold (servos stay on), hold HOLD_OFF_MS = power the servos off ----
// Continuous controls stop first (onHidden) so no drive line lands after the halt.
const HOLD_OFF_MS = 1000;
const estop = $('#estop');
let armTimer = null, heldOff = false;
const disarm = () => { clearTimeout(armTimer); armTimer = null; estop.classList.remove('arming'); };
estop.addEventListener('pointerdown', () => {
  heldOff = false; estop.classList.add('arming');
  armTimer = setTimeout(() => {
    disarm(); heldOff = true;
    current?.onHidden?.(); send(P.off(), { urgent: true }); log('STOP held: servos off', 'sys');
  }, HOLD_OFF_MS);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) estop.addEventListener(ev, disarm);
estop.addEventListener('contextmenu', e => e.preventDefault());
estop.addEventListener('click', () => {
  if (heldOff) { heldOff = false; return; }   // the long press already powered off
  current?.onHidden?.(); send(P.halt(), { urgent: true });
});

// ---- tabs ----
let current = null;
const visible = () => TABS.filter(t => dev || !t.dev);
function show(id, remount = false) {
  const tab = visible().find(t => t.id === id) || TABS[0];
  if (tab === current && !remount) return;
  current?.onLeave?.();
  current = tab;
  view.replaceChildren();
  view.scrollTop = 0;
  tab.mount(view, ctx);
  for (const b of nav.children) b.classList.toggle('on', b.dataset.id === tab.id);
  if (!tab.dev) store.set('tab', tab.id);         // a developer tab is never the landing tab
}
function icon(paths) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = paths;
  return svg;
}
function buildNav() {
  nav.replaceChildren(...visible().map(t => h('button', { 'data-id': t.id, onclick: () => show(t.id) }, icon(t.icon), t.label)));
}
function setDev(on) {
  dev = on;
  store.set('dev', on ? '1' : '0');
  buildNav();
  show(current?.id, true);                         // remount: the tab may show more or less; a dev tab falls back
  toast(on ? 'Developer mode on' : 'Developer mode off');
}
buildNav();

// Long-press the title to toggle developer mode.
const title = $('#top h1');
let devTimer = null;
title.addEventListener('pointerdown', () => { devTimer = setTimeout(() => setDev(!dev), DEV_HOLD_MS); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) title.addEventListener(ev, () => clearTimeout(devTimer));
title.addEventListener('contextmenu', e => e.preventDefault());

const first = store.get('tab', TABS[0].id);
view.dataset.locked = 'true';
show(first);

document.addEventListener('visibilitychange', () => { if (document.hidden) current?.onHidden?.(); else holdWake(); });
if (!link.supported) { log('Web Bluetooth is not available in this browser', 'err'); toast('Web Bluetooth is not available in this browser', 'err'); }
