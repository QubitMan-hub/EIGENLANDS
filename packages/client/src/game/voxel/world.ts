import {
  WebGLRenderer,
  Scene,
  Color,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  Group,
  MeshStandardMaterial,
  Vector3,
  PCFSoftShadowMap,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  InstancedMesh,
  BoxGeometry,
  Matrix4,
  PointLight,
  FogExp2,
  Raycaster,
  Vector2,
  type BufferGeometry,
} from 'three';
import {
  T,
  G,
  TILE_DEFS,
  PALETTE,
  LEVEL_PX,
  biomeAt,
  townsFor,
  frontierTownsNear,
  ENEMY_KEY_BY_KIND,
  NODES,
  bridgeRailsIn,
  otherworldOf,
  caveBiomeAt,
  isCaveY,
  type ChunkStore,
  type Building,
  type Weather,
} from '@eigenlands/shared';
import { voxelCamera, voxelHeight, foregroundOccludes } from './camera';
import { modelGeometry, solidBox as B, placeBoxes, type VoxelBox } from './mesh';
import {
  treeModel,
  rockModel,
  plantModel,
  wallModel,
  roofModel,
  objectModel,
  furnitureModel,
  P,
  variation,
} from './models';
import { creatureBoxes, animalBoxes } from './creatures';
import { personRig, type PersonRig } from './people';
import { arrivalPlan, arrivalGround } from '../arrival-plan';
import { constructionRoom } from '../constructionviews';
import { sceneryAt } from '../scenery';
import type { Anim } from '../../art/foes';
import { VoxelAssets, type AssetInstance } from './assets';
import { buildingStyle } from './architecture';
import { constructionRoof, constructionPreview } from './construction';
import { dressFurniture } from './furnishings';

export interface VoxelActor {
  id: string;
  x: number;
  y: number;
  faceX: number;
  faceY: number;
  type: string;
  kind?: number;
  species?: string;
  look?: number;
  app?: number;
  weapon?: string;
  shield?: string;
  parts?: string;
  walking?: boolean;
  attack?: boolean;
  guard?: boolean;
  dead?: boolean;
  mount?: number;
  cart?: boolean;
  boat?: boolean;
  telegraph?: boolean;
  range?: number;
  z?: number;
  small?: boolean;
  action?: string;
  phase?: number;
}
export interface VoxelProp {
  id: string;
  x: number;
  y: number;
  kind: string;
}
interface ActorMesh {
  root: Group;
  rig?: PersonRig;
  mesh?: Mesh;
  signature: string;
  phase: number;
  x: number;
  y: number;
  asset?: AssetInstance;
  vehicle?: Mesh;
  warning?: Mesh;
}
interface StaticChunk {
  root: Group;
  cx: number;
  cy: number;
}
interface Roof {
  b: Building;
  mesh: Mesh;
  opacity: number;
  material: MeshStandardMaterial;
}
type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: number;
  size: number;
};
const SIDE = 16;
const GROUND = [
  0x244956, 0x437783, 0xc3b383, 0x78915a, 0xab9d7a, 0x74543c, 0x503e31, 0x9a815d, 0x7c8179, 0x686e69, 0x606761,
  0x263f48, 0xb15e32, 0x7b8480,
];
const BIOME_GRASS: Record<string, number> = {
  forest: 0x718650,
  plains: 0x839963,
  taiga: 0x637c64,
  swamp: 0x647755,
  autumn: 0x9c8953,
  enchanted: 0x6e8a79,
  corrupted: 0x69717b,
  desert: 0xb5a475,
  tundra: 0x9da997,
  alpine: 0x899780,
};

/** True 3D presentation of the authoritative tile world. No simulation or persistence lives in this class. */
export class VoxelWorld {
  readonly canvas = document.createElement('canvas');
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  private camera = voxelCamera(1, 1, 1, { x: 0, y: 0, lift: 0 });
  private material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0.02 });
  private foreground = this.material.clone();
  private warningMaterial = new MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    emissive: 0xc46b42,
    emissiveIntensity: 0.7,
    depthWrite: false,
  });
  private playerUniform = { value: new Vector3() };
  private chunks = new Map<string, StaticChunk>();
  private dirty = new Set<string>();
  private objects = new Map<string, { signature: string; mesh: Group; asset?: AssetInstance; lid?: Group }>();
  private chestTimes = new Map<string, number>();
  private assets = new VoxelAssets();
  private roofs = new Map<string, Roof>();
  private actors = new Map<string, ActorMesh>();
  private seenActors = new Set<string>();
  private models = new Map<string, BufferGeometry>();
  private sun = new DirectionalLight(0xffe2b2, 3);
  private sky = new HemisphereLight(0xc8dcdf, 0x52583f, 2.1);
  private lights: PointLight[] = [];
  private particles: Particle[] = [];
  private particleGeometry = new BoxGeometry(1, 1, 1);
  private particleMaterial = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xdca45d, emissiveIntensity: 0.45 });
  private particleMesh = new InstancedMesh(this.particleGeometry, this.particleMaterial, 1024);
  private matrix = new Matrix4();
  private color = new Color();
  private raycaster = new Raycaster();
  private size = { w: 0, h: 0, dpr: 0 };
  private last = 0;
  private rendered = { x: NaN, y: NaN, frames: 0 };
  private season = -1;
  private buildRevision = -1;
  private lastWorldKey = '';
  private roofKey = '';
  private buildingList: Building[] = [];
  private lost = false;
  private restored = () => {
    this.lost = false;
  };
  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
  };
  private missing = new Set<string>();
  private buildGroups = new Map<string, Group>();
  private scenic = new Map<string, { root: Mesh; signature: string }>();
  private previewGroup = new Group();
  private previewKey = '';
  private roomSize = 0;
  private solved = new Set<string>();
  private arrival = new Group();

  constructor(
    private store: ChunkStore,
    overlay: HTMLCanvasElement,
  ) {
    this.canvas.id = 'voxel-world';
    this.canvas.setAttribute('aria-label', 'EIGENLANDS orthographic voxel world');
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    overlay.before(this.canvas);
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color(0x829789);
    this.scene.fog = new FogExp2(0x829789, 0.0015);
    this.scene.add(this.sky, this.sun, this.sun.target, this.arrival);
    this.scene.add(this.previewGroup);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 100 });
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.particleMesh);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.count = 0;
    for (let i = 0; i < 8; i++) {
      const light = new PointLight(0xffbe75, 0, 7, 2);
      this.lights.push(light);
      this.scene.add(light);
    }
    this.foreground.onBeforeCompile = (shader) => {
      shader.uniforms.uPlayer = this.playerUniform;
      shader.vertexShader =
        'varying vec3 vVoxelWorld;\n' +
        shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvVoxelWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader =
        'varying vec3 vVoxelWorld; uniform vec3 uPlayer;\n' +
        shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
        vec3 d = vVoxelWorld - uPlayer;
        float s = .5 * (d.x + d.z) - 1.22474487 * (d.y - .65);
        if (d.x + d.z > .2 && d.y > .35 && abs(d.x-d.z) < 1.05 && abs(s) < 1.1) {
          if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 4.0) < 3.0) discard;
        }`,
        );
    };
    this.canvas.addEventListener('webglcontextlost', this.onLost);
    this.canvas.addEventListener('webglcontextrestored', this.restored);
  }

  private mesh(boxes: readonly VoxelBox[], material = this.material): Mesh {
    const m = new Mesh(modelGeometry(boxes), material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  private remove(root: Group | Mesh): void {
    root.removeFromParent();
    root.traverse((o) => {
      if (o instanceof Mesh && !(o instanceof InstancedMesh) && !o.userData.voxelShared) o.geometry.dispose();
    });
  }
  invalidate(x: number, y: number): void {
    this.dirty.add(`${Math.floor(x / SIDE)},${Math.floor(y / SIDE)}`);
  }
  invalidateChunk(cx: number, cy: number): void {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) this.dirty.add(`${cx * 2 + x},${cy * 2 + y}`);
  }
  beginActors(): void {
    this.seenActors.clear();
  }
  private dropActor(a: ActorMesh): void {
    a.rig?.dispose();
    a.vehicle?.geometry.dispose();
    a.warning?.geometry.dispose();
    a.root.traverse((o) => {
      if (o instanceof Mesh && o.userData.actorOwned) o.geometry.dispose();
    });
    a.root.removeFromParent();
  }
  openChest(x: number, y: number): void {
    this.chestTimes.set(`${x},${y}`, performance.now());
  }
  setSolved(ids: string[]): void {
    this.solved = new Set(ids);
  }
  preview(pieces: Array<{ id: string; x: number; y: number; turn: number; ok: boolean }>): void {
    const key = JSON.stringify(pieces);
    if (key === this.previewKey) return;
    this.previewKey = key;
    for (const child of [...this.previewGroup.children]) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        (child.material as MeshStandardMaterial).dispose();
      }
      this.previewGroup.remove(child);
    }
    for (const p of pieces) {
      const material = this.material.clone();
      material.transparent = true;
      material.opacity = 0.45;
      material.depthWrite = false;
      material.color.setHex(p.ok ? 0xa8d6ad : 0xd58a70);
      const mesh = this.mesh(constructionPreview(p.id, p.turn), material);
      mesh.castShadow = false;
      mesh.position.set(p.x + 0.5, voxelHeight(this.store.levelAt(p.x, p.y) * LEVEL_PX), p.y + 0.5);
      this.previewGroup.add(mesh);
    }
  }
  setProps(props: VoxelProp[]): void {
    const keep = new Set(props.map((p) => p.id));
    for (const p of props) {
      const signature = `${p.kind}:${p.x},${p.y}`;
      const old = this.scenic.get(p.id);
      if (old?.signature === signature) continue;
      if (old) this.remove(old.root);
      const model = objectModel({ x: 0, y: 0, kind: 'deco', sub: p.kind }, 0);
      const root = this.mesh(model.boxes, this.foreground);
      root.position.set(p.x, voxelHeight(this.groundLift(p.x, p.y)), p.y);
      this.scenic.set(p.id, { root, signature });
      this.scene.add(root);
    }
    for (const [id, p] of this.scenic)
      if (!keep.has(id)) {
        this.remove(p.root);
        this.scenic.delete(id);
      }
  }
  pickEnemy(x: number, y: number): string | null {
    this.raycaster.setFromCamera(new Vector2((x / this.size.w) * 2 - 1, 1 - (y / this.size.h) * 2), this.camera);
    const roots = [...this.actors.values()].filter((a) => a.root.userData.type === 'enemy').map((a) => a.root);
    for (const hit of this.raycaster.intersectObjects(roots, true)) {
      let root = hit.object;
      while (root.parent && !root.userData.actorId) root = root.parent;
      if (root.userData.actorId) return root.userData.actorId;
    }
    return null;
  }

  pickMineable(x: number, y: number, tool: string): { tx: number; ty: number } | null {
    this.raycaster.setFromCamera(new Vector2((x / this.size.w) * 2 - 1, 1 - (y / this.size.h) * 2), this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.chunks.values()].map((c) => c.root),
      true,
    );
    for (const hit of hits) {
      if (!(hit.object instanceof Mesh) || !hit.face) continue;
      const tiles = hit.object.geometry.getAttribute('voxelTile');
      if (!tiles) continue;
      const tx = tiles.getX(hit.face.a),
        ty = tiles.getY(hit.face.a);
      if (Number.isFinite(tx) && NODES[this.store.getTile(tx, ty)]?.tool === tool) return { tx, ty };
    }
    return null;
  }

  actor(a: VoxelActor, now: number, reduced: boolean): void {
    if (!Number.isFinite(a.x + a.y)) return;
    this.seenActors.add(a.id);
    const creature =
      a.type === 'proj'
        ? 'projectile'
        : a.species || (a.type === 'enemy' || a.type === 'shadow' ? ENEMY_KEY_BY_KIND[a.kind ?? 0] : undefined);
    const sig = creature
      ? `creature:${creature}`
      : `person:${a.app}:${a.look}:${a.weapon}:${a.shield}:${a.mount}:${a.cart}:${a.boat}:${a.action}:${a.parts}`;
    let v = this.actors.get(a.id);
    if (v && v.signature !== sig) {
      this.dropActor(v);
      this.actors.delete(a.id);
      v = undefined;
    }
    if (!v) {
      const rig = creature
        ? undefined
        : personRig(a.app ?? 0, a.look ?? 0, a.weapon ?? '', a.shield ?? '', this.material, a.parts, a.id);
      const root = new Group();
      if (rig) root.add(rig.root);
      root.userData.actorId = a.id;
      root.userData.type = a.type;
      v = { root, rig, signature: sig, phase: 0, x: a.x, y: a.y };
      this.actors.set(a.id, v);
      this.scene.add(root);
      if (rig && (a.mount || a.boat || a.cart)) {
        let boxes: VoxelBox[] = [];
        if (a.boat) {
          for (let i = 0; i < 4; i++) boxes.push(B(0, 0.08 + i * 0.12, 0, 0.6 + i * 0.15, 0.13, 1.6 + i * 0.1, P.wood));
          boxes.push(B(0, 1, -0.3, 0.07, 1.9, 0.07, P.timber), B(0, 1.4, -0.25, 0.04, 0.8, 0.9, P.pale));
        } else if (a.mount) boxes = animalBoxes('horse', this.season);
        else {
          boxes = furnitureModel('crate').boxes;
          for (const x of [-0.55, 0.55]) for (const z of [-0.4, 0.4]) boxes.push(B(x, 0.22, z, 0.1, 0.5, 0.5, P.iron));
        }
        v.vehicle = this.mesh(boxes);
        root.add(v.vehicle);
        rig.root.position.y = a.mount ? 0.65 : a.boat ? 0.25 : 0;
      }
      if (rig && a.action && a.action !== 'none') {
        const box = furnitureModel(
          a.action === 'lantern' ? 'lantern' : a.action === 'bucket' ? 'bucket' : 'crate',
        ).boxes;
        const prop = this.mesh(box);
        prop.userData.actorOwned = true;
        prop.scale.setScalar(0.45);
        prop.position.set(0, -0.4, 0.08);
        rig.arms[1].add(prop);
      }
    }
    const distance = Math.hypot(a.x - v.x, a.y - v.y);
    v.phase += distance * 7;
    v.x = a.x;
    v.y = a.y;
    const walk = !!a.walking || distance > 0.002;
    const time = now / 1000,
      phase = v.phase;
    const height = voxelHeight((a.z ?? 0) + this.groundLift(a.x, a.y));
    v.root.position.set(a.x, height + (walk && !reduced ? Math.abs(Math.sin(phase)) * 0.025 : 0), a.y);
    const angle = Math.atan2(a.faceX, a.faceY);
    if (Math.abs(a.faceX) + Math.abs(a.faceY) > 0.01) {
      const delta = Math.atan2(Math.sin(angle - v.root.rotation.y), Math.cos(angle - v.root.rotation.y));
      v.root.rotation.y += delta * (reduced ? 1 : 0.4);
    }
    v.root.scale.setScalar(a.small ? 0.68 : 1);
    v.root.rotation.z = a.dead ? Math.PI / 2 : 0;
    if (a.telegraph && !v.warning) {
      const boxes: VoxelBox[] = [],
        r = a.range ?? 1.7;
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2;
        boxes.push(B(Math.sin(angle) * r, 0.03, Math.cos(angle) * r, 0.09, 0.04, 0.09, 0xed9f67));
      }
      v.warning = this.mesh(boxes, this.warningMaterial);
      v.warning.castShadow = false;
      v.root.add(v.warning);
    }
    if (v.warning) v.warning.visible = !!a.telegraph;
    if (v.rig) {
      v.rig.arms.forEach((g, i) => {
        g.rotation.x = reduced
          ? 0
          : a.attack
            ? -1.4 + Math.sin(time * 19) * 0.8
            : a.guard
              ? -1.2
              : walk
                ? Math.sin(phase + (i ? Math.PI : 0)) * 0.55
                : Math.sin(time * 2) * 0.025;
      });
      v.rig.legs.forEach((g, i) => {
        g.rotation.x = walk && !reduced ? Math.sin(phase + (i ? 0 : Math.PI)) * 0.65 : 0;
      });
      v.rig.forearms.forEach((g, i) => {
        g.rotation.x = reduced
          ? 0
          : a.guard
            ? -1.25
            : a.attack
              ? -0.65
              : a.action && a.action !== 'none'
                ? -0.9
                : -0.13 + (walk ? Math.sin(phase + (i ? Math.PI : 0)) * 0.12 : 0);
      });
      v.rig.knees.forEach((g, i) => {
        g.rotation.x = walk && !reduced ? Math.max(0, -Math.sin(phase + (i ? 0 : Math.PI))) * 0.75 : 0;
      });
      v.rig.head.rotation.y = reduced ? 0 : Math.sin(time * 0.65 + a.x) * 0.035;
      v.rig.head.rotation.x = reduced ? 0 : a.action === 'craft' ? 0.15 : Math.sin(time * 1.6) * 0.015;
    } else if (creature) {
      const assetName = this.assets.animalName(creature);
      if (assetName && !v.asset) {
        const width = ['cow', 'horse'].includes(creature) ? 1.55 : ['sheep', 'pig'].includes(creature) ? 1.05 : 0.65;
        const asset = this.assets.get(assetName, width);
        if (asset) {
          v.asset = asset;
          v.root.add(asset.root);
          if (v.mesh) v.mesh.visible = false;
        }
      }
      if (v.asset) {
        v.asset.animate(reduced ? 0 : Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016), walk);
        return;
      }
      const anim: Anim = a.dead ? 'death' : a.telegraph ? 'windup' : a.attack ? 'attack' : walk ? 'move' : 'idle';
      // Cache the authored poses across all instances. Root movement and facing remain continuous.
      const frame = reduced ? 0 : Math.floor((anim === 'move' ? phase : time * 2) * 2) % 6;
      const key = `${creature}:${anim}:${frame}:${this.season}`;
      let geometry = this.models.get(key);
      if (!geometry) {
        let boxes =
          creature === 'projectile'
            ? [B(0, 0.45, 0, 0.08, 0.08, 0.32, P.glow)]
            : creatureBoxes(creature, anim, frame / 6);
        if (!boxes.length) boxes = animalBoxes(creature, this.season, walk ? 2 + (frame % 2) : 0);
        if (!boxes.length) {
          boxes = rockModel(0);
          this.missing.add(`creature:${creature}`);
        }
        geometry = modelGeometry(boxes);
        this.models.set(key, geometry);
      }
      if (!v.mesh) {
        v.mesh = new Mesh(geometry, this.material);
        v.mesh.castShadow = true;
        v.mesh.receiveShadow = true;
        v.root.add(v.mesh);
      } else v.mesh.geometry = geometry;
      v.mesh.rotation.y = Math.PI / 2;
    }
  }

  private groundLift(x: number, y: number): number {
    // Same blended feet height as Game's predictor and iso.ts.
    const here = this.store.levelAt(Math.floor(x), Math.floor(y));
    const px = x - 0.5,
      py = y - 0.5,
      x0 = Math.floor(px),
      y0 = Math.floor(py),
      fx = px - x0,
      fy = py - y0;
    const at = (dx: number, dy: number) => Math.min(here + 1, Math.max(here - 1, this.store.levelAt(x0 + dx, y0 + dy)));
    return (
      ((at(0, 0) + (at(1, 0) - at(0, 0)) * fx) * (1 - fy) + (at(0, 1) + (at(1, 1) - at(0, 1)) * fx) * fy) * LEVEL_PX
    );
  }

  private buildChunk(cx: number, cy: number): StaticChunk {
    const root = new Group(),
      ground: VoxelBox[] = [],
      scenery: VoxelBox[] = [],
      walls: VoxelBox[] = [];
    const x0 = cx * SIDE,
      y0 = cy * SIDE;
    const buildings = [
      ...townsFor(this.store.seed),
      ...frontierTownsNear(this.store.seed, x0, y0, x0 + SIDE, y0 + SIDE, this.store.generation),
    ]
      .flatMap((t) => t.buildings)
      .filter((b) => b.x <= x0 + SIDE && b.x + b.w >= x0 && b.y <= y0 + SIDE && b.y + b.h >= y0);
    root.position.set(x0, 0, y0);
    for (let j = 0; j < SIDE; j++)
      for (let i = 0; i < SIDE; i++) {
        const x = x0 + i,
          y = y0 + j,
          tile = this.store.getTile(x, y),
          def = TILE_DEFS[tile];
        if (!def || tile === T.UPPER_VOID) continue;
        const biome = biomeAt(this.store.seed, x, y, this.store.generation);
        const level = this.store.levelAt(x, y),
          h = voxelHeight(level * LEVEL_PX);
        let color = GROUND[def.ground] ?? P.stone;
        const realm = otherworldOf(y);
        if (realm) color = realm === 'aetheria' ? 0xb5bba6 : realm === 'umbra' ? 0x59536b : 0xa69978;
        if (isCaveY(y)) {
          const cave = caveBiomeAt(this.store.seed, x, y, this.store.generation);
          color =
            (
              {
                limestone: 0x8a8d7b,
                glowmoss: 0x586f64,
                crystal: 0x697d89,
                basalt: 0x565354,
                frost: 0x91a7a8,
                drowned: 0x557780,
              } as Record<string, number>
            )[cave] ?? color;
        }
        if (def.ground === G.GRASS) color = this.season === 3 ? 0xaab5a2 : (BIOME_GRASS[biome] ?? GROUND[G.GRASS]);
        const k = 0.94 + variation(x * 71 + y * 23) * 0.12;
        this.color.setHex(color).multiplyScalar(k);
        color = this.color.getHex();
        const water = def.ground === G.WATER || def.ground === G.DEEP || def.ground === G.LAVA;
        ground.push(B(i + 0.5, h - 0.09 - (water ? 0.08 : 0), j + 0.5, 1, 0.18, 1, color, 4));
        // Only exposed cliff faces, never six hidden faces for every tile.
        for (const [dx, dy, face] of [
          [1, 0, 1],
          [-1, 0, 2],
          [0, 1, 16],
          [0, -1, 32],
        ]) {
          const near = voxelHeight(this.store.levelAt(x + dx, y + dy) * LEVEL_PX);
          if (near < h) ground.push(B(i + 0.5, (h + near) / 2 - 0.09, j + 0.5, 1, h - near + 0.18, 1, 0x727b67, face));
        }
        if (this.store.structureAt(x, y)) continue;
        const seed = x * 37 + y * 109 + this.store.seed;
        let boxes: VoxelBox[] = [];
        if (def.obj === 'tree') boxes = treeModel(seed, biome, this.season);
        else if (def.obj === 'rock' || def.obj?.includes('ore_') || def.obj?.startsWith('cave_'))
          boxes = rockModel(seed, def.obj);
        else if (def.obj === 'stump')
          boxes = [B(0, 0.16, 0, 0.35, 0.32, 0.35, P.bark), B(0, 0.33, 0, 0.32, 0.03, 0.32, P.cutwood)];
        else if (def.obj === 'fence') boxes = furnitureModel('fence').boxes;
        else if (def.obj === 'torch') boxes = furnitureModel('torch').boxes;
        else if (def.obj === 'crystal' || def.obj === 'stalagmite') boxes = rockModel(seed, def.obj);
        else if (def.obj) boxes = plantModel(def.obj, seed, def.obj === 'bloom' ? P.glow : 0xd6a0b1);
        else {
          const wild = sceneryAt(this.store, x, y);
          if (wild) boxes = plantModel(wild, seed);
        }
        if (boxes.length)
          scenery.push(
            ...placeBoxes(boxes, i + 0.5, h, j + 0.5).map((b) => ({ ...b, tile: [x, y] as [number, number] })),
          );
        if (tile === T.WALL || tile === T.FACE || tile === T.DOOR) {
          const axis =
            this.store.getTile(x + 1, y) === T.WALL || this.store.getTile(x - 1, y) === T.WALL || tile === T.FACE
              ? 0
              : 1;
          const building = buildings.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
          const style = building ? buildingStyle(building) : undefined;
          walls.push(
            ...placeBoxes(
              wallModel(style?.stone ?? false, (x + y) % 3 === 0, tile === T.DOOR, axis, style),
              i + 0.5,
              h,
              j + 0.5,
            ),
          );
        } else if (def.ground === G.CAVE_WALL) {
          walls.push(...placeBoxes(rockModel(seed), i + 0.5, h, j + 0.5, 2));
          walls.push(B(i + 0.5, h + 0.6, j + 0.5, 1, 1.2, 1, 0x666d69));
        }
        if (def.ground === G.FLOOR) {
          for (let plank = 0; plank < 4; plank++)
            ground.push(
              B(
                i + (plank + 0.5) / 4,
                h + 0.018,
                j + 0.5,
                0.24,
                0.035,
                0.99,
                [0x9f8057, 0x97764e, 0xa8875d, 0x92724e][(x + y + plank + 40000) % 4],
              ),
            );
        }
      }
    const sides = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const r of bridgeRailsIn((x, y) => this.store.getTile(x, y), x0, y0, SIDE, SIDE)) {
      const [dx, dy] = sides[r.side],
        x = r.x - x0 + 0.5 + dx * 0.45,
        z = r.y - y0 + 0.5 + dy * 0.45;
      const h = voxelHeight(this.store.levelAt(r.x, r.y) * LEVEL_PX);
      for (const offset of [-0.4, 0.4])
        scenery.push(B(x + (dy ? offset : 0), h + 0.4, z + (dx ? offset : 0), 0.08, 0.8, 0.08, P.timber));
      scenery.push(B(x, h + 0.65, z, dy ? 1 : 0.08, 0.08, dx ? 1 : 0.08, P.wood));
      if (r.end) scenery.push(B(x, h + 1.05, z, 0.16, 0.22, 0.16, P.flame));
    }
    if (ground.length) {
      const m = this.mesh(ground);
      m.castShadow = false;
      root.add(m);
    }
    if (scenery.length) root.add(this.mesh(scenery, this.foreground));
    if (walls.length) root.add(this.mesh(walls, this.foreground));
    this.scene.add(root);
    return { root, cx, cy };
  }

  private syncObjects(x0: number, y0: number, x1: number, y1: number): void {
    const keep = new Set<string>();
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const o = this.store.objectAt(x, y);
        if (!o) continue;
        if (this.solved.has(String(o.data?.shrine ?? ''))) continue;
        const id = `${o.x},${o.y}`;
        keep.add(id);
        const signature = JSON.stringify(o);
        const old = this.objects.get(id);
        if (old?.signature === signature) {
          if (old.lid) {
            const age = (this.last - (this.chestTimes.get(id) ?? -Infinity)) / 1000;
            const angle =
              age < 0.3
                ? -Math.min(1, age / 0.3) * 1.25
                : age < 1.8
                  ? -1.25
                  : age < 2.1
                    ? -1.25 * (1 - (age - 1.8) / 0.3)
                    : 0;
            old.lid.rotation.x = angle;
          }
          const name = this.assets.propName(o.sub);
          if (name && !old.asset) {
            const asset = this.assets.get(name, /barn|windmill/.test(name) ? 1.9 : 0.9);
            if (asset) {
              old.asset = asset;
              old.mesh.children[0].visible = false;
              old.mesh.add(asset.root);
            }
          }
          old.asset?.animate(0.016, true);
          continue;
        }
        if (old) this.remove(old.mesh);
        const { boxes, authored } = objectModel(o, o.x * 11 + o.y * 23);
        if (!authored) this.missing.add(`object:${o.sub}`);
        const home = this.buildingList.find((b) => o.x >= b.x && o.x < b.x + b.w && o.y >= b.y && o.y < b.y + b.h);
        const dressed = [...boxes, ...dressFurniture(boxes, o.sub, this.store.seed + o.x * 37 + o.y * 113, home?.kind)];
        const mesh = new Group();
        let lid: Group | undefined;
        if (o.kind === 'chest' || /cache|treasure/.test(o.sub)) {
          const max = Math.max(...boxes.map((b) => b.y + b.h / 2)),
            hinge = max * 0.68;
          const upper = boxes.filter((b) => b.y >= hinge),
            lower = boxes.filter((b) => b.y < hinge);
          mesh.add(this.mesh(lower, this.foreground));
          lid = new Group();
          lid.position.set(0, hinge, -0.25);
          lid.add(
            this.mesh(
              upper.map((b) => ({ ...b, y: b.y - hinge, z: b.z + 0.25 })),
              this.foreground,
            ),
          );
          mesh.add(lid);
        } else mesh.add(this.mesh(dressed, this.foreground));
        mesh.position.set(o.x + 0.5, voxelHeight(this.store.levelAt(o.x, o.y) * LEVEL_PX), o.y + 0.5);
        if (o.data?.facing === 'se') mesh.rotation.y = Math.PI / 2;
        this.objects.set(id, { signature, mesh, lid });
        this.scene.add(mesh);
      }
    for (const [id, v] of this.objects)
      if (!keep.has(id)) {
        this.remove(v.mesh);
        this.objects.delete(id);
        this.chestTimes.delete(id);
      }
  }

  private syncRoofs(x0: number, y0: number, x1: number, y1: number, px: number, py: number, dt: number): void {
    const roofKey = `${Math.floor(x0 / 16)},${Math.floor(y0 / 16)},${Math.floor(x1 / 16)},${Math.floor(y1 / 16)}`;
    if (roofKey !== this.roofKey) {
      this.roofKey = roofKey;
      this.buildingList = [
        ...townsFor(this.store.seed),
        ...frontierTownsNear(this.store.seed, x0 - 16, y0 - 16, x1 + 16, y1 + 16, this.store.generation),
      ].flatMap((t) => t.buildings);
    }
    const keep = new Set<string>();
    for (const b of this.buildingList) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      keep.add(b.id);
      let roof = this.roofs.get(b.id);
      if (!roof) {
        const material = this.material.clone();
        material.transparent = true;
        const mesh = this.mesh(roofModel(b), material);
        mesh.position.set(b.x, voxelHeight(this.store.levelAt(b.x, b.y) * LEVEL_PX), b.y);
        this.scene.add(mesh);
        roof = { b, mesh, material, opacity: 1 };
        this.roofs.set(b.id, roof);
      }
      const inside =
        (px > b.x && px < b.x + b.w - 1 && py > b.y && py < b.y + b.h - 1) ||
        (Math.floor(px) === b.doorX && Math.floor(py) === b.doorY);
      const behind =
        foregroundOccludes(b.x + b.w / 2, b.y + b.h / 2, 4, px, py) ||
        (px >= b.x - 3 && py >= b.y - 3 && px < b.x + b.w && py < b.y + b.h && (px < b.x + 1 || py < b.y + 1));
      const target = inside ? 0 : behind ? 0.15 : 1;
      roof.opacity += (target - roof.opacity) * Math.min(1, dt * 10);
      roof.material.opacity = roof.opacity;
      roof.mesh.visible = roof.opacity > 0.02;
      roof.mesh.castShadow = target > 0.5;
      roof.material.depthWrite = roof.opacity > 0.5;
    }
    for (const [id, r] of this.roofs)
      if (!keep.has(id)) {
        this.remove(r.mesh);
        r.material.dispose();
        this.roofs.delete(id);
      }
  }

  private syncConstruction(px: number, py: number, x0: number, y0: number, x1: number, y1: number): void {
    const key = `${this.store.structureRevision}:${Math.floor(px)},${Math.floor(py)}:${x0},${y0},${x1},${y1}`;
    if (this.lastWorldKey === key) return;
    this.lastWorldKey = key;
    const room = constructionRoom(this.store, Math.floor(px), Math.floor(py));
    this.roomSize = room.size;
    for (const g of this.buildGroups.values()) this.remove(g);
    this.buildGroups.clear();
    for (const [id, c] of this.store.structures) {
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      const group = new Group(),
        d = c.data,
        boxes: VoxelBox[] = [];
      if (d.floor) boxes.push(B(0, 0.025, 0, 1, 0.05, 1, d.floor.includes('stone') ? P.stone : P.wood));
      if (d.wall) {
        const door = d.wall.includes('door');
        boxes.push(...wallModel(d.wall.includes('stone'), d.wall.includes('window'), door, (d.wallTurn ?? 0) % 2));
        if (door && !d.open)
          boxes.push(
            ...placeBoxes([B(0, 0.86, 0, 0.7, 1.7, 0.1, P.wood)], 0, 0, 0, 1, (d.wallTurn ?? 0) % 2 ? Math.PI / 2 : 0),
          );
      }
      if (d.stairs) boxes.push(...furnitureModel('stairs').boxes);
      if (d.roof && !room.has(id)) {
        boxes.push(...constructionRoof(this.store, c));
      }
      group.add(this.mesh(boxes, this.foreground));
      group.position.set(c.x + 0.5, voxelHeight(this.store.levelAt(c.x, c.y) * LEVEL_PX), c.y + 0.5);
      this.scene.add(group);
      this.buildGroups.set(id, group);
    }
  }

  private buildArrival(): void {
    this.arrival.clear();
    const boxes: VoxelBox[] = [];
    for (const p of arrivalPlan(this.store.seed).props) {
      if (!arrivalGround(this.store, p.x, p.y)) continue;
      const model =
        p.kind === 'stone'
          ? [B(0, 0.025, 0, 0.7, 0.05, 0.7, 0xa5aa8d)]
          : p.kind === 'flower'
            ? plantModel('flowers', p.variant, 0xd59a9c)
            : furnitureModel(p.kind === 'board' ? 'board' : 'blanket').boxes;
      boxes.push(...placeBoxes(model, p.x + 0.5, voxelHeight(this.store.levelAt(p.x, p.y) * LEVEL_PX), p.y + 0.5));
    }
    // The arrival shrine is traversable ground in the simulation: keep its centre open.
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8,
        x = 0.5 + Math.cos(angle) * 2.45,
        z = 0.5 + Math.sin(angle) * 2.45;
      boxes.push(B(Math.round(x * 4) / 4, 0.035, Math.round(z * 4) / 4, 0.32, 0.07, 0.32, P.stone));
    }
    this.arrival.add(this.mesh(boxes));
  }

  effect(x: number, y: number, color: number, count = 8, kind = 'burst', radius = 1): void {
    const h = voxelHeight(this.groundLift(x, y));
    for (let i = 0; i < Math.min(count, 64) && this.particles.length < 1024; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2,
        ring = kind === 'ring' || kind === 'arc';
      this.particles.push({
        x: x + (ring ? Math.cos(a) * radius : 0),
        y: h + (ring ? 0.15 : 0.5),
        z: y + (ring ? Math.sin(a) * radius : 0),
        vx: Math.cos(a) * (ring ? 0.3 : 1.2),
        vy: ring ? 0.15 : 1 + variation(i * 19 + this.last) * 1.5,
        vz: Math.sin(a) * (ring ? 0.3 : 1.2),
        life: 0.55,
        max: 0.55,
        color,
        size: ring ? 0.055 : 0.07,
      });
    }
  }

  render(f: {
    now: number;
    x: number;
    y: number;
    scale: number;
    season: number;
    hour: number;
    underground: boolean;
    reduced: boolean;
    tier: string;
    weather: Weather;
    weatherDetail: string;
    bounds: { x0: number; y0: number; x1: number; y1: number };
  }): void {
    if (this.lost) return;
    const dt = Math.min(0.1, this.last ? (f.now - this.last) / 1000 : 0.1);
    this.last = f.now;
    const w = window.innerWidth,
      h = window.innerHeight,
      dpr = f.tier === 'performance' ? 0.65 : Math.min(devicePixelRatio || 1, f.tier === 'high' ? 2 : 1);
    if (w !== this.size.w || h !== this.size.h || dpr !== this.size.dpr) {
      this.size = { w, h, dpr };
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
    }
    this.renderer.shadowMap.enabled = f.tier !== 'performance';
    this.camera = voxelCamera(w, h, f.scale, { x: f.x, y: f.y, lift: this.groundLift(f.x, f.y) });
    this.playerUniform.value.set(f.x, voxelHeight(this.groundLift(f.x, f.y)), f.y);
    if (this.season !== f.season) {
      this.season = f.season;
      for (const key of this.chunks.keys()) this.dirty.add(key);
      this.remove(this.arrival);
      this.arrival = new Group();
      this.scene.add(this.arrival);
      this.buildArrival();
    }
    const { x0, y0, x1, y1 } = f.bounds;
    const keep = new Set<string>(),
      want: Array<[number, number]> = [];
    for (let cy = Math.floor(y0 / SIDE); cy <= Math.floor(y1 / SIDE); cy++)
      for (let cx = Math.floor(x0 / SIDE); cx <= Math.floor(x1 / SIDE); cx++) {
        if (!this.store.has(Math.floor(cx / 2), Math.floor(cy / 2))) continue;
        const key = `${cx},${cy}`;
        keep.add(key);
        if (!this.chunks.has(key) || this.dirty.has(key)) want.push([cx, cy]);
      }
    want.sort(
      (a, b) => Math.hypot(a[0] * SIDE - f.x, a[1] * SIDE - f.y) - Math.hypot(b[0] * SIDE - f.x, b[1] * SIDE - f.y),
    );
    const budget = this.chunks.size ? 2 : want.length;
    for (const [cx, cy] of want.slice(0, budget)) {
      const key = `${cx},${cy}`,
        old = this.chunks.get(key);
      if (old) this.remove(old.root);
      this.chunks.set(key, this.buildChunk(cx, cy));
      this.dirty.delete(key);
    }
    for (const [key, c] of this.chunks)
      if (!keep.has(key)) {
        this.remove(c.root);
        this.chunks.delete(key);
      }
    // Object synchronization is bounded by loaded simulation data; signatures detect every persisted edit.
    this.syncRoofs(x0, y0, x1, y1, f.x, f.y, dt);
    this.syncObjects(x0, y0, x1, y1);
    this.syncConstruction(f.x, f.y, x0, y0, x1, y1);
    this.arrival.visible = Math.abs(f.x) < 55 && Math.abs(f.y) < 55;
    for (const [id, a] of this.actors)
      if (!this.seenActors.has(id)) {
        this.dropActor(a);
        this.actors.delete(id);
      }
    // Bound shared animated geometry as well as live scene objects during long world tours.
    if (this.models.size > 192) {
      const live = new Set([...this.actors.values()].map((a) => a.mesh?.geometry));
      for (const [key, g] of this.models)
        if (!live.has(g)) {
          g.dispose();
          this.models.delete(key);
          if (this.models.size <= 128) break;
        }
    }
    const daylight = f.underground ? 0.12 : Math.max(0.18, Math.sin(((f.hour - 6) / 12) * Math.PI));
    this.sky.intensity = f.underground ? 0.8 : 1.1 + daylight * 1.2;
    this.sun.intensity = f.underground ? 0.35 : daylight * 3;
    const height = voxelHeight(this.groundLift(f.x, f.y));
    this.sun.position.set(f.x - 14, height + 25, f.y - 10);
    this.sun.target.position.set(f.x, height, f.y);
    const background = f.underground ? 0x293d41 : 0x829789;
    (this.scene.background as Color).setHex(background);
    (this.scene.fog as FogExp2).color.setHex(background);
    const lit = [...this.objects.keys()]
      .map((id) => this.store.objects.get(id)!)
      .filter(
        (o) =>
          o &&
          /lamp|torch|hearth|fire|forge|lantern/.test(o.sub) &&
          Math.abs(o.x - f.x) < 15 &&
          Math.abs(o.y - f.y) < 15,
      )
      .sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y));
    this.lights.forEach((l, i) => {
      const o = lit[i];
      l.intensity = o ? (f.underground ? 10 : 7) * (0.95 + 0.05 * Math.sin(f.now / 130 + i)) : 0;
      if (o) l.position.set(o.x + 0.5, voxelHeight(this.groundLift(o.x, o.y)) + 1.2, o.y + 0.5);
    });
    if (!f.reduced && f.weatherDetail !== 'off' && f.weather !== 'clear' && this.particles.length < 500) {
      for (let i = 0; i < (f.weatherDetail === 'full' ? 8 : 3); i++)
        this.particles.push({
          x: f.x + (Math.random() - 0.5) * 24,
          y: height + 7,
          z: f.y + (Math.random() - 0.5) * 24,
          vx: -0.3,
          vy: f.weather === 'snow' ? -1 : -7,
          vz: 0.3,
          life: 2,
          max: 2,
          color: f.weather === 'snow' ? 0xe5e8da : 0x9cbdbf,
          size: 0.035,
        });
    }
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= dt;
      return p.life > 0;
    });
    this.particles.forEach((p, i) => {
      this.matrix.makeScale(p.size, p.size, p.size);
      this.matrix.setPosition(p.x, p.y, p.z);
      this.particleMesh.setMatrixAt(i, this.matrix);
      this.color.setHex(p.color);
      this.particleMesh.setColorAt(i, this.color);
    });
    this.particleMesh.count = this.particles.length;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.rendered = { x: f.x, y: f.y, frames: this.rendered.frames + 1 };
  }

  diagnostics() {
    return {
      renderer: 'three-voxel',
      orthographic: this.camera.isOrthographicCamera,
      elevation: 30,
      azimuth: 45,
      focus: this.rendered,
      cutaways: [...this.roofs.values()].filter((r) => r.opacity < 0.05).map((r) => r.b.id),
      construction: { cells: this.buildGroups.size, room: this.roomSize },
      chunks: this.chunks.size,
      actors: this.actors.size,
      objects: this.objects.size,
      roofs: this.roofs.size,
      geometries: this.renderer.info.memory.geometries,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      missingModels: [...this.missing].sort(),
      assets: this.assets.diagnostics(),
      contextLost: this.lost,
    };
  }
  dispose(): void {
    for (const a of this.actors.values()) this.dropActor(a);
    this.preview([]);
    for (const c of this.chunks.values()) this.remove(c.root);
    for (const o of this.objects.values()) this.remove(o.mesh);
    for (const r of this.roofs.values()) {
      this.remove(r.mesh);
      r.material.dispose();
    }
    for (const g of this.buildGroups.values()) this.remove(g);
    this.remove(this.arrival);
    for (const g of this.models.values()) g.dispose();
    for (const p of this.scenic.values()) this.remove(p.root);
    this.material.dispose();
    this.foreground.dispose();
    this.warningMaterial.dispose();
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.assets.dispose();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.restored);
  }
}
