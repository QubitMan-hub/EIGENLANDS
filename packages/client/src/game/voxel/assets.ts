import { AnimationMixer, Box3, Mesh, Vector3, Group, type Object3D, type AnimationAction } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const ANIMALS: Record<string, string> = {
  cow: 'cow',
  sheep: 'sheep',
  pig: 'pig',
  horse: 'horse',
  chicken: 'hen',
  hen: 'hen',
  duck: 'duck',
  dog: 'sheepdog',
};
const PROPS: Record<string, string> = {
  barn: 'barn',
  farm_barn: 'barn',
  coop: 'barn',
  well: 'well',
  hay: 'hay-bale',
  hay_bale: 'hay-bale',
  beehive: 'beehive',
  apiary: 'beehive',
  water_trough: 'water-trough',
  trough: 'water-trough',
  wheelbarrow: 'wheelbarrow',
  windmill: 'windmill',
  apple_tree: 'apple-tree',
};
export interface AssetInstance {
  root: Group;
  mixer: AnimationMixer;
  actions: AnimationAction[];
  animate(dt: number, moving: boolean): void;
}

/** CC0 solid GLB models supplied by the user. Embedded textures decorate actual 3D surfaces. */
export class VoxelAssets {
  private loader = new GLTFLoader();
  private loaded = new Map<string, GLTF>();
  private pending = new Map<string, Promise<void>>();
  private failures = new Set<string>();
  animalName(id: string): string | undefined {
    return ANIMALS[id];
  }
  propName(id: string): string | undefined {
    return PROPS[id];
  }
  get(name: string, width: number): AssetInstance | null {
    const gltf = this.loaded.get(name);
    if (!gltf) {
      if (!this.pending.has(name) && !this.failures.has(name)) {
        const task = this.loader
          .loadAsync(`${import.meta.env.BASE_URL}art/voxel/cozy-farm/${name}.glb`)
          .then((g) => {
            this.loaded.set(name, g);
          })
          .catch(() => {
            this.failures.add(name);
          });
        this.pending.set(name, task);
      }
      return null;
    }
    const content = clone(gltf.scene),
      root = new Group();
    root.add(content);
    const box = new Box3().setFromObject(content),
      size = box.getSize(new Vector3()),
      centre = box.getCenter(new Vector3());
    const scale = width / Math.max(size.x, size.z);
    content.position.set(-centre.x, -box.min.y, -centre.z);
    root.scale.setScalar(scale);
    content.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.voxelShared = true;
      }
    });
    const mixer = new AnimationMixer(content),
      actions = gltf.animations.map((clip) => mixer.clipAction(clip));
    for (const action of actions) action.play();
    return {
      root,
      mixer,
      actions,
      animate(dt, moving) {
        mixer.timeScale = moving ? 1 : 0;
        mixer.update(dt);
      },
    };
  }
  diagnostics() {
    return { loaded: [...this.loaded.keys()], failed: [...this.failures] };
  }
  dispose(): void {
    for (const gltf of this.loaded.values())
      gltf.scene.traverse((o: Object3D) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const value of Object.values(m))
              if (value && typeof value === 'object' && 'isTexture' in value)
                (value as unknown as { dispose(): void }).dispose();
            m.dispose();
          }
        }
      });
    this.loaded.clear();
  }
}
