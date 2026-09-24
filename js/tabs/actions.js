// Actions tab: the animation library and the demo. The list is the robot's catalog (ctx.catalog) minus the
// postures (Pose tab), the idle fidgets and P.OFF_PAGE. The highlighted chip is what the robot reports playing
// (ctx.onPlaying), not the last one tapped, so it clears when the animation ends or is stopped.
import * as P from '../protocol.js';
import { h, card, icon } from '../ui.js';

export default {
  id: 'actions', label: 'Actions',
  icon: '<path d="M5 4l14 8-14 8z"/>',

  mount(root, ctx) {
    const shown = ctx.catalog.anims.filter(a => !a.posture && !a.idle && !P.OFF_PAGE.includes(a.name));
    const chips = shown.map(a => h('button', { class: 'btn soft act', 'data-name': a.name, onclick: () => ctx.send(P.anim(a.id)) },
      icon(P.iconOf(a.name)), h('span', {}, P.label(a.name))));
    const mark = name => { for (const c of chips) c.classList.toggle('on', c.dataset.name === name); };
    mark(ctx.playing());
    this.unsub = ctx.onPlaying(mark);

    root.append(
      card('Animations', null,
        chips.length ? h('div', { class: 'grid cols3 needs-link' }, chips) : h('p', { class: 'note' }, "Connect to load the robot’s moves."),
        h('div', { class: 'grid mt needs-link' },
          h('button', { class: 'btn', onclick: () => ctx.send(P.demo()) }, 'Play all (demo)'))),
    );
  },

  onLeave() { this.unsub?.(); this.unsub = null; },
};
