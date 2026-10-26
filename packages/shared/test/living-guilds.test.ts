import { expect, it } from 'vitest';
import {
  rotatingGuildContracts,
  guildContract,
  validGuildJourney,
  inspectHome,
  readCharter,
  ChunkStore,
  T,
  newPlayerSim,
  stepPlayer,
  encodeAck,
  decodeAck,
} from '../src';
it('builds deterministic daily jobs with canonical IDs and safe persisted journeys', () => {
  const jobs = rotatingGuildContracts(11, 7, 'B');
  expect(jobs).toEqual(rotatingGuildContracts(11, 7, 'B'));
  expect(new Set(jobs.map((j) => j.id)).size).toBe(4);
  expect(guildContract(11, 'guild:job:7:4:B')).toBeUndefined();
  expect(guildContract(11, 'guild:job:007:0:B')).toBeUndefined();
  expect(guildContract(11, 'guild:job:7:0:god')).toBeUndefined();
  const d = {
    kind: 'escort',
    home: { x: 0, y: 1 },
    points: [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ],
    stage: 0,
    x: 0,
    y: 1,
    hp: 900,
    released: true,
    failed: false,
  };
  expect(validGuildJourney(d)?.hp).toBe(100);
  expect(validGuildJourney({ ...d, x: NaN })).toBeUndefined();
  expect(validGuildJourney({ ...d, points: [] })).toBeUndefined();
  expect(validGuildJourney({ ...d, stage: 4 })).toBeUndefined();
  expect(readCharter({ tier: 100, bank: Infinity, residents: [{ x: NaN }] }, 7)).toMatchObject({
    tier: 3,
    bank: 0,
    residents: [],
  });
});
it('requires owned complete roofs, walls, an entrance and furnishings for homes', () => {
  const s = new ChunkStore(1, 80, 6),
    owner = 'a';
  for (let y = 200; y <= 204; y++)
    for (let x = 200; x <= 204; x++) {
      s.setTile(x, y, T.GRASS);
      s.putObject({
        x,
        y,
        kind: 'structure',
        sub: 'cell',
        owner,
        data:
          x === 200 || x === 204 || y === 200 || y === 204
            ? { wall: x === 202 && y === 204 ? 'timber_door' : 'timber_wall' }
            : { floor: 'timber_floor', roof: 'thatch_roof' },
      });
    }
  for (const [x, y, sub] of [
    [201, 201, 'bed'],
    [202, 201, 'table'],
    [203, 201, 'oil_lamp'],
  ] as const)
    s.putObject({ x, y, sub, kind: 'furniture', owner });
  expect(inspectHome(s, owner, 201, 201).valid).toBe(true);
  expect(inspectHome(s, 'b', 201, 201).valid).toBe(false);
  s.structureAt(202, 202)!.data!.roof = undefined;
  expect(inspectHome(s, owner, 201, 201).valid).toBe(false);
  s.structureAt(202, 202)!.data!.roof = 'thatch_roof';
  s.removeStructure(204, 202);
  expect(inspectHome(s, owner, 201, 201).valid).toBe(false);
});
it('predicts mount speed through packed ACKs and dismounts before attacks', () => {
  const p = newPlayerSim(0, 0),
    q = newPlayerSim(0, 0);
  p.mount = 1;
  const cmd = {
    seq: 1,
    dx: 1,
    dy: 0,
    dash: false,
    attack: false,
    hold: false,
    skill: false,
    aimX: 1,
    aimY: 0,
    viewTick: 0,
  };
  stepPlayer(p, cmd, () => false);
  stepPlayer(q, cmd, () => false);
  expect(p.x / q.x).toBeCloseTo(1.45);
  expect(decodeAck(encodeAck({ seq: 1, tick: 1, sim: p })).sim.mount).toBe(1);
  stepPlayer(p, { ...cmd, attack: true }, () => false);
  expect(p.mount).toBe(0);
});
