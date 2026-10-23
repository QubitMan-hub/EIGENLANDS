export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'skill' | 'dash' | 'interact' | 'inventory' | 'journal' | 'craft' | 'prev' | 'next'
  | 'ability1' | 'ability2' | 'ability3' | 'ability4' | 'ultimate' | 'board' | 'chat' | 'party' | 'extract' | 'shadows' | 'sail' | 'voice' | 'map';
/** Phase 3/4 actions handled through `Input.onAction`. */
export const EXT_ACTIONS = ['ability1', 'ability2', 'ability3', 'ability4', 'ultimate', 'board', 'chat', 'party', 'extract', 'shadows', 'sail', 'voice', 'map'] as const;
export type KeyMap = Record<Action, string[]>;

export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'attack', 'skill', 'dash', 'interact', 'inventory', 'journal', 'craft', 'prev', 'next', ...EXT_ACTIONS];
export const ACTION_LABELS: Record<Action, string> = {
  up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right',
  attack: 'Attack', skill: 'Skill shot', dash: 'Dash (dodge)', interact: 'Use item / talk / open',
  inventory: 'Pack', journal: 'Journal', craft: 'Field crafting', prev: 'Previous quick-bar slot', next: 'Next quick-bar slot',
  ability1: 'Orb ability 1', ability2: 'Orb ability 2', ability3: 'Orb ability 3', ability4: 'Orb ability 4', ultimate: 'Ultimate',
  board: 'Circuit Board', chat: 'Chat', party: 'Party', extract: 'Extract shadow', shadows: 'Shadow Army', sail: 'Set sail / go ashore', voice: 'Proximity voice chat', map: 'World atlas',
};

export const DEFAULT_KEYS: KeyMap = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ', 'KeyZ'], skill: ['KeyK'], dash: ['Space', 'ShiftLeft'], interact: ['KeyX'],
  inventory: ['KeyI', 'Tab'], journal: ['KeyL'], craft: ['KeyC'], prev: ['BracketLeft'], next: ['BracketRight'],
  ability1: ['KeyQ'], ability2: ['KeyE'], ability3: ['KeyR'], ability4: ['KeyF'], ultimate: ['KeyV'], board: ['KeyB'], chat: ['Enter'], party: ['KeyP'], extract: ['KeyT'], shadows: ['KeyY'], sail: ['KeyH'], voice: ['KeyN'], map: ['KeyM'],
};

const STORE_KEY = 'eigen.keys';

export function loadKeys(storage: Pick<Storage, 'getItem'> | null = safeStorage()): KeyMap {
  try {
    const raw = storage?.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KeyMap>;
      const out = Object.fromEntries(ACTIONS.map(a => [a, [...DEFAULT_KEYS[a]]])) as KeyMap;
      for (const a of ACTIONS) {
        const v = parsed[a];
        if (Array.isArray(v) && v.every((k) => typeof k === 'string')) out[a] = v.slice(0, 3);
      }
      const legacy = { ability1: ['KeyQ'], ability2: ['KeyR'], ability3: ['KeyF'], ability4: ['KeyG'], interact: ['KeyE'], skill: ['KeyK', 'KeyX'] };
      const group = Object.keys(legacy) as (keyof typeof legacy)[];
      const unchanged = group.every(a => JSON.stringify(parsed[a]) === JSON.stringify(legacy[a]));
      const reserved = new Set(['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyX', 'KeyK']);
      if (unchanged && !ACTIONS.some(a => !group.includes(a as keyof typeof legacy) && out[a].some(k => reserved.has(k))))
        for (const a of group) out[a] = [...DEFAULT_KEYS[a]];
      // Old default M belonged to voice. Move only that default, never a custom binding.
      if (!('map' in parsed) && out.voice.length === 1 && out.voice[0] === 'KeyM' && !ACTIONS.some(a => a !== 'voice' && a !== 'map' && out[a].includes('KeyN'))) out.voice = ['KeyN'];
      if (!('map' in parsed) && ACTIONS.some(a => a !== 'map' && out[a].includes('KeyM'))) out.map = [];
      // An explicit custom binding wins over a newly introduced default, after default migrations.
      for (const a of ACTIONS) if (!(a in parsed)) out[a] = out[a].filter(k => !ACTIONS.some(other => other !== a && Array.isArray(parsed[other]) && out[other].includes(k)));
      return out;
    }
  } catch { /* corrupt storage falls back to defaults */ }
  return Object.fromEntries(ACTIONS.map(a => [a, [...DEFAULT_KEYS[a]]])) as KeyMap;
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
