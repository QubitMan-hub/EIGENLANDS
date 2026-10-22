import { INV_SIZE, TRADE_MAX_ITEMS, type Stack, type TradeOffer, type TradeStateMsg } from '@eigenlands/shared';
import type { Profile } from '../../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from '../../ui/dom';

export interface TradeActs {
  offer(items: Array<{ slot: number; n: number }>, coins: number): void;
  confirm(): void;
  cancel(): void;
}

/** client pause after any change before Confirm is enabled (the server refuses confirms within 1 s of a change) */
const CHECK_MS = 1100;

/**
 * The trade window: your pack (click or drag items into your offer; shift/right-click adds one), your offer with
 * coins, their offer, both confirmation states and a plain status line.
 */
export class TradeWindow {
  readonly el: HTMLElement;
  private pack = h('div', { class: 'trade-grid' });
  private mineGrid = h('div', { class: 'offer-grid', id: 'trade-mine' });
  private theirsGrid = h('div', { class: 'offer-grid', id: 'trade-theirs' });
  private coins = h('input', { type: 'number', class: 'trade-coins', value: '0' }) as HTMLInputElement;
  private theirCoins = h('div', { class: 'coins' });
  private myConf = h('div', { class: 'conf' });
  private theirConf = h('div', { class: 'conf' });
  private theirTitle = h('h4', { text: 'Their offer' });
  private status = h('div', { class: 'trade-status', id: 'trade-status' });
  private confirmBtn = h('button', { class: 'primary', id: 'trade-confirm', text: 'Confirm' }) as HTMLButtonElement;
  /** slot -> amount offered (local edit state, mirrored from the server when idle) */
  private offer = new Map<number, number>();
  private offerCoins = 0;
  private dirty = false;
  private sendT: number | null = null;
  private st: TradeStateMsg | null = null;
  private changedAt = 0;
  private sig = '';
  private unsub: () => void;
  private tick: number;

  constructor(private profile: Profile, private tip: Tooltip, private acts: TradeActs) {
    this.coins.min = '0';
    this.coins.step = '1';
    this.coins.setAttribute('aria-label', 'Coins to offer');
    this.coins.addEventListener('input', () => {
      const v = Math.max(0, Math.min(this.profile.coins, Math.floor(Number(this.coins.value) || 0)));
      this.offerCoins = v;
      this.queueSend();
    });
    this.coins.addEventListener('change', () => { this.coins.value = String(this.offerCoins); });
    this.confirmBtn.addEventListener('click', () => this.acts.confirm());
    this.mineGrid.addEventListener('dragover', (e) => e.preventDefault());
    this.mineGrid.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = Number(e.dataTransfer?.getData('text/plain'));
      if (Number.isInteger(f)) this.add(f, false);
    });
    this.el = h('div', { class: 'trade' },
      this.status,
      h('div', { class: 'trade-cols' },
        h('section', { class: 'trade-pack' }, h('h4', { text: 'Your pack' }), this.pack,
          h('div', { class: 'small dim', text: 'Click or drag an item into your offer. Shift-click or right-click adds one at a time.' })),
        h('section', { class: 'trade-side mine' }, h('h4', { text: 'Your offer' }), this.mineGrid,
          h('label', { class: 'coin-row' }, 'Coins', this.coins), this.myConf),
        h('section', { class: 'trade-side theirs' }, this.theirTitle, this.theirsGrid, this.theirCoins, this.theirConf)),
      h('div', { class: 'trade-btns' }, this.confirmBtn, h('button', { class: 'danger', text: 'Cancel trade', on: { click: () => this.acts.cancel() } })));
    this.unsub = profile.onChange(() => this.render());
    this.tick = window.setInterval(() => this.renderStatus(), 250);
  }

  destroy(): void { this.unsub(); clearInterval(this.tick); if (this.sendT) clearTimeout(this.sendT); }

  private remaining(slot: number): number {
    const s = this.profile.inv[slot];
    return s ? s.n - (this.offer.get(slot) ?? 0) : 0;
  }

  private add(slot: number, one: boolean): void {
    const s = this.profile.inv[slot];
    if (!s || !this.st) return;
    const cur = this.offer.get(slot) ?? 0;
    if (!cur && this.offer.size >= TRADE_MAX_ITEMS) { this.flash(`You can offer up to ${TRADE_MAX_ITEMS} stacks.`); return; }
    const n = one ? Math.min(s.n, cur + 1) : s.n;
    if (n === cur) return;
    this.offer.set(slot, n);
    this.queueSend();
  }

  private take(slot: number, one: boolean): void {
    const cur = this.offer.get(slot) ?? 0;
    if (!cur) return;
    if (one && cur > 1) this.offer.set(slot, cur - 1); else this.offer.delete(slot);
    this.queueSend();
  }

  private queueSend(): void {
    this.dirty = true;
    this.render();
    if (this.sendT) clearTimeout(this.sendT);
    this.sendT = window.setTimeout(() => {
      this.sendT = null;
      this.acts.offer([...this.offer].map(([slot, n]) => ({ slot, n })), this.offerCoins);
      this.dirty = false;
    }, 120);
  }

  private flashAt = -1e9;
  private flash(text: string): void { this.flashAt = performance.now(); this.status.textContent = text; this.status.className = 'trade-status warn'; }

  /** A TRADE_STATE for the open trade. */
  set(st: TradeStateMsg): void {
    const before = this.sig;
    this.sig = JSON.stringify([st.mine, st.theirs]);
    if (before && before !== this.sig) this.changedAt = performance.now();
    this.st = st;
    this.theirTitle.textContent = `${st.other ?? 'Their'}'s offer`;
    if (!this.dirty && !this.sendT && st.mine) {
      this.offer = new Map(st.mine.items.map((i) => [i.slot, i.stack.n]));
      this.offerCoins = st.mine.coins;
      if (document.activeElement !== this.coins) this.coins.value = String(st.mine.coins);
    }
    this.render();
  }

  private renderOffer(grid: HTMLElement, o: TradeOffer | undefined, mine: boolean): void {
    clear(grid);
    const items: Array<{ slot: number; stack: Stack }> = mine
      ? [...this.offer].map(([slot, n]) => ({ slot, stack: { ...(this.profile.inv[slot] ?? { id: 'stone' }), n } as Stack })).filter((x) => this.profile.inv[x.slot])
      : o?.items ?? [];
    for (let i = 0; i < TRADE_MAX_ITEMS; i++) {
      const it = items[i];
      const slot = h('div', { class: `slot${it ? ' full' : ''}` });
      if (it) {
        slot.append(iconCell(it.stack));
        this.tip.attach(slot, () => tooltipFor(it.stack));
        if (mine) {
          slot.title = 'Click to take back (shift/right-click: one)';
          slot.addEventListener('click', (e) => this.take(it.slot, e.shiftKey));
          slot.addEventListener('contextmenu', (e) => { e.preventDefault(); this.take(it.slot, true); });
          const max = this.profile.inv[it.slot]?.n ?? 1;
          if (max > 1) {
            slot.append(h('div', { class: 'pm-step' },
              h('button', { text: '−', title: 'One less', on: { click: (e) => { e.stopPropagation(); this.take(it.slot, true); } } }),
              h('button', { text: '+', title: 'One more', on: { click: (e) => { e.stopPropagation(); this.add(it.slot, true); } } })));
          }
        }
      }
      grid.append(slot);
    }
  }

  render(): void {
    if (!this.st) return;
    // pack
    clear(this.pack);
    for (let i = 0; i < INV_SIZE; i++) {
      const s = this.profile.inv[i];
      const left = this.remaining(i);
      const slot = h('div', { class: `slot${s && left <= 0 ? ' used' : ''}`, data: { i } });
      if (s && left > 0) {
        const cell = iconCell({ ...s, n: left });
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', String(i)); this.tip.hide(); });
        slot.append(cell);
        this.tip.attach(slot, () => tooltipFor(s));
        slot.addEventListener('click', (e) => this.add(i, e.shiftKey));
        slot.addEventListener('contextmenu', (e) => { e.preventDefault(); this.add(i, true); });
      } else if (s) slot.append(iconCell(s));
      this.pack.append(slot);
    }
    this.renderOffer(this.mineGrid, this.st.mine, true);
    this.renderOffer(this.theirsGrid, this.st.theirs, false);
    this.theirCoins.textContent = `${this.st.theirs?.coins ?? 0} coins`;
    this.coins.max = String(this.profile.coins);
    this.myConf.textContent = this.st.myConfirm ? '✓ You confirmed' : 'Not confirmed';
    this.myConf.classList.toggle('on', !!this.st.myConfirm);
    this.theirConf.textContent = this.st.theirConfirm ? `✓ ${this.st.other} confirmed` : 'Not confirmed';
    this.theirConf.classList.toggle('on', !!this.st.theirConfirm);
    this.renderStatus();
  }

  private renderStatus(): void {
    const st = this.st;
    if (!st) return;
    const checking = performance.now() - this.changedAt < CHECK_MS;
    const empty = !this.offer.size && !this.offerCoins && !st.theirs?.items.length && !st.theirs?.coins;
    this.confirmBtn.disabled = !!st.myConfirm || checking || this.dirty || empty;
    this.confirmBtn.textContent = st.myConfirm ? 'Confirmed ✓' : checking ? 'Check the offer…' : 'Confirm';
    let text: string;
    if (performance.now() - this.flashAt < 2500) return;
    if (empty) text = 'Add items or coins to the trade. Any change resets both confirmations.';
    else if (st.myConfirm && st.theirConfirm) text = 'Both confirmed. Trading…';
    else if (st.myConfirm) text = `You confirmed. Waiting for ${st.other}…`;
    else if (st.theirConfirm) text = `${st.other} confirmed. Check their offer, then press Confirm.`;
    else text = 'Check both offers, then press Confirm. Any change resets both confirmations.';
    this.status.textContent = text;
    this.status.className = `trade-status${st.theirConfirm && !st.myConfirm ? ' ready' : ''}`;
  }
}
