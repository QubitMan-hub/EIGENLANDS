export type Sfx = 'swing' | 'hit' | 'shot' | 'dash' | 'hurt' | 'die' | 'levelup' | 'break' | 'pickup' | 'coin' | 'craft' | 'splash' | 'till' | 'chop' | 'bite' | 'harvest';

/** Tiny WebAudio chiptune-style SFX synth; no asset files. Starts after the first user gesture. */
export class Audio {
  private ctx: AudioContext | null = null;
  muted = false;
  volume = 0.5;

  unlock(): void {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* audio unavailable */ }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, delay = 0): void {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain * this.volume, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  play(s: Sfx): void {
    switch (s) {
      case 'swing': this.tone(380, 0.09, 'square', 0.12, -220); break;
      case 'hit': this.tone(180, 0.09, 'sawtooth', 0.2, -100); this.tone(520, 0.05, 'square', 0.1); break;
      case 'shot': this.tone(700, 0.14, 'triangle', 0.16, 500); break;
      case 'dash': this.tone(220, 0.14, 'sawtooth', 0.08, 380); break;
      case 'hurt': this.tone(150, 0.2, 'square', 0.2, -90); break;
      case 'die': this.tone(300, 0.4, 'sawtooth', 0.2, -250); break;
      case 'break': this.tone(120, 0.15, 'square', 0.2, -60); this.tone(90, 0.2, 'sawtooth', 0.12, -40, 0.03); break;
      case 'pickup': this.tone(660, 0.07, 'square', 0.08); this.tone(880, 0.08, 'square', 0.08, 0, 0.05); break;
      case 'coin': this.tone(988, 0.06, 'square', 0.09); this.tone(1319, 0.14, 'square', 0.09, 0, 0.06); break;
      case 'craft': this.tone(330, 0.08, 'triangle', 0.15); this.tone(440, 0.1, 'triangle', 0.15, 0, 0.08); this.tone(660, 0.16, 'triangle', 0.15, 0, 0.18); break;
      case 'splash': this.tone(300, 0.2, 'sawtooth', 0.06, -200); this.tone(500, 0.1, 'triangle', 0.05, 200, 0.05); break;
      case 'till': this.tone(110, 0.1, 'square', 0.14, -40); break;
      case 'chop': this.tone(140, 0.07, 'square', 0.18, -60); this.tone(300, 0.04, 'sawtooth', 0.08); break;
      case 'bite': this.tone(880, 0.1, 'square', 0.18); this.tone(1175, 0.2, 'square', 0.18, 0, 0.1); break;
      case 'harvest': this.tone(523, 0.08, 'triangle', 0.14); this.tone(784, 0.14, 'triangle', 0.14, 0, 0.07); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.14, 0, i * 0.08)); break;
    }
  }
}

export const SFX_CAPTIONS: Record<Sfx, string> = {
  swing: 'sword swish', hit: 'impact', shot: 'energy bolt', dash: 'whoosh', hurt: 'you are hit!',
  die: 'defeated', levelup: 'level up chime', break: 'rock crumbles', pickup: 'item pickup', coin: 'coins', craft: 'crafted', splash: 'splash',
  till: 'soil turned', chop: 'chopping', bite: 'fish bite!', harvest: 'harvest',
};
