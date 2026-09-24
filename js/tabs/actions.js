// Actions tab: the animation library and the demo. The highlighted chip is what the robot reports playing
// (ctx.onPlaying), not the last one tapped, so it clears when the animation ends or is stopped.
import * as P from '../protocol.js';
import { h, card } from '../ui.js';

export default {
  id: 'actions', label: 'Actions',
  icon: '<path d="M5 4l14 8-14 8z"/>',

  mount(root, ctx) {
    const shown = P.ANIMS.filter(a => !P.POSTURES.includes(a.name) && !P.HIDDEN.includes(a.name));
    const chips = shown.map(a => h('button', { class: 'btn soft', 'data-name': a.name, onclick: () => ctx.send(P.anim(a.id)) }, a.label));
    const mark = name => { for (const c of chips) c.classList.toggle('on', c.dataset.name === name); };
    mark(ctx.playing());
    this.unsub = ctx.onPlaying(mark);

    root.append(
      card('Animations', null,
        h('div', { class: 'grid cols3 needs-link' }, chips),
        h('div', { class: 'grid mt needs-link' },
          h('button', { class: 'btn', onclick: () => ctx.send(P.demo()) }, 'Play all (demo)'))),
    );
  },

  onLeave() { this.unsub?.(); this.unsub = null; },
};
