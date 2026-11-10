import { voxelBoxesCanvas } from '../art/voxel-icons';
import { uiIconBoxes, UI_ICONS } from '../game/voxel/ui-models';

const cache = new Map<string, string>();
/** Pure markup also works in shared settings/tests. The browser hydrates thumbnails after mounting. */
export function iconSvg(name: string, px = 18, cls = ''): string {
  const key = (UI_ICONS as readonly string[]).includes(name) ? name : 'hex';
  return `<img class="pix voxel-ui-icon ${cls}" width="${px}" height="${px}" alt="" aria-hidden="true" draggable="false" data-voxel-icon="${key}">`;
}

export function hydrateVoxelIcons(root: ParentNode): void {
  for (const img of root.querySelectorAll<HTMLImageElement>('img[data-voxel-icon]:not([src])')) {
    const name = img.dataset.voxelIcon!;
    let src = cache.get(name);
    if (!src) {
      src = voxelBoxesCanvas(uiIconBoxes(name), 64).toDataURL();
      cache.set(name, src);
    }
    img.src = src;
  }
}
