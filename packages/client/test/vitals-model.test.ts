import { describe, expect, it } from 'vitest';
import {
  CHIPS_SHOWN,
  GaugeMotion,
  TRAIL_HOLD,
  collectStatuses,
  formatLeft,
  lowHealth,
  needTone,
  splitChips,
  staminaFraction,
} from '../src/ui/vitals-model';
import { vitalsLayout } from '../src/ui/vitals-art';

describe('GaugeMotion', () => {
  it('snaps to the first reading', () => {
    const g = new GaugeMotion();
    expect(g.step(0.016, 0.4, false)).toBe(false);
    expect([g.shown, g.trail]).toEqual([0.4, 0.4]);
  });

  it('drops the fill at once, flashes, and drains the trail after a hold', () => {
    const g = new GaugeMotion();
    g.step(0, 1, false);
    expect(g.step(0.016, 0.5, false)).toBe(true);
    expect(g.shown).toBe(0.5);
    expect(g.flash).toBeGreaterThan(0.9);
    expect(g.trail).toBe(1);
    g.step(TRAIL_HOLD - 0.05, 0.5, false);
    expect(g.trail).toBe(1);
    for (let i = 0; i < 80; i++) g.step(0.016, 0.5, false);
    expect(g.trail).toBe(0.5);
    expect(g.flash).toBe(0);
  });

  it('eases upward while recovering and settles', () => {
    const g = new GaugeMotion();
    g.step(0, 0.2, false);
    g.step(0.1, 0.8, false);
    expect(g.shown).toBeGreaterThan(0.2);
    expect(g.shown).toBeLessThan(0.8);
    for (let i = 0; i < 300; i++) g.step(0.016, 0.8, false);
    expect(g.shown).toBeCloseTo(0.8, 5);
    expect(g.step(0.016, 0.8, false)).toBe(false);
  });

  it('reduced motion shows every change immediately with no trail or flash', () => {
    const g = new GaugeMotion();
    g.step(0, 1, true);
    g.step(0.016, 0.1, true);
    expect([g.shown, g.trail, g.flash]).toEqual([0.1, 0.1, 0]);
    g.step(0.016, 0.9, true);
    expect(g.shown).toBe(0.9);
  });

  it('survives garbage targets', () => {
    const g = new GaugeMotion();
    g.step(0, Number.NaN, false);
    expect(g.shown).toBe(0);
    g.step(0.016, 7, false);
    expect(g.shown).toBeLessThanOrEqual(1);
  });
});

describe('needs and health thresholds', () => {
  it('warns at 20 and marks empty at 0', () => {
    expect([100, 21, 20, 1, 0].map(needTone)).toEqual(['ok', 'ok', 'low', 'low', 'empty']);
  });
  it('low health is under 30 % and not when dead', () => {
    expect(lowHealth(17, 60)).toBe(true);
    expect(lowHealth(18, 60)).toBe(false);
    expect(lowHealth(0, 60)).toBe(false);
  });
  it('stamina is whole charges plus recharge progress', () => {
    expect(staminaFraction(2, 0, 4, 2)).toBe(1);
    expect(staminaFraction(1, 4, 4, 2)).toBe(0.5);
    expect(staminaFraction(1, 2, 4, 2)).toBe(0.75);
    expect(staminaFraction(0, 4, 4, 2)).toBe(0);
  });
});

describe('status registry', () => {
  const none = { buffs: {}, serverNow: 1000, auras: [] as const, needs: null };
  it('lists only live effects, shortest timer first within a tone', () => {
    const list = collectStatuses({
      ...none,
      buffs: {
        might: { until: 1000 + 90_000, power: 0.2 },
        regen: { until: 1000 + 30_000, power: 2 },
        ward: { until: 500, power: 0.2 },
      },
    });
    expect(list.map((s) => s.id)).toEqual(['regen', 'might']);
    expect(list[0]!.left).toBe(30);
  });

  it('reports low needs only in Adventure and never invents temperature or injuries', () => {
    expect(collectStatuses({ ...none }).length).toBe(0);
    const hungry = collectStatuses({ ...none, needs: { food: 10, water: 0 } });
    expect(hungry.map((s) => s.id)).toEqual(['hungry', 'dehydrated']);
    expect(hungry.every((s) => ['chill', 'heat', 'bleed', 'fracture', 'poison'].indexOf(s.id) < 0)).toBe(true);
  });

  it('shows reserved conditions as soon as the server reports them, afflictions first', () => {
    const list = collectStatuses({
      ...none,
      auras: ['shield'],
      buffs: { chill: { until: 1000 + 20_000, power: 1 }, regen: { until: 1000 + 5000, power: 1 } },
    });
    expect(list.map((s) => s.id)).toEqual(['chill', 'aura_shield', 'regen']);
    expect(list[0]!.tone).toBe('debuff');
  });

  it('names unknown server buffs instead of dropping them', () => {
    const [s] = collectStatuses({ ...none, buffs: { frost_ward: { until: 9000, power: 1 } } });
    expect(s!.label).toBe('Frost ward');
    expect(s!.tone).toBe('buff');
  });

  it('formats timers compactly and folds extra chips', () => {
    expect([null, 45, 100, 3000, 7200].map(formatLeft)).toEqual(['', '45s', '2m', '50m', '2h']);
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      label: '',
      tone: 'buff' as const,
      icon: 'hex',
      left: i,
      desc: '',
    }));
    const folded = splitChips(many, false);
    expect(folded.shown.length).toBe(CHIPS_SHOWN - 1);
    expect(folded.more).toBe(7 - (CHIPS_SHOWN - 1));
    expect(splitChips(many, true).shown.length).toBe(7);
  });
});

describe('vial layout', () => {
  it('keeps every vial inside the canvas on one ground line', () => {
    const all = vitalsLayout(['health', 'mana', 'stamina', 'food', 'water']);
    for (const p of all.places) {
      expect(p.cx - (p.w + 1)).toBeGreaterThanOrEqual(0);
      expect(p.cx + p.w + 1).toBeLessThanOrEqual(all.width);
      expect(p.bottom).toBe(all.height - 1);
    }
    const ledger = vitalsLayout(['health', 'stamina']);
    expect(ledger.width).toBeLessThan(all.width);
    // 2:1 art at 2× must fit the 216px ledger
    expect(all.width * 2).toBeLessThanOrEqual(216);
  });
});
