import { EXT_ACTIONS, type Action, type KeyMap } from './keymap';
import type { LocalInput } from '../net/prediction';

const BUFFER_MS = 160;

export interface InputReading extends LocalInput {
  interact: boolean;
  usedKeyboardOrPad: boolean;
}

/** Unifies keyboard, mouse, gamepad and on-screen touch controls into one LocalInput per tick. */
export class Input {
  private down = new Set<string>();
  private buffered = new Map<Action, number>();
  private mouse = { x: 0, y: 0, lastMove: -1, left: false, right: false };
  private stick = { x: 0, y: 0 };
  private touchHeld = new Set<Action>();
  private padPrev: boolean[] = [];
  keys: KeyMap;
  enabled = true;
  /** UI hooks (quick-bar digits, wheel, panel hotkeys) */
  onHotbar: ((i: number) => void) | null = null;
  onCycle: ((dir: number) => void) | null = null;
  onPanel: ((a: 'inventory' | 'journal' | 'craft') => void) | null = null;
  /** Phase 3/4 actions: abilities, ultimate, board, chat, party (keys, gamepad and touch) */
  onAction: ((a: typeof EXT_ACTIONS[number]) => void) | null = null;
  private interactDown = false;
  /** ability armed with its key: the next left click fires it at the cursor (Esc or the same key disarms) */
  armed: typeof EXT_ACTIONS[number] | null = null;
  onArmChange: ((a: typeof EXT_ACTIONS[number] | null) => void) | null = null;
  /** left click while an ability is armed: fire it at the cursor */
  onFire: ((a: typeof EXT_ACTIONS[number]) => void) | null = null;
  /** left click on the world (not firing an armed ability) */
  onWorldClick: ((x: number, y: number) => void) | null = null;
  onClearTarget: (() => void) | null = null;
  arm(a: typeof EXT_ACTIONS[number] | null): void { this.setArmed(a); }
  private setArmed(a: typeof EXT_ACTIONS[number] | null): void { if (this.armed !== a) { this.armed = a; this.onArmChange?.(a); } }
  /** right mouse held: look ahead toward the cursor */
  get lookHeld(): boolean { return this.mouse.right; }
  /** where the player is on screen, for mouse aiming (CSS px) */
  playerScreen = { x: 0, y: 0 };
  /** optional aim assist used by touch and gamepad */
  autoAim: (() => { x: number; y: number } | null) | null = null;
  firstGesture: (() => void) | null = null;
  capturing: ((code: string) => void) | null = null;

  /** Drop held and queued gestures when focus or orientation changes. */
  reset(): void {
    this.down.clear(); this.buffered.clear(); this.touchHeld.clear();
    this.setStick(0, 0); this.mouse.left = this.mouse.right = false;
    this.interactDown = false; this.setArmed(null);
  }

  constructor(private el: HTMLElement, keys: KeyMap) {
    this.keys = keys;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.reset());
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastMove = performance.now(); } });
    el.addEventListener('pointerdown', (e) => {
      this.firstGesture?.();
      if (e.pointerType !== 'mouse') return;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastMove = performance.now();
      if (e.button === 0) {
        if (this.armed) { const a = this.armed; this.setArmed(null); this.onFire?.(a); }
        else { this.mouse.left = true; this.buffer('attack'); this.onWorldClick?.(e.clientX, e.clientY); }
      }
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('pointerup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { this.onCycle?.(e.deltaY > 0 ? 1 : -1); e.preventDefault(); }, { passive: false });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.capturing) { e.preventDefault(); const c = this.capturing; this.capturing = null; c(e.code); return; }
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(e.code) && (e.target as HTMLElement).matches?.('[tabindex="0"][role="region"]')) return;
    if (tag === 'BUTTON' && ['Space', 'Enter'].includes(e.code) && (e.target as HTMLElement).closest?.('[role="dialog"], #hud-menu, #hud-actions')) return;
    this.firstGesture?.();
    if (e.repeat) { if (this.isBound(e.code)) e.preventDefault(); return; }
    this.down.add(e.code);
    for (const a of ['attack', 'skill', 'dash', 'interact'] as Action[]) if (this.keys[a].includes(e.code)) { this.buffer(a); e.preventDefault(); }
    if (/^Digit[0-9]$/.test(e.code)) { this.onHotbar?.((Number(e.code.slice(5)) + 9) % 10); e.preventDefault(); }
    if (this.keys.prev.includes(e.code)) this.onCycle?.(-1);
    if (this.keys.next.includes(e.code)) this.onCycle?.(1);
    for (const a of ['inventory', 'journal', 'craft'] as const) if (this.keys[a].includes(e.code)) { this.onPanel?.(a); e.preventDefault(); }
    if (e.code === 'Escape') { if (this.armed) this.setArmed(null); else this.onClearTarget?.(); }
    for (const a of EXT_ACTIONS) if (this.keys[a].includes(e.code)) {
      // an armed ability's own key cancels it; otherwise the module decides: cast now (quick / auto-aimed) or arm the aim
      if (this.armed === a) this.setArmed(null);
      else { this.setArmed(null); this.onAction?.(a); }
      e.preventDefault();
    }
    if (this.isBound(e.code)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent): void => { this.down.delete(e.code); };
  private isBound(code: string): boolean { return Object.values(this.keys).some((l) => l.includes(code)); }
  private buffer(a: Action): void { this.buffered.set(a, performance.now() + BUFFER_MS); }

  /** Called by the on-screen touch UI. */
  setStick(x: number, y: number): void { this.stick.x = x; this.stick.y = y; }
  touch(a: Action, held: boolean): void {
    if (held) { this.touchHeld.add(a); this.buffer(a); this.firstGesture?.(); } else this.touchHeld.delete(a);
  }

  private isDown(a: Action): boolean { return this.keys[a].some((k) => this.down.has(k)); }

  private consume(a: Action, now: number): boolean {
    const exp = this.buffered.get(a);
    if (exp !== undefined) {
      this.buffered.delete(a);
      if (exp >= now) return true;
    }
    return false;
  }

  /** mouse tile under the cursor (set by the game each frame), for cursor-targeted tool use */
  mouseTile: { tx: number; ty: number } | null = null;
  get mouseXY(): { x: number; y: number } { return { x: this.mouse.x, y: this.mouse.y }; }
  get mouseActive(): boolean { return this.mouse.lastMove > 0; }
  get interactHeld(): boolean { return this.isDown('interact') || this.touchHeld.has('interact'); }

  read(now = performance.now()): InputReading {
    const r: InputReading = { dx: 0, dy: 0, dash: false, attack: false, hold: false, skill: false, aimX: 0, aimY: 0, interact: false, usedKeyboardOrPad: false };
    if (!this.enabled) { this.buffered.clear(); return r; }
    let dx = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let dy = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    if (dx || dy) r.usedKeyboardOrPad = true;

    // gamepad
    let padAttack = false, padAttackEdge = false, padSkill = false, padDash = false, padInteract = false;
    let padAim: { x: number; y: number } | null = null;
    const pad = navigator.getGamepads?.().find((p) => !!p);
    if (pad) {
      const ax = Math.abs(pad.axes[0] ?? 0) > 0.2 ? pad.axes[0]! : 0;
      const ay = Math.abs(pad.axes[1] ?? 0) > 0.2 ? pad.axes[1]! : 0;
      if (ax || ay) { dx = ax; dy = ay; r.usedKeyboardOrPad = true; }
      const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.35) padAim = { x: rx, y: ry };
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const edge = (i: number) => b(i) && !this.padPrev[i];
      padAttack = b(0) || b(7); padAttackEdge = edge(0) || edge(7); padSkill = b(2) || b(6); padDash = edge(1); padInteract = edge(3);
      if (edge(4)) this.onCycle?.(-1);
      if (edge(5)) this.onCycle?.(1);
      if (edge(9)) this.onPanel?.('inventory');
      // d-pad: orb abilities 1-4; stick clicks: ultimate; select: Circuit Board
      ([[12, 'ability1'], [15, 'ability2'], [13, 'ability3'], [14, 'ability4'], [10, 'ultimate'], [11, 'ultimate'], [8, 'board']] as const)
        .forEach(([i, a]) => { if (edge(i)) this.onAction?.(a); });
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }

    if (this.stick.x || this.stick.y) { dx = this.stick.x; dy = this.stick.y; }
    // keys/sticks are screen-relative (W = up the screen): rotate into iso world axes
    const ln = Math.hypot(dx, dy);
    if (ln > 0) { const wx = (dx + dy) * Math.SQRT1_2, wy = (dy - dx) * Math.SQRT1_2; const wl = Math.hypot(wx, wy) || 1; const m = Math.min(1, ln); dx = (wx / wl) * m; dy = (wy / wl) * m; }
    r.dx = dx; r.dy = dy;

    const attackHeld = this.isDown('attack') || this.mouse.left || this.touchHeld.has('attack') || padAttack;
    const skillHeld = this.isDown('skill') || this.touchHeld.has('skill') || padSkill;
    // attack = a press (tap: 3-hit combo, buffered by the sim); hold = still held (charges a heavy, released to strike)
    r.attack = this.consume('attack', now) || padAttackEdge;
    r.hold = attackHeld;
    r.skill = skillHeld || this.consume('skill', now);
    r.dash = this.consume('dash', now) || padDash;
    r.interact = this.consume('interact', now) || padInteract;
    this.buffered.delete('attack'); this.buffered.delete('skill');

    // aiming: recent mouse > right stick > auto-aim (touch/pad) > facing (server falls back to face)
    const toWorld = (sx: number, sy: number) => ({ x: sy / 16 + sx / 32, y: sy / 16 - sx / 32 }); // screen delta -> world delta (iso)
    if (padAim) { const a = toWorld(padAim.x, padAim.y); r.aimX = a.x; r.aimY = a.y; }
    else if (this.mouse.lastMove > 0 && !this.touchHeld.size) {
      const a = toWorld(this.mouse.x - this.playerScreen.x, this.mouse.y - this.playerScreen.y); r.aimX = a.x; r.aimY = a.y;
    } else if ((r.attack || r.hold || r.skill) && this.autoAim) {
      const t = this.autoAim();
      if (t) { r.aimX = t.x; r.aimY = t.y; }
    }
    return r;
  }

  /** Where the player is aiming right now (world-space unit vector); `face` when nothing aims. */
  aimNow(face: { x: number; y: number }): { x: number; y: number } {
    const toWorld = (sx: number, sy: number) => ({ x: sy / 16 + sx / 32, y: sy / 16 - sx / 32 });
    let a: { x: number; y: number } | null = null;
    const pad = navigator.getGamepads?.().find((p) => !!p);
    if (pad && Math.hypot(pad.axes[2] ?? 0, pad.axes[3] ?? 0) > 0.35) a = toWorld(pad.axes[2]!, pad.axes[3]!);
    else if (this.mouse.lastMove > 0 && !this.touchHeld.size) a = toWorld(this.mouse.x - this.playerScreen.x, this.mouse.y - this.playerScreen.y);
    else if (this.autoAim) a = this.autoAim();
    const l = a ? Math.hypot(a.x, a.y) : 0;
    return a && l > 1e-6 ? { x: a.x / l, y: a.y / l } : face;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
