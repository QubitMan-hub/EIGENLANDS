import { Client, type Room } from 'colyseus.js';
import {
  JOIN_ROOM,
  MSG,
  MSG34,
  decodeAck,
  type HandoffMsg,
  type Ack,
  type ChestMsg,
  type ChunkMsg,
  type CraftMsg,
  type DialogueChatMsg,
  type DialogueMsg,
  type EquipMsg,
  type ExperimentMsg,
  type GearMsg,
  type FishBiteMsg,
  type ForgePreviewReply,
  type ForgeStartMsg,
  type FxMsg,
  type InputCmd,
  type InvMoveMsg,
  type InvTrashMsg,
  type ObjMsg,
  type PanelMsg,
  type ProfileMsg,
  type RhythmResultMsg,
  type RhythmStartMsg,
  type ShelterMsg,
  type ShopMsg,
  type ShopViewMsg,
  type TileMsg,
  type ToastMsg,
  type UseMsg,
  type WelcomeMsg,
} from '@eigenlands/shared';
import { NetSim } from './netsim';

export { NetSim };

import { IS_SOLO, SERVER_URL, sessionKey, migrateDefaultSession } from './world-session';
export { SERVER_URL };

try {
  migrateDefaultSession(localStorage);
} catch {
  /* storage may be unavailable */
}

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(sessionKey(k));
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(sessionKey(k), v);
    } catch {
      /* private mode */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(sessionKey(k));
    } catch {
      /* ignore */
    }
  },
};

export interface AuthState {
  token: string;
  guest: boolean;
  accountId: string;
}

/** Solo builds (GitHub Pages) answer the API inside the page: see src/local/api.ts. */
const SOLO = import.meta.env.VITE_SOLO === '1';
const xfetch = (url: string, init?: RequestInit): Promise<Response> =>
  SOLO && IS_SOLO ? import('../local/api').then((m) => m.localFetch(url, init)) : fetch(url, init);

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await xfetch(`${SERVER_URL}/api/auth${path}`, {
    signal: AbortSignal.timeout(8000),
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`);
  return (await r.json()) as T;
}

export const authConfig = () => api<{ googleClientId: string | null }>('/config');

export async function guestLogin(): Promise<AuthState> {
  const j = await api<{ token: string; deviceSecret: string; accountId: string }>('/guest', {
    method: 'POST',
    body: JSON.stringify({ deviceSecret: store.get('eigen.device') ?? undefined }),
  });
  store.set('eigen.device', j.deviceSecret);
  store.set('eigen.token', j.token);
  return { token: j.token, guest: true, accountId: j.accountId };
}

/** Signs in with a Google ID token; if this browser has a guest, the guest is upgraded in place. */
export async function googleLogin(idToken: string): Promise<AuthState & { upgraded: boolean }> {
  const j = await api<{ token: string; accountId: string; upgraded: boolean }>('/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, deviceSecret: store.get('eigen.device') ?? undefined }),
  });
  store.set('eigen.token', j.token);
  if (j.upgraded) store.del('eigen.device');
  return { token: j.token, guest: false, accountId: j.accountId, upgraded: j.upgraded };
}

export async function resumeSession(): Promise<(AuthState & { name?: string }) | null> {
  const token = store.get('eigen.token');
  if (!token) return null;
  try {
    const me = await api<{ account: { id: string; isGuest: boolean }; character: { name: string } | null }>('/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    return { token, guest: me.account.isGuest, accountId: me.account.id, name: me.character?.name };
  } catch {
    store.del('eigen.token');
    return null;
  }
}

export async function deleteAccount(token: string): Promise<void> {
  await api('/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  store.del('eigen.token');
  store.del('eigen.device');
}

export const signOut = () => store.del('eigen.token');

/** Which shard (world region) this character lives in. Falls back to the spawn region. */
export async function fetchShard(token: string): Promise<string> {
  try {
    const r = await xfetch(`${SERVER_URL}/api/shard`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) return '0,0';
    const j = (await r.json()) as { shard?: string };
    return typeof j.shard === 'string' ? j.shard : '0,0';
  } catch {
    return '0,0';
  }
}

export interface NetHandlers {
  welcome(w: WelcomeMsg): void;
  ack(a: Ack): void;
  fx(f: FxMsg): void;
  chunk(m: ChunkMsg): void;
  tile(m: TileMsg): void;
  notice(text: string): void;
  state(state: any): void;
  close(code: number): void;
  rtt(ms: number): void;
  profile(m: ProfileMsg): void;
  obj(m: ObjMsg): void;
  panel(m: PanelMsg): void;
  rhythmStart(m: RhythmStartMsg): void;
  rhythmResult(m: RhythmResultMsg): void;
  fishBite(m: FishBiteMsg): void;
  fishCast(m: { tx: number; ty: number; id: string }): void;
  dialogue(m: DialogueMsg): void;
  shopView(m: ShopViewMsg): void;
  forgePreview(m: ForgePreviewReply): void;
  toast(m: ToastMsg): void;
  /** Phase 3/4 handlers keyed by message type */
  extra?: Record<string, (m: any) => void>;
}

export class Net {
  private room!: Room;
  private client!: Client;
  private pingTimer = 0;
  private token = '';
  private name?: string;
  private simOut = new NetSim();
  private simIn = new NetSim();
  bytesIn = 0;
  /** current shard id */
  shard = '0,0';
  /** true while moving to another shard (input is paused) */
  switching = false;

  constructor(private h: NetHandlers) {}

  get sessionId(): string {
    return this.room.sessionId;
  }

  async connect(token: string, name?: string, shard?: string): Promise<void> {
    this.token = token;
    this.name = name;
    this.client = new Client(SERVER_URL.replace(/^http/, 'ws'));
    if (shard) this.shard = shard;
    this.attach(await this.client.joinOrCreate(JOIN_ROOM, { token, name, shard: this.shard }));
  }

  private attach(r: Room): void {
    this.room = r;
    const on = <T>(type: string, fn: (m: T) => void) =>
      r.onMessage(type, (m: T) =>
        this.simIn.run(() => {
          if (this.room === r) fn(m);
        }, false),
      );
    on(MSG.WELCOME, (w: WelcomeMsg) => this.h.welcome(w));
    on(MSG.ACK, (b: Uint8Array) => {
      this.bytesIn += b.byteLength;
      this.h.ack(decodeAck(b));
    });
    on(MSG.FX, (f: FxMsg) => this.h.fx(f));
    on(MSG.CHUNK, (m: ChunkMsg) =>
      this.h.chunk({ ...m, diff: new Uint8Array(m.diff), ...(m.levels ? { levels: new Uint8Array(m.levels) } : {}) }),
    );
    on(MSG.TILE, (m: TileMsg) => this.h.tile(m));
    on(MSG.NOTICE, (m: { text: string }) => this.h.notice(m.text));
    on(MSG.PONG, (m: { t: number }) => this.h.rtt(performance.now() - m.t));
    on(MSG.PROFILE, (m: ProfileMsg) => this.h.profile(m));
    on(MSG.OBJ, (m: ObjMsg) => this.h.obj(m));
    on(MSG.PANEL, (m: PanelMsg) => this.h.panel(m));
    on(MSG.RHYTHM_START, (m: RhythmStartMsg) => this.h.rhythmStart(m));
    on(MSG.RHYTHM_RESULT, (m: RhythmResultMsg) => this.h.rhythmResult(m));
    on(MSG.FISH_BITE, (m: FishBiteMsg) => this.h.fishBite(m));
    on(MSG.FISH_CAST, (m: { tx: number; ty: number; id: string }) => this.h.fishCast(m));
    on(MSG.DIALOGUE, (m: DialogueMsg) => this.h.dialogue(m));
    on(MSG.SHOP_VIEW, (m: ShopViewMsg) => this.h.shopView(m));
    on(MSG.FORGE_PREVIEW_R, (m: ForgePreviewReply) => this.h.forgePreview(m));
    on(MSG.TOAST, (m: ToastMsg) => this.h.toast(m));
    on(MSG34.HANDOFF, (m: HandoffMsg) => {
      void this.handoff(m);
    });
    for (const [type, fn] of Object.entries(this.h.extra ?? {})) on(type, fn);
    r.onStateChange((st) =>
      this.simIn.run(() => {
        if (this.room === r) this.h.state(st);
      }, false),
    );
    r.onLeave((code) => {
      if (this.room !== r) return;
      clearInterval(this.pingTimer);
      this.h.close(code);
    });
    clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => this.send(MSG.PING, { t: performance.now() }), 2000);
    this.send(MSG.PING, { t: performance.now() });
  }

  /** Walked into another region: join its shard (keeping the drawn world), then drop the old room. */
  private async handoff(m: HandoffMsg): Promise<void> {
    if (this.switching || typeof m?.shard !== 'string') return;
    this.switching = true;
    const old = this.room;
    const opts = { token: this.token, name: this.name, shard: m.shard, ticket: m.ticket };
    try {
      let next: Room;
      try {
        next = m.roomId ? await this.client.joinById(m.roomId, opts) : await this.client.joinOrCreate(JOIN_ROOM, opts);
      } catch {
        next = await this.client.joinOrCreate(JOIN_ROOM, opts);
      }
      this.shard = m.shard;
      this.attach(next);
      void old.leave(true).catch(() => {});
    } catch (e) {
      console.warn('shard handoff failed', e);
      this.h.close(4003);
    } finally {
      this.switching = false;
    }
  }

  /** Send any message (Phase 3/4 modules use this). */
  send(type: string, msg: unknown): void {
    const r = this.room;
    this.simOut.run(() => {
      if (this.room === r) r.send(type, msg);
    }, type === MSG.INPUT);
  }

  sendInput(cmd: InputCmd): void {
    this.send(MSG.INPUT, { cmds: [cmd] });
  }
  sendEdit(tx: number, ty: number): void {
    this.send(MSG.EDIT, { tx, ty });
  }
  requestChunk(cx: number, cy: number): void {
    this.send(MSG.CHUNK_REQ, { cx, cy });
  }
  use(m: UseMsg): void {
    this.send(MSG.USE, m);
  }
  open(tx: number, ty: number): void {
    this.send(MSG.OPEN, { tx, ty });
  }
  invMove(m: InvMoveMsg): void {
    this.send(MSG.INV_MOVE, m);
  }
  invTrash(m: InvTrashMsg): void {
    this.send(MSG.INV_TRASH, m);
  }
  equip(m: EquipMsg): void {
    this.send(MSG.EQUIP, m);
  }
  craft(m: CraftMsg): void {
    this.send(MSG.CRAFT, m);
  }
  experiment(m: ExperimentMsg): void {
    this.send(MSG.EXPERIMENT, m);
  }
  gear(m: GearMsg): void {
    this.send(MSG.GEAR, m);
  }
  forgePreview(materials: string[]): void {
    this.send(MSG.FORGE_PREVIEW, { materials });
  }
  forgeStart(m: ForgeStartMsg): void {
    this.send(MSG.FORGE_START, m);
  }
  rhythmDone(id: string, hits: number[]): void {
    this.send(MSG.RHYTHM_DONE, { id, hits });
  }
  fishHook(id: string): void {
    this.send(MSG.FISH_HOOK, { id });
  }
  talk(npcId: string): void {
    this.send(MSG.TALK, { npcId });
  }
  gift(npcId: string, slot: number): void {
    this.send(MSG.GIFT, { npcId, slot });
  }
  shop(m: ShopMsg): void {
    this.send(MSG.SHOP, m);
  }
  chest(m: ChestMsg): void {
    this.send(MSG.CHEST, m);
  }
  shelter(m: ShelterMsg): void {
    this.send(MSG.SHELTER, m);
  }
  chat(m: DialogueChatMsg): void {
    this.send(MSG.DIALOGUE_CHAT, m);
  }
  /** development/testing commands (only honoured by a server started with DEV_COMMANDS=1) */
  dev(m: Record<string, unknown>): void {
    this.send('dev', m);
  }
  leave(): void {
    clearInterval(this.pingTimer);
    void this.room?.leave();
  }
}
