import type { Action, KeyMap } from './keymap';
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
  private mouse = { x: 0, y: 0, lastMove: -1e9, left: false, right: false };
  private stick = { x: 0, y: 0 };
  private touchHeld = new Set<Action>();
  private padPrev: boolean[] = [];
  keys: KeyMap;
  enabled = true;
  /** where the player is on screen, for mouse aiming (CSS px) */
  playerScreen = { x: 0, y: 0 };
  /** optional aim assist used by touch and gamepad */
  autoAim: (() => { x: number; y: number } | null) | null = null;
  firstGesture: (() => void) | null = null;
  capturing: ((code: string) => void) | null = null;

  constructor(private el: HTMLElement, keys: KeyMap) {
    this.keys = keys;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; });
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastMove = performance.now(); } });
    el.addEventListener('pointerdown', (e) => {
      this.firstGesture?.();
      if (e.pointerType !== 'mouse') return;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastMove = performance.now();
      if (e.button === 0) { this.mouse.left = true; this.buffer('attack'); }
      if (e.button === 2) { this.mouse.right = true; this.buffer('skill'); }
    });
    window.addEventListener('pointerup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.capturing) { e.preventDefault(); const c = this.capturing; this.capturing = null; c(e.code); return; }
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    this.firstGesture?.();
    if (e.repeat) { if (this.isBound(e.code)) e.preventDefault(); return; }
    this.down.add(e.code);
    for (const a of ['attack', 'skill', 'dash', 'interact'] as Action[]) if (this.keys[a].includes(e.code)) { this.buffer(a); e.preventDefault(); }
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

  read(now = performance.now()): InputReading {
    const r: InputReading = { dx: 0, dy: 0, dash: false, attack: false, skill: false, aimX: 0, aimY: 0, interact: false, usedKeyboardOrPad: false };
    if (!this.enabled) { this.buffered.clear(); return r; }
    let dx = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let dy = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    if (dx || dy) r.usedKeyboardOrPad = true;

    // gamepad
    let padAttack = false, padSkill = false, padDash = false, padInteract = false;
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
      padAttack = b(0) || b(7); padSkill = b(2) || b(6); padDash = edge(1) || edge(5); padInteract = edge(3);
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }

    if (this.stick.x || this.stick.y) { dx = this.stick.x; dy = this.stick.y; }
    r.dx = dx; r.dy = dy;

    const attackHeld = this.isDown('attack') || this.mouse.left || this.touchHeld.has('attack') || padAttack;
    const skillHeld = this.isDown('skill') || this.mouse.right || this.touchHeld.has('skill') || padSkill;
    r.attack = attackHeld || this.consume('attack', now);
    r.skill = skillHeld || this.consume('skill', now);
    r.dash = this.consume('dash', now) || padDash;
    r.interact = this.consume('interact', now) || padInteract;
    this.buffered.delete('attack'); this.buffered.delete('skill');

    // aiming: recent mouse > right stick > auto-aim (touch/pad) > facing (server falls back to face)
    if (padAim) { r.aimX = padAim.x; r.aimY = padAim.y; }
    else if (now - this.mouse.lastMove < 4000 && !this.touchHeld.size) {
      r.aimX = this.mouse.x - this.playerScreen.x; r.aimY = this.mouse.y - this.playerScreen.y;
    } else if ((r.attack || r.skill) && this.autoAim) {
      const t = this.autoAim();
      if (t) { r.aimX = t.x; r.aimY = t.y; }
    }
    return r;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
