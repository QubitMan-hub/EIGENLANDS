export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'skill' | 'dash' | 'interact';
export type KeyMap = Record<Action, string[]>;

export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'attack', 'skill', 'dash', 'interact'];
export const ACTION_LABELS: Record<Action, string> = {
  up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right',
  attack: 'Attack', skill: 'Skill shot', dash: 'Dash (dodge)', interact: 'Smash / interact',
};

export const DEFAULT_KEYS: KeyMap = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ', 'KeyZ'], skill: ['KeyK', 'KeyX'], dash: ['Space', 'ShiftLeft'], interact: ['KeyE'],
};

const STORE_KEY = 'eigen.keys';

export function loadKeys(storage: Pick<Storage, 'getItem'> | null = safeStorage()): KeyMap {
  try {
    const raw = storage?.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KeyMap>;
      const out = { ...DEFAULT_KEYS };
      for (const a of ACTIONS) {
        const v = parsed[a];
        if (Array.isArray(v) && v.length && v.every((k) => typeof k === 'string')) out[a] = v.slice(0, 3);
      }
      return out;
    }
  } catch { /* corrupt storage falls back to defaults */ }
  return { ...DEFAULT_KEYS };
}

export function saveKeys(keys: KeyMap, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try { storage?.setItem(STORE_KEY, JSON.stringify(keys)); } catch { /* ignore */ }
}

/** Binds `code` to `action`, removing it from any other action so one key never does two things. */
export function rebind(keys: KeyMap, action: Action, code: string): KeyMap {
  const out = {} as KeyMap;
  for (const a of ACTIONS) out[a] = keys[a].filter((k) => k !== code);
  out[action] = [code, ...out[action]].slice(0, 2);
  return out;
}

const KEY_NAMES: Record<string, string> = {
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ArrowUp: 'Up', ArrowDown: 'Down',
  ArrowLeft: 'Left', ArrowRight: 'Right', Enter: 'Enter', Tab: 'Tab',
};

export function keyLabel(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '');
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
