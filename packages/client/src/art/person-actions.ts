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
  hit: 118,
  dodge: 126,
  death: 134,
  forge: 142,
  cook: 150,
  alchemy: 158,
  saw: 166,
  slash: 174,
  thrust: 182,
  cleave: 190,
} as const;
export type PersonAction = keyof typeof ACTION_START;
export const PERSON_ACTION_END = 198;
const ACTIONS = Object.keys(ACTION_START) as PersonAction[];
/** Preserve legacy four keys; append in-between poses instead of renumbering saved presentation IDs. */
const KEYS = Object.fromEntries(
  ACTIONS.map((action, index) => {
    const start = ACTION_START[action],
      extra = 74 + index * 4;
    return [
      action,
      start >= 118
        ? Array.from({ length: 8 }, (_, i) => start + i)
        : [start, extra, start + 1, extra + 1, start + 2, extra + 2, extra + 3, start + 3],
    ];
  }),
) as Record<PersonAction, number[]>;
export function actionKeys(action: PersonAction): readonly number[] {
  return KEYS[action];
}
const CLIPS = new Map<number, { action: PersonAction; k: number }>();
for (const action of ACTIONS)
  actionKeys(action).forEach((frame, i) => CLIPS.set(frame, { action, k: [0, 0.5, 1, 1.5, 2, 2.35, 2.7, 3][i]! }));
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
  // Deliberate anticipation, a short contact and a longer settling recovery.
  const key = reduced
    ? action === 'death'
      ? 7
      : 4
    : t < 0.18
      ? 0
      : t < 0.34
        ? 1
        : t < 0.43
          ? 2
          : t < 0.49
            ? 3
            : t < 0.58
              ? 4
              : t < 0.7
                ? 5
                : t < 0.85
                  ? 6
                  : 7;
  return actionKeys(action)[key]!;
}
export function actionPose(dir: number, frame: number) {
  const clip = CLIPS.get(frame);
  if (!clip) return null;
  const { action, k } = clip;
  const sample = (values: number[]) => {
    const i = Math.floor(k),
      t = k - i;
    return values[i]! + (values[Math.min(3, i + 1)]! - values[i]!) * t;
  };
  const [dx, dy] = FACING[((dir % 8) + 8) % 8]!;
  const aim = Math.atan2(dy!, dx!);
  const back = dir === 1 || dir >= 6;
  const side = dir === 2 || dir === 4 || dir === 7 ? 1 : -1;
  let reach = 3,
    height = 18,
    crouch = 0,
    angle = aim;
  switch (action) {
    case 'slash':
      reach = sample([1, 3, 6, 2]);
      height = sample([14, 16, 18, 19]);
      angle = aim + sample([-1.5, -0.8, 0.15, 0.65]);
      crouch = sample([0, 0, 1, 0]);
      break;
    case 'thrust':
      reach = sample([1, 3, 7, 2]);
      height = sample([18, 17, 17, 19]);
      angle = aim;
      crouch = sample([1, 0, 1, 0]);
      break;
    case 'cleave':
      reach = sample([1, 2, 5, 2]);
      height = sample([9, 11, 20, 20]);
      angle = aim + sample([-1.7, -1.2, 0.45, 0.6]);
      crouch = sample([0, 0, 3, 1]);
      break;
    case 'hit':
      reach = sample([2, 1, 1, 2]);
      height = 18;
      crouch = sample([0, 2, 1, 0]);
      angle = aim - 0.8;
      break;
    case 'dodge':
      reach = 2;
      height = sample([18, 23, 25, 19]);
      crouch = sample([1, 5, 6, 1]);
      angle = aim - 1;
      break;
    case 'death':
      reach = sample([1, 2, 3, 4]);
      height = sample([19, 23, 26, 28]);
      crouch = k / 3;
      angle = aim + 0.4;
      break;
    case 'forge':
      reach = sample([1, 3, 5, 2]);
      height = sample([9, 12, 20, 17]);
      crouch = sample([0, 0, 2, 0]);
      angle = aim + sample([-1.5, -1, 0.4, -0.8]);
      break;
    case 'cook':
      reach = sample([3, 5, 4, 3]);
      height = sample([19, 20, 21, 19]);
      angle = aim + sample([-0.5, 0.1, 0.5, -0.5]);
      break;
    case 'alchemy':
      reach = sample([2, 4, 4, 2]);
      height = sample([15, 14, 17, 19]);
      angle = aim + sample([-1, -0.2, 0.7, -0.7]);
      break;
    case 'saw':
      reach = sample([2, 3, 4, 2]);
      height = sample([20, 20, 21, 20]);
      crouch = sample([1, 1, 2, 1]);
      angle = aim;
      break;
    case 'mine':
      reach = sample([1, 4, 6, 2]);
      height = sample([10, 13, 21, 18]);
      crouch = sample([0, 1, 2, 0]);
      angle = aim + sample([-1.6, -1, 0.4, -0.8]);
      break;
    case 'chop':
      reach = sample([1, 3, 7, 3]);
      height = sample([13, 15, 18, 18]);
      crouch = sample([0, 0, 1, 0]);
      angle = aim + sample([-1.9, -1.2, 0.15, -0.6]);
      break;
    case 'dig':
      reach = sample([2, 4, 6, 2]);
      height = sample([16, 19, 23, 20]);
      crouch = sample([0, 2, 3, 1]);
      angle = aim + sample([-1.2, -0.4, 0.6, -0.6]);
      break;
    case 'water':
      reach = sample([2, 4, 5, 2]);
      height = sample([19, 19, 20, 19]);
      crouch = sample([0, 0, 1, 0]);
      angle = aim + sample([0, 0.25, 0.5, 0]);
      break;
    case 'fish':
      reach = sample([2, 4, 5, 4]);
      height = sample([13, 14, 18, 18]);
      angle = aim + sample([-1.1, -0.6, 0, -0.1]);
      break;
    case 'gather':
      reach = sample([2, 4, 5, 2]);
      height = sample([20, 23, 25, 20]);
      crouch = sample([1, 3, 4, 1]);
      angle = aim + 0.5;
      break;
    case 'craft':
      reach = sample([2, 3, 4, 2]);
      height = sample([15, 17, 20, 18]);
      crouch = sample([0, 1, 1, 0]);
      angle = aim + sample([-0.8, -0.4, 0.4, 0]);
      break;
    case 'channel':
      reach = sample([2, 4, 5, 4]);
      height = sample([19, 16, 14, 16]);
      crouch = sample([1, 1, 0, 0]);
      angle = aim - 0.8;
      break;
    case 'swim':
      reach = sample([3, 5, 3, 1]);
      height = sample([17, 18, 20, 19]);
      crouch = sample([0, 0.5, 0, 0.5]);
      angle = aim + sample([-0.6, 0, 0.6, 0]);
      break;
    case 'talk':
      reach = sample([1, 3, 2, 1]);
      height = sample([19, 16, 17, 19]);
      angle = aim - 0.7;
      break;
    case 'sit':
      reach = 4;
      height = 19 + sample([0, 0, 1, 0]);
      crouch = 2;
      angle = aim - 0.7;
      break;
  }
  const x = 12.5 + side * (back ? -1 : 1) + dx! * reach;
  const y = height + dy! * reach * 0.35;
  return {
    x,
    y,
    phase: k / 3,
    angle,
    crouch,
    action,
    supportX: action === 'swim' ? 25 - x : x - Math.cos(angle) * 3,
    supportY: action === 'swim' ? 36 - y : y - Math.sin(angle) * 3,
  };
}

/** Weapon identity selects the body's contact geometry as well as the held mesh. */
export function meleeAction(family: string): 'slash' | 'thrust' | 'cleave' {
  return family === 'spear'
    ? 'thrust'
    : ['warhammer', 'battle_axe', 'greatsword'].includes(family)
      ? 'cleave'
      : 'slash';
}
export function meleeFrame(family: string, progress: number, reduced = false): number {
  return actionFrame(meleeAction(family), 0.49 + Math.max(0, Math.min(1, progress)) * 0.51, reduced);
}
