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
} from 'three';
import { voxelItemBoxes } from '../game/voxel/items';
import { modelGeometry } from '../game/voxel/mesh';
import { personRig } from '../game/voxel/people';

let renderer: WebGLRenderer | null = null;
const scene = new Scene(),
  material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const sky = new HemisphereLight(0xe0e6dc, 0x66634f, 2),
  sun = new DirectionalLight(0xffe7bd, 2.5);
sun.position.set(-3, 6, 4);
scene.add(sky, sun);

/** UI thumbnails are rendered from solid voxel geometry; the inventory itself needs no extra live 3D scenes. */
function renderThumbnail(object: Object3D, size: number): HTMLCanvasElement {
  if (!renderer) {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0, 0);
    renderer.setPixelRatio(1);
  }
  renderer.setSize(size, size, false);
  scene.add(object);
  const bounds = new Box3().setFromObject(object),
    centre = bounds.getCenter(new Vector3()),
    extent = bounds.getSize(new Vector3());
  const radius = Math.max(extent.x, extent.y, extent.z) * 0.9 + 0.07;
  const camera = new OrthographicCamera(-radius, radius, radius, -radius, 0.1, 100);
  camera.position.copy(centre).add(new Vector3(6.123724, 5, 6.123724));
  camera.lookAt(centre);
  renderer.render(scene, camera);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
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
