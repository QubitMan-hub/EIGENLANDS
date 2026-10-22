import { ITEMS, MAX_HEARTS, NPC_BY_ID, giftTaste, hoursText, recipeById, type DialogueChoice, type DialogueMsg } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';
import { ensureP2Styles } from './p2style';

export interface DialogueActions {
  /** TALK with a topic (choices, ask, events, goodbye) */
  talk(npcId: string, topic: string): void;
  quest(npcId: string, quest: string, action: 'accept' | 'turnin'): void;
  shop(npcId: string): void;
  gift(npcId: string, slot: number): void;
  learn(npcId: string, recipe: string): void;
  chat(npcId: string, text: string): void;
  close(): void;
}

const TASTE_TEXT = { love: '❤ They loved it!', like: '♪ They liked it.', neutral: 'A polite thank-you.', hate: '✖ They really didn’t like that.' } as const;
const MOOD_ICON = { happy: '♪', sad: '…', surprised: '!', angry: '#', neutral: '' } as const;
const CPS = 55; // typewriter characters per second

export function heartsRow(hearts: number): HTMLElement {
  const row = h('div', { class: 'hearts', title: `${hearts} of ${MAX_HEARTS} hearts` });
  for (let i = 0; i < MAX_HEARTS; i++) row.append(h('span', { class: i < hearts ? 'hf' : 'he', text: '♥' }));
  return row;
}

/**
 * The conversation window: portrait + name plate, a typewriter text box (click / E / Space / Enter to skip, then to
 * turn the page), then response buttons (number keys pick them). Pages come from `msg.text` + `msg.pages`.
 */
export function buildDialogue(msg: DialogueMsg, portraitUrl: string, profile: Profile, tip: Tooltip, act: DialogueActions, opts: { reduced?: boolean } = {}): HTMLElement {
  ensureP2Styles();
  const root = h('div', { class: 'dialogue', data: { npc: msg.npcId } });
  const pages = [msg.text, ...(msg.pages ?? [])].filter((p) => p && p.length);
  let page = 0;
  let shown = 0;
  let timer = 0;
  let mode: 'talk' | 'gift' | 'chat' = 'talk';
  let giftNote: HTMLElement | null = msg.gift && msg.gift.delta !== 0 ? h('div', { class: `gift-note ${msg.gift.taste}`, text: `${TASTE_TEXT[msg.gift.taste]} (${msg.gift.delta >= 0 ? '+' : ''}${msg.gift.delta} friendship)` }) : null;
  const npc = NPC_BY_ID[msg.npcId];
  const box = h('div', { class: 'dlg-box', title: 'Click, E or Space: skip / next' });
  const textEl = h('span');
  const more = h('span', { class: 'more' });
  const pageNo = h('span', { class: 'pageno' });
  box.append(textEl, more, pageNo);
  const below = h('div', { class: 'dlg-below' });

  const full = () => pages[page] ?? '';
  const typing = () => shown < full().length;
  const paint = () => {
    textEl.textContent = full().slice(0, shown);
    const last = page >= pages.length - 1;
    more.textContent = typing() ? '' : last ? '' : '▸ next';
    pageNo.textContent = pages.length > 1 ? `${page + 1}/${pages.length}` : '';
    below.hidden = typing() || !last;
  };
  const type = () => {
    clearInterval(timer);
    shown = opts.reduced ? full().length : 0;
    paint();
    if (opts.reduced) return;
    timer = window.setInterval(() => {
      if (!root.isConnected && shown > 0) { clearInterval(timer); return; }
      shown = Math.min(full().length, shown + 2);
      paint();
      if (!typing()) clearInterval(timer);
    }, 2000 / CPS);
  };
  /** skip the typewriter, or turn the page */
  const advance = (): boolean => {
    if (typing()) { shown = full().length; clearInterval(timer); paint(); return true; }
    if (page < pages.length - 1) { page++; type(); return true; }
    return false;
  };
  box.addEventListener('click', () => advance());

  const choose = (c: DialogueChoice) => {
    if (c.id.startsWith('accept:')) act.quest(msg.npcId, c.id.slice(7), 'accept');
    else if (c.id.startsWith('turnin:')) act.quest(msg.npcId, c.id.slice(7), 'turnin');
    else act.talk(msg.npcId, c.id);
  };

  const renderBelow = () => {
    clear(below);
    if (giftNote) below.append(giftNote);
    if (msg.end) { below.append(h('div', { class: 'dlg-actions' }, h('button', { text: 'Close', on: { click: () => act.close() } }))); return; }
    if (mode === 'gift') {
      below.append(h('div', { class: 'side-title', text: 'Choose a gift (one per day)' }));
      const pack = h('div', { class: 'pack-pick' });
      profile.inv.forEach((st, i) => {
        if (!st || ITEMS[st.id]?.kind === 'tool' || ITEMS[st.id]?.kind === 'weapon') return;
        const slot = h('div', { class: 'slot small', on: { click: () => { act.gift(msg.npcId, i); mode = 'talk'; } } }, iconCell(st));
        // once they know you well enough, hint at reactions
        const taste = npc && msg.hearts >= 3 ? giftTaste(npc, st.id) : null;
        if (taste === 'love') slot.append(h('span', { class: 'taste', text: '❤' }));
        if (taste === 'hate') slot.append(h('span', { class: 'taste', text: '✖' }));
        tip.attach(slot, () => tooltipFor(st));
        pack.append(slot);
      });
      below.append(pack, h('div', { class: 'small dim', text: 'Villagers love some things and dislike others. Their tastes appear in your Journal (L → Friends) as you become friends.' }),
        h('button', { text: 'Never mind', on: { click: () => { mode = 'talk'; renderBelow(); } } }));
      return;
    }
    if (mode === 'chat') {
      const input = h('input', { type: 'text', placeholder: `Say something to ${msg.name.split(' ')[0]}…`, maxLength: 140 });
      const send = () => { const v = input.value.trim(); if (v) { act.chat(msg.npcId, v); input.value = ''; mode = 'talk'; } };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); e.stopPropagation(); });
      below.append(h('div', { class: 'chatrow' }, input, h('button', { class: 'primary', text: 'Say', on: { click: send } })), h('button', { text: 'Back', on: { click: () => { mode = 'talk'; renderBelow(); } } }));
      queueMicrotask(() => input.focus());
      return;
    }
    const list = h('div', { class: 'dlg-choices' });
    const choices = msg.choices ?? [];
    choices.forEach((c, i) => list.append(h('button', { class: c.kind ?? '', on: { click: () => choose(c) } }, h('span', { class: 'k', text: `${i + 1}` }), c.text)));
    if (choices.length) below.append(list);
    // a heart event is a little scene: only its choices
    if (msg.event) return;
    const acts = h('div', { class: 'dlg-actions' });
    if (msg.canShop) acts.append(h('button', { class: 'primary', text: '🛒 Shop', on: { click: () => act.shop(msg.npcId) } }));
    else if (npc?.shop && msg.hours) acts.append(h('button', { text: `🛒 Shop closed (opens ${hoursText(msg.hours)})`, disabled: true }));
    if (msg.canGift) acts.append(h('button', { text: '🎁 Give a gift', on: { click: () => { mode = 'gift'; giftNote = null; renderBelow(); } } }));
    else acts.append(h('button', { text: '🎁 Gifted today', disabled: true }));
    for (const rid of msg.teaches) { const r = recipeById(rid); if (r) acts.append(h('button', { text: `📖 Learn: ${ITEMS[r.out.id]?.name ?? r.id}`, on: { click: () => act.learn(msg.npcId, rid) } })); }
    if (msg.canChat) acts.append(h('button', { text: '💬 Chat', on: { click: () => { mode = 'chat'; renderBelow(); } } }));
    acts.append(h('button', { text: 'Goodbye', on: { click: () => act.talk(msg.npcId, 'bye') } }));
    below.append(acts, h('div', { class: 'dlg-hint', text: 'Click / E / Space: skip · 1–9: answer · Esc: leave' }));
  };

  const portrait = h('div', { class: `dlg-portrait ${msg.mood ?? ''}` }, h('img', { src: portraitUrl, alt: msg.name }), h('span', { class: 'dlg-mood', text: MOOD_ICON[msg.mood ?? 'neutral'] }));
  const plate = h('div', { class: 'dlg-plate' },
    msg.event ? h('div', { class: 'dlg-event', text: msg.event }) : null,
    h('div', { class: 'dlg-name', text: msg.name }), h('div', { class: 'dlg-title', text: msg.title }), heartsRow(msg.hearts),
    msg.doing ? h('div', { class: 'dlg-doing', text: `Currently ${msg.doing}` }) : null,
    npc?.shop && msg.hours ? h('div', { class: `dlg-hours ${msg.shopOpen ? 'open' : 'shut'}`, text: `${npc.shop.name}: ${hoursText(msg.hours)} ${msg.shopOpen ? '(open)' : '(closed)'}` }) : null);
  root.append(h('div', { class: 'dlg-top' }, portrait, plate), box, below);
  renderBelow();
  type();

  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) { window.removeEventListener('keydown', onKey, true); clearInterval(timer); return; }
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { if (advance()) e.preventDefault(); return; }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m && !below.hidden && mode === 'talk') {
      const c = (msg.choices ?? [])[Number(m[1]) - 1];
      if (c) { e.preventDefault(); e.stopImmediatePropagation(); choose(c); }
    }
  };
  window.addEventListener('keydown', onKey, true);
  if (msg.end) setTimeout(() => { if (root.isConnected) act.close(); }, Math.min(4000, 1200 + full().length * 25));
  (root as unknown as { rerender: () => void }).rerender = renderBelow;
  return root;
}
