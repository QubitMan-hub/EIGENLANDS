import { describe, expect, it } from 'vitest';
import {
  ChunkStore, CROPS, ITEMS, MATERIALS, NPCS, RECIPES, T, afterHarvest, addStack, advanceDay, beatTimes, buyPrice, canAdd, catchUp,
  collapseCrop, cropSeasonOk, cropStage, decaySupply, emptyInventory, findPath, forge, gameHour, hearts, interference, isRipe, matchExperiment,
  moveSlot, preview, removeItem, countItem, rollFish, sanitizeHits, scheduleAt, scoreHits, sellPrice, skillLevel, townFor, weatherForDay,
  tileAt, isSolid, FISH_TABLE, NODES, TILE_DEFS, FORAGE_BY_SEASON, validInventory, mulberry32, tierOf, giftTaste, SHOP_NPCS, buildingAt,
  type CropData, DAY_MS, QUESTS, QUEST_BY_ID, offerable, startQuest, applyQuestEvent, questComplete, type QuestLog,
  syncDeliveries, dailyRequests, questDef, pruneRequests, VOICES, composeTalk, pendingEvent, barkFor, QUBITMAN, NPC_BY_ID, shopOpen, STATION_SUBS,
} from '../src';

const SEED = 20260101;

describe('items & inventory', () => {
  it('every item has a glyph and sane value; seeds map to crops', () => {
    for (const d of Object.values(ITEMS)) {
      expect(d.icon.g).toBeTruthy();
      expect(d.value).toBeGreaterThanOrEqual(0);
      if (d.kind === 'seed' && d.id !== 'superposed_seed') expect(CROPS[d.crop!]).toBeTruthy();
    }
  });
  it('stacks, merges, splits and refuses overflow', () => {
    const inv = emptyInventory();
    expect(addStack(inv, { id: 'wood', n: 150 })).toBe(0);
    expect(inv[0]!.n).toBe(99);
    expect(inv[1]!.n).toBe(51);
    expect(countItem(inv, 'wood')).toBe(150);
    expect(removeItem(inv, 'wood', 120)).toBe(true);
    expect(countItem(inv, 'wood')).toBe(30);
    expect(removeItem(inv, 'wood', 31)).toBe(false);
    expect(countItem(inv, 'wood')).toBe(30);
    const full = emptyInventory().map(() => ({ id: 'stone', n: 99 }));
    expect(canAdd(full, { id: 'stone', n: 1 })).toBe(false);
    expect(addStack(full, { id: 'stone', n: 5 })).toBe(5);
  });
  it('unique crafted items never merge', () => {
    const inv = emptyInventory();
    addStack(inv, { id: 'sword', n: 1, p: { atk: 9 } });
    addStack(inv, { id: 'sword', n: 1, p: { atk: 9 } });
    expect(inv.filter(Boolean).length).toBe(2);
    expect(moveSlot(inv, 0, 5)).toBe(true);
    expect(inv[5]).toBeTruthy();
    const v = validInventory([{ id: 'nope', n: 3 }, { id: 'wood', n: -2 }, { id: 'wood', n: 4 }]);
    expect([v[0], v[1], v[2]!.n]).toEqual([null, null, 4]);
  });
});

describe('farming rules', () => {
  const fresh = (crop = 'turnip', over: Partial<CropData> = {}): CropData => ({ crop, planted: 0, growth: 0, watered: -1, lastDay: -1, owner: 'a', ...over });
  it('grows only on watered days and ripens', () => {
    let d = fresh();
    d = advanceDay(d, 0, { rain: false, sprinkler: false, greenhouse: false });
    expect(d.growth).toBe(0);
    d = advanceDay({ ...d, watered: 1 }, 1, { rain: false, sprinkler: false, greenhouse: false });
    expect(d.growth).toBe(1);
    d = advanceDay(d, 2, { rain: true, sprinkler: false, greenhouse: false });
    expect(isRipe(d)).toBe(true);
    expect(cropStage(d)).toBe(3);
  });
  it('withers when the season turns against it unless it is in a greenhouse', () => {
    const d = fresh('turnip', { growth: 1 });
    expect(advanceDay(d, 6, { rain: false, sprinkler: false, greenhouse: false }).dead).toBe(true);
    expect(advanceDay(d, 6, { rain: false, sprinkler: false, greenhouse: true }).dead).toBeFalsy();
    expect(cropSeasonOk('frostroot', 3)).toBe(true);
    expect(cropSeasonOk('tomato', 3)).toBe(false);
  });
  it('superposed crops collapse by the tonic bias and need the slower crop', () => {
    const d = fresh('turnip', { alt: 'potato', bias: 'a' });
    const r = mulberry32(3);
    let a = 0;
    for (let i = 0; i < 2000; i++) if (collapseCrop(d, r) === 'turnip') a++;
    expect(a / 2000).toBeGreaterThan(0.7);
    expect(a / 2000).toBeLessThan(0.8);
    expect(cropStage({ ...d, growth: 2 })).toBeLessThan(3); // potato needs 3
    expect(cropStage({ ...d, growth: 3 })).toBe(3);
  });
  it('regrowers drop back, single-harvest crops are consumed, offline catch-up is bounded', () => {
    const ripe = fresh('strawberry', { growth: 4 });
    expect(afterHarvest(ripe)!.growth).toBe(2);
    expect(afterHarvest(fresh('turnip', { growth: 2 }))).toBeNull();
    const c = catchUp(fresh('potato', { lastDay: 0 }), 5, SEED, true, false); // sprinkled every day
    expect(c.growth).toBeGreaterThanOrEqual(3);
  });
  it('weather is deterministic and seasonal (no snow in summer, rain waters)', () => {
    expect(weatherForDay(SEED, 10)).toBe(weatherForDay(SEED, 10));
    const days = Array.from({ length: 400 }, (_, i) => weatherForDay(SEED, i));
    expect(days.slice(7, 14).includes('snow')).toBe(false);
    expect(days.some((w) => w === 'rain')).toBe(true);
    expect(days.some((w) => w === 'snow')).toBe(true);
  });
});

describe('interference forging', () => {
  it('in-phase beats out-of-phase on stats, out-of-phase cancels flaws', () => {
    expect(interference(1, 1)).toBeCloseTo(1);
    expect(interference(1, 5)).toBeCloseTo(-1);
    const inPhase = preview(['copper_ingot', 'copper_ingot'], 0.5)!;
    const out = preview(['copper_ingot', 'iron_ingot'], 0.5)!;
    expect(inPhase.coherence).toBeGreaterThan(0.99);
    expect(out.coherence).toBeLessThan(-0.99);
    // copper flaw is -3 dur twice = -6; out-of-phase halves-ish flaws
    expect(inPhase.stats.dur).toBeLessThan(out.stats.dur);
    // in-phase bonus: two coppers beat raw sum of copper atk
    expect(inPhase.stats.atk).toBeGreaterThan(8 * 0.85);
  });
  it('rhythm accuracy tunes quality; tier follows grade and synergy', () => {
    const lo = forge('sword', ['iron_ingot', 'silver_ingot'], 0)!;
    const hi = forge('sword', ['iron_ingot', 'silver_ingot'], 1)!;
    expect(hi.item.props.atk).toBeGreaterThan(lo.item.props.atk);
    expect(hi.qname).toBe('Perfect');
    expect(lo.qname).toBe('Rough');
    const copperPick = forge('pickaxe', ['copper_ingot', 'copper_ingot'], 0.5)!;
    expect(copperPick.item.props.tier).toBe(2);
    expect(forge('pickaxe', ['iron_ingot', 'silver_ingot'], 1)!.item.props.tier).toBeGreaterThanOrEqual(4);
    expect(forge('sword', ['copper_ingot'], 1)).toBeNull();
    expect(forge('sword', ['wood', 'stone'], 1)).toBeNull();
    for (const m of Object.values(MATERIALS)) expect(ITEMS[m.id]).toBeTruthy();
  });
  it('rhythm scoring rewards timing, ignores mashing and out-of-session presses', () => {
    const plan = { startAt: 1000, intervalMs: 600, count: 4, windowMs: 180 };
    const beats = beatTimes(plan);
    expect(scoreHits(beats, beats, 180)).toBeCloseTo(1);
    expect(scoreHits(beats, beats.map((b) => b + 90), 180)).toBeLessThan(0.7);
    expect(scoreHits(beats, beats.map((b) => b + 300), 180)).toBe(0);
    expect(scoreHits(beats, [beats[0]!, beats[0]! + 10, beats[0]! + 20, beats[0]! + 30], 180)).toBeLessThanOrEqual(0.25);
    expect(sanitizeHits([0, 1100, 1105, 1700, 99999, NaN], plan, 10)).toEqual([1100, 1700]);
  });
});

describe('crafting data', () => {
  it('every recipe references real items and outputs', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.out.id], r.id).toBeTruthy();
      for (const i of r.inputs) if (!i.id.startsWith('*')) expect(ITEMS[i.id], `${r.id}:${i.id}`).toBeTruthy();
      expect(r.inputs.length).toBeLessThanOrEqual(4);
    }
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });
  it('experiments discover recipes by exact ingredient match, including superposed seeds', () => {
    expect(matchExperiment('furnace', [{ id: 'copper_ore', n: 2 }, { id: 'coal', n: 1 }])?.id).toBe('copper_ingot');
    expect(matchExperiment('furnace', [{ id: 'copper_ore', n: 3 }, { id: 'coal', n: 1 }])).toBeNull();
    expect(matchExperiment('alchemy', [{ id: 'qubit_crystal', n: 1 }, { id: 'turnip_seed', n: 1 }, { id: 'potato_seed', n: 1 }])?.id).toBe('superposed_seed');
    expect(matchExperiment('alchemy', [{ id: 'qubit_crystal', n: 1 }, { id: 'turnip_seed', n: 2 }])).toBeNull();
    expect(matchExperiment('workbench', [{ id: 'wood', n: 2 }])?.id).toBe('plank');
  });
  it('enough starter recipes exist and every NPC-taught recipe has a teacher', () => {
    expect(RECIPES.filter((r) => r.learn === 'start').length).toBeGreaterThan(25);
    for (const r of RECIPES) if (r.learn.startsWith('npc:')) expect(NPCS.find((n) => n.id === r.learn.slice(4)), r.id).toBeTruthy();
  });
});

describe('economy & skills & fishing', () => {
  it('prices drop with supply and recover over time', () => {
    expect(sellPrice('melon', 40)).toBeLessThan(sellPrice('melon', 0));
    expect(buyPrice('turnip_seed')).toBe(ITEMS.turnip_seed!.value);
    expect(decaySupply({ melon: 40 }, 24).melon!).toBeLessThan(10);
    expect(sellPrice('melon', 0)).toBeGreaterThanOrEqual(1);
  });
  it('skill levels rise with xp and cap at 10', () => {
    expect(skillLevel(0)).toBe(1);
    expect(skillLevel(1e6)).toBe(10);
    expect(skillLevel(200)).toBeGreaterThan(2);
  });
  it('fish depend on season, time and water; skill favours rare fish', () => {
    const r = mulberry32(5);
    const base = { season: 1, hour: 12, deep: false, weather: 'clear' as const, level: 1, luck: 0 };
    for (let i = 0; i < 200; i++) { const got = rollFish(r, base); expect(FISH_TABLE.find((f) => f.id === got.id)!.water).not.toBe('deep'); }
    const count = (level: number) => { let k = 0; const rr = mulberry32(9); for (let i = 0; i < 3000; i++) if (rollFish(rr, { ...base, deep: true, season: 0, level }).difficulty > 0.4) k++; return k; };
    expect(count(10)).toBeGreaterThan(count(1));
    expect(rollFish(mulberry32(1), { ...base, season: 3, hour: 2 }).id).toBeTruthy();
  });
});

describe('world: nodes, ores and the town', () => {
  it('every node tile has a def and drops real items', () => {
    for (const n of Object.values(NODES)) { expect(TILE_DEFS[n.tile]).toBeTruthy(); for (const d of n.drops) expect(ITEMS[d.item]).toBeTruthy(); }
    for (const season of FORAGE_BY_SEASON) for (const id of season) expect(ITEMS[id]).toBeTruthy();
  });
  it('the world contains copper nearby, and iron/silver/gold only further out', () => {
    const seen = new Map<number, number>();
    for (let cy = -8; cy <= 8; cy++) for (let cx = -8; cx <= 8; cx++) for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
      const t = tileAt(SEED, cx * 32 + x, cy * 32 + y);
      if (t >= T.ORE_COPPER && t <= T.CRYSTAL) seen.set(t, Math.min(seen.get(t) ?? 1e9, Math.hypot(cx * 32 + x, cy * 32 + y)));
    }
    expect(seen.get(T.ORE_COPPER)).toBeLessThan(60);
    expect(seen.get(T.ORE_IRON) ?? 1e9).toBeGreaterThan(40);
    expect(seen.get(T.ORE_SILVER) ?? 1e9).toBeGreaterThan(90);
    expect(seen.has(T.CRYSTAL)).toBe(true);
  });
  const town = townFor(SEED);
  it('Hadamere exists with its 10 original buildings plus the wider village, walkable doors and furnished interiors', () => {
    expect(town.buildings.length).toBe(27);
    for (const id of ['smithy', 'hall', 'inn', 'store', 'farmhouse', 'herbalist', 'fisher', 'tailor', 'carpenter', 'scout']) expect(town.buildings.some((b) => b.id === id), id).toBe(true);
    const store = new ChunkStore(SEED);
    for (const b of town.buildings) {
      expect(tileAt(SEED, b.doorX, b.doorY)).toBe(T.DOOR);
      expect(isSolid(tileAt(SEED, b.doorX, b.doorY))).toBe(false);
      expect(isSolid(tileAt(SEED, b.doorX, b.doorY + 1))).toBe(false);
      expect(isSolid(tileAt(SEED, b.doorX, b.doorY - 1))).toBe(false);
      expect(buildingAt(SEED, b.x + 1, b.y + 1)?.id).toBe(b.id);
      store.get(Math.floor(b.x / 32), Math.floor(b.y / 32));
    }
    const subs = new Set(town.objects.map((o) => o.sub));
    for (const s of ['forge', 'furnace', 'workbench', 'cooking_pot', 'alchemy', 'loom', 'carpenter', 'well', 'bed', 'statue', 'plaque', 'stall', 'bench']) expect(subs.has(s), s).toBe(true);
    const plaque = town.objects.find((o) => o.sub === 'plaque')!;
    expect(String(plaque.data?.text)).toContain('ALL HAIL QUBITMAN');
    // static furnishing is solid in the shared collision query
    const forge = town.objects.find((o) => o.sub === 'forge')!;
    expect(store.solidAt(forge.x, forge.y)).toBe(true);
  });
  it('there is a walkable route between the plaza and every front door', () => {
    const store = new ChunkStore(SEED);
    const from = town.spots.plaza_c!;
    for (const b of town.buildings) {
      const p = findPath(from.x, from.y, b.doorX, b.doorY - 1, store.solidAt, 6000);
      expect(p, b.id).not.toBeNull();
    }
    // and to every named spot an NPC can be scheduled at
    for (const [name, sp] of Object.entries(town.spots)) {
      expect(store.solidAt(sp.x, sp.y), `${name} is blocked`).toBe(false);
      expect(findPath(from.x, from.y, sp.x, sp.y, store.solidAt, 8000), `no route to ${name}`).not.toBeNull();
    }
  });
});

describe('NPCs', () => {
  const town = townFor(SEED);
  it('ten villagers with complete 24h schedules whose spots all exist', () => {
    expect(NPCS.length).toBe(10);
    for (const n of NPCS) {
      let h = 0;
      for (const b of [...n.schedule].sort((a, c) => a.h0 - c.h0)) { expect(b.h0, n.id).toBe(h); h = b.h1; expect(town.spots[b.spot], `${n.id}:${b.spot}`).toBeTruthy(); }
      expect(h, n.id).toBe(24);
      expect(town.spots[n.home], `${n.id} home`).toBeTruthy();
      for (const w of ['rain', 'snow', 'clear'] as const) for (const hr of [3, 9, 13, 19]) expect(town.spots[scheduleAt(n, hr, w).spot], `${n.id}@${hr}/${w}`).toBeTruthy();
    }
  });
  it('gift preferences and shops reference real items; teachers exist', () => {
    for (const n of NPCS) {
      for (const id of [...n.loves, ...n.likes, ...n.hates]) expect(ITEMS[id], `${n.id}:${id}`).toBeTruthy();
      for (const s of n.shop?.stock ?? []) expect(ITEMS[s.item], `${n.id}:${s.item}`).toBeTruthy();
      expect(n.lines.greet.every((g) => g.length > 0)).toBe(true);
    }
    expect(SHOP_NPCS.length).toBeGreaterThanOrEqual(6);
    expect(giftTaste(NPCS[0]!, 'fruit_pie')).toBe('love');
    expect(hearts(130)).toBe(3);
    expect(tierOf(300)).toBe(2);
  });
  it('NPCs shelter from bad weather instead of standing in the rain', () => {
    const fen = NPCS.find((n) => n.id === 'fenwick')!;
    expect(scheduleAt(fen, 9, 'clear').spot).toBe('field');
    expect(scheduleAt(fen, 9, 'rain').spot).not.toBe('field');
  });
});

describe('time helpers used by day rollover', () => {
  it('a game day lasts 24 minutes', () => { expect(DAY_MS).toBe(1440000); expect(gameHour(0)).toBeCloseTo(6); });
});

describe('quests', () => {
  it('every quest references real givers, items and prerequisites', () => {
    for (const q of QUESTS) {
      expect(NPCS.find((n) => n.id === q.giver), q.id).toBeTruthy();
      for (const r of q.requires ?? []) expect(QUEST_BY_ID[r], `${q.id} requires ${r}`).toBeTruthy();
      for (const i of q.rewards.items ?? []) expect(ITEMS[i.id], `${q.id}:${i.id}`).toBeTruthy();
      for (const o of q.objectives) if ((o.type === 'gain' || o.type === 'craft' || o.type === 'deliver') && !/^[*#@]/.test(o.target)) expect(ITEMS[o.target], `${q.id}:${o.target}`).toBeTruthy();
      for (const o of q.objectives) if (o.target.startsWith('@')) expect(Object.values(STATION_SUBS)).toContain(o.target.slice(1));
      if (q.rewards.recipe) expect(RECIPES.some((r) => r.id === q.rewards.recipe), q.id).toBe(true);
      expect(q.lines.offer.length).toBeGreaterThan(10);
    }
  });
  it('unlocks in order and tracks progress from events', () => {
    const log: QuestLog = {};
    expect(offerable('orla', log).map((q) => q.id)).toEqual(['welcome']);
    expect(offerable('odo', log)).toEqual([]);
    startQuest(log, 'welcome');
    for (const t of ['odo', 'brannoch', 'tobin']) applyQuestEvent(log, { type: 'talk', target: t, n: 1 });
    expect(questComplete(QUEST_BY_ID.welcome!, log.welcome!)).toBe(true);
    log.welcome!.state = 'done';
    expect(offerable('odo', log).map((q) => q.id)).toContain('timber');
    startQuest(log, 'timber');
    // deliveries track what is in the pack, not events
    applyQuestEvent(log, { type: 'gain', target: 'wood', n: 5 });
    expect(log.timber!.progress[0]).toBe(0);
    syncDeliveries(log, (id) => (id === 'wood' ? 5 : 0));
    expect(log.timber!.progress[0]).toBe(5);
    syncDeliveries(log, (id) => (id === 'wood' ? 50 : 0));
    expect(log.timber!.progress[0]).toBe(12);
    expect(questComplete(QUEST_BY_ID.timber!, log.timber!)).toBe(true);
    expect(startQuest(log, 'timber')).toBe(false);
    // pattern targets: any forage item, anything cooked at a pot, a specific enemy
    startQuest(log, 'forager'); startQuest(log, 'supper'); log.bugs = { state: 'done', progress: [3] }; startQuest(log, 'slimes');
    applyQuestEvent(log, { type: 'gain', target: 'wood', n: 3 });
    applyQuestEvent(log, { type: 'gain', target: 'daffodil', n: 2 });
    expect(log.forager!.progress[0]).toBe(2);
    applyQuestEvent(log, { type: 'craft', target: 'plank', n: 1, station: 'workbench' });
    expect(log.supper!.progress[0]).toBe(0);
    applyQuestEvent(log, { type: 'craft', target: 'roast_potato', n: 1, station: 'cooking_pot' });
    expect(log.supper!.progress[0]).toBe(1);
    applyQuestEvent(log, { type: 'kill', target: 'hopper', n: 1 });
    applyQuestEvent(log, { type: 'kill', target: 'slime', n: 2 });
    expect(log.slimes!.progress[0]).toBe(2);
  });
  it('every villager has at least one story quest', () => {
    for (const n of NPCS) expect(QUESTS.some((q) => q.giver === n.id), n.id).toBe(true);
  });
  it('the request board posts three deterministic, season-appropriate jobs a day that expire', () => {
    for (let day = 0; day < 40; day++) {
      const a = dailyRequests(SEED, day), b = dailyRequests(SEED, day);
      expect(a.length).toBe(3);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
      expect(new Set(a.map((q) => q.giver)).size).toBe(3);
      for (const q of a) {
        expect(questDef(q.id, SEED)).toEqual(q); // single lookups regenerate the same job
        expect(NPCS.some((n) => n.id === q.giver)).toBe(true);
        expect(q.rewards.coins).toBeGreaterThan(0);
        for (const o of q.objectives) {
          expect(o.n).toBeGreaterThan(0);
          if (o.type === 'deliver') {
            expect(ITEMS[o.target], o.target).toBeTruthy();
            const crop = CROPS[o.target];
            if (crop) expect(crop.seasons).toContain(Math.floor(day / 7) % 4);
          }
        }
      }
    }
    const log: QuestLog = { 'req:5:0': { state: 'active', progress: [0] }, 'req:9:1': { state: 'done', progress: [1] }, welcome: { state: 'done', progress: [1, 1, 1] } };
    expect(pruneRequests(log, 9)).toEqual(['req:5:0']);
    expect(Object.keys(log).sort()).toEqual(['req:9:1', 'welcome']);
    expect(questDef('req:x:1', SEED)).toBeUndefined();
  });
});

describe('dialogue', () => {
  const rand = mulberry32(3);
  it('every villager has a full voice: greetings, three tiers, heart events with choices, barks', () => {
    for (const n of NPCS) {
      const v = VOICES[n.id]!;
      expect(v, n.id).toBeTruthy();
      for (const k of ['morning', 'day', 'evening', 'night'] as const) expect(v.greet[k].length, `${n.id}:${k}`).toBeGreaterThan(0);
      expect(v.chat.every((t) => t.length >= 2)).toBe(true);
      expect(v.events.length).toBeGreaterThanOrEqual(3);
      for (const e of v.events) { expect(e.pages.length).toBeGreaterThanOrEqual(3); expect(e.choices.length).toBe(3); }
      expect(v.qubitman.length).toBeGreaterThan(0);
      expect(v.barks.work.length + v.barks.free.length).toBeGreaterThan(4);
    }
  });
  it('lines vary with time of day, friendship, weather and memory', () => {
    const orla = NPC_BY_ID.orla!;
    const morning = composeTalk(orla, { pts: 0, hour: 8, season: 0, weather: 'clear', first: true, atWork: true, rand: () => 0 }).text;
    expect(VOICES.orla!.greet.morning.some((g) => morning.startsWith(g))).toBe(true);
    const night = composeTalk(orla, { pts: 0, hour: 23, season: 0, weather: 'clear', first: true, atWork: false, rand: () => 0 }).text;
    expect(night).not.toBe(morning);
    const deed = composeTalk(NPC_BY_ID.brannoch!, { pts: 0, hour: 10, season: 0, weather: 'clear', first: true, atWork: true, rand: () => 0.1, deed: { kind: 'perfect_forge', what: 'Sword' } });
    expect(deed.usedDeed).toBe(true);
    expect(deed.text).toContain('Perfect Sword');
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(composeTalk(NPC_BY_ID.juniper!, { pts: 300, hour: 14, season: 1, weather: 'rain', first: i % 2 === 0, atWork: false, rand }).text);
    expect(seen.size).toBeGreaterThan(10);
  });
  it('heart events unlock in order and only once', () => {
    expect(pendingEvent('sedge', 40, [])).toBeNull();
    expect(pendingEvent('sedge', 80, [])!.id).toBe('sedge:0');
    expect(pendingEvent('sedge', 400, ['sedge:0'])!.id).toBe('sedge:1');
    expect(pendingEvent('sedge', 400, ['sedge:0', 'sedge:1', 'sedge:2'])).toBeNull();
  });
  it('QubitMan has a plaque, a legend, and villagers who talk about him', () => {
    expect(QUBITMAN.plaque).toBe('ALL HAIL QUBITMAN');
    expect(QUBITMAN.legend.length).toBeGreaterThanOrEqual(4);
    expect(NPCS.filter((n) => VOICES[n.id]!.qubitman.length > 0).length).toBe(10);
    expect(barkFor('brannoch', 'asleep', 'clear', rand)).toBe('Zzz…');
    expect(typeof barkFor('brannoch', 'working the forge', 'clear', rand)).toBe('string');
  });
  it('shops keep opening hours', () => {
    expect(shopOpen(NPC_BY_ID.tobin!, 9)).toBe(true);
    expect(shopOpen(NPC_BY_ID.tobin!, 19)).toBe(false);
    expect(shopOpen(NPC_BY_ID.orla!, 3)).toBe(true);
  });
});

describe('town objects never share a tile', () => {
  it('every static object has its own tile, off the buildings and the plaza statue stays the statue', () => {
    const town = townFor(SEED);
    const seen = new Map<string, string>();
    for (const o of town.objects) {
      const k = `${o.x},${o.y}`;
      expect(seen.get(k), `${o.sub} overlaps ${seen.get(k)} at ${k}`).toBeUndefined();
      seen.set(k, o.sub);
    }
    const statue = town.objects.find((o) => o.sub === 'statue')!;
    expect(seen.get(`${statue.x},${statue.y}`)).toBe('statue');
  });
});
