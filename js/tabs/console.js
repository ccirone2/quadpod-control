// Console tab: reply log plus a raw command line. The log buffer lives in app.js so nothing is lost
// while another tab is showing; this tab only renders it. Also the idle fidget switch (D): the page turns fidgets on
// at every connect, and the box shows what the robot last reported (ctx.onIdle).
import * as P from '../protocol.js';
import { h, card } from '../ui.js';

const QUICK = [['?', P.help()], ['L', P.listCal()], ['Q', P.query()], ['H', P.home()]];
const HISTORY = 20;

export default {
  id: 'console', label: 'Console', dev: true,
  icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10l3 2-3 2M12 14h5"/>',

  mount(root, ctx) {
    const log = h('div', { class: 'log' });
    const render = entries => {
      const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
      log.replaceChildren(...entries.map(e => h('div', { class: e.cls }, e.text)));
      if (stick) log.scrollTop = log.scrollHeight;
    };
    render(ctx.entries());
    const unLog = ctx.onLog(() => render(ctx.entries()));

    const history = [];
    let hi = -1;
    const input = h('input', { type: 'text', placeholder: 'command, e.g. G 1 20 0 0', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'send' });
    const submit = () => {
      const cmd = input.value.trim();
      if (!cmd) return;
      if (history[0] !== cmd) history.unshift(cmd);
      history.length = Math.min(history.length, HISTORY);
      hi = -1; input.value = '';
      ctx.send(cmd);
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hi = Math.min(hi + 1, history.length - 1); input.value = history[hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.max(hi - 1, -1); input.value = hi < 0 ? '' : history[hi]; }
    });

    const idleBox = h('input', { type: 'checkbox', onchange: () => ctx.send(P.idle(idleBox.checked)) });
    const showIdle = on => { idleBox.checked = on === true; idleBox.indeterminate = on == null; };
    showIdle(ctx.idle());
    const unIdle = ctx.onIdle(showIdle);
    this.unsub = () => { unLog(); unIdle(); };

    root.append(
      card('Idle fidgets', h('label', { class: 'toggle needs-link' }, idleBox, 'On'),
        h('p', { class: 'note' }, 'Small random moves when the robot stands alone. On again at every connect.')),
      card('Log', null, log,
        h('div', { class: 'cmdline' }, input, h('button', { class: 'btn sm', onclick: submit }, 'Send')),
        h('div', { class: 'chips mt' },
          QUICK.map(([label, cmd]) => h('button', { class: 'btn soft sm', onclick: () => ctx.send(cmd) }, label)),
          h('button', { class: 'btn soft sm', onclick: () => { ctx.clearLog(); } }, 'Clear'))),
      h('p', { class: 'note' }, 'Needs Chrome on Android over https. Robot advertises as "quadpod".'),
    );
  },

  onLeave() { this.unsub?.(); this.unsub = null; },
};
