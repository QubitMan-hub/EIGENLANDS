import {validGraphics,validWeather,type GraphicsMode,type WeatherDetail} from '../game/visual-budget';
import './fonts';
import './hud.css';
import { iconSvg } from './icons';
import { validMovementMode, type MovementMode } from '../input/input';
import { ACTIONS, ACTION_LABELS, keyLabel, rebind, saveKeys, type Action, type KeyMap } from '../input/keymap';

export interface Settings {
  graphics: GraphicsMode;
  weatherDetail: WeatherDetail;
  movementMode: MovementMode;
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
    graphics: 'auto', weatherDetail: 'gentle',
    movementMode: 'keyboard',
    reducedMotion: matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    textScale: 1, colorblind: 'off', muted: false, captions: false, volume: 0.5, highContrastHud: false,
  };
  try { const s = { ...d, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) }; return { ...s, movementMode: validMovementMode(s.movementMode), graphics: validGraphics(s.graphics), weatherDetail:validWeather(s.weatherDetail) }; } catch { return d; }
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
  <filter id="decohere" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter>
</svg>
<div id="hud" hidden>
  <div id="hud-left">
    <div class="orbinfo">
      <b id="hud-name" class="pname">-</b>
      <div id="orb" class="orbwrap" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="60" aria-valuenow="60"></div>
      <div class="xpbar" aria-hidden="true"><i id="xp-orb"></i></div>
      <div class="statrow"><span class="gate" id="hud-level">Lv 1</span><span class="coinrow">${iconSvg('coin', 16)}<span id="coins">0 coins</span></span></div>
      <div id="needs-hud" hidden>
        <label>Food <b id="needs-food-value">100</b><progress id="needs-food" aria-label="Food" max="100" value="100"></progress></label>
        <label>Water <b id="needs-water-value">100</b><progress id="needs-water" aria-label="Water" max="100" value="100"></progress></label>
      </div>
      <div id="buffs"></div>
    </div>
    <div class="legacy" aria-hidden="true"><i id="hp-fill"></i><span id="hp-text"></span><i id="xp-fill"></i><span id="clock"></span></div>
  </div>
  <div id="hud-right">
    <div id="dial" class="dialwrap"><div id="dial-time" class="dialtime">--:--</div></div>
    <div id="dayinfo" class="dayinfo"></div>
    <div id="townhint" class="townhint"></div>
    <div id="wx" class="wxrow"></div>
  </div>
  <div id="hud-actions">
    <button id="btn-journal" class="gatebtn journal-shortcut" aria-label="Journal (L)" title="Quests and guidance">${iconSvg('book', 20)}<span>Journal</span></button>
    <button id="btn-menu" class="gatebtn" popovertarget="hud-menu">Menu</button>
  </div>
  <div id="hud-menu" popover aria-label="Game menu">
  <div id="hud-btns">
    <button id="btn-settings" class="gatebtn" aria-label="Settings" title="Settings">${iconSvg('gear', 20)}</button>
    <button id="btn-pack" class="gatebtn" aria-label="Pack (I)" title="Pack (I)">${iconSvg('pack', 20)}<kbd>I</kbd></button>
    <button id="btn-craft" class="gatebtn" aria-label="Field crafting (C)" title="Field crafting (C)">${iconSvg('hammer', 20)}<kbd>C</kbd></button>
  </div>
  </div>
  <div id="hint" class="panel node-hint" hidden role="status"></div>
  <div id="captions" aria-live="polite"></div>
  <div id="debug" class="panel" hidden></div>
  <div id="vignette"></div>
</div>
<div id="touch" hidden>
  <div id="stick"><div id="knob"></div></div>
  <div id="tbtns">
    <button data-a="attack" aria-label="Attack">${iconSvg('sword', 26)}</button>
    <button data-a="skill" aria-label="Skill shot">${iconSvg('bolt', 24)}</button>
    <button data-a="dash" aria-label="Dash">${iconSvg('dash', 24)}</button>
    <button data-a="interact" aria-label="Use">${iconSvg('hand', 22)}</button>
  </div>
</div>
<div id="rotate-device" role="region" aria-label="Landscape play">
  <div class="panel"><h2>A wider world awaits</h2><p>Turn your phone sideways to explore EIGENLANDS with room for both hands.</p>
  <button id="btn-landscape" class="primary">Enter landscape</button>
  <button id="btn-portrait">Continue in portrait</button><p id="rotate-note" class="small" role="status"></p></div>
</div>
<div id="login" class="overlay title">
  <div class="stars" aria-hidden="true"></div><div class="traces" aria-hidden="true"></div>
  <div class="title-card">
    <div class="qubit" aria-hidden="true">
      <svg viewBox="-50 -50 100 100"><circle r="30" class="q-core"/><ellipse rx="44" ry="14" class="q-orbit"/><ellipse rx="44" ry="14" class="q-orbit" transform="rotate(60)"/><ellipse rx="44" ry="14" class="q-orbit" transform="rotate(120)"/><circle r="4" class="q-e e1"/><circle r="4" class="q-e e2"/><circle r="4" class="q-e e3"/><path class="q-arrow" d="M0 0 L16 -18"/><circle cx="16" cy="-18" r="3" class="q-tip"/></svg>
    </div>
    <h1 class="wordmark" aria-label="EIGENLANDS"><span>EIGEN</span><span>LANDS</span></h1>
    <div class="trace-rule" aria-hidden="true"></div>
    <p class="tag">An infinite world where every skill is a quantum circuit.</p>
    <div class="menu panel">
      <label for="name">Name your wanderer</label>
      <input id="name" maxlength="16" autocomplete="off" placeholder="Wanderer" />
      <p id="play-mode" class="small"></p><p id="server-address" class="small"></p>
      <button id="btn-guest" class="primary big">${iconSvg('spark', 16)} Play</button>
      <details class="friends-menu"><summary>Play with friends</summary>
        <p class="small">Join the same online world. Solo saves stay separate.</p>
        <label for="friend-server">Game server address</label>
        <input id="friend-server" type="url" autocomplete="url" placeholder="https://play.example.com" />
        <button id="btn-join-server">Join server</button>
        <button id="btn-invite" hidden>Copy friend invite</button>
        <button id="btn-solo" hidden>Return to solo world</button>
      </details>
      <div id="google-slot"><div id="g-btn"></div><p id="g-off" class="small" hidden>Google sign-in isn't configured on this server. Guest progress is saved on this device and can be upgraded later.</p></div>
      <button id="btn-title-settings">${iconSvg('gear', 14)} Settings</button>
      <p id="login-msg" class="small" role="alert"></p>
    </div>
    <div class="credits">v0.2 &middot; Hail QubitMan</div>
  </div>
</div>
<div id="settings" class="overlay soft-modal" hidden>
  <div class="window panel wide" role="dialog" aria-label="Settings">
    <div class="win-head"><div class="win-title">Settings</div></div>
    <div class="win-body">
    <div class="grid">
      <section><h3>Controls</h3>
        <label for="s-movement">Movement controls</label><select id="s-movement" aria-describedby="movement-help"><option value="keyboard">WASD / keyboard</option><option value="mouse">Mouse — hold right button</option></select>
        <p id="movement-help" class="small dim">Keyboard: your movement keys; right button aims without moving the camera. Mouse: hold right button to move toward the cursor; release to stop. Movement keys, touch and gamepad remain available.</p>
        <p class="small dim">Left click attacks or shoots at the cursor. Select an axe or pickaxe and click a tree or rock to approach and gather until it breaks. Click ripe crops or forage to harvest; hoes and watering cans can also act on clicked ground. Movement, Dodge, another click or changing tools cancels. Select a fishing rod near water and press Space (or your interaction key) to cast. Directional orbs: press their key, aim, then left click to cast. Escape or the same key cancels. Self abilities cast immediately.</p>
        <div id="keys"></div><p class="small dim">Click a control below, then press the new key. Your custom bindings are kept when changing movement controls.</p></section>
      <section><h3>Visuals &amp; accessibility</h3>
        <label for="s-graphics">Graphics</label><select id="s-graphics"><option value="auto">Auto · lighter on phones</option><option value="economy">Economy · faster, quieter terrain</option><option value="high">High · full terrain detail</option></select>
        <p class="small dim">Economy reduces canvas resolution and background detail while keeping crisp sprites, collision and combat warnings.</p>
        <label for="s-weather">Weather effects</label><select id="s-weather"><option value="gentle">Gentle</option><option value="full">Full</option><option value="off">Off</option></select>
        <label class="tog"><input type="checkbox" id="s-motion"> Reduce motion (no shake, fewer particles, still water)</label>
        <label>Text size <select id="s-text"><option value="1">Normal</option><option value="1.25">Large</option><option value="1.5">Extra large</option></select></label>
        <label>Colour-blind mode <select id="s-cb"><option value="off">Off</option><option value="protan">Protanopia (red-weak)</option><option value="deutan">Deuteranopia (green-weak)</option><option value="tritan">Tritanopia (blue-weak)</option></select></label>
        <label class="tog"><input type="checkbox" id="s-hc"> High-contrast HUD</label>
        <label class="tog"><input type="checkbox" id="s-cap"> Sound captions</label>
        <label class="tog"><input type="checkbox" id="s-mute"> Mute sound</label>
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
</div>
<div id="lost" class="overlay" hidden><div class="panel lostbox"><h2 id="lost-title">Connection lost</h2><p id="lost-msg" class="small"></p><button id="btn-reload" class="primary">Reconnect</button></div></div>
<div id="dead" class="overlay soft" hidden><div class="panel deadbox"><h2>Wavefunction collapsed</h2><p class="small">You were defeated. Respawning at the shrine&hellip; Tip: dash through a glowing red warning to dodge it.</p></div></div>
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
    // Dismiss before the chosen window records its focus-return target.
    const dismissMenu = () => {
      if (!$('hud-menu').matches(':popover-open')) return;
      $('hud-menu').hidePopover();
      $('btn-menu').focus();
    };
    $('hud-btns').addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('button')) dismissMenu();
    }, { capture: true });
    window.addEventListener('keydown', e => {
      if ((['inventory', 'journal', 'craft', 'map', 'board'] as const).some(a => this.keys[a].includes(e.code))) dismissMenu();
    }, { capture: true });
    const s = this.settings;
    $<HTMLSelectElement>('s-graphics').value = s.graphics;
    $<HTMLSelectElement>('s-weather').value = s.weatherDetail;
    $<HTMLSelectElement>('s-movement').value = s.movementMode;
    $<HTMLInputElement>('s-motion').checked = s.reducedMotion;
    $<HTMLSelectElement>('s-text').value = String(s.textScale);
    $<HTMLSelectElement>('s-cb').value = s.colorblind;
    $<HTMLInputElement>('s-hc').checked = s.highContrastHud;
    $<HTMLInputElement>('s-cap').checked = s.captions;
    $<HTMLInputElement>('s-mute').checked = s.muted;
    $<HTMLInputElement>('s-vol').value = String(Math.round(s.volume * 100));
    const upd = () => {
      s.graphics = validGraphics($<HTMLSelectElement>('s-graphics').value);
      s.weatherDetail = validWeather($<HTMLSelectElement>('s-weather').value);
      s.movementMode = validMovementMode($<HTMLSelectElement>('s-movement').value);
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
    for (const id of ['s-graphics', 's-weather', 's-movement', 's-motion', 's-text', 's-cb', 's-hc', 's-cap', 's-mute', 's-vol']) $(id).addEventListener('input', upd);
    $('btn-signout').addEventListener('click', handlers.signOut);
    $('btn-delete').addEventListener('click', () => {
      if (confirm('Delete your account, character and all saved data? This cannot be undone.')) handlers.deleteAccount();
    });
    $('btn-settings').addEventListener('click', () => { $('acct-info').textContent = handlers.accountInfo(); this.renderKeys(); this.show(true); });
    $('btn-close').addEventListener('click', () => this.show(false));
    document.getElementById('btn-title-settings')?.addEventListener('click', () => { $('acct-info').textContent = handlers.accountInfo(); this.renderKeys(); this.show(true); });
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
  document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
  const cv = $('game');
  cv.style.filter = s.colorblind === 'off' ? '' : `url(#cb-${s.colorblind})`;
  audio.muted = s.muted;
  audio.volume = s.volume;
}

export interface Acts {
  moved: boolean; attacked: boolean; dashed: boolean; selected: boolean; chopped: boolean; mined: boolean; tilled: boolean;
  planted: boolean; watered: boolean; crafted: boolean; talked: boolean; fished: boolean; forged: boolean; harvested: boolean; openedPack: boolean;
  quest: boolean; journal: boolean; statue: boolean; board: boolean; sold: boolean; openedMap: boolean; arrived: boolean; openedCircuit: boolean; orbCast: boolean; skillShot: boolean;
}
export const freshActs = (): Acts => ({ moved: false, attacked: false, dashed: false, selected: false, chopped: false, mined: false, tilled: false, planted: false, watered: false, crafted: false, talked: false, fished: false, forged: false, harvested: false, openedPack: false, quest: false, journal: false, statue: false, board: false, sold: false, openedMap: false, arrived: false, openedCircuit: false, orbCast: false, skillShot: false });

/** One hint at a time, in order. Steps already done (and persisted) are skipped. */
export const TUTORIAL: ReadonlyArray<{ id: keyof Acts; text: string }> = [
  { id: 'moved', text: 'Move with WASD or the arrow keys (touch: left stick).' },
  { id: 'attacked', text: 'Attack with {attack}, or click. Chain three hits for a heavy finisher.' },
  { id: 'dashed', text: 'Dash with {dash}. You cannot be hurt while dashing — dodge red warnings.' },
  { id: 'selected', text: 'Pick a tool: press 1–0, scroll the wheel, or tap the quick-bar. Slot 1 is your axe.' },
  { id: 'chopped', text: 'Face a tree and hold {interact} with the axe selected to chop it. Wood is the start of everything.' },
  { id: 'mined', text: 'Select the pickaxe (slot 2) and hold {interact} on a grey boulder to mine stone. Ore outcrops need better pickaxes.' },
  { id: 'crafted', text: 'Press {craft} for field crafting. A Workbench needs 10 wood and 4 stone — then place it with {interact}.' },
  { id: 'tilled', text: 'Select the hoe (slot 3) and press {interact} on grass to till soil.' },
  { id: 'planted', text: 'Select seeds and press {interact} on tilled soil to plant. Mind the season!' },
  { id: 'watered', text: 'Select the watering can and water your crop every day (rain does it for you).' },
  { id: 'talked', text: 'The village of Hadamere is nearby: follow the arrow next to the clock (top right). Walk up to a villager and press {interact} to talk. Mayor Orla welcomes newcomers.' },
  { id: 'quest', text: 'Villagers with a yellow ! have tasks. In a conversation, pick the quest and choose "I\'ll do it!". Your objectives and progress are in the Journal (Quests tab).' },
  { id: 'openedPack', text: 'Press {inventory} to open your pack (equip rings and outfits there).' },
  { id: 'journal', text: 'Press {journal} for your Journal: quests, skills, friends, recipes, and a "How to…" guide for every system.' },
  { id: 'statue', text: 'The statue in the middle of the plaza is QubitMan, Hadamere\'s legendary founder. Walk up to it and press {interact} to read his plaque.' },
  { id: 'board', text: 'The notice board on the plaza is the request board: three new paid jobs every morning. Press {interact} at it.' },
];
