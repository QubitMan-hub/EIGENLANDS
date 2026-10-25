// Dev-only UI lab: renders each panel with mock data (?panel=inventory|station|forge|dialogue|shop|journal|chest|shelter|rhythm).
import '../style.css';
import '../ui/fonts';
import '../ui/hud.css';
import { ITEMS, NPC_BY_ID, RECIPES, type DialogueMsg, type PanelMsg } from '@eigenlands/shared';
import { Audio } from '../audio';
import { ServerClock } from '../net/interp';
import { Profile } from '../game/profile';
import { Tooltip, h } from '../ui/dom';
import { Windows } from '../ui/windows';
import { Hotbar } from '../ui/hotbar';
import { buildInventory } from '../ui/inventory';
import { buildStation } from '../ui/station';
import { buildForge } from '../ui/forge';
import { buildDialogue } from '../ui/dialogue';
import { buildShop } from '../ui/shop';
import { buildChest, buildShelter } from '../ui/containers';
import { buildJourney } from '../ui/journey';
import { buildJournal } from '../ui/journal';
import { RhythmOverlay } from '../ui/rhythm';
import { Toasts } from '../ui/toast';
import { VitalsHud, type VitalsFrame } from '../ui/vitals';
import { BossBar } from '../ui/bossbar';
import { Moments, levelMoment } from '../ui/moments';
import { TargetFrame } from '../ui/targetframe';
import { enemyChips } from '../ui/enemy-model';
import { BOSSES } from '@eigenlands/shared';

const q2 = new URLSearchParams(location.search);
const panel = q2.get('panel') ?? 'inventory';
const profile = new Profile();
const inv = Array.from({ length: 30 }, () => null) as ReturnType<typeof Array.prototype.fill>;
const put = (i: number, id: string, n = 1, p?: object) => {
  inv[i] = { id, n, ...(p ? { p } : {}) };
};
put(0, 'axe', 1, { tier: 2 });
put(1, 'pickaxe', 1, { tier: 1 });
put(2, 'hoe', 1, { tier: 1 });
put(3, 'can', 1, { tier: 1 });
put(4, 'rod', 1, { tier: 1 });
put(5, 'net', 1, { tier: 1 });
put(6, 'sword', 1, {
  atk: 11,
  tier: 3,
  qname: 'Superior',
  phase: 4.5,
  stats: { atk: 8, dur: 3, spd: 4 },
  note: 'In phase: the metals sing together.',
});
put(7, 'turnip_seed', 12);
put(8, 'potato_seed', 4);
put(10, 'wood', 64);
put(11, 'stone', 40);
put(12, 'copper_ingot', 6);
put(13, 'iron_ingot', 3);
put(14, 'silver_ingot', 2);
put(15, 'qubit_crystal', 2);
put(16, 'slime_gel', 3);
put(17, 'turnip', 5);
put(18, 'minnow', 3);
put(19, 'ring_atk', 1, { stat: 'atk', val: 4 });
put(20, 'outfit_red', 1);
put(21, 'healing_potion', 2);
put(22, 'coal', 8);
put(23, 'fiber', 20);
profile.apply({
  inv,
  coins: 482,
  recipes: RECIPES.filter((r) => r.learn === 'start').map((r) => r.id),
  skills: { farming: 130, mining: 40, foraging: 12, fishing: 0, crafting: 70 },
  friends: { orla: { pts: 150, talked: 0, gifted: 0 }, tobin: { pts: 330, talked: 0, gifted: 0 } },
  equip: {
    ring1: { id: 'ring_hp', n: 1, p: { stat: 'hp', val: 12 } },
    ring2: null,
    outfit: 0,
    weapon: null,
    head: null,
    chest: null,
    legs: null,
    feet: null,
  },
  stats: { hpBonus: 12, def: 0, phase: 0, atkBonus: 4, luck: 0, haste: 0.1 },
});

const tip = new Tooltip();
const wins = new Windows();
const audio = new Audio();
const clock = new ServerClock();
new Toasts().add('Welcome to the UI lab', 'good');
const hotbar = new Hotbar(profile, tip);
document.body.append(hotbar.el);
const noop = () => {};
const portrait = () => h('div', { class: 'portrait-box' });
const portraitUrl = (id: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='48'><rect width='32' height='48' fill='#2c2f4a'/><circle cx='16' cy='14' r='8' fill='#d6a566'/><text x='16' y='42' font-size='8' fill='white' text-anchor='middle'>${id.slice(0, 5)}</text></svg>`)}`;

const dlg: DialogueMsg = {
  npcId: 'tobin',
  name: NPC_BY_ID.tobin!.name,
  title: NPC_BY_ID.tobin!.title,
  text: NPC_BY_ID.tobin!.lines.greet[1][0]!,
  hearts: 8,
  pts: 330,
  doing: 'minding the counter',
  canShop: true,
  canGift: true,
  canChat: true,
  teaches: ['fruit_pie'],
};
const chestPanel: PanelMsg = {
  kind: 'chest',
  tx: 0,
  ty: 0,
  sub: 'chest',
  chest: [{ id: 'wood', n: 20 }, null, { id: 'stone', n: 8 }, ...Array(27).fill(null)],
};
const shelterPanel: PanelMsg = {
  kind: 'shelter',
  tx: 0,
  ty: 0,
  sub: 'coop',
  shelter: { type: 'coop', animals: 2, max: 4, fed: false, ready: 3 },
};

switch (panel) {
  case 'inventory':
    wins.show(
      'inv',
      'Pack',
      buildInventory(profile, tip, { move: noop, trash: noop, equip: noop, use: noop }, portrait),
      { wide: true },
    );
    break;
  case 'station':
    wins.show('st', 'Workbench', buildStation('workbench', profile, tip, { craft: noop, experiment: noop }), {
      wide: true,
    });
    break;
  case 'alchemy':
    wins.show('st', 'Alchemy Table', buildStation('alchemy', profile, tip, { craft: noop, experiment: noop }), {
      wide: true,
    });
    break;
  case 'forge':
    wins.show('f', 'Anvil & Forge', buildForge(profile, tip, { start: noop }), { wide: true });
    break;
  case 'dialogue':
    wins.show(
      'd',
      NPC_BY_ID.tobin!.name,
      buildDialogue(dlg, portraitUrl('tobin'), profile, tip, {
        talk: noop,
        quest: noop,
        shop: noop,
        gift: noop,
        learn: noop,
        chat: noop,
        close: noop,
      }),
    );
    break;
  case 'shop':
    wins.show(
      's',
      'Greenbough General Store',
      buildShop(
        {
          npcId: 'tobin',
          name: 'Store',
          coins: 482,
          stock: [
            { item: 'turnip_seed', price: 10 },
            { item: 'potato_seed', price: 14 },
            { item: 'fertilizer', price: 20 },
            { item: 'chest', price: 50 },
          ],
          sell: { 17: 18, 18: 6, 10: 2, 12: 13 },
        },
        profile,
        tip,
        { buy: noop, sell: noop },
      ),
      { wide: true },
    );
    break;
  case 'journey': {
    const journey = buildJourney(
      () => ({
        level: 10,
        xp: 87,
        cls: 'superposer',
        spec: null,
        second: null,
        qubits: 4,
        gates: 12,
        runes: 2,
        summons: { slime_crown: 1 },
      }),
      noop,
    );
    wins.show(
      'j',
      'Journal',
      buildJournal(profile, portraitUrl, 'journey', 0, () => null, journey.el),
      { wide: true },
    );
    break;
  }
  case 'journal':
    wins.show('j', 'Journal', buildJournal(profile, portraitUrl), { wide: true });
    break;
  case 'friends':
    wins.show('j', 'Journal', buildJournal(profile, portraitUrl, 'friends'), { wide: true });
    break;
  case 'chest':
    wins.show('c', 'Chest', buildChest(chestPanel, profile, tip, { put: noop, take: noop }).el, { wide: true });
    break;
  case 'shelter':
    wins.show('c', 'Coop', buildShelter(shelterPanel, profile, { add: noop, feed: noop, collect: noop }));
    break;
  case 'vitals': {
    // ?panel=vitals&reduced=1&scale=1 — five HUD states side by side, each driven by the real model and painter
    const reduced = q2.get('reduced') === '1';
    document.documentElement.classList.toggle('reduced-motion', reduced);
    if (q2.get('scale')) document.documentElement.style.setProperty('--lab-vs', q2.get('scale')!);
    document.body.style.cssText =
      'display:flex;flex-wrap:wrap;gap:24px;padding:24px;background:#1b2a22;align-items:flex-start';
    const now = 1_000_000;
    const base = (o: Partial<VitalsFrame>): VitalsFrame => ({
      hp: 60,
      maxHp: 60,
      mana: { v: 100, max: 100, name: 'Coherence' },
      stamina: { frac: 1, value: 100, charges: 2, max: 2 },
      needs: null,
      auras: [],
      buffs: {},
      serverNow: now,
      ...o,
    });
    const cases: Array<[string, VitalsFrame, ((v: VitalsHud) => void) | null]> = [
      ['Full · mana ready', base({}), null],
      [
        'Wounded 17/60 · mana low · 1 dash',
        base({
          hp: 17,
          mana: { v: 22, max: 100, name: 'Coherence' },
          stamina: { frac: 0.62, value: 62, charges: 1, max: 2 },
        }),
        null,
      ],
      [
        'Adventure · hungry · shield + buffs',
        base({
          hp: 44,
          needs: { food: 14, water: 62 },
          auras: ['shield'],
          buffs: {
            regen: { until: now + 42_000, power: 2 },
            might: { until: now + 170_000, power: 0.2 },
            ward: { until: now + 95_000, power: 0.25 },
          },
        }),
        null,
      ],
      [
        'Many effects (folded) · empty water',
        base({
          hp: 30,
          mana: null,
          needs: { food: 80, water: 0 },
          auras: ['ward', 'mirror'],
          buffs: {
            lantern: { until: now + 500_000, power: 1 },
            regen: { until: now + 9_000, power: 1 },
            chill: { until: now + 60_000, power: 1 },
          },
        }),
        null,
      ],
    ];
    const ledgers: VitalsHud[] = [];
    for (const [title, frame, post] of cases) {
      const box = h('div', {
        class: 'orbinfo',
        style:
          'padding:10px 12px;background:#17201fed;border:1px solid #786646;border-left:4px solid #bca06b;width:216px',
      });
      box.append(h('b', { class: 'pname', text: title, style: 'font-size:10px' }), h('div'));
      document.body.append(box);
      const v = new VitalsHud(box.lastElementChild as HTMLElement);
      box.lastElementChild!.id = '';
      v.update(frame, 0, reduced);
      post?.(v);
      ledgers.push(v);
    }
    // a hit on the first ledger so the trail and flash are visible in captures (?hit=1)
    if (q2.get('hit') === '1') {
      ledgers[0]!.update(base({ hp: 38 }), 0.016, reduced);
      ledgers[0]!.update(base({ hp: 38 }), 0.1, reduced);
    }
    // the folded list expands on click
    if (q2.get('open') === '1')
      (document.querySelectorAll('.status-row')[3]?.querySelector('button') as HTMLButtonElement)?.click();
    break;
  }
  case 'bosses': {
    // ?panel=bosses — every legendary frame at a different health, stacked (no world behind them)
    const reduced = q2.get('reduced') === '1';
    document.documentElement.classList.toggle('reduced-motion', reduced);
    document.body.style.cssText = 'background:#1b2a22;padding:12px';
    const hps: Record<string, [number, number, number]> = {
      slime_king: [0.9, 0, 0],
      warden: [0.42, 80, 0],
      colossus: [0.28, 35, 5],
      bellkeeper: [0.6, 100, 2],
      veyr: [0.7, 60, 5],
      geode_tyrant: [0.8, 120, 0],
      cinder_wyrm: [0.5, 90, 4],
      rime_sovereign: [0.35, 60, 2],
      tide_leviathan: [0.95, 150, 0],
    };
    Object.values(BOSSES).forEach((def, i) => {
      const bar = new BossBar();
      const [f, poise, st] = hps[def.id]!;
      bar.update(
        { id: def.id, kind: def.kind, hp: Math.round(f * 1000), maxHp: 1000, x: 0, y: 0, poise, st },
        def,
        def.intro,
        reduced ? 0 : 1.7,
      );
      bar.root.style.position = 'relative';
      bar.root.style.top = '0';
      bar.root.style.left = '0';
      bar.root.style.transform = 'none';
      bar.root.style.margin = `0 0 ${i === 4 ? 0 : 40}px 0`;
      document.body.append(bar.root);
    });
    break;
  }
  case 'feedback': {
    // ?panel=feedback — toasts (plain, good, bad, pickup, rare find), a celebration card and the defeat ribbon
    document.body.style.cssText = 'background:#1b2a22';
    const t = new Toasts();
    const mo = new Moments();
    t.moments = mo;
    t.add('Crafted 1 Plank', 'good');
    t.add('Not enough room in your pack', 'bad');
    t.add('', 'item', { id: 'wood', n: 4 });
    t.add('', 'item', { id: 'sword', n: 1, p: { qname: 'Superior', tier: 3 } });
    t.add('Quest complete: Welcome to Hadamere! (50 coins, Seed Pouch)', 'good');
    if (q2.get('level')) mo.show(levelMoment(Number(q2.get('level'))));
    const dead = h('div', { class: 'overlay soft' });
    dead.style.position = 'static';
    dead.style.inset = 'auto';
    dead.style.background = 'none';
    dead.innerHTML =
      '<div class="panel deadbox"><h2>Wavefunction collapsed</h2><p class="small">Felled by a Cave Brute. Respawning at the shrine in 2&hellip;</p><div class="dead-wait"><i style="width:35%"></i></div></div>';
    dead.style.position = 'fixed';
    dead.style.right = '20px';
    dead.style.top = '200px';
    dead.style.left = 'auto';
    dead.style.width = '420px';
    document.body.append(dead);
    break;
  }
  case 'creatures': {
    document.body.style.cssText = 'background:#1b2a22;padding:12px;display:grid;gap:12px;justify-items:start';
    const rows: Array<[string, Parameters<typeof enemyChips>[0], number, number]> = [
      ['hostile', { faction: 'hostile', elite: 0, st: 0, night: false }, 30, 40],
      ['neutral', { faction: 'neutral', elite: 0, st: 0, night: false }, 20, 20],
      ['elite', { faction: 'elite', def: { armor: true }, elite: 3, st: 2, night: true }, 90, 120],
      ['ally', { faction: 'ally', elite: 0, st: 0, night: false }, 55, 60],
    ];
    for (const [fac, input, hp, max] of rows) {
      const tf = new TargetFrame();
      tf.root.style.position = 'relative';
      tf.root.style.left = '0';
      tf.root.style.top = '0';
      tf.root.style.transform = 'none';
      tf.update({
        id: fac,
        name: fac === 'elite' ? 'Cave Brute' : fac === 'ally' ? 'Wren' : 'Wisp Slime',
        level: fac === 'ally' ? 8 : null,
        hp,
        maxHp: max,
        kind: fac === 'ally' ? 'player' : 'enemy',
        faction: input.faction,
        chips: enemyChips(input),
        poise: fac === 'elite' ? 62 : null,
        poiseLabel: 'Armor',
        dist: 6,
      });
      document.body.append(tf.root);
    }
    break;
  }
  case 'rhythm': {
    clock.observe(Date.now(), 1, performance.now());
    const r = new RhythmOverlay(
      () => clock,
      audio,
      () => {},
    );
    r.start({
      id: 'x',
      kind: 'forge',
      label: 'Strike the anvil on the beat!',
      plan: { startAt: clock.serverNow(performance.now()) + 1500, intervalMs: 650, count: 5, windowMs: 200 },
    });
    break;
  }
}
(window as unknown as { __uilab: boolean }).__uilab = true;
void ITEMS;
