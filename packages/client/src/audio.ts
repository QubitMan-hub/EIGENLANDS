export type Sfx =
  | 'swing'
  | 'hit'
  | 'shot'
  | 'dash'
  | 'hurt'
  | 'die'
  | 'levelup'
  | 'break'
  | 'pickup'
  | 'coin'
  | 'craft'
  | 'splash'
  | 'till'
  | 'chop'
  | 'bite'
  | 'harvest'
  // combat 2.0
  | 'swing2'
  | 'finisher'
  | 'heavy'
  | 'charge'
  | 'chargeReady'
  | 'hitLight'
  | 'hitHeavy'
  | 'crit'
  | 'perfect'
  | 'windup'
  | 'orb'
  | 'reflect'
  | 'slam'
  | 'stagger'
  | 'blast'
  | 'kill'
  | 'heartbeat'
  | 'crash'
  | 'bomb'
  | 'counter';

/** Tiny WebAudio chiptune-style SFX synth; no asset files. Starts after the first user gesture. */
export class Audio {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  volume = 0.5;

  unlock(): void {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio unavailable */
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, delay = 0): void {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain * this.volume, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /** Filtered white noise: whooshes (band sweep), impacts (low-pass thump), crackles (high-pass). */
  private noise(
    dur: number,
    gain: number,
    type: BiquadFilterType,
    f0: number,
    f1 = f0,
    q = 1,
    delay = 0,
    attack = 0.005,
  ): void {
    const c = this.ctx;
    if (!c || this.muted) return;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.volume, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  play(s: Sfx): void {
    switch (s) {
      // swings: band-passed whooshes, pitch rising through the combo
      case 'swing':
        this.noise(0.12, 0.22, 'bandpass', 900, 2600, 1.2);
        this.tone(380, 0.06, 'square', 0.04, -200);
        break;
      case 'swing2':
        this.noise(0.12, 0.22, 'bandpass', 1300, 3200, 1.2);
        this.tone(440, 0.06, 'square', 0.04, -220);
        break;
      case 'finisher':
        this.noise(0.2, 0.3, 'bandpass', 600, 3600, 0.9);
        this.tone(200, 0.16, 'sawtooth', 0.08, 260);
        break;
      case 'heavy':
        this.noise(0.32, 0.38, 'bandpass', 300, 2800, 0.8);
        this.tone(110, 0.3, 'sawtooth', 0.14, 160);
        this.tone(55, 0.35, 'sine', 0.25, -10);
        break;
      case 'charge':
        this.tone(160, 0.35, 'triangle', 0.06, 220);
        break;
      case 'chargeReady':
        this.tone(880, 0.07, 'square', 0.09);
        this.tone(1320, 0.12, 'triangle', 0.1, 0, 0.05);
        break;
      // impacts by weight
      case 'hitLight':
        this.noise(0.07, 0.3, 'lowpass', 2200, 400, 0.7);
        this.tone(240, 0.06, 'square', 0.08, -120);
        break;
      case 'hit':
        this.noise(0.1, 0.35, 'lowpass', 1800, 250, 0.7);
        this.tone(180, 0.09, 'sawtooth', 0.16, -100);
        this.tone(520, 0.05, 'square', 0.06);
        break;
      case 'hitHeavy':
        this.noise(0.22, 0.5, 'lowpass', 1400, 120, 0.8);
        this.tone(90, 0.24, 'sine', 0.4, -50);
        this.tone(150, 0.12, 'sawtooth', 0.15, -90);
        break;
      case 'crit':
        this.tone(1568, 0.06, 'square', 0.1);
        this.tone(2093, 0.14, 'triangle', 0.12, 0, 0.04);
        this.noise(0.12, 0.2, 'highpass', 4000, 7000, 0.5);
        break;
      case 'counter':
        this.tone(784, 0.08, 'square', 0.1);
        this.tone(1175, 0.08, 'square', 0.1, 0, 0.06);
        this.tone(1568, 0.2, 'triangle', 0.12, 0, 0.12);
        break;
      case 'kill':
        this.noise(0.25, 0.25, 'bandpass', 2000, 300, 1.5);
        this.tone(660, 0.1, 'triangle', 0.08, -300, 0.05);
        break;
      case 'stagger':
        this.tone(520, 0.08, 'square', 0.08, -200);
        this.tone(390, 0.12, 'square', 0.08, -160, 0.07);
        break;
      case 'slam':
        this.noise(0.28, 0.5, 'lowpass', 900, 80, 0.9);
        this.tone(70, 0.3, 'sine', 0.4, -30);
        break;
      // dodge
      case 'dash':
        this.noise(0.16, 0.18, 'bandpass', 500, 2400, 1);
        this.tone(220, 0.12, 'sawtooth', 0.04, 380);
        break;
      case 'perfect':
        this.noise(0.4, 0.22, 'bandpass', 6000, 400, 2, 0, 0.12); // reversed-feeling swell
        [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, 0, 0.04 + i * 0.035));
        break;
      // enemies
      case 'windup':
        this.tone(300, 0.28, 'square', 0.05, 260);
        break;
      case 'orb':
        this.tone(520, 0.25, 'sine', 0.1, -260);
        this.noise(0.2, 0.08, 'bandpass', 3000, 900, 3);
        break;
      case 'reflect':
        this.tone(1200, 0.06, 'square', 0.12);
        this.tone(1800, 0.16, 'triangle', 0.12, 400, 0.03);
        break;
      case 'blast':
        this.noise(0.4, 0.45, 'lowpass', 1200, 60, 0.8);
        this.tone(60, 0.35, 'sine', 0.35, -20);
        break;
      case 'crash':
        this.noise(0.35, 0.55, 'lowpass', 700, 60, 1);
        this.tone(55, 0.4, 'square', 0.18, -20);
        break;
      case 'bomb':
        [0, 0.15, 0.3, 0.42, 0.52, 0.6].forEach((d) => this.tone(1100, 0.04, 'square', 0.08, 0, d));
        break;
      case 'heartbeat':
        this.tone(58, 0.12, 'sine', 0.45, -15);
        this.tone(52, 0.14, 'sine', 0.35, -12, 0.16);
        break;
      // existing
      case 'shot':
        this.tone(700, 0.14, 'triangle', 0.16, 500);
        break;
      case 'hurt':
        this.tone(150, 0.2, 'square', 0.2, -90);
        this.noise(0.12, 0.3, 'lowpass', 1600, 200);
        break;
      case 'die':
        this.tone(300, 0.4, 'sawtooth', 0.2, -250);
        break;
      case 'break':
        this.tone(120, 0.15, 'square', 0.2, -60);
        this.tone(90, 0.2, 'sawtooth', 0.12, -40, 0.03);
        break;
      case 'pickup':
        this.tone(660, 0.07, 'square', 0.08);
        this.tone(880, 0.08, 'square', 0.08, 0, 0.05);
        break;
      case 'coin':
        this.tone(988, 0.06, 'square', 0.09);
        this.tone(1319, 0.14, 'square', 0.09, 0, 0.06);
        break;
      case 'craft':
        this.tone(330, 0.08, 'triangle', 0.15);
        this.tone(440, 0.1, 'triangle', 0.15, 0, 0.08);
        this.tone(660, 0.16, 'triangle', 0.15, 0, 0.18);
        break;
      case 'splash':
        this.tone(300, 0.2, 'sawtooth', 0.06, -200);
        this.tone(500, 0.1, 'triangle', 0.05, 200, 0.05);
        break;
      case 'till':
        this.tone(110, 0.1, 'square', 0.14, -40);
        break;
      case 'chop':
        this.tone(140, 0.07, 'square', 0.18, -60);
        this.tone(300, 0.04, 'sawtooth', 0.08);
        break;
      case 'bite':
        this.tone(880, 0.1, 'square', 0.18);
        this.tone(1175, 0.2, 'square', 0.18, 0, 0.1);
        break;
      case 'harvest':
        this.tone(523, 0.08, 'triangle', 0.14);
        this.tone(784, 0.14, 'triangle', 0.14, 0, 0.07);
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.14, 0, i * 0.08));
        break;
    }
  }
}

export const SFX_CAPTIONS: Record<Sfx, string> = {
  swing: 'sword swish',
  hit: 'impact',
  shot: 'energy bolt',
  dash: 'whoosh',
  hurt: 'you are hit!',
  die: 'defeated',
  levelup: 'level up chime',
  break: 'rock crumbles',
  pickup: 'item pickup',
  coin: 'coins',
  craft: 'crafted',
  splash: 'splash',
  till: 'soil turned',
  chop: 'chopping',
  bite: 'fish bite!',
  harvest: 'harvest',
  swing2: 'sword swish',
  finisher: 'finishing lunge',
  heavy: 'heavy cleave',
  charge: 'charging',
  chargeReady: 'charge ready',
  hitLight: 'impact',
  hitHeavy: 'heavy impact',
  crit: 'critical hit!',
  perfect: 'phase slip!',
  windup: 'enemy winding up',
  orb: 'orb fired',
  reflect: 'orb reflected',
  slam: 'wall slam',
  stagger: 'staggered',
  blast: 'blast',
  kill: 'foe defeated',
  heartbeat: 'heartbeat',
  crash: 'crash',
  bomb: 'ticking',
  counter: 'counter!',
};
