import {
  ABILITIES, CLASSES, MULTICLASS_LEVEL, PLAYABLE_CLASSES, SPEC_LEVEL,
  type ChooseMsg, type ClassDef, type ClassId,
} from '@eigenlands/shared';
import { h } from './el';
import { elementIcon, hex } from './art';

export interface PathState {
  cls: ClassId;
  spec: string | null;
  second: ClassId | null;
  level: number;
  /** a card the player has picked and must confirm */
  pending: { what: 'class' | 'second'; cls: ClassId } | { what: 'spec'; spec: string } | null;
  tutorialChoose: boolean;
}

export interface PathActions {
  pick(p: PathState['pending']): void;
  confirm(m: ChooseMsg): void;
}

function abilityRows(c: ClassDef): HTMLElement {
  const box = h('div', { class: 'cb-pc-abil' });
  for (const id of c.abilities) {
    const a = ABILITIES[id];
    const forms = h('div', { class: 'cb-pc-forms' },
      ...a.forms.map((f, i) => h('span', { class: 'cb-pc-form' }, h('img', { class: 'cb-elicon', src: elementIcon(f.hue), alt: '' }), h('span', { text: `${i ? 'or ' : ''}${f.name}` }))));
    box.append(h('div', { class: 'cb-pc-row' }, h('span', { class: 'cb-medal sm', text: a.glyph }), h('div', {}, h('b', { text: a.name }), h('div', { class: 'cb-pc-desc', text: a.desc }), forms)));
  }
  return box;
}

export function classCard(c: ClassDef, opts: { button?: HTMLElement; compact?: boolean; chosen?: boolean } = {}): HTMLElement {
  const card = h('section', { class: `cb-pcard${opts.compact ? ' compact' : ''}${opts.chosen ? ' chosen' : ''}`, style: `--cc:${hex(c.color)};--rc:${hex(c.resource.color)}` });
  card.append(
    h('div', { class: 'cb-pc-head' },
      h('span', { class: 'cb-pc-crest', text: c.ultimate.glyph, title: c.ultimate.name }),
      h('div', {}, h('div', { class: 'cb-pc-name', text: c.name }), h('div', { class: 'cb-pc-title', text: c.title }))),
    h('p', { class: 'cb-pc-blurb', text: c.blurb }),
  );
  if (!opts.compact) {
    card.append(
      h('div', { class: 'cb-pc-k', text: 'Abilities' }), abilityRows(c),
      h('div', { class: 'cb-pc-k', text: 'Passive' }), h('div', { class: 'cb-pc-p' }, h('b', { text: c.passive.name }), ` ${c.passive.desc}`),
      h('div', { class: 'cb-pc-k', text: 'Ultimate' }), h('div', { class: 'cb-pc-p' }, h('b', { text: `${c.ultimate.glyph} ${c.ultimate.name}` }), ` ${c.ultimate.desc}`),
      h('div', { class: 'cb-pc-k', text: 'Resource' }), h('div', { class: 'cb-pc-p' }, h('span', { class: 'cb-pc-res' }), h('b', { text: c.resource.name }), ` ${c.resource.desc}`),
    );
  }
  if (opts.button) card.append(opts.button);
  return card;
}

export function buildPath(s: PathState, act: PathActions): HTMLElement {
  const root = h('div', { class: 'cb-path' });
  if (s.cls === 'wanderer') {
    root.append(
      h('h3', { class: 'cb-path-h', text: 'Choose your path' }),
      h('p', { class: 'cb-path-sub', text: s.tutorialChoose
        ? 'Your orb is awake, and a second one is stirring. Pick the way you want to fight. You can add the other path later in life.'
        : 'You are a Wanderer with a single orb. Choosing a path gives you four abilities, a second orb and an ultimate.' }),
    );
    const cards = h('div', { class: 'cb-pcards' });
    for (const id of PLAYABLE_CLASSES) {
      const c = CLASSES[id];
      const pend = s.pending?.what === 'class' && s.pending.cls === id;
      const btn = pend
        ? h('div', { class: 'cb-confirm' },
          h('button', { class: 'primary cb-glow', text: `Yes, become a ${c.name}`, data: { focus: `pc-yes:${id}` }, on: { click: () => act.confirm({ what: 'class', cls: id }) } }),
          h('button', { text: 'Back', on: { click: () => act.pick(null) } }))
        : h('button', { class: 'primary', text: `Become a ${c.name}`, data: { focus: `pc:${id}` }, on: { click: () => act.pick({ what: 'class', cls: id }) } });
      cards.append(classCard(c, { button: btn, chosen: pend }));
    }
    root.append(cards);
    return root;
  }

  const c = CLASSES[s.cls];
  root.append(classCard(c, { compact: true, chosen: true }));

  // specialization
  root.append(h('h3', { class: 'cb-path-h', text: 'Specialization' }));
  if (s.level < SPEC_LEVEL) root.append(h('p', { class: 'cb-path-sub', text: `At level ${SPEC_LEVEL} you choose how to sharpen your ${c.name} skills.` }));
  const specs = h('div', { class: 'cb-specs' });
  for (const sp of c.specs) {
    const chosen = s.spec === sp.id;
    const pend = s.pending?.what === 'spec' && s.pending.spec === sp.id;
    const can = s.level >= SPEC_LEVEL && !s.spec;
    const card = h('div', { class: `cb-spec${chosen ? ' chosen' : ''}${!can && !chosen ? ' locked' : ''}`, style: `--cc:${hex(c.color)}` },
      h('b', { text: sp.name }), h('p', { text: sp.desc }));
    if (chosen) card.append(h('div', { class: 'cb-tag', text: 'Your specialization' }));
    else if (can) {
      card.append(pend
        ? h('div', { class: 'cb-confirm' }, h('button', { class: 'primary', text: 'Confirm', data: { focus: `sp-yes:${sp.id}` }, on: { click: () => act.confirm({ what: 'spec', spec: sp.id }) } }), h('button', { text: 'Back', on: { click: () => act.pick(null) } }))
        : h('button', { text: `Choose ${sp.name}`, data: { focus: `sp:${sp.id}` }, on: { click: () => act.pick({ what: 'spec', spec: sp.id }) } }));
    }
    specs.append(card);
  }
  root.append(specs);

  // second class
  root.append(h('h3', { class: 'cb-path-h', text: 'Second path' }));
  if (s.second) root.append(classCard(CLASSES[s.second], { compact: true, chosen: true }));
  else if (s.level < MULTICLASS_LEVEL) root.append(h('p', { class: 'cb-path-sub', text: `At level ${MULTICLASS_LEVEL} you can learn a second path and slot its abilities too.` }));
  else {
    const cards = h('div', { class: 'cb-pcards' });
    for (const id of PLAYABLE_CLASSES.filter((x) => x !== s.cls)) {
      const pend = s.pending?.what === 'second' && s.pending.cls === id;
      const btn = pend
        ? h('div', { class: 'cb-confirm' }, h('button', { class: 'primary', text: 'Confirm second path', data: { focus: `sc-yes:${id}` }, on: { click: () => act.confirm({ what: 'second', cls: id }) } }), h('button', { text: 'Back', on: { click: () => act.pick(null) } }))
        : h('button', { class: 'primary', text: `Learn ${CLASSES[id].name}`, data: { focus: `sc:${id}` }, on: { click: () => act.pick({ what: 'second', cls: id }) } });
      cards.append(classCard(CLASSES[id], { button: btn, chosen: pend }));
    }
    root.append(cards);
  }
  return root;
}
