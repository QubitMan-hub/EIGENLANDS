/**
 * Proximity voice chat: audio flows peer-to-peer (WebRTC); the room only relays the handshake between two players
 * who are within VOICE_RELAY_RANGE of each other, so nobody can be pinged from across the world and the server never
 * touches audio. See docs/design/voice.md.
 */
import { MSG34, VOICE_RELAY_RANGE, type VoiceMsg } from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import type { Module, Registrar } from '../types';

const MAX_SDP = 12_000;

export class VoiceModule implements Module {
  constructor(private room: GameRoom) {}

  install(reg: Registrar): void {
    reg.on<VoiceMsg>(MSG34.VOICE, 'voice', (p, m) => this.relay(p, m));
  }

  private relay(p: ServerPlayer, m: VoiceMsg): void {
    if (!m || typeof m.to !== 'string' || !m.d || typeof m.d !== 'object' || m.to === p.id) return;
    const d = m.d;
    if (d.t === 'offer' || d.t === 'answer') { if (typeof d.sdp !== 'string' || d.sdp.length > MAX_SDP) return; }
    else if (d.t === 'ice') { if (!d.c || typeof d.c.candidate !== 'string' || d.c.candidate.length > 1000) return; }
    else if (d.t !== 'bye') return;
    const q = this.room.players.get(m.to);
    if (!q) return;
    // goodbyes always pass; anything else needs the two players to be near
    if (d.t !== 'bye' && Math.hypot(q.sim.x - p.sim.x, q.sim.y - p.sim.y) > VOICE_RELAY_RANGE) return;
    q.client.send(MSG34.VOICE, { from: p.id, d });
  }
}
