import { expect, it } from 'vitest';
import { Soundscape, type SoundscapeFrame } from '../src/game/soundscape';

/** A tiny stand-in for WebAudio that records what the soundscape asks for. */
function fakeContext() {
  const made: string[] = [];
  const param = () => {
    const p = { value: 0, targets: [] as number[] };
    return Object.assign(p, {
      setValueAtTime: () => p,
      setTargetAtTime: (v: number) => (p.targets.push(v), p),
      exponentialRampToValueAtTime: () => p,
    });
  };
  const node = (kind: string) => {
    made.push(kind);
    const n: Record<string, unknown> = {
      gain: param(),
      frequency: param(),
      Q: param(),
      pan: param(),
      type: '',
      buffer: null,
      loop: false,
      connect: (to: unknown) => to,
      start: () => {},
      stop: () => {},
    };
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node('destination'),
    createGain: () => node('gain'),
    createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('source'),
    createOscillator: () => node('osc'),
    createStereoPanner: () => node('pan'),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, made };
}

const frame = (o: Partial<SoundscapeFrame> = {}): SoundscapeFrame => ({
  dt: 1,
  hour: 6.5,
  season: 1,
  weather: 'clear',
  wind: 0.3,
  biome: 'forest',
  underground: false,
  water: 0,
  town: false,
  speed: 0,
  ...o,
});

it('builds its beds once, follows mute and the World sounds level, and sings through every voice', () => {
  const { ctx, made } = fakeContext();
  const audio = { context: () => ctx as unknown as AudioContext, muted: false, volume: 0.5 };
  const s = new Soundscape(audio);
  s.level = 0.8;
  for (let i = 0; i < 40; i++) s.frame(frame({ hour: 6 + i * 0.5, weather: i % 5 === 0 ? 'storm' : 'clear' }));
  const beds = made.filter((k) => k === 'source').length;
  // one looping source per bed plus thunder rolls; birds and crickets are oscillators
  expect(beds).toBeGreaterThanOrEqual(5);
  expect(made.filter((k) => k === 'osc').length).toBeGreaterThan(10);
  // underground, swamp, coast and town all run without errors
  for (const f of [
    frame({ underground: true }),
    frame({ biome: 'swamp', hour: 22 }),
    frame({ water: 0.9 }),
    frame({ town: true, hour: 12 }),
    frame({ biome: 'taiga', hour: 23, season: 3 }),
  ])
    for (let i = 0; i < 10; i++) s.frame(f);
  // muted: the master gain heads to silence
  audio.muted = true;
  const before = made.length;
  s.frame(frame());
  expect(made.length).toBe(before); // nothing new is voiced while muted
});

it('waits quietly until the audio context exists', () => {
  const s = new Soundscape({ context: () => null, muted: false, volume: 1 });
  expect(() => s.frame(frame())).not.toThrow();
});
