// Small DOM helpers shared by the tabs.

// h('button', {class: 'btn', onclick: fn, 'data-id': 1}, 'label', childEl, ...)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

// Trailing-edge throttle: the latest call runs at most once per `ms`.
export function throttle(fn, ms) {
  let timer = null, pending = null;
  const flush = () => { timer = null; if (pending) { const a = pending; pending = null; fn(...a); } };
  const t = (...args) => { pending = args; if (!timer) timer = setTimeout(flush, ms); };
  t.cancel = () => { clearTimeout(timer); timer = null; pending = null; };
  return t;
}

// Labelled range slider. onInput(value) fires on every change, onRelease(value) when the thumb is let go;
// returns {el, set(v), get()}.
export function slider(label, { min, max, value = 0, step = 1, format = String, onInput, onRelease }) {
  const out = h('output', {}, format(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.value = format(+input.value); onInput?.(+input.value); });
  for (const ev of ['pointerup', 'pointercancel', 'keyup']) input.addEventListener(ev, () => onRelease?.(+input.value));
  const el = h('label', { class: 'slider' }, label, input, out);
  return { el, get: () => +input.value, set: v => { input.value = v; out.value = format(+v); } };
}

// Segmented control. options: [{id, label}]; onChange(id).
export function segmented(options, value, onChange) {
  const el = h('div', { class: 'seg' });
  const set = id => { for (const b of el.children) b.classList.toggle('on', +b.dataset.id === id); };
  for (const o of options) el.append(h('button', {
    class: 'btn', 'data-id': o.id, onclick: () => { set(o.id); onChange(o.id); }
  }, o.label));
  set(value);
  return { el, set };
}

export function card(title, hint, ...children) {
  return h('section', { class: 'card' }, h('h2', {}, title, hint ? (typeof hint === 'string' ? h('span', { class: 'hint' }, hint) : hint) : null), ...children);
}
