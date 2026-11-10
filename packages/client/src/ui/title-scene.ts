import type { Appearance } from '@eigenlands/shared';
import { voxelTitleCanvas } from '../art/voxel-icons';
import { h } from './dom';

/** Cached orthographic renders of an actual voxel diorama; no sprite layers. */
export function mountTitleScene(host: HTMLElement, initial: Appearance): { setLook(a: Appearance): void } {
  const stage = h('div', { class: 'ts-stage' });
  host.append(h('div', { class: 'title-scene', 'aria-hidden': 'true' } as never, stage));
  const draw = (look: Appearance) => {
    const canvas = voxelTitleCanvas(look);
    canvas.className = 'ts-island';
    stage.replaceChildren(canvas);
  };
  draw(initial);
  return { setLook: draw };
}
