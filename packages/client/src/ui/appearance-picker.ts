import { PART_COUNTS, validParts, type PartKind } from '@eigenlands/shared';
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
import {
  DRESS_RAMPS,
  EYE_COLORS,
  HAIR_RAMPS,
  SKIN_RAMPS,
  TRIM_COLORS,
  outfitFromAppearance,
  referenceAppearance,
} from '../art/appearance';
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
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as {
      app?: number;
      parts?: unknown;
      touched?: boolean;
    } | null;
    const app = unpackAppearance(raw?.app);
    if (app) return { app: { ...app, parts: validParts(raw?.parts) }, touched: !!raw?.touched };
  } catch {
    /* private mode or corrupt value: pick fresh */
  }
  const fresh = { app: referenceAppearance(Math.random() < 0.5 ? 0 : 1), touched: false };
  saveLook(fresh);
  return fresh;
}

export function saveLook(l: StoredLook): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ app: packAppearance(l.app), parts: l.app.parts, touched: l.touched }));
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
  const catalogControls = new Map<PartKind, { select: HTMLSelectElement; image: HTMLImageElement }>();

  const draw = () => {
    const c = renderPersonCanvas(outfitFromAppearance(OUTFITS[0]!, look, true), TURNS[turn]!, 0);
    c.setAttribute('aria-label', 'Your wanderer');
    canvasBox.replaceChildren(c);
  };
  const sync = () => {
    for (const [field, control] of catalogControls) {
      const id = look.parts?.[field] ?? 0;
      control.select.value = String(id);
      control.image.hidden = !id;
      if (id) control.image.src = `${import.meta.env.BASE_URL}art/wardrobe/${field}-${String(id).padStart(2, '0')}.png`;
    }
    for (const row of ROWS)
      buttons.get(row.field)!.forEach((b, i) => b.setAttribute('aria-pressed', String(look[row.field] === i)));
    draw();
  };
  const change = () => {
    sync();
    onChange({ ...look });
  };

  const presets = h('div', { class: 'look-presets' });
  for (const [body, label] of [
    [0, 'Steel adventurer'],
    [1, 'Teal adventurer'],
  ] as const)
    presets.append(
      h('button', {
        type: 'button',
        text: label,
        on: {
          click: () => {
            Object.assign(look, referenceAppearance(body));
            change();
          },
        },
      }),
    );
  rows.append(presets);

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
            const part: PartKind | undefined = ['cut', 'hairStyle', 'hairColor'].includes(row.field)
              ? 'hair'
              : row.field === 'eyes'
                ? 'eyes'
                : ['dress', 'dressColor'].includes(row.field)
                  ? 'tops'
                  : undefined;
            if (part && look.parts) look.parts = { ...look.parts, [part]: 0 };
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
          Object.assign(look, randomAppearance(Math.random), { parts: validParts(null) });
          change();
        },
      },
    }),
  );
  const catalog = h('div', { class: 'look-catalog' });
  const labels: Record<PartKind, string> = {
    hair: 'Hair design',
    eyes: 'Eye detail',
    mouths: 'Expression',
    tops: 'Top',
    pants: 'Trousers',
    shorts: 'Shorts',
    boots: 'Boots',
  };
  for (const field of Object.keys(PART_COUNTS) as PartKind[]) {
    const label = h('label', { text: labels[field] });
    const select = document.createElement('select');
    select.setAttribute('aria-label', labels[field]);
    for (let i = 0; i <= PART_COUNTS[field]; i++) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = i ? `${labels[field]} ${String(i).padStart(2, '0')}` : 'Original';
      select.append(option);
    }
    select.value = String(look.parts?.[field] ?? 0);
    select.addEventListener('change', () => {
      look.parts = { ...validParts(look.parts), [field]: Number(select.value) };
      if (field === 'pants') look.parts.shorts = 0;
      if (field === 'shorts') look.parts.pants = 0;
      change();
    });
    const image = document.createElement('img');
    image.alt = `${labels[field]} preview`;
    catalogControls.set(field, { select, image });
    label.append(select, image);
    catalog.append(label);
  }
  rows.append(catalog);
  sync();
  return h('div', { class: 'look-picker' }, preview, rows);
}
