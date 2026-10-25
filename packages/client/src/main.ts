import './style.css';
import { MSG, packAppearance, type Appearance } from '@eigenlands/shared';
import { IS_SOLO, HAS_SOLO, SERVER_URL, SERVER_ERROR, friendInvite, gameServerUrl } from './net/world-session';
import { Game } from './game/Game';
import { Input } from './input/input';
import { loadKeys } from './input/keymap';
import {
  Net,
  authConfig,
  deleteAccount,
  fetchShard,
  googleLogin,
  guestLogin,
  resumeSession,
  signOut,
  type AuthState,
} from './net/session';
import { mountTitleScene } from './ui/title-scene';
import { buildAppearancePicker, loadLook, saveLook } from './ui/appearance-picker';
import { HTML, SettingsUI, ZOOM_LEVELS, applySettings, loadSettings, saveSettings } from './ui/ui';

/** single-player build (GitHub Pages): the world runs and is saved in this browser, see src/local/ */
const SOLO = IS_SOLO;
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
  $<HTMLButtonElement>('btn-guest').disabled = true;
  $('btn-landscape').addEventListener('click', () => {
    void requestLandscape(true);
  });
  $('btn-portrait').addEventListener('click', () => document.documentElement.classList.add('portrait-allowed'));
  $('play-mode').textContent = SOLO ? 'Solo world · saved in this browser' : 'Online world · shared with friends';
  $('server-address').textContent = SOLO ? '' : new URL(SERVER_URL).host;
  $('btn-solo').hidden = !HAS_SOLO || SOLO;
  $('btn-solo').addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.delete('server');
    location.href = url.href;
  });
  $<HTMLInputElement>('friend-server').value =
    !SOLO && !SERVER_ERROR ? SERVER_URL : (import.meta.env.VITE_SERVER_URL ?? '');
  $('btn-join-server').addEventListener('click', () => {
    try {
      location.href = friendInvite(gameServerUrl($<HTMLInputElement>('friend-server').value, location.protocol));
    } catch (e) {
      $('login-msg').textContent = (e as Error).message;
    }
  });
  $('btn-invite').hidden = SOLO;
  $('btn-invite').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(friendInvite());
      $('login-msg').textContent = 'Invite link copied. Friends join the same server; each keeps their own character.';
    } catch {
      $('login-msg').textContent = friendInvite();
    }
  });
  if (SERVER_ERROR) {
    $('login-msg').textContent = SERVER_ERROR;
    return;
  }
  const settings = loadSettings();
  const canvas = $<HTMLCanvasElement>('game');
  const keys = loadKeys();
  const input = new Input(canvas, keys);
  input.setMovementMode(settings.movementMode);
  const game = new Game(input, () => settings, onClosed);
  input.firstGesture = () => game.audio.unlock();
  applySettings(settings, game.audio);
  await game.init(canvas);

  // = / − step the camera distance (the same setting as Settings → Camera distance)
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
      return;
    if (e.ctrlKey || e.metaKey || e.altKey || $('login').hidden === false) return;
    const dir =
      e.code === 'Equal' || e.code === 'NumpadAdd' ? -1 : e.code === 'Minus' || e.code === 'NumpadSubtract' ? 1 : 0;
    if (!dir) return;
    const i = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(settings.zoom) + dir));
    if (ZOOM_LEVELS[i] === settings.zoom) return;
    settings.zoom = ZOOM_LEVELS[i]!;
    saveSettings(settings);
    game.relayout();
  });

  let auth: AuthState | null = null;
  const msg = (t: string) => {
    $('login-msg').textContent = t;
  };

  const ui = new SettingsUI(
    settings,
    keys,
    (k) => {
      input.keys = k;
    },
    (cb) => {
      input.capturing = cb;
    },
    () => {
      input.setMovementMode(settings.movementMode);
      applySettings(settings, game.audio);
      game.relayout();
    },
  );
  ui.bind({
    signOut: () => {
      signOut();
      location.reload();
    },
    deleteAccount: async () => {
      if (auth) {
        await deleteAccount(auth.token);
        await game.ext.atlas.forgetAll();
        location.reload();
      }
    },
    accountInfo: () =>
      SOLO
        ? SOLO_NOTE
        : auth
          ? auth.guest
            ? 'Playing as a guest. Progress is saved on this device — sign in with Google to keep it safe.'
            : 'Signed in with Google.'
          : '',
  });
  game.settingsOpen = () => ui.open;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      game.toggleDebug();
    }
  });

  function onClosed(code: number): void {
    $('lost-title').textContent = code === 4001 ? 'Signed in elsewhere' : 'Connection lost';
    $('lost-msg').textContent =
      code === 4001
        ? 'This account joined from another window or device.'
        : 'The connection to the world dropped. Your progress was saved.';
    $('lost').hidden = false;
  }
  $('btn-reload').addEventListener('click', () => location.reload());

  if (!SOLO) {
    const inviteButton = document.createElement('button');
    inviteButton.textContent = 'Copy friend invite';
    inviteButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(friendInvite());
        inviteButton.textContent = 'Invite copied';
      } catch {
        inviteButton.textContent = friendInvite();
      }
    });
    $('acct-info').after(inviteButton);
  }
  setupTouch(input);
  $('btn-pack').addEventListener('click', () => game.gameplay.toggleInventory());
  $('btn-craft').addEventListener('click', () => game.gameplay.toggleFieldCraft());
  $('btn-journal').addEventListener('click', () => game.gameplay.toggleJournal());

  const look = loadLook();
  const picked = (a: Appearance) => {
    look.app = a;
    look.touched = true;
    saveLook(look);
    if (auth && game.net) game.net.send(MSG.APPEARANCE, { app: packAppearance(a) });
  };
  const scene = mountTitleScene($('login'), look.app);
  $('look-title').append(
    buildAppearancePicker(look.app, (a) => {
      picked(a);
      scene.setLook(a);
    }),
  );
  $('btn-settings').addEventListener('click', () =>
    $('look-settings').replaceChildren(buildAppearancePicker(look.app, picked)),
  );
  const enter = async (a: AuthState, name?: string, sendLook = false): Promise<void> => {
    auth = a;
    game.accountId = a.accountId;
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
    if (sendLook || look.touched) net.send(MSG.APPEARANCE, { app: packAppearance(look.app) });
    $('login').hidden = true;
    $('hud').hidden = false;
    window.__eigen = { state: () => game.debugState(), game };
  };

  const cfg = await authConfig().catch(() => ({ googleClientId: null as string | null }));
  setupGoogle(cfg.googleClientId, async (idToken) => {
    try {
      const g = await googleLogin(idToken);
      if (!auth) await enter(g, ($<HTMLInputElement>('name').value || '').trim() || undefined, true);
      else {
        auth = g;
        $('acct-info').textContent = 'Signed in with Google — your guest progress is now linked to your account.';
      }
    } catch (e) {
      msg(`Google sign-in failed: ${(e as Error).message}`);
    }
  });

  $('btn-guest').addEventListener('click', async () => {
    game.audio.unlock();
    void requestLandscape();
    try {
      const g = await guestLogin();
      await enter(g, ($<HTMLInputElement>('name').value || '').trim() || undefined, true);
    } catch (e) {
      msg(`Cannot reach the game server (${(e as Error).message}).`);
    }
  });

  $<HTMLButtonElement>('btn-guest').disabled = false;
  const resumed = await resumeSession();
  if (resumed) {
    $<HTMLInputElement>('name').value = resumed.name ?? '';
    msg(`Welcome back${resumed.name ? ', ' + resumed.name : ''}!`);
    await enter(resumed, resumed.name);
  }
}

function setupGoogle(clientId: string | null, onCredential: (idToken: string) => void): void {
  if (SOLO) {
    $('g-off').hidden = false;
    $('g-off').textContent = SOLO_NOTE;
    return;
  }
  if (!clientId) {
    $('g-off').hidden = false;
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = () => {
    window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: (r: { credential: string }) => onCredential(r.credential),
    });
    window.google?.accounts.id.renderButton($('g-btn'), {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
    });
    const up = document.getElementById('g-upgrade');
    if (up) window.google?.accounts.id.renderButton(up, { theme: 'outline', size: 'medium', text: 'signin_with' });
  };
  s.onerror = () => {
    $('g-off').hidden = false;
    $('g-off').textContent = 'Google sign-in could not be loaded.';
  };
  document.head.append(s);
}

async function requestLandscape(explicit = false): Promise<void> {
  if (!matchMedia('(pointer: coarse)').matches) return;
  if (!explicit && document.documentElement.classList.contains('portrait-allowed')) return;
  if (explicit) document.documentElement.classList.remove('portrait-allowed');
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    if (orientation?.lock) await orientation.lock('landscape');
  } catch {
    /* iOS and embedded browsers require physical rotation. */
  }
  $('rotate-note').textContent = 'If the screen has not turned, rotate your phone and check its rotation lock.';
}

function setupTouch(input: Input): void {
  if (!matchMedia('(pointer: coarse)').matches) return;
  $('touch').hidden = false;
  const stick = $('stick'),
    knob = $('knob');
  let active: number | null = null;
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2),
      dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    const dead = Math.hypot(dx, dy) < 0.15;
    input.setStick(dead ? 0 : dx, dead ? 0 : dy);
    knob.style.transform = `translate(${dx * (r.width * 0.3)}px, ${dy * (r.height * 0.3)}px)`;
  };
  stick.addEventListener('pointerdown', (e) => {
    active = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    move(e);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === active) move(e);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId === active) {
      active = null;
      input.setStick(0, 0);
      knob.style.transform = '';
    }
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  stick.addEventListener('lostpointercapture', end);
  const reset = () => {
    active = null;
    knob.style.transform = '';
    input.reset();
  };
  window.addEventListener('resize', reset);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  document.querySelectorAll<HTMLButtonElement>('#tbtns button').forEach((b) => {
    const a = b.dataset.a as 'attack' | 'skill' | 'dash' | 'interact';
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      input.touch(a, true);
    });
    const up = () => input.touch(a, false);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  });
}

boot().catch((e) => {
  console.error(e);
  const m = document.getElementById('login-msg');
  if (m) m.textContent = `Startup failed: ${(e as Error).message}`;
});
