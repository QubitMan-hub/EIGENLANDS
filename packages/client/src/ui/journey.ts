import './journey.css';
import { BOSSES, CLASSES, ITEMS, MULTICLASS_LEVEL, QUBIT_UNLOCK_LEVELS, SPEC_LEVEL, xpForLevel, type ClassId } from '@eigenlands/shared';
import { h } from './dom';

export interface JourneyInfo {
  level: number; xp: number; cls: ClassId; spec: string | null; second: ClassId | null;
  qubits: number; gates: number; runes: number; summons: Record<string, number>;
}
export function journeyMilestones(s: JourneyInfo): Array<[string, string]> {
  const next = QUBIT_UNLOCK_LEVELS.find(l => l > s.level);
  return [
    ['Orb growth', next ? `Next level milestone: ${next}. Bonus orbs are included in your current total.` : 'All level-based orb milestones reached.'],
    ['Specialization', s.spec ? CLASSES[s.cls].specs.find(p => p.id === s.spec)?.name ?? s.spec : s.cls === 'wanderer' ? `Choose a class first; opens at level ${SPEC_LEVEL}.` : s.level >= SPEC_LEVEL ? 'Available on the Circuit Board.' : `Opens at level ${SPEC_LEVEL}.`],
    ['Second class', s.second ? CLASSES[s.second].name : s.cls === 'wanderer' ? `Choose a class first; opens at level ${MULTICLASS_LEVEL}.` : s.level >= MULTICLASS_LEVEL ? 'Available on the Circuit Board.' : `Opens at level ${MULTICLASS_LEVEL}.`],
  ];
}

/** A live Journal page, refreshed by Gameplay's existing frame; no timer or secondary state store. */
export function buildJourney(read: () => JourneyInfo | null, openBoard: () => void): { el: HTMLElement; refresh(): void } {
  const title = h('h3'), summary = h('p'), xp = h('progress'), xpText = h('p', { class:'small' });
  xp.setAttribute('aria-label', 'Experience toward next level');
  const milestones = h('dl', { class:'journey-milestones' });
  const encounters = h('div', { class:'journey-encounters' });
  const el = h('section', { class:'journey' }, title, summary, xp, xpText,
    h('button', { class:'primary', text:'Open Circuit Board', on:{click:openBoard} }),
    h('h3', {text:'Your next steps'}), milestones,
    h('h3', {text:'Boss encounters'}), h('p', {class:'small dim',text:'Craft a summoning item, then use it on open ground well outside Hadamere and the starting area.'}), encounters);
  let previous = '';
  const refresh = () => {
    const s = read(); if (!s) { title.textContent='Waiting for progression…'; return; }
    const key = JSON.stringify(s); if (key === previous) return; previous = key;
    title.textContent = `Level ${s.level} · ${CLASSES[s.cls].name}`;
    summary.textContent = `${s.qubits} awakened orbs · ${s.gates} gate tokens (placed included) · ${s.runes} correction runes`;
    xp.max = xpForLevel(s.level); xp.value = Math.min(xp.max, Math.max(0,s.xp));
    xpText.textContent = `${s.xp} / ${xp.max} XP · ${Math.max(0,xp.max-s.xp)} to level ${s.level+1}`;
    milestones.replaceChildren(...journeyMilestones(s).flatMap(([name,text])=>[h('dt',{text:name}),h('dd',{text})]));
    encounters.replaceChildren(...Object.values(BOSSES).map(b=>h('section', {},
      h('h4',{text:b.name}), h('p',{class:'small',text:`Level ${b.level} required · ${ITEMS[b.item]?.name ?? b.item} · ${s.summons[b.item] ?? 0} in pack`}),
      h('p',{class:'small dim',text:`Only one nearby encounter of this kind can be called at a time. ${b.loot}`}))));
  };
  refresh(); return {el,refresh};
}
