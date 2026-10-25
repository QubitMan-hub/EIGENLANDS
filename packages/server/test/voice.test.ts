import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG34, VOICE_FAR, VOICE_NEAR, voiceGain, type VoiceIn } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, sleep, spawn3, tp } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await app?.close();
});

describe('proximity voice', () => {
  it('gain is flat up close and falls to silence', () => {
    expect(voiceGain(0)).toBe(1);
    expect(voiceGain(VOICE_NEAR)).toBe(1);
    expect(voiceGain(VOICE_FAR)).toBe(0);
    expect(voiceGain((VOICE_NEAR + VOICE_FAR) / 2)).toBeLessThan(0.3);
    expect(voiceGain(15)).toBeGreaterThan(voiceGain(20));
  });

  it('relays handshakes between nearby players only, and rejects junk', async () => {
    const a = await spawn3(app, 'Caller'),
      b = await spawn3(app, 'Listener');
    const got: VoiceIn[] = [];
    b.r.onMessage(MSG34.VOICE, (m: VoiceIn) => got.push(m));
    await tp(a, 5.5, 5.5);
    await tp(b, 9.5, 5.5);
    a.r.send(MSG34.VOICE, { to: b.sid, d: { t: 'offer', sdp: 'v=0' } });
    await sleep(250);
    expect(got).toHaveLength(1);
    expect(got[0]!.from).toBe(a.sid);
    // junk is dropped
    a.r.send(MSG34.VOICE, { to: b.sid, d: { t: 'offer', sdp: 'x'.repeat(14000) } });
    a.r.send(MSG34.VOICE, { to: b.sid, d: { t: 'nope' } });
    a.r.send(MSG34.VOICE, { to: 'nobody', d: { t: 'bye' } });
    // out of range: dropped, but a goodbye still gets through
    await tp(b, 120.5, 5.5);
    a.r.send(MSG34.VOICE, { to: b.sid, d: { t: 'ice', c: { candidate: 'candidate:1' } } });
    await sleep(250);
    expect(got).toHaveLength(1);
    a.r.send(MSG34.VOICE, { to: b.sid, d: { t: 'bye' } });
    await sleep(250);
    expect(got).toHaveLength(2);
    await a.r.leave();
    await b.r.leave();
  });
});
