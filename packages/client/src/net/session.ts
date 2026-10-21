import { Client, type Room } from 'colyseus.js';
import {
  JOIN_ROOM, MSG, decodeAck, type Ack, type ChestMsg, type ChunkMsg, type CraftMsg, type DialogueChatMsg, type DialogueMsg, type EquipMsg,
  type ExperimentMsg, type FishBiteMsg, type ForgePreviewReply, type ForgeStartMsg, type FxMsg, type InputCmd, type InvMoveMsg,
  type InvTrashMsg, type ObjMsg, type PanelMsg, type ProfileMsg, type RhythmResultMsg, type RhythmStartMsg, type ShelterMsg,
  type ShopMsg, type ShopViewMsg, type TileMsg, type ToastMsg, type UseMsg, type WelcomeMsg,
} from '@eigenlands/shared';

export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:2567`;

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export interface AuthState { token: string; guest: boolean; accountId: string }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${SERVER_URL}/api/auth${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`);
  return (await r.json()) as T;
}

export const authConfig = () => api<{ googleClientId: string | null }>('/config');

export async function guestLogin(): Promise<AuthState> {
  const j = await api<{ token: string; deviceSecret: string; accountId: string }>('/guest', {
    method: 'POST', body: JSON.stringify({ deviceSecret: store.get('eigen.device') ?? undefined }),
  });
  store.set('eigen.device', j.deviceSecret);
  store.set('eigen.token', j.token);
  return { token: j.token, guest: true, accountId: j.accountId };
}

/** Signs in with a Google ID token; if this browser has a guest, the guest is upgraded in place. */
export async function googleLogin(idToken: string): Promise<AuthState & { upgraded: boolean }> {
  const j = await api<{ token: string; accountId: string; upgraded: boolean }>('/google', {
    method: 'POST', body: JSON.stringify({ idToken, deviceSecret: store.get('eigen.device') ?? undefined }),
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
  } catch { store.del('eigen.token'); return null; }
}

export async function deleteAccount(token: string): Promise<void> {
  await api('/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  store.del('eigen.token'); store.del('eigen.device');
}

export const signOut = () => store.del('eigen.token');

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
}

export class Net {
  private room!: Room;
  private pingTimer = 0;
  bytesIn = 0;

  constructor(private h: NetHandlers) {}

  get sessionId(): string { return this.room.sessionId; }

  async connect(token: string, name?: string): Promise<void> {
    const client = new Client(SERVER_URL.replace(/^http/, 'ws'));
    this.room = await client.joinOrCreate(JOIN_ROOM, { token, name });
    const r = this.room;
    r.onMessage(MSG.WELCOME, (w: WelcomeMsg) => this.h.welcome(w));
    r.onMessage(MSG.ACK, (b: Uint8Array) => { this.bytesIn += b.byteLength; this.h.ack(decodeAck(b)); });
    r.onMessage(MSG.FX, (f: FxMsg) => this.h.fx(f));
    r.onMessage(MSG.CHUNK, (m: ChunkMsg) => this.h.chunk({ ...m, diff: new Uint8Array(m.diff) }));
    r.onMessage(MSG.TILE, (m: TileMsg) => this.h.tile(m));
    r.onMessage(MSG.NOTICE, (m: { text: string }) => this.h.notice(m.text));
    r.onMessage(MSG.PONG, (m: { t: number }) => this.h.rtt(performance.now() - m.t));
    r.onMessage(MSG.PROFILE, (m: ProfileMsg) => this.h.profile(m));
    r.onMessage(MSG.OBJ, (m: ObjMsg) => this.h.obj(m));
    r.onMessage(MSG.PANEL, (m: PanelMsg) => this.h.panel(m));
    r.onMessage(MSG.RHYTHM_START, (m: RhythmStartMsg) => this.h.rhythmStart(m));
    r.onMessage(MSG.RHYTHM_RESULT, (m: RhythmResultMsg) => this.h.rhythmResult(m));
    r.onMessage(MSG.FISH_BITE, (m: FishBiteMsg) => this.h.fishBite(m));
    r.onMessage(MSG.FISH_CAST, (m: { tx: number; ty: number; id: string }) => this.h.fishCast(m));
    r.onMessage(MSG.DIALOGUE, (m: DialogueMsg) => this.h.dialogue(m));
    r.onMessage(MSG.SHOP_VIEW, (m: ShopViewMsg) => this.h.shopView(m));
    r.onMessage(MSG.FORGE_PREVIEW_R, (m: ForgePreviewReply) => this.h.forgePreview(m));
    r.onMessage(MSG.TOAST, (m: ToastMsg) => this.h.toast(m));
    r.onStateChange((s) => this.h.state(s));
    r.onLeave((code) => { clearInterval(this.pingTimer); this.h.close(code); });
    this.pingTimer = window.setInterval(() => r.send(MSG.PING, { t: performance.now() }), 2000);
    r.send(MSG.PING, { t: performance.now() });
  }

  sendInput(cmd: InputCmd): void { this.room.send(MSG.INPUT, { cmds: [cmd] }); }
  sendEdit(tx: number, ty: number): void { this.room.send(MSG.EDIT, { tx, ty }); }
  requestChunk(cx: number, cy: number): void { this.room.send(MSG.CHUNK_REQ, { cx, cy }); }
  use(m: UseMsg): void { this.room.send(MSG.USE, m); }
  open(tx: number, ty: number): void { this.room.send(MSG.OPEN, { tx, ty }); }
  invMove(m: InvMoveMsg): void { this.room.send(MSG.INV_MOVE, m); }
  invTrash(m: InvTrashMsg): void { this.room.send(MSG.INV_TRASH, m); }
  equip(m: EquipMsg): void { this.room.send(MSG.EQUIP, m); }
  craft(m: CraftMsg): void { this.room.send(MSG.CRAFT, m); }
  experiment(m: ExperimentMsg): void { this.room.send(MSG.EXPERIMENT, m); }
  forgePreview(materials: string[]): void { this.room.send(MSG.FORGE_PREVIEW, { materials }); }
  forgeStart(m: ForgeStartMsg): void { this.room.send(MSG.FORGE_START, m); }
  rhythmDone(id: string, hits: number[]): void { this.room.send(MSG.RHYTHM_DONE, { id, hits }); }
  fishHook(id: string): void { this.room.send(MSG.FISH_HOOK, { id }); }
  talk(npcId: string): void { this.room.send(MSG.TALK, { npcId }); }
  gift(npcId: string, slot: number): void { this.room.send(MSG.GIFT, { npcId, slot }); }
  shop(m: ShopMsg): void { this.room.send(MSG.SHOP, m); }
  chest(m: ChestMsg): void { this.room.send(MSG.CHEST, m); }
  shelter(m: ShelterMsg): void { this.room.send(MSG.SHELTER, m); }
  chat(m: DialogueChatMsg): void { this.room.send(MSG.DIALOGUE_CHAT, m); }
  /** development/testing commands (only honoured by a server started with DEV_COMMANDS=1) */
  dev(m: Record<string, unknown>): void { this.room.send('dev', m); }
  leave(): void { clearInterval(this.pingTimer); void this.room?.leave(); }
}
