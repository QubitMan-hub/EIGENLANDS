import {
  NpcState,
  MSG,
  sanctuaryAt,
  ENEMY_KEY_BY_KIND,
  findPath,
  moveBody,
  contractKind,
  contractDay,
  hash2,
  questDef,
  type GuildJourney,
  type WorldObj,
  type PanelMsg,
} from '@eigenlands/shared';
import type { GameRoom } from '../rooms/GameRoom';
import type { ServerPlayer } from '../rooms/player';
import type { Module, Registrar } from './types';
import { questEvent } from '../systems/quests';
import { gainRep } from '../systems/reputation';
import { removeItem, REALM_IDS, KINGDOMS } from '@eigenlands/shared';
const ADVENTURE = 'guild_journey';
const names = ['Mira', 'Tamsin', 'Hale'];
export class GuildJourneys implements Module {
  private time = 0;
  private saveTime = 0;
  private elapsed = 0;
  private cleaned = new Set<string>();
  private pathReady = new Map<string, number>();
  killed(e: import('../game/enemies').Enemy, killer: ServerPlayer | undefined): void {
    if (!killer || e.noRewards) return;
    const key = ENEMY_KEY_BY_KIND[e.def.kind];
    if (!key) return;
    for (const account of this.room.social.partyMates(killer.accountId)) {
      const p = [...this.room.players.values()].find((p) => p.accountId === account);
      if (p && p.deadT <= 0 && Math.hypot(p.sim.x - e.x, p.sim.y - e.y) <= 32)
        questEvent(p, { type: 'kill', target: key, n: 1 });
    }
  }
  private guards = new Map<string, string[]>();
  private paths = new Map<string, Array<[number, number]>>();
  constructor(private room: GameRoom) {}
  install(reg: Registrar): void {
    reg.on<any>(ADVENTURE, 'board', (p, m) => this.act(p, m?.id, m?.action, m?.choice));
  }
  async start(p: ServerPlayer, id: string, board: WorldObj): Promise<GuildJourney | null> {
    const kind = contractKind(id);
    if (!kind) return null;
    const bx = Math.floor(board.x),
      by = Math.floor(board.y);
    const loads = [];
    for (let y = Math.floor((by - 45) / 32); y <= Math.floor((by + 45) / 32); y++)
      for (let x = Math.floor((bx - 45) / 32); x <= Math.floor((bx + 45) / 32); x++)
        if (this.room.ownsChunk(x, y)) loads.push(this.room.ensureChunk(x, y));
    await Promise.all(loads);
    const home = [
      [bx, by + 1],
      [bx + 1, by],
      [bx - 1, by],
      [bx, by - 1],
    ].find(([x, y]) => this.room.owns(x!, y!) && !this.room.store.solidAt(x!, y!));
    if (!home) return null;
    const cells: Array<[number, number, number]> = [[home[0]!, home[1]!, -1]],
      seen = new Set([`${home[0]},${home[1]}`]);
    let far = 0,
      best = -Infinity;
    const angle = hash2(this.room.seed, contractDay(id), Number(id.split(':')[3]), bx ^ by) * Math.PI * 2;
    for (let i = 0; i < cells.length && i < 6500; i++) {
      const [x, y] = cells[i]!;
      const score = Math.hypot(x - bx, y - by) * 0.5 + (x - bx) * Math.cos(angle) + (y - by) * Math.sin(angle);
      if (score > best && (kind !== 'rescue' || !sanctuaryAt(this.room.seed, x, y))) {
        best = score;
        far = i;
      }
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const nx = x + dx!,
          ny = y + dy!,
          key = `${nx},${ny}`;
        if (
          seen.has(key) ||
          Math.abs(nx - bx) > 43 ||
          Math.abs(ny - by) > 43 ||
          !this.room.owns(nx, ny) ||
          this.room.store.solidAt(nx, ny) ||
          Math.abs(this.room.store.levelAt(nx, ny) - this.room.store.levelAt(x, y)) > 1
        )
          continue;
        seen.add(key);
        cells.push([nx, ny, i]);
      }
    }
    if (kind === 'rescue' && !Number.isFinite(best)) return null;
    const route: Array<{ x: number; y: number }> = [];
    for (let i = far; i >= 0; i = cells[i]![2]) route.push({ x: cells[i]![0] + 0.5, y: cells[i]![1] + 0.5 });
    route.reverse();
    if (route.length < 15) return null;
    const points = [0.35, 0.7, 1].map((t) => route[Math.min(route.length - 1, Math.floor((route.length - 1) * t))]!);
    if (kind === 'rescue') points[0] = route[route.length - 1]!;
    return {
      kind,
      home: { x: home[0]! + 0.5, y: home[1]! + 0.5 },
      points,
      stage: 0,
      x: kind === 'escort' ? home[0]! + 0.5 : points[0]!.x,
      y: kind === 'escort' ? home[1]! + 0.5 : points[0]!.y,
      hp: 100,
      released: kind === 'escort',
      failed: false,
    };
  }
  private key(p: ServerPlayer, id: string): string {
    return `journey:${p.id}:${id}`;
  }
  private emit(p: ServerPlayer, id: string, text: string, choices: Array<{ id: string; label: string }> = []): void {
    const d = p.data.quests[id]?.journey;
    if (!d) return;
    const target = d.kind === 'rescue' && d.released ? d.home : d.points[Math.min(2, d.stage)];
    p.client.send(MSG.PANEL, {
      kind: 'journey',
      tx: Math.floor(d.x),
      ty: Math.floor(d.y),
      sub: id,
      journey: { id, title: questDef(id, this.room.seed)?.title ?? 'Guild journey', text, choices, target, hp: d.hp },
    } satisfies PanelMsg);
  }
  interact(p: ServerPlayer, o: WorldObj): boolean {
    if (o.sub !== 'guild_clue') return false;
    if (o.owner !== p.accountId && !p.data.quests[String(o.data?.quest)]?.journey) {
      p.toast('This evidence belongs to another commission.');
      return true;
    }
    this.act(p, String(o.data?.quest ?? ''), 'inspect', undefined);
    return true;
  }
  talk(p: ServerPlayer, npcId: string): boolean {
    if (typeof npcId !== 'string' || !npcId.startsWith(`journey:${p.id}:`)) return false;
    this.act(p, npcId.slice(`journey:${p.id}:`.length), 'inspect', undefined);
    return true;
  }
  private act(p: ServerPlayer, id: unknown, action: unknown, choice: unknown): void {
    if (typeof id !== 'string' || p.deadT > 0) return;
    const st = p.data.quests[id],
      d = st?.journey;
    if (!st || st.state !== 'active' || st.progress[0] || !d || d.failed) return;
    const point = d.kind === 'investigate' ? d.points[Math.min(2, d.stage)]! : { x: d.x, y: d.y };
    if (Math.hypot(p.sim.x - point.x, p.sim.y - point.y) > 3.5) return;
    if (action === 'inspect') {
      if (d.kind === 'investigate') {
        if (d.stage < 3) {
          const expected = d.points[d.stage]!;
          if (Math.hypot(p.sim.x - expected.x, p.sim.y - expected.y) > 3) return;
          const answer = Math.floor(hash2(this.room.seed, contractDay(id), 0, 9801) * 3);
          const clues = [
            `The muddy bootprint matches ${['the quarry road', 'the river bank', 'the orchard path'][answer]}.`,
            `${names[answer]} signed for a cloak in ${['ochre', 'blue', 'green'][answer]}. The recovered thread matches it.`,
            `The forged seal carries ${names[answer]}'s reversed initial. Compare the evidence before accusing anyone.`,
          ];
          const text = clues[d.stage]!;
          const clue = this.room.store.objectAt(Math.floor(expected.x), Math.floor(expected.y));
          if (clue?.sub === 'guild_clue' && clue.owner === p.accountId) this.room.objects.remove(clue.x, clue.y);
          d.stage++;
          p.dirty('quests');
          this.emit(
            p,
            id,
            text,
            d.stage === 3 ? names.map((n, i) => ({ id: `accuse:${i}`, label: `Accuse ${n}` })) : [],
          );
        } else
          this.emit(
            p,
            id,
            d.choice ? 'The evidence is clear. Choose justice.' : 'Who forged the seal?',
            d.choice
              ? [
                  { id: 'mercy', label: 'Seek restitution' },
                  { id: 'report', label: 'Report to the magistrate' },
                ]
              : names.map((n, i) => ({ id: `accuse:${i}`, label: `Accuse ${n}` })),
          );
      } else if (d.kind === 'diplomacy')
        this.emit(p, id, 'The envoy needs proof that the hall will stand behind its promise.', [
          { id: 'aid', label: 'Offer 10 wood for rebuilding' },
          { id: 'compromise', label: 'Fund a 50-coin compromise' },
          { id: 'threaten', label: 'Demand concessions by threat' },
        ]);
      else
        this.emit(
          p,
          id,
          d.released ? 'Stay close. I will follow while the road is safe.' : 'Clear the nearby threat before we leave.',
        );
    } else if (action === 'choose' && typeof choice === 'string') {
      const realm = REALM_IDS[Math.floor(hash2(this.room.seed, contractDay(id), 1, 9802) * REALM_IDS.length)]!;
      if (d.kind === 'investigate' && d.stage === 3) {
        const answer = Math.floor(hash2(this.room.seed, contractDay(id), 0, 9801) * 3);
        if (!d.choice) {
          if (choice !== `accuse:${answer}`) {
            d.stage = 1;
            this.emit(p, id, 'That accusation contradicts the evidence. Revisit the witness and seal.');
            p.dirty('quests');
            return;
          }
          d.choice = choice;
          p.dirty('quests');
          this.emit(p, id, 'The culprit admits the forgery. What should happen next?', [
            { id: 'mercy', label: 'Seek restitution' },
            { id: 'report', label: 'Report to the magistrate' },
          ]);
          return;
        }
        if (choice !== 'mercy' && choice !== 'report') return;
        d.choice = choice;
        gainRep(p, realm, choice === 'mercy' ? 12 : 8);
      } else if (d.kind === 'diplomacy') {
        if (choice === 'aid') {
          if (!removeItem(p.data.inv, 'wood', 10)) {
            p.toast('Bring 10 wood to support that offer.');
            return;
          }
          p.dirty('inv');
          gainRep(p, realm, 20);
        } else if (choice === 'compromise') {
          if (p.data.coins < 50) {
            p.toast('The compromise needs 50 coins.');
            return;
          }
          p.data.coins -= 50;
          p.dirty('coins');
          gainRep(p, realm, 12);
        } else if (choice === 'threaten') {
          gainRep(p, realm, -15);
        } else return;
        d.choice = choice;
      } else return;
      this.finish(p, id);
      this.emit(
        p,
        id,
        `The outcome is recorded with ${KINGDOMS[realm].name}. Return to a guild board for verification.`,
      );
    }
  }
  private finish(p: ServerPlayer, id: string): void {
    const st = p.data.quests[id];
    if (!st || st.progress[0]) return;
    questEvent(p, { type: 'discover', target: id, n: 1 });
    p.dirty('quests');
    this.clear(p, id);
  }
  clear(p: ServerPlayer, id: string): void {
    const key = this.key(p, id);
    if (this.cleaned.has(key)) return;
    this.cleaned.add(key);
    this.room.state.npcs.delete(key);
    this.paths.delete(key);
    this.pathReady.delete(key);
    for (const eid of this.guards.get(key) ?? []) {
      this.room.enemies.delete(eid);
      this.room.state.enemies.delete(eid);
    }
    this.guards.delete(key);
    for (const o of [...this.room.objects.all()])
      if (o.sub === 'guild_clue' && o.owner === p.accountId && o.data?.quest === id) this.room.objects.remove(o.x, o.y);
  }
  leave(p: ServerPlayer): void {
    for (const id of Object.keys(p.data.quests))
      if (contractKind(id)) {
        this.clear(p, id);
        this.cleaned.delete(this.key(p, id));
      }
  }
  tick(_now: number, dt: number): void {
    this.time += dt;
    this.elapsed += dt;
    this.saveTime += dt;
    if (this.time < 0.2) return;
    const step = this.time;
    this.time = 0;
    const save = this.saveTime >= 1;
    if (save) this.saveTime = 0;
    for (const p of this.room.players.values())
      for (const [id, st] of Object.entries(p.data.quests)) {
        if (contractKind(id) && contractDay(id) < this.room.wclock.day() - 14) {
          this.clear(p, id);
          delete p.data.quests[id];
          p.dirty('quests');
          continue;
        }
        const d = st.journey;
        if (!d || st.state !== 'active') continue;
        if (contractDay(id) < this.room.wclock.day() - 2) {
          this.clear(p, id);
          delete p.data.quests[id];
          p.dirty('quests');
          continue;
        }
        if (st.progress[0] || d.failed || p.deadT > 0) {
          this.clear(p, id);
          continue;
        }
        const key = this.key(p, id);
        this.cleaned.delete(key);
        if (d.kind === 'investigate') {
          for (let i = d.stage; i < Math.min(3, d.stage + 1); i++) {
            const point = d.points[i]!,
              x = Math.floor(point.x),
              y = Math.floor(point.y);
            if (this.room.owns(x, y) && !this.room.store.objectAt(x, y) && Math.hypot(p.sim.x - x, p.sim.y - y) < 35)
              this.room.objects.put({
                x,
                y,
                kind: 'deco',
                sub: 'guild_clue',
                owner: p.accountId,
                data: { quest: id, step: i },
              });
          }
          continue;
        }
        if (!this.room.owns(Math.floor(d.x), Math.floor(d.y)) || Math.hypot(p.sim.x - d.x, p.sim.y - d.y) > 60) {
          this.room.state.npcs.delete(key);
          continue;
        }
        let n = this.room.state.npcs.get(key);
        if (!n) {
          n = new NpcState();
          n.id = key;
          n.name =
            d.kind === 'diplomacy' ? 'Guild Envoy' : d.kind === 'rescue' ? 'Missing Surveyor' : 'Travelling Scholar';
          n.look = d.kind === 'diplomacy' ? 1 : 2;
          this.room.state.npcs.set(key, n);
        }
        if (d.kind === 'rescue' && !d.released && Math.hypot(p.sim.x - d.x, p.sim.y - d.y) < 12) {
          if (!this.guards.has(key)) {
            const guards: string[] = [];
            for (const [dx, dy] of [
              [2, 0],
              [-2, 0],
            ]) {
              const x = Math.floor(d.x + dx!),
                y = Math.floor(d.y + dy!);
              if (this.room.owns(x, y) && !this.room.store.solidAt(x, y) && !sanctuaryAt(this.room.seed, x, y)) {
                const e = this.room.spawnEnemy('slime', x + 0.5, y + 0.5, false, {
                  level: Math.max(1, Math.min(8, p.level)),
                });
                e.noRewards = true;
                guards.push(e.id);
              }
            }
            this.guards.set(key, guards);
          }
          if ((this.guards.get(key) ?? []).every((id) => !this.room.enemies.has(id))) {
            d.released = true;
            p.dirty('quests');
            p.toast('The surveyor is free. Lead them back to the hall.', 'good');
          }
        }
        n.flags = 0;
        if (d.released) {
          const danger = [...this.room.enemies.values()].find(
            (e) => !e.def.passive && !e.state.ally && Math.hypot(e.x - d.x, e.y - d.y) < 2,
          );
          if (danger) {
            d.hp = Math.max(0, d.hp - 8 * step);
            if (!d.hp) {
              d.failed = true;
              p.dirty('quests');
              p.toast('The journey failed. Abandon it at the hall to try another.', 'bad');
            }
          } else if (Math.hypot(p.sim.x - d.x, p.sim.y - d.y) < 7 && Math.hypot(p.sim.x - d.x, p.sim.y - d.y) > 1.1) {
            let path = this.paths.get(key);
            if (
              this.elapsed >= (this.pathReady.get(key) ?? 0) ||
              (!!path?.length && this.room.store.solidAt(path[0]![0], path[0]![1]))
            ) {
              path =
                findPath(
                  Math.floor(d.x),
                  Math.floor(d.y),
                  Math.floor(p.sim.x),
                  Math.floor(p.sim.y),
                  Object.assign((x: number, y: number) => !this.room.owns(x, y) || this.room.store.solidAt(x, y), {
                    level: this.room.store.levelAt,
                  }),
                  500,
                ) ?? [];
              this.paths.set(key, path);
              this.pathReady.set(key, this.elapsed + 0.8);
            }
            const point = path?.[0];
            if (point) {
              const dx = point[0] + 0.5 - d.x,
                dy = point[1] + 0.5 - d.y,
                len = Math.hypot(dx, dy);
              if (len < 0.45) path?.shift();
              else {
                moveBody(
                  d,
                  (dx / len) * 2.5 * step,
                  (dy / len) * 2.5 * step,
                  0.25,
                  Object.assign(this.room.store.solidAt, { level: this.room.store.levelAt }),
                );
                n.faceX = dx / len;
                n.faceY = dy / len;
                n.flags = 1;
              }
            }
          }
          if (
            d.kind === 'escort' &&
            d.stage < 3 &&
            Math.hypot(d.x - d.points[d.stage]!.x, d.y - d.points[d.stage]!.y) < 2.2
          ) {
            d.stage++;
            p.dirty('quests');
          }
          if (
            (d.kind === 'rescue' && Math.hypot(d.x - d.home.x, d.y - d.home.y) < 2) ||
            (d.kind === 'escort' && d.stage === 3)
          )
            this.finish(p, id);
        }
        n.x = d.x;
        n.y = d.y;
        if (save) p.dirty('quests');
      }
  }
}
