import { describe, expect, it } from 'vitest';
import { BOSSES, ELITE, ENEMY_BY_KIND } from '@eigenlands/shared';
import { BOSS_IDS, BOSS_THEMES, BOSS_H, BOSS_W, WINDOW, phaseMarks, themeVars } from '../src/ui/boss-frames';
import { ELITE_INFO, eliteMods, enemyChips, factionOf, poiseLabel } from '../src/ui/enemy-model';

describe('boss frame themes', () => {
  it('gives every boss its own theme with a distinct look', () => {
    expect(Object.keys(BOSS_THEMES).sort()).toEqual(Object.keys(BOSSES).sort());
    const looks = BOSS_IDS.map((id) => {
      const t = BOSS_THEMES[id];
      return `${t.frame.join()}|${t.accent}|${t.fill.join()}`;
    });
    expect(new Set(looks).size).toBe(BOSS_IDS.length);
    const titles = BOSS_IDS.map((id) => BOSS_THEMES[id].title);
    expect(new Set(titles).size).toBe(BOSS_IDS.length);
    for (const id of BOSS_IDS) expect(BOSS_THEMES[id].title.length).toBeGreaterThan(5);
  });

  it('exports CSS colours as palette hex values only', () => {
    for (const id of BOSS_IDS)
      for (const v of Object.values(themeVars(BOSS_THEMES[id]))) expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps the bar window inside the frame', () => {
    expect(WINDOW.x + WINDOW.w).toBeLessThan(BOSS_W);
    expect(WINDOW.y + WINDOW.h).toBeLessThan(BOSS_H);
  });

  it('lights a phase gem once health has fallen to its threshold', () => {
    const marks = phaseMarks(BOSSES.slime_king.phases, 0.5);
    expect(marks.map((m) => m.reached)).toEqual([true, false]);
    expect(phaseMarks([0.5], 1)[0]!.reached).toBe(false);
    expect(phaseMarks([0.5], 0.5)[0]!.reached).toBe(true);
  });
});

describe('creature classification', () => {
  it('puts elites above camps and allies above everything', () => {
    expect(factionOf({}, 0, false)).toBe('hostile');
    expect(factionOf({ neutral: true }, 0, false)).toBe('neutral');
    expect(factionOf({ passive: true }, 0, false)).toBe('passive');
    expect(factionOf({ passive: true }, ELITE.SWIFT, false)).toBe('elite');
    expect(factionOf({}, ELITE.SWIFT, true)).toBe('ally');
  });

  it('describes every elite modifier and nothing else', () => {
    expect(eliteMods(0)).toEqual([]);
    expect(eliteMods(ELITE.HARDENED | ELITE.VOLATILE)).toEqual([ELITE.HARDENED, ELITE.VOLATILE]);
    for (const bit of Object.values(ELITE)) expect(ELITE_INFO[bit]!.desc.length).toBeGreaterThan(10);
  });

  it('shows camp, modifiers, armour, night and stance as chips with explanations', () => {
    const chips = enemyChips({
      faction: 'elite',
      def: { armor: true },
      elite: ELITE.HARDENED | ELITE.SWIFT,
      st: 5,
      night: true,
    });
    expect(chips.map((c) => c.id)).toEqual(['elite', 'elite_1', 'elite_2', 'armor', 'night', 'staggered']);
    for (const c of chips) {
      expect(c.desc.length).toBeGreaterThan(3);
      expect(c.icon.length).toBeGreaterThan(0);
    }
    expect(enemyChips({ faction: 'hostile', elite: 0, st: 2, night: false }).map((c) => c.id)).toEqual([
      'hostile',
      'windup',
    ]);
  });

  it('names armour on armoured creatures and poise on the rest', () => {
    expect(poiseLabel({ armor: true })).toBe('Armor');
    expect(poiseLabel({})).toBe('Poise');
  });

  it('knows every real enemy definition well enough to classify it', () => {
    for (const def of Object.values(ENEMY_BY_KIND)) {
      expect(['hostile', 'neutral', 'passive']).toContain(factionOf(def, 0, false));
    }
  });
});
