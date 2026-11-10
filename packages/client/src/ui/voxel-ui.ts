import { voxelBoxesCanvas } from '../art/voxel-icons';
import { hydrateVoxelIcons } from './icons';
import { uiPlateBoxes } from '../game/voxel/ui-models';

/** Four cached 3D panel renders, shared by every DOM surface; no extra WebGL contexts or animation loops. */
export function installVoxelUI(): void {
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      hydrateVoxelIcons(document);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  for (const kind of ['timber', 'stone', 'jade', 'slot'] as const) {
    const url = voxelBoxesCanvas(uiPlateBoxes(kind), 384, true).toDataURL();
    document.documentElement.style.setProperty(`--voxel-${kind}`, `url("${url}")`);
  }
}
