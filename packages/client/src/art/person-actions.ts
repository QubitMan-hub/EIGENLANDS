/** Append-only person frame families: existing outfits, saves and combat columns stay compatible. */
export const ACTION_START = {
  mine: 30,
  chop: 34,
  dig: 38,
  water: 42,
  fish: 46,
  gather: 50,
  craft: 54,
  channel: 58,
  sit: 62,
  swim: 66,
  talk: 70,
} as const;
export type PersonAction = keyof typeof ACTION_START;
export const PERSON_ACTION_END = 74;
const FACING = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
  [-0.894, 0.447],
  [0.894, 0.447],
  [-0.894, -0.447],
  [0.894, -0.447],
];
export function actionFrame(action: PersonAction, progress: number, reduced = false): number {
  const t = Math.max(0, Math.min(1, progress));
  // Store energy, accelerate into contact, then settle. No equal-duration robotic swing.
  return ACTION_START[action] + (reduced ? 2 : t < 0.34 ? 0 : t < 0.49 ? 1 : t < 0.68 ? 2 : 3);
}
export function actionPose(dir: number, frame: number) {
  if (frame < 30 || frame >= PERSON_ACTION_END) return null;
  const index = Math.floor((frame - 30) / 4),
    k = (frame - 30) % 4;
  const action = Object.keys(ACTION_START)[index] as PersonAction;
  const [dx, dy] = FACING[((dir % 8) + 8) % 8]!;
  const aim = Math.atan2(dy!, dx!);
  const back = dir === 1 || dir >= 6;
  const side = dir === 2 || dir === 4 || dir === 7 ? 1 : -1;
  let reach = 3,
    height = 18,
    crouch = 0,
    angle = aim;
  switch (action) {
    case 'mine':
      reach = [1, 4, 6, 2][k]!;
      height = [10, 13, 21, 18][k]!;
      crouch = [0, 1, 2, 0][k]!;
      angle = aim + [-1.6, -1, 0.4, -0.8][k]!;
      break;
    case 'chop':
      reach = [1, 3, 7, 3][k]!;
      height = [13, 15, 18, 18][k]!;
      crouch = [0, 0, 1, 0][k]!;
      angle = aim + [-1.9, -1.2, 0.15, -0.6][k]!;
      break;
    case 'dig':
      reach = [2, 4, 6, 2][k]!;
      height = [16, 19, 23, 20][k]!;
      crouch = [0, 2, 3, 1][k]!;
      angle = aim + [-1.2, -0.4, 0.6, -0.6][k]!;
      break;
    case 'water':
      reach = [2, 4, 5, 2][k]!;
      height = [19, 19, 20, 19][k]!;
      crouch = [0, 0, 1, 0][k]!;
      angle = aim + [0, 0.25, 0.5, 0][k]!;
      break;
    case 'fish':
      reach = [2, 4, 5, 4][k]!;
      height = [13, 14, 18, 18][k]!;
      angle = aim + [-1.1, -0.6, 0, -0.1][k]!;
      break;
    case 'gather':
      reach = [2, 4, 5, 2][k]!;
      height = [20, 23, 25, 20][k]!;
      crouch = [1, 3, 4, 1][k]!;
      angle = aim + 0.5;
      break;
    case 'craft':
      reach = [2, 3, 4, 2][k]!;
      height = [15, 17, 20, 18][k]!;
      crouch = [0, 1, 1, 0][k]!;
      angle = aim + [-0.8, -0.4, 0.4, 0][k]!;
      break;
    case 'channel':
      reach = [2, 4, 5, 4][k]!;
      height = [19, 16, 14, 16][k]!;
      crouch = [1, 1, 0, 0][k]!;
      angle = aim - 0.8;
      break;
    case 'swim':
      reach = [3, 5, 3, 1][k]!;
      height = [17, 18, 20, 19][k]!;
      crouch = [0, 0.5, 0, 0.5][k]!;
      angle = aim + [-0.6, 0, 0.6, 0][k]!;
      break;
    case 'talk':
      reach = [1, 3, 2, 1][k]!;
      height = [19, 16, 17, 19][k]!;
      angle = aim - 0.7;
      break;
    case 'sit':
      reach = 4;
      height = 19 + [0, 0, 1, 0][k]!;
      crouch = 2;
      angle = aim - 0.7;
      break;
  }
  const x = 12.5 + side * (back ? -1 : 1) + dx! * reach;
  const y = height + dy! * reach * 0.35;
  return {
    x,
    y,
    angle,
    crouch,
    action,
    supportX: action === 'swim' ? 25 - x : x - Math.cos(angle) * 3,
    supportY: action === 'swim' ? 36 - y : y - Math.sin(angle) * 3,
  };
}
