// Actions tab: robot state buttons and the animation library.
import * as P from '../protocol.js';
import { h, card } from '../ui.js';

export default {
  id: 'actions', label: 'Actions',
  icon: '<path d="M5 4l14 8-14 8z"/>',

  mount(root, ctx) {
    // Power off needs a second tap within 2 s so a stray touch does not drop the robot.
    let armed = null;
    const off = h('button', { class: 'btn bad', onclick: () => {
      if (armed) { clearTimeout(armed); armed = null; off.textContent = 'Power off'; ctx.send(P.off()); return; }
      off.textContent = 'Tap again';
      armed = setTimeout(() => { armed = null; off.textContent = 'Power off'; }, 2000);
    } }, 'Power off');

    const chips = P.ANIMS.filter(a => !P.POSTURES.includes(a.label)).map(a => h('button', { class: 'btn soft', 'data-id': a.id, onclick: () => {
      for (const c of chips) c.classList.toggle('on', +c.dataset.id === a.id);
      ctx.send(P.anim(a.id));
    } }, a.label));

    root.append(
      card('Robot', null,
        h('div', { class: 'grid tight needs-link' },
          h('button', { class: 'btn', onclick: () => P.run(P.standUp(), ctx.send) }, 'Stand up'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.home()) }, 'Home'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.rest()) }, 'Rest'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.ball()) }, 'Ball'),
          h('button', { class: 'btn soft', onclick: () => ctx.send(P.splay()) }, 'Splay'),
          h('button', { class: 'btn warn', onclick: () => P.run(P.sleep(), ctx.send) }, 'Sleep'),
          off)),
      card('Animations', null,
        h('div', { class: 'chips needs-link' }, chips),
        h('div', { class: 'grid needs-link', style: 'margin-top:10px' },
          h('button', { class: 'btn', onclick: () => ctx.send(P.demo()) }, 'Demo: play all'))),
    );
  },
};
