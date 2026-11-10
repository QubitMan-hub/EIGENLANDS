import { PALETTE } from '@eigenlands/shared';
import { voxelBoxesCanvas } from '../art/voxel-icons';
import { uiPlateBoxes } from '../game/voxel/ui-models';
import { creatureBoxes } from '../game/voxel/creatures';
import { solidBox } from '../game/voxel/mesh';
import { BOSS_H, BOSS_W, type BossTheme } from './boss-frames';

const cache = new Map<string, HTMLCanvasElement>();
export function renderVoxelBossFrame(
  ctx: CanvasRenderingContext2D,
  theme: BossTheme,
  state: { frac: number; phases: readonly number[]; t: number },
): void {
  const phase = state.phases.filter((p) => state.frac <= p).length;
  const key = `${theme.id}:${phase}`;
  let image = cache.get(key);
  if (!image) {
    const c = (index: number) => Number.parseInt(PALETTE[index].slice(1), 16);
    const boxes = uiPlateBoxes('timber').map((b, i) => ({
      ...b,
      y: b.y * 0.31,
      h: b.h * 0.31,
      color: i === 1 ? c(theme.panel) : i > 5 ? c(theme.accent) : c(theme.frame[1]),
    }));
    state.phases.forEach((_, i) =>
      boxes.push(
        solidBox(-1.5 + i * 0.25, -0.48, 0.3, 0.14, 0.08, 0.15, i < phase ? c(theme.accent) : c(theme.frame[0])),
      ),
    );
    image = voxelBoxesCanvas(boxes, BOSS_W * 4, true, BOSS_H * 4);
    const portrait = voxelBoxesCanvas(creatureBoxes(theme.id), 160);
    image.getContext('2d')!.drawImage(portrait, 2, 4, 138, BOSS_H * 4 - 8);
    cache.set(key, image);
  }
  ctx.clearRect(0, 0, BOSS_W, BOSS_H);
  ctx.drawImage(image, 0, 0, BOSS_W, BOSS_H);
}
