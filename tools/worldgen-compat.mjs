// node --import tsx tools/worldgen-compat.mjs <other-checkout>/packages/shared/src/
// Proves revisions 1 and 2 are unchanged: compares tiles, biomes, whole chunks, authored objects, landmark sites and the
// Hadamere site of this checkout against another one (for example the commit before revision 3) for two seeds.
// Needs the other checkout's node_modules reachable (symlink it) and TSX_TSCONFIG_PATH=packages/server/tsconfig.json.
import { pathToFileURL } from 'node:url';
const ref = process.argv[2];
if (!ref) throw new Error('usage: worldgen-compat.mjs <reference packages/shared/src/>');
const dir = ref.endsWith('/') ? ref : `${ref}/`;
const load = async (base) => {
  const mods = await Promise.all(
    ['worldgen', 'chunks', 'town', 'ruins', 'caves', 'shrines'].map((m) => import(base + m)),
  );
  return Object.assign({}, ...mods);
};
const NEW = await load(new URL('../packages/shared/src/', import.meta.url).href);
const OLD = await load(pathToFileURL(dir).href);
let bad = 0,
  compared = 0;
const diff = (what, ...where) => {
  if (bad++ < 8) console.log('DIFF', what, ...where);
};
for (const seed of [20260101, 1337])
  for (const gen of [1, 2]) {
    for (let y = -400; y < 400; y += 3)
      for (let x = -400; x < 400; x += 3) {
        compared++;
        if (NEW.tileAt(seed, x, y, gen) !== OLD.tileAt(seed, x, y, gen)) diff('tile', seed, gen, x, y);
        if (NEW.biomeAt(seed, x, y, gen) !== OLD.biomeAt(seed, x, y)) diff('biome', seed, gen, x, y);
      }
    for (let gy = -6; gy <= 6; gy++)
      for (let gx = -6; gx <= 6; gx++) {
        if (JSON.stringify(NEW.ruinOfCell(seed, gx, gy)) !== JSON.stringify(OLD.ruinOfCell(seed, gx, gy)))
          diff('ruin', gx, gy);
        if (JSON.stringify(NEW.caveOfCell(seed, gx, gy)) !== JSON.stringify(OLD.caveOfCell(seed, gx, gy)))
          diff('cave', gx, gy);
      }
    if (JSON.stringify(NEW.shrinesNear(seed, 0, 0, 500)) !== JSON.stringify(OLD.shrinesNear(seed, 0, 0, 500)))
      diff('shrines');
    const a = NEW.townFor(seed),
      b = OLD.townFor(seed);
    if (a.cx !== b.cx || a.cy !== b.cy) diff('town');
    const cs = new NEW.ChunkStore(seed, 64, gen),
      co = new OLD.ChunkStore(seed, 64, gen);
    for (let cy = -6; cy <= 6; cy++)
      for (let cx = -6; cx <= 6; cx++) {
        if (JSON.stringify(cs.townObjectsIn(cx, cy)) !== JSON.stringify(co.townObjectsIn(cx, cy)))
          diff('objects', cx, cy);
        if (Buffer.compare(Buffer.from(cs.get(cx, cy).tiles), Buffer.from(co.get(cx, cy).tiles)) !== 0)
          diff('chunk', cx, cy);
      }
  }
console.log(`compared ${compared} tiles (+ chunks, objects, sites); differences: ${bad}`);
process.exitCode = bad ? 1 : 0;
