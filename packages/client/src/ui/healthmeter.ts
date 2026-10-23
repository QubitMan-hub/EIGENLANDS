import './encounter.css';
import { h } from './dom';
import { healthReading } from './encounter-model';

/** Shared numeric encounter health. A new identity or healing snaps the damage trail. */
export class HealthMeter {
  readonly root = h('div', { class: 'enc-health' });
  private trail = h('i', { class: 'enc-trail' });
  private fill = h('i', { class: 'enc-fill' });
  private number = h('span', { class: 'enc-number' });
  private identity = '';
  private previous = 0;
  private maximum = -1;
  private label = '';
  constructor() {
    this.root.setAttribute('role', 'progressbar');
    this.root.setAttribute('aria-valuemin', '0');
    this.root.append(this.trail, this.fill, this.number);
  }
  update(id: string, name: string, hp: number, max: number): void {
    const value = healthReading(hp, max);
    if (id === this.identity && name === this.label && value.hp === this.previous && value.max === this.maximum) return;
    const reset = id !== this.identity || value.hp > this.previous;
    this.root.classList.toggle('enc-reset', reset);
    this.fill.style.width = this.trail.style.width = `${value.percent}%`;
    if (reset) { this.trail.getBoundingClientRect(); this.root.classList.remove('enc-reset'); }
    const text = `${value.hp} / ${value.max}`;
    if (this.number.textContent !== text) this.number.textContent = text;
    this.root.setAttribute('aria-label', `${name} health`);
    this.root.setAttribute('aria-valuenow', String(value.hp));
    this.root.setAttribute('aria-valuemax', String(value.max));
    this.identity = id; this.previous = value.hp; this.maximum = value.max; this.label = name;
  }
}
