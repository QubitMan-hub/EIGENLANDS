import { afterEach, expect, it, vi } from 'vitest';
import { Input } from '../src/input/input';
import { DEFAULT_KEYS } from '../src/input/keymap';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  const win = new EventTarget(),
    canvas = new EventTarget();
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  const input = new Input(canvas as HTMLElement, DEFAULT_KEYS);
  input.playerScreen = { x: 100, y: 100 };
  input.feetScreen = { x: 100, y: 100 };
  input.worldScale = 1;
  const event = (target: EventTarget, name: string, props: object = {}) =>
    target.dispatchEvent(Object.assign(new Event(name, { cancelable: true }), props));
  const point = (name: string, x = 132, y = 116, button = 2) =>
    event(name === 'pointerup' ? win : canvas, name, { pointerType: 'mouse', clientX: x, clientY: y, button });
  const key = (name: string, code: string) => event(win, name, { code });
  return { input, win, canvas, event, point, key };
}
it('right click attacks (tap = combo press, held = charge) and shows the aim; left click holds guard', () => {
  const { input, point, key } = setup();
  point('pointerdown');
  expect(input.lookHeld).toBe(true);
  expect(input.read()).toMatchObject({ dx: 0, dy: 0, attack: true, hold: true, guard: false, skill: false });
  expect(input.read()).toMatchObject({ attack: false, hold: true });
  point('pointerup');
  expect(input.read()).toMatchObject({ attack: false, hold: false });
  point('pointerdown', 132, 116, 0);
  expect(input.read()).toMatchObject({ attack: false, hold: false, guard: true });
  point('pointerup', 132, 116, 0);
  expect(input.read().guard).toBe(false);
  key('keydown', 'KeyW');
  expect(input.read().dy).toBeCloseTo(-Math.SQRT1_2);
  key('keyup', 'KeyW');
});
it('steers toward the ground cursor in authentic iso space with the middle button, and stops on release', () => {
  const { input, point } = setup();
  input.setMovementMode('mouse');
  point('pointerdown', 132, 116, 1);
  expect(input.read()).toMatchObject({ dx: 1, dy: 0, attack: false, skill: false });
  point('pointermove', 68, 84);
  expect(input.read()).toMatchObject({ dx: -1, dy: 0 });
  point('pointermove', 104, 102);
  expect(input.read().dx).toBeGreaterThan(0);
  expect(input.read().dx).toBeLessThan(0.5);
  point('pointermove', 100, 100);
  expect(input.read()).toMatchObject({ dx: 0, dy: 0 });
  point('pointermove');
  point('pointerup', 132, 116, 1);
  expect(input.read()).toMatchObject({ dx: 0, dy: 0 });
});
it('does not drift with zoom or camera offset and keeps keyboard/touch overrides', () => {
  const { input, point, key } = setup();
  input.setMovementMode('mouse');
  input.feetScreen = { x: 300, y: 220 };
  input.worldScale = 3;
  point('pointerdown', 396, 268, 1);
  expect(input.read()).toMatchObject({ dx: 1, dy: 0 });
  key('keydown', 'KeyW');
  expect(input.read().dy).toBeLessThan(0);
  key('keyup', 'KeyW');
  input.setStick(-1, 0);
  expect(input.read().dx).toBeLessThan(0);
});
it('drops held and queued controls on cancellation, leaving the canvas, blur and switching modes', () => {
  for (const why of ['pointercancel', 'pointerleave', 'blur', 'mode']) {
    const { input, point, event, canvas, win } = setup();
    input.setMovementMode('mouse');
    point('pointerdown', 132, 116, 1);
    point('pointerdown');
    point('pointerdown', 132, 116, 0);
    expect(input.read().dx).toBeGreaterThan(0);
    if (why === 'mode') input.setMovementMode('keyboard');
    else event(why === 'blur' ? win : canvas, why);
    expect(input.read()).toMatchObject({ dx: 0, dy: 0, attack: false, hold: false, guard: false });
    expect(input.lookHeld).toBe(false);
  }
});
it('confirms an armed skill at the click coordinates without raising guard or attacking', () => {
  const { input, point } = setup(),
    fire = vi.fn(() => expect(input.mouseXY).toEqual({ x: 210, y: 180 }));
  input.onFire = fire;
  input.arm('ability1');
  point('pointerdown', 210, 180, 0);
  expect(fire).toHaveBeenCalledWith('ability1');
  expect(input.armed).toBeNull();
  expect(input.read()).toMatchObject({ attack: false, hold: false, guard: false });
  point('pointerup', 210, 180, 0);
  point('pointerdown', 210, 180, 0);
  expect(input.read()).toMatchObject({ attack: false, guard: true });
});
it('resets and refuses combat/movement while UI blocks gameplay, without replaying it afterward', () => {
  const { input, point, key } = setup(),
    fire = vi.fn();
  input.onFire = fire;
  input.setMovementMode('mouse');
  point('pointerdown');
  input.arm('ability1');
  input.blocked = () => true;
  expect(input.read()).toMatchObject({ dx: 0, dy: 0 });
  point('pointerdown', 210, 180, 0);
  key('keydown', 'KeyJ');
  expect(fire).not.toHaveBeenCalled();
  input.blocked = () => false;
  expect(input.read()).toMatchObject({ dx: 0, dy: 0, attack: false, hold: false });
  expect(input.armed).toBeNull();
});
it('keeps gamepad orb presses direct and edge-triggered without a mouse confirmation', () => {
  const { input } = setup(),
    buttons = Array.from({ length: 16 }, () => ({ pressed: false })),
    action = vi.fn();
  buttons[12]!.pressed = true;
  vi.stubGlobal('navigator', { getGamepads: () => [{ axes: [0, 0, 0, 0], buttons }] });
  input.onAction = action;
  input.read();
  expect(action).toHaveBeenCalledWith('ability1', true);
  action.mockClear();
  input.read();
  expect(action).not.toHaveBeenCalled();
});
it('can steer with the middle button while aiming and confirming a skill with LMB', () => {
  const { input, point } = setup(),
    fire = vi.fn();
  input.setMovementMode('mouse');
  input.onFire = fire;
  input.arm('ability1');
  point('pointerdown', 132, 116, 1);
  expect(input.armed).toBe('ability1');
  expect(input.read().dx).toBeGreaterThan(0);
  point('pointerdown', 132, 116, 0);
  expect(fire).toHaveBeenCalledWith('ability1');
  expect(input.read()).toMatchObject({ dx: 1, attack: false, hold: false, guard: false });
});
it('retains a short foreground click through a slow render frame and consumes it exactly once', () => {
  const { input, point } = setup();
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  point('pointerdown');
  point('pointerup');
  expect(input.read(1600).attack).toBe(true);
  expect(input.read(1650).attack).toBe(false);
  vi.restoreAllMocks();
});
it('discards pending clicks when a desktop tab becomes hidden before the next frame', () => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', doc);
  const { input, point } = setup();
  input.setMovementMode('mouse');
  point('pointerdown');
  point('pointerup');
  point('pointerdown', 132, 116, 1);
  input.arm('ability1');
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  doc.hidden = false;
  expect(input.read()).toMatchObject({ dx: 0, dy: 0, attack: false, hold: false });
  expect(input.armed).toBeNull();
});
it('consumes a mining click without raising guard; a plain left click guards, never attacks', () => {
  const { input, point } = setup();
  input.onWorldClick = () => true;
  point('pointerdown', 132, 116, 0);
  expect(input.read()).toMatchObject({ attack: false, hold: false, guard: false });
  point('pointerup', 132, 116, 0);
  input.onWorldClick = () => false;
  point('pointerdown', 132, 116, 0);
  expect(input.read()).toMatchObject({ attack: false, hold: false, guard: true });
});
