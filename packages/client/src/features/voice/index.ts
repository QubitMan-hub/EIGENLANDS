import { keyLabel } from '../../input/keymap';
import { Graphics } from 'pixi.js';
import { MSG34, VOICE_FAR, voiceGain, type VoiceIn, type VoiceSignal } from '@eigenlands/shared';
import { h } from '../../ui/dom';
import { isoX, isoY } from '../../game/iso';
import type { ClientModule, ExtAction, P34Deps } from '../types';

const CSS = `
#voice-chip{position:fixed;left:12px;top:92px;z-index:28;display:flex;gap:8px;align-items:center;padding:4px 10px 4px 8px;border-radius:0;
  font:600 12px ui-monospace,monospace;color:#d5e1cf;background:#17201fed;border:1px solid #786646;border-left:4px solid #bca06b;box-shadow:0 2px 0 #101719aa;cursor:pointer;user-select:none;max-width:260px}
#voice-chip .vc-dot{width:8px;height:8px;border-radius:0;background:#786646;flex:none;border-radius:0;transform:rotate(45deg);transition:background .1s,box-shadow .1s}
#voice-chip.on .vc-dot{background:#5af0d0}
#voice-chip.talk .vc-dot{box-shadow:0 0 8px 3px #5af0d0}
#voice-chip.muted .vc-dot{background:#d44a4a}
#voice-chip .vc-who{opacity:.75;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const SPEAK_LEVEL = 0.035;

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  gain?: GainNode;
  pan?: StereoPannerNode;
  an?: AnalyserNode;
  buf?: Uint8Array<ArrayBuffer>;
  audio?: HTMLAudioElement;
  level: number;
  queued: RTCIceCandidateInit[];
}

/**
 * Proximity voice chat. Audio is peer-to-peer (WebRTC); the room relays handshakes between nearby players only.
 * Each listener hears a speaker with a gain that falls with distance (`voiceGain`) and panned by their screen offset.
 * The bound voice key turns voice on/off (asks for the microphone, or listens only if it is refused); click the chip to mute the mic.
 */
export class VoiceClient implements ClientModule {
  private chip: HTMLElement;
  private who: HTMLElement;
  private on = false;
  private muted = false;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private peers = new Map<string, Peer>();
  private players: any = null;
  private gfx = new Graphics();
  private last = 0;
  private key = '';
  private mic: { an: AnalyserNode; buf: Uint8Array<ArrayBuffer> } | null = null;
  private talking = 0;

  constructor(private d: P34Deps) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.who = h('span', { class: 'vc-who', text: '' });
    this.chip = h(
      'div',
      { id: 'voice-chip', title: 'Proximity voice chat. Click to mute your microphone.' },
      h('span', { class: 'vc-dot' }),
      h('span', { text: 'Voice off' }),
      this.who,
    );
    this.chip.addEventListener('click', () => {
      if (this.on) this.toggleMute();
      else void this.enable();
    });
    document.body.append(this.chip);
    const ledger = document.getElementById('hud-left');
    if (ledger && typeof ResizeObserver !== 'undefined') {
      const place = () => {
        const box = ledger.getBoundingClientRect();
        if (!box.height) return;
        const bottom = Math.ceil(box.bottom);
        document.body.style.setProperty('--ledger-bottom', `${bottom}px`);
        this.chip.style.top = `${bottom + 4}px`;
      };
      new ResizeObserver(place).observe(ledger);
      window.addEventListener('resize', place);
      place();
    }
    this.gfx.zIndex = 9e8;
    this.d.fxLayer().addChild(this.gfx);
    this.paint();
  }

  handlers(): Record<string, (m: any) => void> {
    return { [MSG34.VOICE]: (m: VoiceIn) => void this.onSignal(m) };
  }

  onState(s: any): void {
    this.players = s?.players ?? null;
  }

  action(a: ExtAction): boolean {
    if (a !== 'voice') return false;
    if (this.d.wins.open) return false;
    if (this.on) this.disable();
    else void this.enable();
    return true;
  }

  // ───────────────────────── session ─────────────────────────

  private async enable(): Promise<void> {
    if (this.on) return;
    this.on = true;
    try {
      this.ctx = new AudioContext();
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        if (this.ctx) {
          const an = this.ctx.createAnalyser();
          an.fftSize = 512;
          this.ctx.createMediaStreamSource(this.stream).connect(an);
          this.mic = { an, buf: new Uint8Array(an.fftSize) };
        }
      } catch {
        this.d.toasts.add('No microphone: you can hear nearby players but they will not hear you.', 'info');
      }
    } else this.d.toasts.add('Voice chat needs a browser with microphone support.', 'info');
    this.paint();
  }

  private disable(): void {
    this.on = false;
    for (const id of [...this.peers.keys()]) this.drop(id, true);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mic = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.gfx.clear();
    this.paint();
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !this.muted;
    });
    this.paint();
  }

  private send(to: string, d: VoiceSignal): void {
    try {
      this.d.net().send(MSG34.VOICE, { to, d });
    } catch {
      /* offline */
    }
  }

  // ───────────────────────── peers ─────────────────────────

  private make(id: string): Peer {
    const pc = new RTCPeerConnection(ICE);
    const peer: Peer = { id, pc, level: 0, queued: [] };
    this.peers.set(id, peer);
    if (this.stream) for (const t of this.stream.getAudioTracks()) pc.addTrack(t, this.stream);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = (e) => {
      if (e.candidate)
        this.send(id, {
          t: 'ice',
          c: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex },
        });
    };
    pc.ontrack = (e) => this.attach(peer, e.streams[0] ?? new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.drop(id, false);
    };
    return peer;
  }

  /** remote audio -> analyser (who is speaking) -> gain (distance) -> panner (left/right) -> speakers */
  private attach(peer: Peer, stream: MediaStream): void {
    // a muted element keeps the stream flowing in Chromium; the Web Audio graph does the actual playback
    const audio = new Audio();
    audio.srcObject = stream;
    audio.muted = true;
    void audio.play().catch(() => {});
    peer.audio = audio;
    if (!this.ctx) return;
    const src = this.ctx.createMediaStreamSource(stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = 512;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const pan = this.ctx.createStereoPanner();
    src.connect(an);
    src.connect(gain);
    gain.connect(pan);
    pan.connect(this.ctx.destination);
    Object.assign(peer, { an, buf: new Uint8Array(an.fftSize), gain, pan });
  }

  private drop(id: string, tell: boolean): void {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    if (tell) this.send(id, { t: 'bye' });
    try {
      p.pc.close();
    } catch {
      /* already closed */
    }
    p.audio?.pause();
    p.gain?.disconnect();
  }

  private async onSignal(m: VoiceIn): Promise<void> {
    if (!this.on || !m || typeof m.from !== 'string' || !m.d) return;
    const d = m.d;
    try {
      if (d.t === 'bye') {
        this.drop(m.from, false);
        return;
      }
      if (d.t === 'offer') {
        this.drop(m.from, false);
        const p = this.make(m.from);
        await p.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
        for (const c of p.queued.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        const ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        this.send(m.from, { t: 'answer', sdp: ans.sdp ?? '' });
      } else if (d.t === 'answer') {
        const p = this.peers.get(m.from);
        if (!p || p.pc.signalingState !== 'have-local-offer') return;
        await p.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
        for (const c of p.queued.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
      } else if (d.t === 'ice') {
        const p = this.peers.get(m.from);
        if (!p) return;
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(d.c).catch(() => {});
        else p.queued.push(d.c);
      }
    } catch {
      this.drop(m.from, false);
    }
  }

  private async call(id: string): Promise<void> {
    const p = this.make(id);
    try {
      const offer = await p.pc.createOffer();
      await p.pc.setLocalDescription(offer);
      this.send(id, { t: 'offer', sdp: offer.sdp ?? '' });
    } catch {
      this.drop(id, false);
    }
  }

  // ───────────────────────── per frame ─────────────────────────

  private level(an: AnalyserNode | undefined, buf: Uint8Array<ArrayBuffer> | undefined): number {
    if (!an || !buf) return 0;
    an.getByteTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i]! - 128) / 128;
      s += v * v;
    }
    return Math.sqrt(s / buf.length);
  }

  frame(now: number, _dt: number): void {
    const key = this.d.keys().voice[0] ?? '';
    if (key !== this.key) {
      this.key = key;
      this.paint();
    }
    if (!this.on) return;
    const me = this.d.me();
    if (!me) return;
    const near = new Map<string, { x: number; y: number; name: string; dist: number }>();
    this.players?.forEach?.((p: { name: string }, id: string) => {
      if (id === this.d.myId()) return;
      const pos = this.d.entityPos(id);
      if (!pos) return;
      const dist = Math.hypot(pos.x - me.x, pos.y - me.y);
      if (dist <= VOICE_FAR + 8) near.set(id, { x: pos.x, y: pos.y, name: p.name, dist });
    });
    // connect / disconnect twice a second; the lexicographically smaller id places the call
    if (now - this.last > 500) {
      this.last = now;
      for (const [id, n] of near)
        if (n.dist <= VOICE_FAR && !this.peers.has(id) && this.d.myId() < id) void this.call(id);
      for (const id of [...this.peers.keys()]) {
        const n = near.get(id);
        if (!n || n.dist > VOICE_FAR + 6) this.drop(id, true);
      }
    }
    const g = this.gfx;
    g.clear();
    const speakers: string[] = [];
    const sx = isoX(me.x, me.y);
    for (const [id, p] of this.peers) {
      const n = near.get(id);
      if (!n) continue;
      if (p.gain && p.pan && this.ctx) {
        p.gain.gain.setTargetAtTime(voiceGain(n.dist), this.ctx.currentTime, 0.08);
        p.pan.pan.setTargetAtTime(
          Math.max(-0.9, Math.min(0.9, (isoX(n.x, n.y) - sx) / 220)),
          this.ctx.currentTime,
          0.08,
        );
      }
      p.level += (this.level(p.an, p.buf) - p.level) * 0.35;
      if (p.level > SPEAK_LEVEL && voiceGain(n.dist) > 0.02) {
        speakers.push(n.name);
        const x = isoX(n.x, n.y),
          y = isoY(n.x, n.y) - 36;
        const k = 0.5 + 0.5 * Math.sin(now / 90);
        for (let i = 0; i < 3; i++)
          g.arc(x + 7, y, 3 + i * 2.5, -0.7, 0.7).stroke({
            color: 0x5af0d0,
            width: 1,
            alpha: 0.35 + 0.5 * k * (1 - i / 3),
          });
      }
    }
    const lvl = this.mic && !this.muted ? this.level(this.mic.an, this.mic.buf) : 0;
    this.talking = lvl > SPEAK_LEVEL ? 1 : 0;
    this.chip.classList.toggle('talk', !!this.talking);
    this.who.textContent = speakers.length
      ? speakers.slice(0, 3).join(', ')
      : this.peers.size
        ? `${this.peers.size} nearby`
        : '';
  }

  private paint(): void {
    this.chip.classList.toggle('on', this.on);
    this.chip.classList.toggle('muted', this.on && (this.muted || !this.stream));
    const label = this.chip.children[1] as HTMLElement;
    const code = this.d.keys().voice[0],
      key = code ? ` · ${keyLabel(code)}` : '';
    label.textContent = (!this.on ? 'Voice off' : !this.stream ? 'Listening' : this.muted ? 'Muted' : 'Voice on') + key;
    if (!this.on) this.who.textContent = '';
  }

  debug(): Record<string, unknown> {
    return {
      voice: this.on,
      voicePeers: this.peers.size,
      voiceLive: [...this.peers.values()].filter((p) => p.pc.connectionState === 'connected').length,
      muted: this.muted,
    };
  }
}
