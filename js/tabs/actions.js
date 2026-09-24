// Actions tab: the animation library and the demo.
import * as P from '../protocol.js';
import { h, card, cap } from '../ui.js';

export default {
  id: 'actions', label: 'Actions',
  icon: '<path d="M5 4l14 8-14 8z"/>',

  mount(root, ctx) {
    const shown = P.ANIMS.filter(a => !P.POSTURES.includes(a.label) && !P.HIDDEN.includes(a.label));
    const chips = shown.map(a => h('button', { class: 'btn soft', 'data-id': a.id, onclick: () => {
      for (const c of chips) c.classList.toggle('on', +c.dataset.id === a.id);
      ctx.send(P.anim(a.id));
    } }, cap(a.label)));

    root.append(
      card('Animations', null,
        h('div', { class: 'grid cols3 needs-link' }, chips),
        h('div', { class: 'grid mt needs-link' },
          h('button', { class: 'btn', onclick: () => ctx.send(P.demo()) }, 'Play all (demo)'))),
    );
  },
};
