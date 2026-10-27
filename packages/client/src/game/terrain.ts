import { caveBiomeAt } from '@eigenlands/shared';
import { TERRAIN_PAD, terrainWindow } from './terrain-window';
import {
  BufferImageSource,
  Container,
  Mesh,
  MeshGeometry,
  RenderTexture,
  Shader,
  Sprite,
  UniformGroup,
  type Renderer,
} from 'pixi.js';
import {
  BIOMES,
  CHUNK_SIZE,
  G,
  T,
  TILE_DEFS,
  biomeAt,
  chunkKey,
  isCaveY,
  isCryptY,
  sampleClimate,
  LEVEL_PX,
  townFor,
  townAt,
  type ChunkStore,
} from '@eigenlands/shared';
import { TERRAIN_FRAG, TERRAIN_VERT } from '../gl/terrain.frag';

const WIN_CHUNKS = 5; // window = 5x5 chunks around the player (160x160 tiles)
const WIN = WIN_CHUNKS * CHUNK_SIZE;

/**
 * Isometric tilemap terrain. Per-chunk tile-class data is cached on the CPU and assembled into one window texture
 * around the player; a single full-screen pass (low-res render target, nearest-neighbour upscaled) inverse-projects
 * every screen pixel into the world and blends ground classes with organic, noise-warped borders.
 */
export class Terrain {
  readonly sprite: Sprite;
  private rt: RenderTexture;
  private scene = new Container();
  private mesh: Mesh<MeshGeometry, Shader>;
  private geometry: MeshGeometry;
  private shaders = new Map<number, Shader>();
  private chunks = new Map<string, Uint8Array>();
  private data = new Uint8Array(WIN * WIN * 4);
  private src: BufferImageSource;
  private common: UniformGroup;
  private winCx = 1e9;
  private winCy = 1e9;
  private winDirty = true;
  private dirtyChunks = new Set<string>();
  private painted: { x: number; y: number; season: number; motion: boolean; detail: number; tick: number } | null =
    null;
  private w = 16;
  private h = 16;
  private plaza: { x: number; y: number; r: number; x0: number; y0: number; x1: number; y1: number };

  constructor(
    private renderer: Renderer,
    private store: ChunkStore,
  ) {
    this.rt = RenderTexture.create({ width: 16, height: 16, scaleMode: 'nearest' });
    // Pixi must invalidate the submitted sprite quad when this render target resizes.
    this.rt.dynamic = true;
    this.sprite = new Sprite(this.rt);
    this.geometry = new MeshGeometry({
      positions: new Float32Array([0, 0, 16, 0, 16, 16, 0, 16]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this.src = new BufferImageSource({
      resource: this.data,
      width: WIN,
      height: WIN,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      alphaMode: 'no-premultiply-alpha',
    });
    this.common = new UniformGroup({
      uDetail: { value: 1, type: 'f32' },
      uTime: { value: 0, type: 'f32' },
      uSeason: { value: 1, type: 'f32' },
      uMotion: { value: 1, type: 'f32' },
      uWin: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
      uWinSize: { value: WIN, type: 'f32' },
      uIso: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
      uRes: { value: new Float32Array([16, 16]), type: 'vec2<f32>' },
      uPlaza: { value: new Float32Array([0, 0, 0, 0]), type: 'vec4<f32>' },
      uShrine: { value: new Float32Array([0.5, 0.5, 3.05, 0]), type: 'vec4<f32>' },
      uWind: { value: new Float32Array([1, 0, 0.3]), type: 'vec3<f32>' },
      uTopZ: { value: 0, type: 'f32' },
    });
    const town = townFor(store.seed);
    this.plaza = { x: town.cx + 0.5, y: town.cy + 4.5, r: 5.9, x0: town.x0, y0: town.y0, x1: town.x1, y1: town.y1 };
    this.common.uniforms.uPlaza = new Float32Array([this.plaza.x, this.plaza.y, this.plaza.r, 0]);
    const shader = this.shaderFor(1);
    this.mesh = new Mesh({ geometry: this.geometry, shader });
    this.scene.addChild(this.mesh);
  }

  private shaderFor(detail: number): Shader {
    const mode = detail < 0.5 ? 0 : 1;
    let shader = this.shaders.get(mode);
    if (!shader) {
      // Compile-time branches remove expensive high-detail loops on limited GPUs.
      // Both variants use the same tile buffer, projection, materials and render target.
      shader = Shader.from({
        gl: {
          vertex: TERRAIN_VERT,
          fragment: TERRAIN_FRAG.replace('uniform float uDetail;', `const float uDetail = ${mode}.0;`),
        },
        resources: { uTiles: this.src, commonUniforms: this.common },
      });
      this.shaders.set(mode, shader);
    }
    return shader;
  }

  private pad = TERRAIN_PAD;
  private view: [number, number] = [0, 0];
  /** Overscan in art pixels: wider means fewer shader paints while the camera travels, at a larger texture. */
  setPad(pad: number): void {
    if (pad === this.pad) return;
    this.pad = pad;
    if (this.view[0] > 0) this.resize(this.view[0], this.view[1]);
  }

  get originX(): number {
    return this.painted?.x ?? 0;
  }
  get originY(): number {
    return this.painted?.y ?? 0;
  }
  get count(): number {
    return this.chunks.size;
  }
  has(cx: number, cy: number): boolean {
    return this.chunks.has(chunkKey(cx, cy));
  }

  /** Visible region in art pixels (1 texel = 1 art pixel). */
  resize(wPx: number, hPx: number): void {
    this.view = [wPx, hPx];
    wPx = Math.ceil(wPx) + this.pad * 2;
    hPx = Math.ceil(hPx) + this.pad * 2;
    if (wPx === this.w && hPx === this.h) return;
    this.w = wPx;
    this.h = hPx;
    this.rt.resize(wPx, hPx);
    this.painted = null;
    this.rt.source.scaleMode = 'nearest';
    this.geometry.positions = new Float32Array([0, 0, wPx, 0, wPx, hPx, 0, hPx]);
    this.common.uniforms.uRes = new Float32Array([wPx, hPx]);
  }

  /** Paving style of a PATH tile: 0 worn dirt, 1 cobbled road, 2 ring-laid plaza, 3 the spawn shrine. */
  private paving(tx: number, ty: number): number {
    if (Math.hypot(tx, ty) <= 3) return 3;
    const town = townAt(this.store.seed, tx, ty);
    if (town && town.name !== 'Hadamere') return 1;
    const p = this.plaza;
    if (tx < p.x0 || tx > p.x1 || ty < p.y0 || ty > p.y1) return 0;
    if (Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) < p.r + 0.6) return 2;
    let n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (this.store.getTile(tx + i, ty + j) === T.PATH) n++;
    return n >= 5 ? 1 : 0; // two-wide streets are cobbled; single-file door paths stay trodden earth
  }

  private compute(cx: number, cy: number): Uint8Array {
    const out = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * 4);
    const levels = this.store.get(cx, cy).levels;
    const seed = this.store.seed;
    // crypt interiors are hewn from the same rock as the Undercroft
    const cave = isCaveY(cy * CHUNK_SIZE) || isCryptY(cy * CHUNK_SIZE);
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const o = (y * CHUNK_SIZE + x) * 4;
        const tx = cx * CHUNK_SIZE + x,
          ty = cy * CHUNK_SIZE + y;
        const tile = this.store.getTile(tx, ty);
        const biome = cave
          ? (
              {
                limestone: 'desert',
                glowmoss: 'forest',
                crystal: 'enchanted',
                basalt: 'corrupted',
                frost: 'taiga',
                drowned: 'swamp',
              } as const
            )[caveBiomeAt(seed, tx, ty)]
          : biomeAt(seed, tx, ty);
        let ground = TILE_DEFS[tile]?.ground ?? 3;
        if (biome === 'desert' && ground === G.GRASS) ground = G.SAND; // scrub and cacti stand on the dunes
        if (cave && ground === G.GRASS) ground = G.CAVE; // ore, crystals and glowcaps rest on the cave floor
        out[o] = ground;
        const flux = sampleClimate(seed, tx, ty).flux;
        const fl = flux > 0.4 ? Math.min(31, Math.round(((flux - 0.4) / 0.4) * 31)) : 0; // iridescent meadow intensity
        out[o + 1] = BIOMES.indexOf(biome) * 32 + fl;
        // paving style in the low two bits, elevation level above them
        out[o + 2] = (tile === T.PATH ? this.paving(tx, ty) : 0) | ((levels?.[y * CHUNK_SIZE + x] ?? 0) << 2);
        out[o + 3] = 128;
      }
    }
    return out;
  }

  /** Signed distance (tiles) from each tile centre to the shoreline: + inside water, - on land. Stored in alpha. */
  private shoreField(): void {
    const N = WIN,
      d = this.data;
    const wet = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) wet[i] = d[i * 4]! <= 1 ? 1 : 0;
    const field = (src: number) => {
      const f = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) f[i] = wet[i] === src ? 0 : 99;
      const D = Math.SQRT2;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const i = y * N + x;
          let v = f[i]!;
          if (x > 0) v = Math.min(v, f[i - 1]! + 1);
          if (y > 0) {
            v = Math.min(v, f[i - N]! + 1);
            if (x > 0) v = Math.min(v, f[i - N - 1]! + D);
            if (x < N - 1) v = Math.min(v, f[i - N + 1]! + D);
          }
          f[i] = v;
        }
      for (let y = N - 1; y >= 0; y--)
        for (let x = N - 1; x >= 0; x--) {
          const i = y * N + x;
          let v = f[i]!;
          if (x < N - 1) v = Math.min(v, f[i + 1]! + 1);
          if (y < N - 1) {
            v = Math.min(v, f[i + N]! + 1);
            if (x < N - 1) v = Math.min(v, f[i + N + 1]! + D);
            if (x > 0) v = Math.min(v, f[i + N - 1]! + D);
          }
          f[i] = v;
        }
      return f;
    };
    const toLand = field(0),
      toWater = field(1);
    for (let i = 0; i < N * N; i++) {
      const sd = wet[i] ? toLand[i]! - 0.5 : -(toWater[i]! - 0.5);
      d[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(128 + sd * 12)));
    }
  }

  /** Cache a chunk's tile classes (cheap to call repeatedly; use invalidate() after edits). */
  build(cx: number, cy: number): void {
    const k = chunkKey(cx, cy);
    if (!this.chunks.has(k) || this.dirtyChunks.has(k)) {
      this.chunks.set(k, this.compute(cx, cy));
      this.dirtyChunks.delete(k);
      this.winDirty = true;
    }
  }

  /** A tile changed (or the chunk's diff arrived): recompute that chunk. */
  invalidate(cx: number, cy: number, _lx = 16, _ly = 16): void {
    const k = chunkKey(cx, cy);
    if (!this.chunks.has(k)) return;
    this.dirtyChunks.add(k);
    this.winDirty = true;
  }

  retain(keep: Set<string>): void {
    for (const k of [...this.chunks.keys()])
      if (!keep.has(k)) {
        this.chunks.delete(k);
        this.dirtyChunks.delete(k);
      }
  }

  private assemble(cx: number, cy: number): void {
    const half = (WIN_CHUNKS - 1) / 2;
    this.data.fill(0);
    for (let j = 0; j < WIN_CHUNKS; j++) {
      for (let i = 0; i < WIN_CHUNKS; i++) {
        const ccx = cx - half + i,
          ccy = cy - half + j;
        const k = chunkKey(ccx, ccy);
        let c = this.chunks.get(k);
        if (!c || this.dirtyChunks.has(k)) {
          c = this.compute(ccx, ccy);
          this.chunks.set(k, c);
          this.dirtyChunks.delete(k);
        }
        for (let y = 0; y < CHUNK_SIZE; y++) {
          const dst = ((j * CHUNK_SIZE + y) * WIN + i * CHUNK_SIZE) * 4;
          this.data.set(c.subarray(y * CHUNK_SIZE * 4, (y + 1) * CHUNK_SIZE * 4), dst);
        }
      }
    }
    this.shoreField();
    let top = 0;
    for (let i = 2; i < this.data.length; i += 4) top = Math.max(top, this.data[i]! >> 2);
    this.common.uniforms.uTopZ = top * LEVEL_PX;
    this.common.uniforms.uWin = new Float32Array([(cx - half) * CHUNK_SIZE, (cy - half) * CHUNK_SIZE]);
    this.src.update();
    this.winCx = cx;
    this.winCy = cy;
    this.winDirty = false;
  }

  /** Draw the terrain for the view whose top-left iso art-pixel is (isoX, isoY); (pcx,pcy) = the player's chunk. */
  render(
    isoX: number,
    isoY: number,
    pcx: number,
    pcy: number,
    time: number,
    season: number,
    motion: boolean,
    wind?: { dx: number; dy: number; strength: number },
    detail = 1,
  ): void {
    const window = terrainWindow(isoX, isoY, time, motion, detail, this.pad);
    isoX = window.x;
    isoY = window.y;
    const changed = this.winDirty || pcx !== this.winCx || pcy !== this.winCy;
    if (changed) this.assemble(pcx, pcy);
    if (
      !changed &&
      this.painted &&
      this.painted.motion === motion &&
      this.painted.x === isoX &&
      this.painted.y === isoY &&
      this.painted.season === season &&
      this.painted.detail === detail &&
      this.painted.tick === window.tick
    )
      return;
    this.mesh.shader = this.shaderFor(detail);
    this.common.uniforms.uDetail = detail;
    this.common.uniforms.uTime = motion ? time : 0;
    this.common.uniforms.uSeason = season;
    this.common.uniforms.uMotion = motion ? 1 : 0;
    if (wind) this.common.uniforms.uWind = new Float32Array([wind.dx, wind.dy, wind.strength]);
    this.common.uniforms.uIso = new Float32Array([isoX, isoY]);
    this.renderer.render({ container: this.scene, target: this.rt, clear: true });
    this.painted = { x: isoX, y: isoY, season, motion, detail, tick: window.tick };
  }
}
