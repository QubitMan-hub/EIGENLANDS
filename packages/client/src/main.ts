import './style.css';
import { Game } from './game/Game';
import { Input } from './input/input';
import { loadKeys } from './input/keymap';
import {
  Net, authConfig, deleteAccount, fetchShard, googleLogin, guestLogin, resumeSession, signOut, type AuthState,
} from './net/session';
import { HTML, SettingsUI, applySettings, loadSettings } from './ui/ui';

/** single-player build (GitHub Pages): the world runs and is saved in this browser, see src/local/ */
const SOLO = import.meta.env.VITE_SOLO === '1';
const SOLO_NOTE = 'Single-player preview: your world is saved in this browser.';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

declare global {
  interface Window {
    google?: any;
    __eigen?: { state(): unknown; game: Game };
  }
}

async function boot(): Promise<void> {
  $('app').innerHTML = HTML;
  const settings = loadSettings();
  const canvas = $<HTMLCanvasElement>('game');
  const keys = loadKeys();
  const input = new Input(canvas, keys);
  const game = new Game(input, () => settings, onClosed);
  input.firstGesture = () => game.audio.unlock();
  applySettings(settings, game.audio);
  await game.init(canvas);

  let auth: AuthState | null = null;
  const msg = (t: string) => { $('login-msg').textContent = t; };

  const ui = new SettingsUI(settings, keys, (k) => { input.keys = k; }, (cb) => { input.capturing = cb; }, () => applySettings(settings, game.audio));
  ui.bind({
    signOut: () => { signOut(); location.reload(); },
    deleteAccount: async () => { if (auth) { await deleteAccount(auth.token); location.reload(); } },
    accountInfo: () => SOLO ? SOLO_NOTE : auth ? (auth.guest ? 'Playing as a guest. Progress is saved on this device — sign in with Google to keep it safe.' : 'Signed in with Google.') : '',
  });
  game.settingsOpen = () => ui.open;
  window.addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); game.toggleDebug(); } });

  function onClosed(code: number): void {
    $('lost-title').textContent = code === 4001 ? 'Signed in elsewhere' : 'Connection lost';
    $('lost-msg').textContent = code === 4001 ? 'This account joined from another window or device.' : 'The connection to the world dropped. Your progress was saved.';
    $('lost').hidden = false;
  }
  $('btn-reload').addEventListener('click', () => location.reload());

  setupTouch(input);
  $('btn-pack').addEventListener('click', () => game.gameplay.toggleInventory());
  $('btn-craft').addEventListener('click', () => game.gameplay.toggleFieldCraft());
  $('btn-journal').addEventListener('click', () => game.gameplay.toggleJournal());

  const enter = async (a: AuthState, name?: string): Promise<void> => {
    auth = a;
    msg('Entering the world…');
    const net = new Net(game.handlers);
    game.net = net;
    try {
      await net.connect(a.token, name, await fetchShard(a.token));
      await game.ready();
    } catch (e) {
      msg(`Could not join: ${(e as Error).message || 'server unreachable'}`);
      return;
    }
    $('login').hidden = true;
    $('hud').hidden = false;
    window.__eigen = { state: () => game.debugState(), game };
  };

  const cfg = await authConfig().catch(() => ({ googleClientId: null as string | null }));
  setupGoogle(cfg.googleClientId, async (idToken) => {
    try {
      const g = await googleLogin(idToken);
      if (!auth) await enter(g, ($<HTMLInputElement>('name').value || '').trim() || undefined);
      else { auth = g; $('acct-info').textContent = 'Signed in with Google — your guest progress is now linked to your account.'; }
    } catch (e) { msg(`Google sign-in failed: ${(e as Error).message}`); }
  });

  $('btn-guest').addEventListener('click', async () => {
    game.audio.unlock();
    try {
      const g = await guestLogin();
      await enter(g, ($<HTMLInputElement>('name').value || '').trim() || undefined);
    } catch (e) { msg(`Cannot reach the game server (${(e as Error).message}).`); }
  });

  const resumed = await resumeSession();
  if (resumed) {
    $<HTMLInputElement>('name').value = resumed.name ?? '';
    msg(`Welcome back${resumed.name ? ', ' + resumed.name : ''}!`);
    await enter(resumed, resumed.name);
  }
}

function setupGoogle(clientId: string | null, onCredential: (idToken: string) => void): void {
  if (SOLO) { $('g-off').hidden = false; $('g-off').textContent = SOLO_NOTE; return; }
  if (!clientId) { $('g-off').hidden = false; return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = () => {
    window.google?.accounts.id.initialize({ client_id: clientId, callback: (r: { credential: string }) => onCredential(r.credential) });
    window.google?.accounts.id.renderButton($('g-btn'), { theme: 'filled_black', size: 'large', text: 'continue_with' });
    const up = document.getElementById('g-upgrade');
    if (up) window.google?.accounts.id.renderButton(up, { theme: 'outline', size: 'medium', text: 'signin_with' });
  };
  s.onerror = () => { $('g-off').hidden = false; $('g-off').textContent = 'Google sign-in could not be loaded.'; };
  document.head.append(s);
}

function setupTouch(input: Input): void {
  if (!matchMedia('(pointer: coarse)').matches) return;
  $('touch').hidden = false;
  const stick = $('stick'), knob = $('knob');
  let active: number | null = null;
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    const dead = Math.hypot(dx, dy) < 0.15;
    input.setStick(dead ? 0 : dx, dead ? 0 : dy);
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { active = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === active) move(e); });
  const end = (e: PointerEvent) => { if (e.pointerId === active) { active = null; input.setStick(0, 0); knob.style.transform = ''; } };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  document.querySelectorAll<HTMLButtonElement>('#tbtns button').forEach((b) => {
    const a = b.dataset.a as 'attack' | 'skill' | 'dash' | 'interact';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); input.touch(a, true); });
    const up = () => input.touch(a, false);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
}

boot().catch((e) => {
  console.error(e);
  const m = document.getElementById('login-msg');
  if (m) m.textContent = `Startup failed: ${(e as Error).message}`;
});
