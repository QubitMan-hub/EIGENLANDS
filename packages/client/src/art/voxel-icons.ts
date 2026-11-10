import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  Mesh,
  MeshStandardMaterial,
  DirectionalLight,
  HemisphereLight,
  Box3,
  Vector3,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  type Object3D,
  Group,
} from 'three';
import { voxelItemBoxes } from '../game/voxel/items';
import { modelGeometry } from '../game/voxel/mesh';
import { packAppearance, type Appearance } from '@eigenlands/shared';
import { treeModel, furnitureModel, P } from '../game/voxel/models';
import { solidBox as B, type VoxelBox } from '../game/voxel/mesh';
import { personRig } from '../game/voxel/people';

let renderer: WebGLRenderer | null = null;
const scene = new Scene(),
  material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const sky = new HemisphereLight(0xe0e6dc, 0x66634f, 2),
  sun = new DirectionalLight(0xffe7bd, 2.5);
sun.position.set(-3, 6, 4);
scene.add(sky, sun);

/** UI thumbnails are rendered from solid voxel geometry; the inventory itself needs no extra live 3D scenes. */
function renderThumbnail(object: Object3D, size: number, panel = false, panelHeight?: number): HTMLCanvasElement {
  if (!renderer) {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0, 0);
    renderer.setPixelRatio(1);
  }
  const height = panel ? (panelHeight ?? Math.round((size * 2) / 3)) : size;
  renderer.setSize(size, height, false);
  scene.add(object);
  const bounds = new Box3().setFromObject(object),
    centre = bounds.getCenter(new Vector3()),
    extent = bounds.getSize(new Vector3());
  // Fit the projected box at our fixed 45°/30° view, rather than leaving half the frame empty.
  const radius =
    Math.max(
      0.05,
      (extent.x + extent.z) / (2 * Math.SQRT2),
      (extent.x + extent.z) / (4 * Math.SQRT2) + (extent.y * Math.sqrt(3)) / 4,
    ) * 1.12;
  const camera = panel
    ? new OrthographicCamera(-3.12, 3.12, (3.12 * height) / size, (-3.12 * height) / size, 0.1, 100)
    : new OrthographicCamera(-radius, radius, radius, -radius, 0.1, 100);
  camera.position.copy(centre).add(new Vector3(6.123724, 5, 6.123724));
  if (panel) {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  } else camera.lookAt(centre);
  renderer.render(scene, camera);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  object.removeFromParent();
  return canvas;
}

export function voxelIconCanvas(id: string, size: number): HTMLCanvasElement {
  const geometry = modelGeometry(voxelItemBoxes(id));
  try {
    return renderThumbnail(new Mesh(geometry, material), size);
  } finally {
    geometry.dispose();
  }
}

/** Dialogue and inventory share the same solid anatomy and equipment as world actors. */
export function voxelPortraitUrl(
  app: number,
  look: number,
  weapon = '',
  shield = '',
  parts?: string,
  npcId?: string,
): string {
  const rig = personRig(app, look, weapon, shield, material, parts, npcId);
  try {
    return renderThumbnail(rig.root, 160).toDataURL();
  } finally {
    rig.dispose();
  }
}

/** One shared renderer produces all static UI art from real geometry, with no live HUD render loop. */
export function voxelBoxesCanvas(
  boxes: readonly VoxelBox[],
  size = 64,
  panel = false,
  panelHeight?: number,
): HTMLCanvasElement {
  const geometry = modelGeometry(boxes);
  try {
    return renderThumbnail(new Mesh(geometry, material), size, panel, panelHeight);
  } finally {
    geometry.dispose();
  }
}

export function voxelAppearanceCanvas(appearance: Appearance, turn = 0): HTMLCanvasElement {
  const rig = personRig(packAppearance(appearance), 0, '', '', material, JSON.stringify(appearance.parts));
  rig.root.rotation.y = turn;
  try {
    return renderThumbnail(rig.root, 192);
  } finally {
    rig.dispose();
  }
}

/** Title illustration is the same solid world vocabulary, including the current character. */
export function voxelTitleCanvas(appearance: Appearance): HTMLCanvasElement {
  const root = new Group();
  const geometry = modelGeometry([
    B(0, -0.3, 0, 4, 0.6, 4, P.wood),
    B(0, 0.025, 0, 4, 0.05, 4, 0x67a848),
    ...treeModel(3, 'forest', 0).map((b) => ({ ...b, x: b.x - 1.15, z: b.z - 1.05 })),
    ...furnitureModel('torch').boxes.map((b) => ({ ...b, x: b.x + 1.4, z: b.z - 0.9 })),
    B(0.8, 0.1, 0.7, 1.1, 0.15, 1.1, P.stone),
    B(0.8, 0.25, 0.7, 0.7, 0.15, 0.7, P.teal),
    B(0.8, 0.4, 0.7, 0.35, 0.15, 0.35, P.glow),
  ]);
  root.add(new Mesh(geometry, material));
  const rig = personRig(packAppearance(appearance), 0, '', '', material, JSON.stringify(appearance.parts));
  rig.root.position.set(-0.35, 0.05, 0.9);
  root.add(rig.root);
  try {
    return renderThumbnail(root, 576);
  } finally {
    geometry.dispose();
    rig.dispose();
  }
}
