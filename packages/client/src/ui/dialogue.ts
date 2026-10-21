import { ITEMS, MAX_HEARTS, NPC_BY_ID, giftTaste, recipeById, type DialogueMsg } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';

export interface DialogueActions {
  shop(npcId: string): void;
  gift(npcId: string, slot: number): void;
  learn(npcId: string, recipe: string): void;
  chat(npcId: string, text: string): void;
  close(): void;
}

const TASTE_TEXT = { love: '❤ They loved it!', like: '👍 They liked it.', neutral: 'A polite thank-you.', hate: '💔 They really didn’t like that.' } as const;

export function heartsRow(hearts: number): HTMLElement {
  const row = h('div', { class: 'hearts', title: `${hearts} of ${MAX_HEARTS} hearts` });
  for (let i = 0; i < MAX_HEARTS; i++) row.append(h('span', { class: i < hearts ? 'hf' : 'he', text: '♥' }));
  return row;
}

export function buildDialogue(msg: DialogueMsg, portraitUrl: string, profile: Profile, tip: Tooltip, act: DialogueActions): HTMLElement {
  const root = h('div', { class: 'dialogue' });
  let mode: 'talk' | 'gift' | 'chat' = 'talk';
  let giftNote: HTMLElement | null = msg.gift ? h('div', { class: `gift-note ${msg.gift.taste}`, text: `${TASTE_TEXT[msg.gift.taste]} (${msg.gift.delta >= 0 ? '+' : ''}${msg.gift.delta})` }) : null;

  const render = () => {
    clear(root);
    const npc = NPC_BY_ID[msg.npcId];
    const head = h('div', { class: 'dhead' },
      h('img', { class: 'portrait', src: portraitUrl }),
      h('div', {}, h('b', { class: 'dname', text: msg.name }), h('div', { class: 'small dim', text: msg.title }), heartsRow(msg.hearts), h('div', { class: 'small dim', text: msg.doing ? `Currently ${msg.doing}` : '' })));
    const text = h('div', { class: 'dtext', text: `“${msg.text}”` });
    root.append(head, text);
    if (giftNote) root.append(giftNote);
    if (mode === 'gift') {
      root.append(h('div', { class: 'side-title', text: 'Choose a gift (one per day)' }));
      const pack = h('div', { class: 'pack-pick' });
      profile.inv.forEach((st, i) => {
        if (!st || ITEMS[st.id]?.kind === 'tool' || ITEMS[st.id]?.kind === 'weapon') return;
        const slot = h('div', { class: 'slot small', on: { click: () => { act.gift(msg.npcId, i); mode = 'talk'; } } }, iconCell(st));
        // once they know you well enough, hint at reactions
        const taste = npc && msg.hearts >= 4 ? giftTaste(npc, st.id) : null;
        if (taste === 'love') slot.append(h('span', { class: 'taste', text: '❤' }));
        if (taste === 'hate') slot.append(h('span', { class: 'taste', text: '✖' }));
        tip.attach(slot, () => tooltipFor(st));
        pack.append(slot);
      });
      root.append(pack, h('button', { text: 'Never mind', on: { click: () => { mode = 'talk'; render(); } } }));
      return;
    }
    if (mode === 'chat') {
      const input = h('input', { type: 'text', placeholder: `Say something to ${msg.name.split(' ')[0]}…`, maxLength: 140 });
      const send = () => { const v = input.value.trim(); if (v) { act.chat(msg.npcId, v); input.value = ''; mode = 'talk'; } };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); e.stopPropagation(); });
      root.append(h('div', { class: 'chatrow' }, input, h('button', { class: 'primary', text: 'Say', on: { click: send } })), h('button', { text: 'Back', on: { click: () => { mode = 'talk'; render(); } } }));
      queueMicrotask(() => input.focus());
      return;
    }
    const buttons = h('div', { class: 'dbtns' });
    if (msg.canShop) buttons.append(h('button', { class: 'primary', text: '🛒 Shop', on: { click: () => act.shop(msg.npcId) } }));
    if (msg.canGift) buttons.append(h('button', { text: '🎁 Give a gift', on: { click: () => { mode = 'gift'; giftNote = null; render(); } } }));
    else buttons.append(h('button', { text: '🎁 Already gifted today', disabled: true }));
    for (const rid of msg.teaches) { const r = recipeById(rid); if (r) buttons.append(h('button', { text: `📖 Learn: ${ITEMS[r.out.id]?.name ?? r.id}`, on: { click: () => act.learn(msg.npcId, rid) } })); }
    if (msg.canChat) buttons.append(h('button', { text: '💬 Chat', on: { click: () => { mode = 'chat'; render(); } } }));
    buttons.append(h('button', { text: 'Goodbye', on: { click: () => act.close() } }));
    root.append(buttons);
    if (msg.rumor) root.append(h('div', { class: 'small dim', text: `They lean in: “${msg.rumor}”` }));
  };
  render();
  (root as unknown as { rerender: () => void }).rerender = render;
  return root;
}
