// App shell: header (status, connect, STOP), tab registry and bottom nav, shared log buffer.
// To add a feature: create js/tabs/<name>.js exporting {id, label, icon, mount(root, ctx), onLeave?, onHidden?}
// and add it to TABS.
import { Link } from './ble.js';
import * as P from './protocol.js';
import { h } from './ui.js';
import drive from './tabs/drive.js';
import pose from './tabs/pose.js';
import actions from './tabs/actions.js';
import console_ from './tabs/console.js';

const TABS = [drive, pose, actions, console_];
const LOG_MAX = 300;

const $ = s => document.querySelector(s);
const link = new Link();
const view = $('#view'), nav = $('#tabs'), dot = $('#dot'), status = $('#status'), connectBtn = $('#connect');

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

const ctx = {
  link, send, log,
  entries: () => entries,
  clearLog: () => { entries.length = 0; for (const fn of logSubs) fn(); },
  onLog: fn => { logSubs.add(fn); return () => logSubs.delete(fn); },
};

// ---- link events ----
link.addEventListener('tx', e => log('> ' + e.detail.text, 'tx'));
link.addEventListener('line', e => log('< ' + e.detail.text));
link.addEventListener('error', e => log(e.detail.text, 'err'));
link.addEventListener('state', e => {
  const { state, name } = e.detail;
  dot.className = 'dot' + (state === 'on' ? ' on' : state === 'busy' ? ' busy' : '');
  status.textContent = state === 'on' ? 'connected to ' + name : state === 'busy' ? 'connecting…' : 'not connected';
  connectBtn.textContent = state === 'on' ? 'Disconnect' : 'Connect';
  connectBtn.disabled = state === 'busy';
  view.dataset.locked = state === 'on' ? 'false' : 'true';
  if (state === 'on') log('connected to ' + name, 'sys');
  else if (state === 'off') { current?.onHidden?.(); log('disconnected', 'sys'); }
});
connectBtn.addEventListener('click', () => link.connected ? link.disconnect() : link.connect());
$('#estop').addEventListener('click', () => { current?.onHidden?.(); P.run(P.estop(), send); });

// ---- tabs ----
let current = null;
function show(id) {
  const tab = TABS.find(t => t.id === id) || TABS[0];
  if (tab === current) return;
  current?.onLeave?.();
  current = tab;
  view.replaceChildren();
  view.scrollTop = 0;
  tab.mount(view, ctx);
  for (const b of nav.children) b.classList.toggle('on', b.dataset.id === tab.id);
  try { localStorage.setItem('quadpod.tab', tab.id); } catch {}
}
function icon(paths) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = paths;
  return svg;
}
for (const t of TABS) nav.append(h('button', { 'data-id': t.id, onclick: () => show(t.id) }, icon(t.icon), t.label));

let first = TABS[0].id;
try { first = localStorage.getItem('quadpod.tab') || first; } catch {}
view.dataset.locked = 'true';
show(first);

document.addEventListener('visibilitychange', () => { if (document.hidden) current?.onHidden?.(); });
if (!link.supported) log('Web Bluetooth is not available in this browser', 'err');
