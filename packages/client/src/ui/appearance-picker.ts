/** Character creation / wardrobe: live isometric-pixel preview plus swatches for every appearance choice. */
import {
  APPEARANCE_COUNTS,
  BODY_NAMES,
  HAIRCUT_NAMES,
  DRESS_COLOR_NAMES,
  DRESS_NAMES,
  EYE_NAMES,
  HAIR_COLOR_NAMES,
  HAIR_STYLE_NAMES,
  PALETTE,
  SKIN_NAMES,
  TRIM_NAMES,
  packAppearance,
  randomAppearance,
  unpackAppearance,
  type Appearance,
  type AppearanceField,
} from '@eigenlands/shared';
import { OUTFITS, renderPersonCanvas } from '../art/actors';
import { DRESS_RAMPS, EYE_COLORS, HAIR_RAMPS, SKIN_RAMPS, TRIM_COLORS, outfitFromAppearance } from '../art/appearance';
import { h } from './dom';

const KEY = 'eigenlands.appearance';
const TURNS = [0, 5, 3, 7, 1, 6, 2, 4]; // front, then once around the wanderer

export interface StoredLook {
  app: Appearance;
  /** the player has changed something on this device */
  touched: boolean;
}

export function loadLook(): StoredLook {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { app?: number; touched?: boolean } | null;
    const app = unpackAppearance(raw?.app);
    if (app) return { app, touched: !!raw?.touched };
  } catch {
    /* private mode or corrupt value: pick fresh */
  }
  const fresh = { app: randomAppearance(Math.random), touched: false };
  saveLook(fresh);
  return fresh;
}

export function saveLook(l: StoredLook): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ app: packAppearance(l.app), touched: l.touched }));
  } catch {
    /* storage unavailable: the look still applies for this session */
  }
}

const hex = (i: number) => PALETTE[i]!;

interface Row {
  field: AppearanceField;
  label: string;
  names: readonly string[];
  swatch?: (i: number) => string;
}

const ROWS: Row[] = [
  { field: 'body', label: 'Body', names: BODY_NAMES },
  { field: 'skin', label: 'Skin', names: SKIN_NAMES, swatch: (i) => hex(SKIN_RAMPS[i]![2]!) },
  // 0 keeps the classic style choice; every other entry is a haircut of the modular character system
  { field: 'cut', label: 'Haircut', names: ['Classic', ...HAIRCUT_NAMES] },
  { field: 'hairStyle', label: 'Classic hair', names: HAIR_STYLE_NAMES },
  { field: 'hairColor', label: 'Hair colour', names: HAIR_COLOR_NAMES, swatch: (i) => hex(HAIR_RAMPS[i]![3]!) },
  { field: 'eyes', label: 'Eyes', names: EYE_NAMES, swatch: (i) => hex(EYE_COLORS[i]!) },
  { field: 'dress', label: 'Dress', names: DRESS_NAMES },
  { field: 'dressColor', label: 'Dress colour', names: DRESS_COLOR_NAMES, swatch: (i) => hex(DRESS_RAMPS[i]![3]!) },
  { field: 'trim', label: 'Trim', names: TRIM_NAMES, swatch: (i) => hex(TRIM_COLORS[i]!) },
];

function turnButton(text: string, label: string, click: () => void): HTMLButtonElement {
  const b = h('button', { type: 'button', text, title: label, on: { click } });
  b.setAttribute('aria-label', label);
  return b;
}

export function buildAppearancePicker(initial: Appearance, onChange: (a: Appearance) => void): HTMLElement {
  const look: Appearance = { ...initial };
  let turn = 0;
  const preview = h('div', { class: 'look-preview' });
  const canvasBox = h('div', { class: 'look-canvas', title: 'Turn around' });
  const rows = h('div', { class: 'look-rows' });
  const buttons = new Map<string, HTMLButtonElement[]>();

  const draw = () => {
    const c = renderPersonCanvas(outfitFromAppearance(OUTFITS[0]!, look, true), TURNS[turn]!, 0);
    c.setAttribute('aria-label', 'Your wanderer');
    canvasBox.replaceChildren(c);
  };
  const sync = () => {
    for (const row of ROWS)
      buttons.get(row.field)!.forEach((b, i) => b.setAttribute('aria-pressed', String(look[row.field] === i)));
    draw();
  };
  const change = () => {
    sync();
    onChange({ ...look });
  };

  for (const row of ROWS) {
    const group = h('div', { class: `look-group ${row.swatch ? 'swatches' : 'names'}` });
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', row.label);
    const list: HTMLButtonElement[] = [];
    for (let i = 0; i < APPEARANCE_COUNTS[row.field]; i++) {
      const b = h('button', {
        class: 'look-opt',
        type: 'button',
        title: row.names[i],
        text: row.swatch ? '' : row.names[i],
        on: {
          click: () => {
            look[row.field] = i;
            change();
          },
        },
      }) as HTMLButtonElement;
      b.setAttribute('aria-label', `${row.label}: ${row.names[i]}`);
      if (row.swatch) b.style.setProperty('--swatch', row.swatch(i));
      list.push(b);
      group.append(b);
    }
    buttons.set(row.field, list);
    rows.append(h('div', { class: 'look-row' }, h('span', { class: 'look-label', text: row.label }), group));
  }

  const spin = (d: number) => {
    turn = (turn + d + TURNS.length) % TURNS.length;
    draw();
  };
  canvasBox.addEventListener('click', () => spin(1));
  preview.append(
    canvasBox,
    h(
      'div',
      { class: 'look-turn' },
      turnButton('‹', 'Turn left', () => spin(-1)),
      turnButton('›', 'Turn right', () => spin(1)),
    ),
    h('button', {
      type: 'button',
      class: 'look-random',
      text: 'Surprise me',
      on: {
        click: () => {
          Object.assign(look, randomAppearance(Math.random));
          change();
        },
      },
    }),
  );
  sync();
  return h('div', { class: 'look-picker' }, preview, rows);
}
