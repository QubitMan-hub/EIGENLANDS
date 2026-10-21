import { ACTIONS, ACTION_LABELS, keyLabel, rebind, saveKeys, type Action, type KeyMap } from '../input/keymap';

export interface Settings {
  reducedMotion: boolean;
  textScale: number; // 1 | 1.25 | 1.5
  colorblind: 'off' | 'protan' | 'deutan' | 'tritan';
  muted: boolean;
  captions: boolean;
  volume: number;
  highContrastHud: boolean;
}

const KEY = 'eigen.settings';
export function loadSettings(): Settings {
  const d: Settings = {
    reducedMotion: matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    textScale: 1, colorblind: 'off', muted: false, captions: false, volume: 0.5, highContrastHud: false,
  };
  try { return { ...d, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) }; } catch { return d; }
}
export function saveSettings(s: Settings): void { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Colour-blind friendly shifts: simulate the deficiency, then push the lost information into other channels. */
const SIM = {
  protan: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deutan: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritan: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
} as const;
const SHIFT = {
  protan: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  deutan: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  tritan: [1, 0, 0.7, 0, 1, 0.7, 0, 0, 0],
} as const;

export function colorblindMatrix(kind: 'protan' | 'deutan' | 'tritan'): string {
  const S = SIM[kind], M = SHIFT[kind];
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let e = 0; // (I - S) -> error; corrected = I + M * error
      for (let k = 0; k < 3; k++) e += M[r * 3 + k]! * ((k === c ? 1 : 0) - S[k * 3 + c]!);
      out.push((r === c ? 1 : 0) + e);
    }
  }
  const [a, b, c, d, e, f, g, h, i] = out;
  return `${a} ${b} ${c} 0 0  ${d} ${e} ${f} 0 0  ${g} ${h} ${i} 0 0  0 0 0 1 0`;
}

export const HTML = `
<canvas id="game" aria-label="EIGENLANDS game view" role="img"></canvas>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="cb-protan"><feColorMatrix type="matrix" values="${colorblindMatrix('protan')}"/></filter>
  <filter id="cb-deutan"><feColorMatrix type="matrix" values="${colorblindMatrix('deutan')}"/></filter>
  <filter id="cb-tritan"><feColorMatrix type="matrix" values="${colorblindMatrix('tritan')}"/></filter>
</svg>
<div id="hud" hidden>
  <div id="hud-left" class="panel">
    <div class="row"><b id="hud-name">-</b><span id="hud-level">Lv 1</span></div>
    <div class="bar hp"><i id="hp-fill"></i><span id="hp-text"></span></div>
    <div class="bar xp"><i id="xp-fill"></i></div>
    <div id="coins" class="coinsm"></div>
  </div>
  <div id="buffs"></div>
  <div id="hud-right" class="panel" aria-live="off">
    <div id="clock">--:--</div>
    <div id="dayinfo"></div>
    <div id="townhint" class="small dim"></div>
  </div>
  <div id="hint" class="panel" hidden role="status"></div>
  <div id="captions" aria-live="polite"></div>
  <div id="debug" class="panel" hidden></div>
  <button id="btn-settings" class="icon-btn" aria-label="Settings">&#9881;</button>
  <div id="hud-btns">
    <button id="btn-pack" class="icon-btn small" aria-label="Pack (I)" title="Pack (I)">&#127890;</button>
    <button id="btn-craft" class="icon-btn small" aria-label="Field crafting (C)" title="Field crafting (C)">&#128296;</button>
    <button id="btn-journal" class="icon-btn small" aria-label="Journal (L)" title="Journal (L)">&#128214;</button>
  </div>
  <div id="vignette"></div>
</div>
<div id="touch" hidden>
  <div id="stick"><div id="knob"></div></div>
  <div id="tbtns">
    <button data-a="attack" aria-label="Attack">ATK</button>
    <button data-a="skill" aria-label="Skill shot">SKL</button>
    <button data-a="dash" aria-label="Dash">DSH</button>
    <button data-a="interact" aria-label="Smash">USE</button>
  </div>
</div>
<div id="login" class="overlay">
  <div class="card">
    <h1>EIGENLANDS</h1>
    <p class="tag">An infinite world where every skill is a quantum circuit.</p>
    <label for="name">Your name</label>
    <input id="name" maxlength="16" autocomplete="off" placeholder="Wanderer" />
    <button id="btn-guest" class="primary">Play as guest</button>
    <div id="google-slot"><div id="g-btn"></div><p id="g-off" class="small" hidden>Google sign-in isn't configured on this server. Guest progress is saved on this device and can be upgraded later.</p></div>
    <p id="login-msg" class="small" role="alert"></p>
  </div>
</div>
<div id="settings" class="overlay" hidden>
  <div class="card wide" role="dialog" aria-label="Settings">
    <h2>Settings</h2>
    <div class="grid">
      <section><h3>Controls</h3><div id="keys"></div><p class="small">Click a control, then press the new key. Mouse: left = attack, right = skill (aims at the cursor).</p></section>
      <section><h3>Accessibility</h3>
        <label><input type="checkbox" id="s-motion"> Reduce motion (no screen shake, fewer particles, still water)</label>
        <label>Text size <select id="s-text"><option value="1">Normal</option><option value="1.25">Large</option><option value="1.5">Extra large</option></select></label>
        <label>Colour-blind mode <select id="s-cb"><option value="off">Off</option><option value="protan">Protanopia (red-weak)</option><option value="deutan">Deuteranopia (green-weak)</option><option value="tritan">Tritanopia (blue-weak)</option></select></label>
        <label><input type="checkbox" id="s-hc"> High-contrast HUD</label>
        <label><input type="checkbox" id="s-cap"> Sound captions</label>
        <label><input type="checkbox" id="s-mute"> Mute sound</label>
        <label>Volume <input type="range" id="s-vol" min="0" max="100"></label>
      </section>
      <section><h3>Account</h3><p id="acct-info" class="small"></p>
        <div id="g-upgrade"></div>
        <button id="btn-signout">Sign out</button>
        <button id="btn-delete" class="danger">Delete my account and data</button>
      </section>
    </div>
    <button id="btn-close" class="primary">Back to game</button>
  </div>
</div>
<div id="lost" class="overlay" hidden><div class="card"><h2 id="lost-title">Connection lost</h2><p id="lost-msg" class="small"></p><button id="btn-reload" class="primary">Reconnect</button></div></div>
<div id="dead" class="overlay soft" hidden><div class="card small-card"><h2>You were defeated</h2><p class="small">Respawning at the shrine&hellip; Tip: dash through a glowing red warning to dodge it.</p></div></div>
`;

export class SettingsUI {
  constructor(
    public settings: Settings,
    private keys: KeyMap,
    private onKeys: (k: KeyMap) => void,
    private captureKey: (cb: (code: string) => void) => void,
    private apply: () => void,
  ) {}

  bind(handlers: { signOut(): void; deleteAccount(): void; accountInfo(): string }): void {
    const s = this.settings;
    $<HTMLInputElement>('s-motion').checked = s.reducedMotion;
    $<HTMLSelectElement>('s-text').value = String(s.textScale);
    $<HTMLSelectElement>('s-cb').value = s.colorblind;
    $<HTMLInputElement>('s-hc').checked = s.highContrastHud;
    $<HTMLInputElement>('s-cap').checked = s.captions;
    $<HTMLInputElement>('s-mute').checked = s.muted;
    $<HTMLInputElement>('s-vol').value = String(Math.round(s.volume * 100));
    const upd = () => {
      s.reducedMotion = $<HTMLInputElement>('s-motion').checked;
      s.textScale = Number($<HTMLSelectElement>('s-text').value);
      s.colorblind = $<HTMLSelectElement>('s-cb').value as Settings['colorblind'];
      s.highContrastHud = $<HTMLInputElement>('s-hc').checked;
      s.captions = $<HTMLInputElement>('s-cap').checked;
      s.muted = $<HTMLInputElement>('s-mute').checked;
      s.volume = Number($<HTMLInputElement>('s-vol').value) / 100;
      saveSettings(s);
      this.apply();
    };
    for (const id of ['s-motion', 's-text', 's-cb', 's-hc', 's-cap', 's-mute', 's-vol']) $(id).addEventListener('input', upd);
    $('btn-signout').addEventListener('click', handlers.signOut);
    $('btn-delete').addEventListener('click', () => {
      if (confirm('Delete your account, character and all saved data? This cannot be undone.')) handlers.deleteAccount();
    });
    $('btn-settings').addEventListener('click', () => { $('acct-info').textContent = handlers.accountInfo(); this.renderKeys(); this.show(true); });
    $('btn-close').addEventListener('click', () => this.show(false));
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('settings').hidden) this.show(false); });
    this.renderKeys();
  }

  show(on: boolean): void { $('settings').hidden = !on; }
  get open(): boolean { return !$('settings').hidden; }

  private renderKeys(): void {
    const box = $('keys');
    box.textContent = '';
    for (const a of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'keyrow';
      const label = document.createElement('span');
      label.textContent = ACTION_LABELS[a];
      const btn = document.createElement('button');
      btn.textContent = this.keys[a].map(keyLabel).join(' / ');
      btn.addEventListener('click', () => {
        btn.textContent = 'press a key…';
        this.captureKey((code) => {
          if (code !== 'Escape') { this.keys = rebind(this.keys, a as Action, code); saveKeys(this.keys); this.onKeys(this.keys); }
          this.renderKeys();
        });
      });
      row.append(label, btn);
      box.append(row);
    }
  }
}

export function applySettings(s: Settings, audio: { muted: boolean; volume: number }): void {
  document.documentElement.style.setProperty('--ui-scale', String(s.textScale));
  document.documentElement.classList.toggle('hc', s.highContrastHud);
  const cv = $('game');
  cv.style.filter = s.colorblind === 'off' ? '' : `url(#cb-${s.colorblind})`;
  audio.muted = s.muted;
  audio.volume = s.volume;
}

export interface Acts {
  moved: boolean; attacked: boolean; dashed: boolean; selected: boolean; chopped: boolean; mined: boolean; tilled: boolean;
  planted: boolean; watered: boolean; crafted: boolean; talked: boolean; fished: boolean; forged: boolean; harvested: boolean; openedPack: boolean;
}
export const freshActs = (): Acts => ({ moved: false, attacked: false, dashed: false, selected: false, chopped: false, mined: false, tilled: false, planted: false, watered: false, crafted: false, talked: false, fished: false, forged: false, harvested: false, openedPack: false });

/** One hint at a time, in order. Steps already done (and persisted) are skipped. */
export const TUTORIAL: ReadonlyArray<{ id: keyof Acts; text: string }> = [
  { id: 'moved', text: 'Move with WASD or the arrow keys (touch: left stick).' },
  { id: 'attacked', text: 'Attack with J, or click. Chain three hits for a heavy finisher.' },
  { id: 'dashed', text: 'Dash with Space. You cannot be hurt while dashing — dodge red warnings.' },
  { id: 'selected', text: 'Pick a tool: press 1–0, scroll the wheel, or tap the quick-bar. Slot 1 is your axe.' },
  { id: 'chopped', text: 'Face a tree and hold E with the axe selected to chop it. Wood is the start of everything.' },
  { id: 'mined', text: 'Select the pickaxe (slot 2) and hold E on a grey boulder to mine stone. Ore outcrops need better pickaxes.' },
  { id: 'crafted', text: 'Press C for field crafting. A Workbench needs 10 wood and 4 stone — then place it with E.' },
  { id: 'tilled', text: 'Select the hoe (slot 3) and press E on grass to till soil.' },
  { id: 'planted', text: 'Select seeds and press E on tilled soil to plant. Mind the season!' },
  { id: 'watered', text: 'Select the watering can and water your crop every day (rain does it for you).' },
  { id: 'talked', text: 'Hadamere is a village to the east — follow the road. Press E next to a villager to talk, shop and give gifts.' },
  { id: 'openedPack', text: 'Press I to open your pack, L for your journal with skills, friends and recipes.' },
];
