import {
  BufferImageSource, Container, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, UniformGroup, type Renderer,
} from 'pixi.js';
import { CHUNK_SIZE, TILE_DEFS, TILE_SIZE, chunkKey, sampleClimate, type ChunkStore } from '@eigenlands/shared';
import { TERRAIN_FRAG, TERRAIN_VERT } from '../gl/terrain.frag';

const DATA = CHUNK_SIZE + 2;
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE;

interface ChunkMesh {
  cx: number;
  cy: number;
  mesh: Mesh<MeshGeometry, Shader>;
  src: BufferImageSource;
  data: Uint8Array;
  group: UniformGroup;
}

/**
 * Tilemap terrain: per-chunk tile-class textures drawn by the blending shader into a low-resolution
 * render target (one texel = one art pixel) which is then shown with integer nearest-neighbour scaling.
 */
export class Terrain {
  readonly sprite: Sprite;
  private rt: RenderTexture;
  private scene = new Container();
  private meshes = new Map<string, ChunkMesh>();
  private dirty = new Set<string>();
  private geometry: MeshGeometry;
  private common: UniformGroup;
  private w = 16;
  private h = 16;
  originX = 0;
  originY = 0;

  constructor(private renderer: Renderer, private store: ChunkStore) {
    this.rt = RenderTexture.create({ width: 16, height: 16, scaleMode: 'nearest' });
    this.sprite = new Sprite(this.rt);
    this.geometry = new MeshGeometry({
      positions: new Float32Array([0, 0, CHUNK_PX, 0, CHUNK_PX, CHUNK_PX, 0, CHUNK_PX]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this.common = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uSeason: { value: 1, type: 'f32' },
      uMotion: { value: 1, type: 'f32' },
    });
  }

  get count(): number { return this.meshes.size; }
  has(cx: number, cy: number): boolean { return this.meshes.has(chunkKey(cx, cy)); }

  /** Size of the visible region in art pixels. */
  resize(wPx: number, hPx: number): void {
    wPx = Math.ceil(wPx); hPx = Math.ceil(hPx);
    if (wPx === this.w && hPx === this.h) return;
    this.w = wPx; this.h = hPx;
    this.rt.resize(wPx, hPx);
    this.rt.source.scaleMode = 'nearest';
  }

  private fill(cm: ChunkMesh): void {
    const ox = cm.cx * CHUNK_SIZE - 1, oy = cm.cy * CHUNK_SIZE - 1;
    const seed = this.store.seed;
    for (let y = 0; y < DATA; y++) {
      for (let x = 0; x < DATA; x++) {
        const tx = ox + x, ty = oy + y;
        const id = this.store.getTile(tx, ty);
        const o = (y * DATA + x) * 4;
        cm.data[o] = TILE_DEFS[id]?.ground ?? 3;
        const flux = sampleClimate(seed, tx, ty).flux;
        cm.data[o + 1] = flux > 0.4 ? Math.min(255, Math.round(((flux - 0.4) / 0.4) * 255)) : 0; // iridescent meadow intensity
        cm.data[o + 2] = (tx * 31 + ty * 17) & 255;
        cm.data[o + 3] = 255;
      }
    }
    cm.src.update();
  }

  /** (Re)build a chunk's tile-class texture. Safe to call again after edits. */
  build(cx: number, cy: number): void {
    const k = chunkKey(cx, cy);
    let cm: ChunkMesh | undefined = this.meshes.get(k);
    if (!cm) {
      const data = new Uint8Array(DATA * DATA * 4);
      const src = new BufferImageSource({ resource: data, width: DATA, height: DATA, format: 'rgba8unorm', scaleMode: 'nearest' });
      const group = new UniformGroup({ uChunk: { value: new Float32Array([cx * CHUNK_PX, cy * CHUNK_PX]), type: 'vec2<f32>' } });
      const shader = Shader.from({
        gl: { vertex: TERRAIN_VERT, fragment: TERRAIN_FRAG },
        resources: { uTiles: src, chunkUniforms: group, commonUniforms: this.common },
      });
      const mesh = new Mesh({ geometry: this.geometry, shader });
      this.scene.addChild(mesh);
      cm = { cx, cy, mesh, src, data, group };
      this.meshes.set(k, cm);
    }
    this.fill(cm as ChunkMesh);
    this.dirty.delete(k);
  }

  /** Mark a chunk (and neighbours when the edit touched a border) for rebuild. */
  invalidate(cx: number, cy: number, lx = 16, ly = 16): void {
    const mark = (x: number, y: number) => { if (this.has(x, y)) this.dirty.add(chunkKey(x, y)); };
    mark(cx, cy);
    const dx = lx <= 0 ? -1 : lx >= CHUNK_SIZE - 1 ? 1 : 0;
    const dy = ly <= 0 ? -1 : ly >= CHUNK_SIZE - 1 ? 1 : 0;
    if (dx) mark(cx + dx, cy);
    if (dy) mark(cx, cy + dy);
    if (dx && dy) mark(cx + dx, cy + dy);
  }

  retain(keep: Set<string>): void {
    for (const [k, cm] of this.meshes) {
      if (keep.has(k)) continue;
      this.scene.removeChild(cm.mesh);
      cm.mesh.destroy();
      cm.src.destroy();
      this.meshes.delete(k);
    }
  }

  /** Draw the terrain for the view whose top-left corner is (originX, originY) in world pixels (integers). */
  render(originX: number, originY: number, time: number, season: number, motion: boolean): void {
    for (const k of [...this.dirty].slice(0, 2)) {
      const cm = this.meshes.get(k);
      if (cm) this.fill(cm);
      this.dirty.delete(k);
    }
    this.originX = originX; this.originY = originY;
    this.common.uniforms.uTime = time;
    this.common.uniforms.uSeason = season;
    this.common.uniforms.uMotion = motion ? 1 : 0;
    for (const cm of this.meshes.values()) {
      cm.mesh.position.set(cm.cx * CHUNK_PX - originX, cm.cy * CHUNK_PX - originY);
      cm.mesh.visible = cm.mesh.x < this.w && cm.mesh.y < this.h && cm.mesh.x + CHUNK_PX > 0 && cm.mesh.y + CHUNK_PX > 0;
    }
    this.renderer.render({ container: this.scene, target: this.rt, clear: true });
  }
}
