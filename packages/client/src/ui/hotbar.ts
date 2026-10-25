import { HOTBAR, itemName } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { h, iconCell, tooltipFor, type Tooltip } from './dom';

/** Bottom quick-bar: 10 slots mirroring inventory slots 0-9. Number keys / wheel / tap select; drag to rearrange. */
export class Hotbar {
  readonly el = h('div', { id: 'hotbar' });
  selected = 0;
  onSelect: (i: number) => void = () => {};
  onMove: (from: number, to: number) => void = () => {};
  private slots: HTMLElement[] = [];

  constructor(
    private profile: Profile,
    private tooltip: Tooltip,
  ) {
    for (let i = 0; i < HOTBAR; i++) {
      const s = h('div', { class: 'hslot', data: { i } }, h('span', { class: 'hkey', text: String((i + 1) % 10) }));
      s.addEventListener('pointerdown', () => this.select(i));
      s.addEventListener('dragover', (e) => e.preventDefault());
      s.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer?.getData('text/plain'));
        if (Number.isInteger(from)) this.onMove(from, i);
      });
      this.tooltip.attach(s, () => {
        const st = this.profile.inv[i];
        return st ? tooltipFor(st) : null;
      });
      this.slots.push(s);
      this.el.append(s);
    }
    this.profile.onChange((c) => {
      if (c.has('inv')) this.render();
    });
    this.render();
  }

  select(i: number): void {
    this.selected = ((i % HOTBAR) + HOTBAR) % HOTBAR;
    this.render();
    this.onSelect(this.selected);
  }
  cycle(dir: number): void {
    this.select(this.selected + dir);
  }

  render(): void {
    this.slots.forEach((s, i) => {
      s.classList.toggle('sel', i === this.selected);
      for (const c of [...s.querySelectorAll('.cell')]) c.remove();
      const st = this.profile.inv[i] ?? null;
      if (st) {
        const cell = iconCell(st);
        s.append(cell);
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData('text/plain', String(i));
        });
      }
    });
  }

  selectedName(): string {
    const st = this.profile.inv[this.selected];
    return st ? itemName(st) : 'Empty hand';
  }
}
