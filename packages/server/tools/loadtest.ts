/**
 * Bot load test: npx tsx tools/loadtest.ts [bots=100] [seconds=20] [serverUrl=http://localhost:2567]
 * Bots random-walk and fight near spawn (worst case for interest management: everyone sees everyone).
 */
import { Client } from 'colyseus.js';
import { MSG, TICK_MS } from '@eigenlands/shared';

const bots = Number(process.argv[2] ?? 100);
const seconds = Number(process.argv[3] ?? 20);
const url = process.argv[4] ?? 'http://localhost:2567';
const spread = process.env.SPREAD === '1';

let bytes = 0;
let joined = 0;
let failed = 0;
const rooms: any[] = [];

async function bot(i: number): Promise<void> {
  try {
    const g = await (await fetch(`${url}/api/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json() as any;
    const client = new Client(url.replace(/^http/, 'ws'));
    const room = await client.joinOrCreate('world', { token: g.token, name: `bot${i}` });
    room.onMessage('*', (_t: any, m: any) => { bytes += m?.byteLength ?? 60; });
    room.onStateChange(() => { bytes += 30; });
    rooms.push(room);
    joined++;
    let seq = 0, dx = 0, dy = 0, t = 0;
    const timer = setInterval(() => {
      if (t++ % 20 === 0) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); }
      room.send(MSG.INPUT, { cmds: [{ seq: ++seq, dx, dy, dash: t % 37 === 0, attack: t % 5 === 0, skill: t % 23 === 0, aimX: dx, aimY: dy, viewTick: 0 }] });
    }, TICK_MS);
    room.onLeave(() => clearInterval(timer));
    if (spread) { /* bots wander on their own; no teleport hook is exposed on purpose */ }
  } catch { failed++; }
}

const t0 = Date.now();
for (let i = 0; i < bots; i += 10) {
  await Promise.all(Array.from({ length: Math.min(10, bots - i) }, (_, k) => bot(i + k)));
}
console.log(`joined ${joined}/${bots} (failed ${failed}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const samples: any[] = [];
const end = Date.now() + seconds * 1000;
bytes = 0;
const mStart = Date.now();
while (Date.now() < end) {
  await new Promise((r) => setTimeout(r, 2000));
  const m = await (await fetch(`${url}/metrics`)).json() as any;
  samples.push(m);
  console.log(`players ${m.players} enemies ${m.enemies} tick avg ${m.tickMsAvg.toFixed(2)}ms max ${m.tickMsMax.toFixed(1)}ms overBudget ${m.overBudget} rss ${m.rssMb}MB`);
}
const secs = (Date.now() - mStart) / 1000;
console.log(`downstream ≈ ${(bytes / 1024 / secs).toFixed(0)} KB/s total, ≈ ${(bytes / secs / Math.max(1, joined)).toFixed(0)} B/s per player (counted client-side, payload bytes)`);
const last = samples[samples.length - 1];
console.log(last && last.tickMsAvg < 25 ? 'PASS: avg tick under half the 50ms budget' : 'WARN: tick avg above half budget');
for (const r of rooms) r.leave();
setTimeout(() => process.exit(0), 1500);
