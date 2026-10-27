/**
 * The world's ambient soundscape: what you hear when you stop and listen. Wind that rises with the weather and blows
 * harder over snow and sand, rain and the odd roll of thunder, surf and water lapping where there is water about,
 * the murmur of townsfolk inside a settlement by day, the low breath of the Undercroft and its drips. Over those beds,
 * life: birdsong at dawn and by day (thick in the woods, sparse in the dunes), gulls over open water, crickets on
 * warm nights, owls in the pines and frogs in the fen. Everything is synthesised with WebAudio (no sound files) and
 * follows the Sound settings: mute silences it, the master volume and the World sounds slider scale it.
 */
import type { Biome, Weather } from '@eigenlands/shared';

export interface SoundscapeFrame {
  /** seconds since the last frame */
  dt: number;
  hour: number;
  season: number;
  weather: Weather;
  /** 0 calm .. 1 storm */
  wind: number;
  biome: Biome;
  underground: boolean;
  /** 0..1: how much water lies around the player */
  water: number;
  /** inside a settlement's ward */
  town: boolean;
  /** the player is moving fast enough to hear the air (riding, flying) */
  speed: number;
}

interface Bed {
  filter: BiquadFilterNode;
  gain: GainNode;
}

const SONGBIRDS: Partial<Record<Biome, number>> = {
  forest: 1.6,
  autumn: 1.2,
  meadow: 0.9,
  enchanted: 1.3,
  swamp: 0.6,
  taiga: 0.5,
  desert: 0.12,
  corrupted: 0.05,
};

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private beds: Record<'wind' | 'rain' | 'water' | 'murmur' | 'cave', Bed> | null = null;
  private windLfo: OscillatorNode | null = null;
  private timers = { bird: 2, cricket: 1, owl: 12, frog: 3, drip: 1, gull: 8, thunder: 20, murmur: 0 };
  /** World sounds slider, 0..1 */
  level = 0.7;

  constructor(private audio: { context(): AudioContext | null; muted: boolean; volume: number }) {}

  private ensure(): boolean {
    if (this.beds) return true;
    const c = this.audio.context();
    if (!c) return false;
    this.ctx = c;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);
    // one looping noise buffer feeds every bed through its own filter
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    // brown-ish noise: smoother than white, closer to wind and surf
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.04 * w) / 1.04;
      d[i] = last * 3.2 + w * 0.08;
    }
    const bed = (type: BiquadFilterType, f: number, q: number): Bed => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = f;
      filter.Q.value = q;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master!);
      src.start(0, Math.random() * 2);
      return { filter, gain };
    };
    this.beds = {
      wind: bed('bandpass', 420, 0.7),
      rain: bed('highpass', 1800, 0.4),
      water: bed('lowpass', 520, 0.8),
      murmur: bed('bandpass', 620, 1.4),
      cave: bed('lowpass', 140, 0.9),
    };
    // the wind sighs: a slow oscillator sweeps its band up and down
    this.windLfo = c.createOscillator();
    this.windLfo.frequency.value = 0.07;
    const depth = c.createGain();
    depth.gain.value = 180;
    this.windLfo.connect(depth).connect(this.beds.wind.filter.frequency);
    this.windLfo.start();
    return true;
  }

  private set(b: Bed, v: number, tc = 1.2): void {
    b.gain.gain.setTargetAtTime(Math.max(0, v), this.ctx!.currentTime, tc);
  }

  frame(f: SoundscapeFrame): void {
    if (!this.ensure()) return;
    const c = this.ctx!,
      b = this.beds!;
    const out = this.audio.muted ? 0 : this.audio.volume * this.level;
    this.master!.gain.setTargetAtTime(out, c.currentTime, 0.4);
    if (!out) return;
    const day = f.hour >= 5.5 && f.hour < 20;
    const wet = f.weather === 'rain' || f.weather === 'storm';
    if (f.underground) {
      this.set(b.wind, 0);
      this.set(b.rain, 0);
      this.set(b.water, f.water * 0.1);
      this.set(b.murmur, f.town ? 0.05 : 0);
      this.set(b.cave, 0.22);
    } else {
      const exposed = f.biome === 'taiga' || f.biome === 'desert' ? 1.5 : f.biome === 'forest' ? 0.75 : 1;
      this.set(b.wind, (0.05 + f.wind * 0.22) * exposed + Math.min(0.2, f.speed * 0.025));
      b.wind.filter.Q.value = 0.6 + f.wind * 0.6;
      this.set(b.rain, f.weather === 'storm' ? 0.34 : f.weather === 'rain' ? 0.22 : f.weather === 'snow' ? 0.03 : 0);
      this.set(b.water, f.water * (0.16 + f.wind * 0.12));
      this.set(b.cave, 0);
    }
    // townsfolk: a murmur that swells and falls as conversations come and go
    if ((this.timers.murmur -= f.dt) <= 0) {
      this.timers.murmur = 0.35 + Math.random() * 0.5;
      const busy = f.town && (f.underground || (day && f.hour < 21));
      this.set(b.murmur, busy ? 0.05 + Math.random() * 0.07 : 0, 0.25);
      b.murmur.filter.frequency.setTargetAtTime(500 + Math.random() * 350, c.currentTime, 0.3);
    }
    this.events(f, day, wet);
  }

  private tick(k: keyof Soundscape['timers'], dt: number, every: number): boolean {
    if ((this.timers[k] -= dt) > 0) return false;
    this.timers[k] = every * (0.5 + Math.random());
    return true;
  }

  private events(f: SoundscapeFrame, day: boolean, wet: boolean): void {
    const dt = f.dt;
    if (f.underground) {
      if (this.tick('drip', dt, 2.2)) this.drip();
      return;
    }
    const birds = SONGBIRDS[f.biome] ?? 0.8;
    const dawn = f.hour >= 5 && f.hour < 8 ? 2 : 1; // the dawn chorus
    if (day && !wet && birds > 0 && this.tick('bird', dt, 3.2 / (birds * dawn))) this.birdsong(f.biome);
    if (day && f.water > 0.35 && this.tick('gull', dt, 9)) this.gull();
    const night = f.hour >= 20.5 || f.hour < 5;
    const warm = f.season < 3 && f.biome !== 'taiga';
    if (night && warm && !wet && this.tick('cricket', dt, 0.9)) this.cricket();
    if (night && (f.biome === 'forest' || f.biome === 'taiga' || f.biome === 'autumn') && this.tick('owl', dt, 18))
      this.owl();
    if ((f.hour >= 18 || f.hour < 5) && f.biome === 'swamp' && this.tick('frog', dt, 1.6)) this.frog();
    if (f.weather === 'storm' && this.tick('thunder', dt, 22)) this.thunder();
  }

  // ───────────────────────── voices ─────────────────────────

  private voice(pan = Math.random() * 1.6 - 0.8): { out: AudioNode; t: number } {
    const c = this.ctx!;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.master!);
    return { out: p, t: c.currentTime + 0.02 };
  }
  private chirp(
    out: AudioNode,
    t: number,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    type: OscillatorType = 'sine',
  ) {
    const c = this.ctx!;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** a little phrase of song: a few quick whistles, each species-ish pattern its own */
  private birdsong(biome: Biome): void {
    const { out, t } = this.voice();
    const base = (biome === 'swamp' ? 1800 : 2600) + Math.random() * 1800;
    const kind = Math.floor(Math.random() * 3);
    const n = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const s = t + i * (kind === 2 ? 0.07 : 0.13);
      if (kind === 0) this.chirp(out, s, base, base * 1.35, 0.08, 0.05);
      else if (kind === 1) this.chirp(out, s, base * 1.3, base * 0.85, 0.11, 0.045);
      else this.chirp(out, s, base * (i % 2 ? 1.2 : 1), base * (i % 2 ? 1.25 : 1.05), 0.05, 0.04);
    }
  }
  private gull(): void {
    const { out, t } = this.voice();
    for (let i = 0; i < 3; i++) this.chirp(out, t + i * 0.22, 900, 1500 - i * 120, 0.18, 0.03, 'triangle');
  }
  /** a cricket's trill: a burst of very short high pulses */
  private cricket(): void {
    const { out, t } = this.voice();
    const f = 4200 + Math.random() * 900;
    for (let i = 0; i < 6; i++) this.chirp(out, t + i * 0.035, f, f, 0.02, 0.018, 'square');
  }
  private owl(): void {
    const { out, t } = this.voice(Math.random() - 0.5);
    this.chirp(out, t, 420, 380, 0.32, 0.06);
    this.chirp(out, t + 0.55, 430, 370, 0.5, 0.06);
  }
  private frog(): void {
    const { out, t } = this.voice();
    const f = 140 + Math.random() * 80;
    for (let i = 0; i < 2; i++) this.chirp(out, t + i * 0.12, f * 1.4, f, 0.09, 0.05, 'sawtooth');
  }
  /** a drip in the dark, with its echo off the cave walls */
  private drip(): void {
    const { out, t } = this.voice();
    const f = 1500 + Math.random() * 1400;
    this.chirp(out, t, f * 1.6, f, 0.05, 0.05);
    this.chirp(out, t + 0.21, f * 1.6, f, 0.05, 0.018);
    this.chirp(out, t + 0.43, f * 1.6, f, 0.05, 0.007);
  }
  /** a far-off roll of thunder: low filtered noise swelling and fading */
  private thunder(): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    const len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 6;
    }
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    src.connect(lp).connect(g).connect(this.master!);
    src.start(t);
  }
}
