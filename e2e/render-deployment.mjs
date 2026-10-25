// Only operates on disposable eigenlands-render-test volumes, never production.
// TSX_TSCONFIG_PATH=packages/server/tsconfig.json node --import tsx e2e/render-deployment.mjs /tmp/render-test.env
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { Client } from 'colyseus.js';
import { JOIN_ROOM, MSG, TICK_MS, decodeAck } from '../packages/shared/src/index.ts';
const envFile = process.argv[2];
if (!envFile) throw new Error('Provide the isolated test environment file.');
const args = [
  'compose',
  '--project-name',
  'eigenlands-render-test',
  '--env-file',
  resolve(envFile),
  '-f',
  resolve('deploy/render/compose.test.yml'),
];
const dc = (...command) =>
  execFileSync('docker', [...args, ...command], { encoding: 'utf8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
const run = promisify(execFile);
const dcAsync = (...command) => run('docker', [...args, ...command], { timeout: 120000 });
const url = 'http://127.0.0.1:2667',
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(100);
  }
  throw new Error('Deployment condition timed out');
}
async function connect(token, name) {
  const room = await new Client(url.replace(/^http/, 'ws')).joinOrCreate(JOIN_ROOM, { token, name });
  const state = { room, ack: null, profile: {} };
  room.onMessage('*', () => {});
  room.onMessage(MSG.ACK, (data) => {
    state.ack = decodeAck(data).sim;
  });
  room.onMessage(MSG.PROFILE, (p) => Object.assign(state.profile, p));
  await until(() => state.ack && Array.isArray(state.profile.inv));
  return state;
}
let current;
try {
  assert.equal((await fetch(`${url}/readyz`)).status, 200);
  const cors = await fetch(`${url}/api/auth/config`, { headers: { origin: 'http://127.0.0.1:5240' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5240');
  const response = await fetch(`${url}/api/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 200);
  const guest = await response.json();
  assert(/^[a-f0-9-]{36}$/i.test(guest.accountId));
  current = await connect(guest.token, 'Render proof');
  const start = { ...current.ack };
  for (let seq = 1; seq <= 30; seq++) {
    current.room.send(MSG.INPUT, {
      cmds: [
        { seq, dx: 1, dy: 0, dash: false, attack: false, hold: false, skill: false, aimX: 1, aimY: 0, viewTick: 0 },
      ],
    });
    await sleep(TICK_MS);
  }
  await sleep(250);
  const saved = { ...current.ack };
  assert(Math.hypot(saved.x - start.x, saved.y - start.y) > 1);
  current.room.send(MSG.DEV, { cmd: 'tp', x: 5000, y: 5000 });
  await sleep(250);
  assert(
    Math.hypot(current.ack.x - saved.x, current.ack.y - saved.y) < 0.2,
    'production must reject development commands',
  );
  const coins = current.profile.coins;
  // Recreate both containers with the same volume/secret, as after a host restart or redeploy.
  console.log('Recreating containers with a connected player; last position', { x: saved.x, y: saved.y });
  // Keep Node's event loop running so the SDK processes old socket close events during restart.
  await dcAsync('down');
  current = null;
  await dcAsync('up', '-d', '--no-build', '--wait', '--wait-timeout', '90');
  current = await connect(guest.token);
  console.log('Restored position', { x: current.ack.x, y: current.ack.y });
  assert(Math.hypot(current.ack.x - saved.x, current.ack.y - saved.y) < 0.1);
  assert.equal(current.profile.coins, coins);
  assert.equal(current.room.state.players.get(current.room.sessionId).name, 'Render proof');
  await current.room.leave();
  current = null;
  // An actual custom-format dump must restore into a separate verification database.
  const dump = execFileSync(
    'docker',
    [...args, 'exec', '-T', 'postgres', 'pg_dump', '-U', 'eigen', '-Fc', 'eigenlands'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  dc('exec', '-T', 'postgres', 'dropdb', '--if-exists', '-U', 'eigen', 'restore_check');
  dc('exec', '-T', 'postgres', 'createdb', '-U', 'eigen', 'restore_check');
  execFileSync(
    'docker',
    [
      ...args,
      'exec',
      '-T',
      'postgres',
      'pg_restore',
      '-U',
      'eigen',
      '--exit-on-error',
      '--no-owner',
      '-d',
      'restore_check',
    ],
    { input: dump, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const query = `SELECT json_build_object('name',name,'x',x,'y',y,'slots',jsonb_array_length(data->'inv')) FROM characters WHERE account_id='${guest.accountId}'`;
  const restored = JSON.parse(
    dc('exec', '-T', 'postgres', 'psql', '-U', 'eigen', '-d', 'restore_check', '-tA', '-c', query),
  );
  assert.equal(restored.name, 'Render proof');
  assert(Math.hypot(restored.x - saved.x, restored.y - saved.y) < 0.1);
  assert(restored.slots > 0);
  console.log(
    'PASS production Docker boot, HTTP/WebSockets, origin handling, DEV rejection, real movement/save, full container recreation, stable session/name/position/inventory, and actual pg_dump/pg_restore.',
  );
} finally {
  if (current) await current.room.leave();
}
