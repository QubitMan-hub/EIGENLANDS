import './atlas.css';
import {
  ENEMY_BY_KIND,
  NPC_BY_ID,
  caveExitRoutes,
  isCaveY,
  isDiveY,
  G,
  PALETTE,
  TILE_DEFS,
  townsFor,
  frontierTownsNear,
  townFor,
  type PartyStateMsg,
} from '@eigenlands/shared';
import { isoX, isoY, unproject } from '../../game/iso';
import { keyLabel } from '../../input/keymap';
import { h } from '../../ui/dom';
import { iconSvg } from '../../ui/icons';
import type { ClientModule, P34Deps } from '../types';
import { Exploration, chartY, planeOf, type ChartChunk } from './model';
import { ChartArchive } from './archive';
import { partyDestinations, questDestinations, type Destination } from './destinations';
interface Point {
  x: number;
  y: number;
  name: string;
}
interface Landmark extends Point {
  sub: string;
  shrine?: string;
}
const known = new Map<string, string>([
  ['shrine_altar', 'Resonance shrine'],
  ['cave_mouth', 'Cave entrance'],
  ['cave_ladder', 'Surface ladder'],
  ['cave_lift', 'Supply lift'],
  ['dive_gate', 'Diving buoy'],
  ['dive_exit', 'Sloop return'],
  ['stairs_up', 'Upper floor'],
  ['stairs_down', 'Downstairs'],
  ['board', 'Town board'],
]);
const colors = [
  '#224555',
  '#326779',
  '#cba67c',
  '#5b8056',
  '#af855e',
  '#62433f',
  '#443039',
  '#b48d60',
  '#6b7c7c',
  '#46565b',
  '#2b3941',
  '#10141f',
  '#dd985f',
  '#6b7c7c',
];
const point = (v: unknown): v is Point =>
  !!v &&
  typeof v === 'object' &&
  ['x', 'y'].every(
    (k) =>
      Number.isFinite((v as Record<string, unknown>)[k]) && Math.abs(Number((v as Record<string, unknown>)[k])) < 1e6,
  ) &&
  typeof (v as Point).name === 'string';
/** One local chart shared by the modal atlas and quiet live minimap. */
export class AtlasClient implements ClientModule {
  journal = new Exploration();
  private key = '';
  private entrance: Point | null = null;
  private wasUnderground = false;
  private observedPosition = false;
  private tracked: string | null = '@arrival';
  private archive?: ChartArchive;
  private last = -Infinity;
  private saved = -1;
  private savedArchive = -1;
  private savedAt = 0;
  private changed = false;
  private warned = false;
  private state: any;
  private solved = new Set<string>();
  private landmarks = new Map<string, Landmark>();
  private waypoints: Point[] = [];
  private cache = new Map<
    string,
    {
      chunk: ChartChunk;
      revision: number;
      canvas: HTMLCanvasElement;
    }
  >();
  private mini = h('button', { id: 'atlas-mini', type: 'button' });
  private small = h('canvas');
  private label = h('span');
  private binding = h('kbd');
  private button = h('button', { class: 'gatebtn', type: 'button', title: 'World atlas' });
  private showMini = true;
  private size = 144;
  private filters = { locations: true, players: true, npcs: true, enemies: false, quests: true, party: true };
  private destinations: Record<'quests' | 'party', Destination[]> = { quests: [], party: [] };
  private directories: { key: 'quests' | 'party'; summary: HTMLElement; list: HTMLElement; signature: string }[] = [];
  private centres = new Map<string, Point>();
  private centre: Point = { x: 0, y: 0, name: '' };
  private plane = 'Overworld';
  private zoom = 8;
  private chart: HTMLCanvasElement | null = null;
  private readout: HTMLElement | null = null;
  private waypointList: HTMLElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  constructor(
    private d: P34Deps,
    private party: () => PartyStateMsg | null = () => null,
  ) {
    this.small.width = this.small.height = this.size;
    this.mini.append(this.small, this.label);
    this.mini.setAttribute('aria-label', 'Open world atlas');
    this.small.setAttribute('aria-hidden', 'true');
    this.mini.onclick = () => this.toggle();
    this.button.innerHTML = iconSvg('map', 20);
    this.button.append(this.binding);
    this.button.onclick = () => this.toggle();
    this.button.setAttribute('aria-label', 'World atlas');
    document.querySelector('#hud-btns')?.append(this.button);
    document.querySelector('#hud')?.append(this.mini);
    document.body.classList.add('atlas-ready');
    window.addEventListener('storage', (e) => {
      if (!this.key || e.storageArea !== localStorage || e.newValue !== null || (e.key !== this.key && e.key !== null))
        return;
      // Account erasure in another tab must not recreate its synchronous recovery snapshot.
      this.key = '';
      void this.archive?.close();
      this.archive = undefined;
      this.journal = new Exploration();
      this.cache.clear();
    });
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
  }
  onWelcome(): void {
    const key = `eigen.atlas:${this.d.identity?.() ?? 'local'}:${this.d.store().seed}`;
    if (key === this.key) return;
    this.save();
    void this.archive?.close();
    this.archive = undefined;
    this.key = key;
    this.warned = false;
    this.savedArchive = -1;
    this.journal = new Exploration(512, (key, cells) => this.archive?.record(key, cells));
    this.cache.clear();
    this.landmarks.clear();
    this.waypoints = [];
    this.entrance = null;
    this.wasUnderground = false;
    this.observedPosition = false;
    this.tracked = '@arrival';
    this.centres.clear();
    let recovery: string | null = null;
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (v?.v === 1) {
        if (point(v.entrance)) this.entrance = v.entrance;
        if (v.tracked === null || (typeof v.tracked === 'string' && v.tracked.length < 128)) this.tracked = v.tracked;
        if (v.archiveVersion === 1) recovery = typeof v.recovery === 'string' ? v.recovery : '';
        if (typeof v.chart === 'string') this.journal.restore(v.chart);
        if (Array.isArray(v.waypoints))
          this.waypoints = v.waypoints
            .filter(point)
            .slice(-32)
            .map((p: Point) => ({ ...p, name: p.name.slice(0, 32) }));
        if (Array.isArray(v.landmarks))
          for (const p of v.landmarks.slice(-256))
            if (point(p) && 'sub' in p && typeof p.sub === 'string' && known.has(p.sub))
              this.landmarks.set(`${Math.floor(p.x)},${Math.floor(p.y)}`, {
                ...p,
                name: p.name.slice(0, 64),
                sub: p.sub,
                shrine: 'shrine' in p && typeof p.shrine === 'string' ? p.shrine : undefined,
              });
        if (Array.isArray(v.centres)) for (const p of v.centres.filter(point)) this.centres.set(planeOf(p.y), p);
        for (const key of Object.keys(this.filters) as (keyof typeof this.filters)[])
          if (typeof v.filters?.[key] === 'boolean') this.filters[key] = v.filters[key];
        this.showMini = v.showMini !== false;
        if ([112, 144, 176].includes(v.size)) this.size = v.size;
      }
    } catch {
      /* private/corrupt storage leaves a usable empty chart */
    }
    this.archive = new ChartArchive(key, this.journal, () => this.storageWarning(), recovery);
    void this.archive.flush();
    this.saved = this.journal.revision;
    this.last = -Infinity;
  }
  async forgetAll(): Promise<void> {
    const prefix = `eigen.atlas:${this.d.identity?.() ?? 'local'}:`;
    this.key = ''; // stop frame and unload saves before awaiting disk work
    try {
      for (const key of Object.keys(localStorage))
        if (key.startsWith(prefix) || key.startsWith(`eigen.onboarding:${this.d.identity?.() ?? 'local'}:`))
          localStorage.removeItem(key);
    } catch {
      /* localStorage may be unavailable */
    }
    await this.archive?.erase(prefix);
    this.archive = undefined;
    this.journal = new Exploration();
    this.cache.clear();
  }
  private storageWarning(): void {
    if (this.warned) return;
    this.warned = true;
    this.d.toasts.add(
      'Chart storage is unavailable or full. Only recent terrain may survive; keep this tab open to retry.',
      'info',
    );
  }
  private seen(x: number, y: number): boolean {
    return this.journal.tile(x, y) !== undefined || !!this.archive?.seen(x, y);
  }
  trackedQuest(): string | null {
    return this.tracked;
  }
  navigation(): Destination | null {
    const me = this.d.me(),
      cave = !!me && isCaveY(me.y) && !isDiveY(me.y);
    if (
      cave &&
      (this.tracked === '@cave-exit' || this.tracked === '@cave-entry' || !this.tracked || this.tracked === '@arrival')
    ) {
      const exit =
        this.tracked === '@cave-entry' && this.entrance
          ? this.entrance
          : caveExitRoutes(this.d.store().seed, me!.x, me!.y)[0];
      if (exit)
        return {
          id: '@cave-exit',
          title: exit.name,
          detail: 'Follow the broad survey roads. Supply lifts return to daylight; unexplored terrain stays hidden.',
          point: exit,
        };
    }
    if (this.tracked === '@arrival') {
      const town = townFor(this.d.store().seed);
      return {
        id: '@arrival',
        title: town.name,
        detail: 'Known settlement · follow the roads; wards protect its streets and homes',
        point: { x: town.cx, y: town.cy },
      };
    }
    if (!this.tracked) return null;
    return (
      questDestinations(
        this.d.store().seed,
        this.d.profile.quests,
        (id) => this.d.profile.count(id),
        this.state?.npcs ?? new Map(),
        (x, y) => this.seen(x, y),
        true,
      ).find((p) => p.questId === this.tracked) ?? null
    );
  }
  trackQuest(id: string | null, showMap = false): void {
    if (id && !['@arrival', '@cave-entry', '@cave-exit'].includes(id) && this.d.profile.quests[id]?.state !== 'active')
      return;
    this.tracked = id;
    this.changed = true;
    this.save();
    if (!showMap) return;
    const route = this.navigation();
    if (!route?.point) {
      this.d.toasts.add(
        route?.detail ?? 'This quest has no fixed destination. Read its objectives in the Journal.',
        'info',
      );
      return;
    }
    this.d.wins.close();
    this.toggle();
    this.centre = { ...route.point, name: route.title };
    this.plane = planeOf(route.point.y);
    const layer = document.querySelector<HTMLSelectElement>('[aria-label="Map layer"]');
    if (layer) layer.value = this.plane;
  }
  setSolved(ids: string[]): void {
    this.solved = new Set(ids);
  }
  onState(s: any): void {
    this.state = s;
  }
  action(a: string): boolean {
    if (a !== 'map') return false;
    this.toggle();
    return true;
  }
  private save(): void {
    if (this.key) void this.archive?.flush();
    if (
      !this.key ||
      (!this.changed && this.saved === this.journal.revision && this.savedArchive === this.archive?.revision)
    )
      return;
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify({
          v: 1,
          tracked: this.tracked,
          entrance: this.entrance,
          archiveVersion: 1,
          recovery: this.archive?.recovery(),
          chart: this.journal.serialize(),
          waypoints: this.waypoints,
          landmarks: [...this.landmarks.values()],
          centres: [...this.centres.values()],
          showMini: this.showMini,
          size: this.size,
          filters: this.filters,
        }),
      );
      this.changed = false;
      this.saved = this.journal.revision;
      this.savedArchive = this.archive?.revision ?? -1;
    } catch {
      this.storageWarning();
    }
  }
  frame(now: number): void {
    if (now - this.last < 250 || !this.key) return;
    this.last = now;
    void this.archive?.flush();
    const me = this.d.me();
    if (!me) return;
    if (this.d.profile.loaded) {
      const status = this.tracked ? this.d.profile.quests[this.tracked]?.state : undefined;
      if (this.tracked === '@arrival' && this.d.profile.quests.welcome) {
        this.tracked = this.d.profile.quests.welcome.state === 'active' ? 'welcome' : null;
        this.changed = true;
      } else if (
        this.tracked &&
        !['@arrival', '@cave-entry', '@cave-exit'].includes(this.tracked) &&
        status !== 'active'
      ) {
        this.tracked = null;
        this.changed = true;
      }
    }
    const authority = this.state?.players?.get(this.d.myId());
    const entryPosition = authority ? { x: authority.x, y: authority.y } : null;
    const underground = entryPosition ? isCaveY(entryPosition.y) && !isDiveY(entryPosition.y) : this.wasUnderground;
    if (underground && !this.wasUnderground) {
      if (entryPosition && (this.observedPosition || !this.entrance)) {
        this.entrance = { ...entryPosition, name: 'Entry chamber' };
        this.changed = true;
      }
    }
    this.wasUnderground = underground;
    if (entryPosition) this.observedPosition = true;
    const plane = planeOf(me.y);
    this.journal.visit(this.d.store(), me.x, me.y);
    this.centres.set(plane, { x: me.x, y: me.y, name: plane });
    for (const t of frontierTownsNear(this.d.store().seed, me.x - 100, me.y - 100, me.x + 100, me.y + 100)) {
      const key = `${t.cx},${t.cy}`;
      if (this.seen(t.cx, t.cy) && !this.landmarks.has(key)) {
        this.landmarks.set(key, { x: t.cx, y: t.cy, name: t.name, sub: 'frontier_city' });
        this.changed = true;
      }
    }
    for (const o of this.d.store().objects.values())
      if (known.has(o.sub) && this.seen(o.x, o.y)) {
        const key = `${o.x},${o.y}`;
        if (!this.landmarks.has(key)) {
          this.landmarks.set(key, {
            x: o.x + 0.5,
            y: o.y + 0.5,
            name: known.get(o.sub)!,
            sub: o.sub,
            shrine: typeof o.data?.shrine === 'string' ? o.data.shrine : undefined,
          });
          this.changed = true;
        }
      }
    while (this.landmarks.size > 256) this.landmarks.delete(this.landmarks.keys().next().value!);
    const mapKey = this.d.keys().map[0],
      text = mapKey ? keyLabel(mapKey) : 'Map';
    this.label.textContent = `Atlas · ${text}`;
    this.binding.textContent = mapKey ? text : '';
    this.button.title = `World atlas${mapKey ? ` (${text})` : ''}`;
    this.mini.hidden = !this.showMini;
    if (this.showMini) this.draw(this.small, { x: me.x, y: me.y, name: '' }, 3.5, plane);
    if (this.d.wins.name === 'atlas' && this.chart) {
      this.refreshDestinations();
      this.draw(this.chart, this.centre, this.zoom, this.plane);
      if (this.readout)
        this.readout.textContent = `${this.plane} · ${Math.floor(this.centre.x)}, ${Math.floor(chartY(this.centre.y))} · ${this.archive?.discovery.size ?? this.journal.chunks.size} chart pages · ${this.archive?.limited ? 'Storage limit reached · older unsaved terrain lost' : this.archive?.status === 'saved' ? 'Saved on this browser' : this.archive?.status === 'unavailable' ? 'Storage unavailable · recent snapshot only' : 'Saving chart…'}`;
    }
    if (now - this.savedAt > 5000) {
      this.savedAt = now;
      this.save();
    }
  }
  private toggle(): void {
    if (this.d.wins.name === 'atlas') {
      this.d.wins.close();
      return;
    }
    const me = this.d.me();
    if (!me) return;
    this.d.learn?.('openedMap');
    this.plane = planeOf(me.y);
    this.centre = { ...me, name: '' };
    const root = h('div', { class: 'atlas' }),
      tools = h('div', { class: 'atlas-tools' }),
      nav = h('div', { class: 'atlas-nav' });
    const layer = h('select');
    layer.setAttribute('aria-label', 'Map layer');
    for (const name of ['Overworld', 'Undercroft', 'Upper rooms', 'Submerged sanctuaries'])
      layer.append(h('option', { value: name, text: name }));
    layer.value = this.plane;
    layer.onchange = () => {
      this.plane = layer.value;
      this.centre = this.centres.get(this.plane) ?? { x: 0, y: 0, name: '' };
    };
    const act = (text: string, fn: () => void) => h('button', { type: 'button', text, on: { click: fn } });
    tools.append(
      layer,
      act('− Zoom', () => (this.zoom = Math.max(0.5, this.zoom / 1.5))),
      act('+ Zoom', () => (this.zoom = Math.min(16, this.zoom * 1.5))),
      act('Centre on me', () => {
        const p = this.d.me();
        if (p) {
          this.plane = planeOf(p.y);
          layer.value = this.plane;
          this.centre = { ...p, name: '' };
        }
      }),
    );
    if (isCaveY(me.y) && !isDiveY(me.y))
      tools.append(
        act('Track nearest exit', () => this.trackQuest('@cave-exit')),
        act('Track entry chamber', () => this.trackQuest('@cave-entry')),
      );
    const places = h('select');
    places.setAttribute('aria-label', 'Charted location');
    places.append(h('option', { value: '', text: 'Find a charted location' }));
    const locations: Point[] = [
      ...townsFor(this.d.store().seed).map((t) => ({ x: t.cx, y: t.cy, name: t.name })),
      ...[...this.landmarks.values()].filter((p) => !p.shrine || !this.solved.has(p.shrine)),
    ].filter((p) => this.seen(p.x, p.y));
    locations.forEach((p, i) => places.append(h('option', { value: String(i), text: `${p.name} · ${planeOf(p.y)}` })));
    places.onchange = () => {
      const p = locations[Number(places.value)];
      if (places.value && p) {
        this.centre = p;
        this.plane = planeOf(p.y);
        layer.value = this.plane;
      }
    };
    tools.append(places);
    const mini = act(this.showMini ? 'Hide minimap' : 'Show minimap', () => {
      this.showMini = !this.showMini;
      mini.textContent = this.showMini ? 'Hide minimap' : 'Show minimap';
      this.changed = true;
      this.save();
    });
    const size = h('select');
    size.setAttribute('aria-label', 'Minimap size');
    for (const n of [112, 144, 176]) size.append(h('option', { value: String(n), text: `${n}px minimap` }));
    size.value = String(this.size);
    size.onchange = () => {
      this.size = Number(size.value);
      this.changed = true;
      this.save();
    };
    tools.append(mini, size);
    const filters = h('div', { class: 'atlas-filters' });
    for (const [key, text] of Object.entries({
      locations: 'Locations',
      players: 'Travellers',
      npcs: 'Villagers',
      enemies: 'Enemies',
      quests: 'Quest markers',
      party: 'Party markers',
    })) {
      const input = h('input', { type: 'checkbox' });
      input.checked = this.filters[key as keyof typeof this.filters];
      input.onchange = () => {
        this.filters[key as keyof typeof this.filters] = input.checked;
        this.changed = true;
        this.save();
      };
      filters.append(h('label', {}, input, text));
    }
    this.chart = h('canvas', { class: 'atlas-canvas' });
    this.chart.tabIndex = 0;
    this.chart.setAttribute(
      'aria-label',
      'Exploration chart. Arrow keys pan; plus and minus zoom. Click explored ground to place a waypoint.',
    );
    this.chart.setAttribute('role', 'img');
    let drag: {
      x: number;
      y: number;
      cx: number;
      cy: number;
      moved: boolean;
    } | null = null;
    this.chart.onpointerdown = (e) => {
      this.chart!.focus();
      this.chart!.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, cx: this.centre.x, cy: this.centre.y, moved: false };
    };
    this.chart.onpointermove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 5;
      const p = unproject((dx / this.zoom) * 16, (dy / this.zoom) * 16);
      this.centre = { x: drag.cx - p.x, y: drag.cy - p.y, name: '' };
    };
    this.chart.onpointerup = (e) => {
      if (drag && !drag.moved) {
        const r = this.chart!.getBoundingClientRect(),
          p = unproject(
            ((e.clientX - r.left - r.width / 2) / this.zoom) * 16,
            ((e.clientY - r.top - r.height / 2) / this.zoom) * 16,
          );
        this.place(this.centre.x + p.x, this.centre.y + p.y);
      }
      drag = null;
    };
    this.chart.onpointercancel = () => {
      drag = null;
    };
    this.chart.onwheel = (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.5, Math.min(16, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    };
    const pan = (x: number, y: number) => {
      const p = unproject((x * 16) / this.zoom, (y * 16) / this.zoom);
      this.centre = { x: this.centre.x + p.x, y: this.centre.y + p.y, name: '' };
    };
    this.chart.onkeydown = (e) => {
      const moves: Record<string, number[]> = {
        ArrowLeft: [-40, 0],
        ArrowRight: [40, 0],
        ArrowUp: [0, -40],
        ArrowDown: [0, 40],
      };
      if (moves[e.key]) {
        e.preventDefault();
        pan(moves[e.key]![0]!, moves[e.key]![1]!);
      }
      if (['+', '=', '-'].includes(e.key)) {
        e.preventDefault();
        this.zoom = Math.max(0.5, Math.min(16, this.zoom * (e.key === '-' ? 1 / 1.5 : 1.5)));
      }
    };
    nav.append(
      act('Pan left', () => pan(-60, 0)),
      act('Pan up', () => pan(0, -60)),
      act('Pan down', () => pan(0, 60)),
      act('Pan right', () => pan(60, 0)),
    );
    this.nameInput = h('input', { type: 'text', placeholder: 'Waypoint name', maxLength: 32 });
    this.nameInput.setAttribute('aria-label', 'Waypoint name');
    nav.append(
      this.nameInput,
      act('Mark my position', () => {
        const p = this.d.me();
        if (p) this.place(p.x, p.y);
      }),
    );
    this.readout = h('div', { class: 'atlas-position small' });
    this.waypointList = h('div', { class: 'atlas-waypoints' });
    this.renderWaypoints();
    this.directories = [];
    const directories = h('div', { class: 'atlas-directories' });
    for (const [key, title] of [
      ['quests', 'Quest destinations'],
      ['party', 'Party destinations'],
    ] as const) {
      const summary = h('summary', { text: title });
      const list = h('div', { class: 'atlas-destinations' });
      const directory = h('details', { class: 'atlas-directory' }, summary, list);
      this.directories.push({ key, summary, list, signature: '' });
      directories.append(directory);
    }
    this.refreshDestinations();
    const legend = h('div', { class: 'atlas-legend' });
    for (const [name, color] of [
      ['You', '#f5e5b9'],
      ['Traveller', '#7fe3d3'],
      ['Villager', '#eed093'],
      ['Enemy', '#ce7556'],
      ['Quest', '#f6c568'],
      ['Party', '#bba4ef'],
      ['Waypoint', '#df84a5'],
      ['Unexplored', '#10191d'],
    ])
      legend.append(h('span', {}, h('i', { class: 'atlas-key', style: `background:${color}` }), name));
    root.append(
      tools,
      filters,
      this.chart,
      this.readout,
      legend,
      directories,
      nav,
      h('p', {
        class: 'atlas-note',
        text: 'Drag to pan. Click explored ground to mark it. Only nearby visited terrain is charted. Earlier regions load as you pan. Charts and waypoints are saved on this browser, subject to its storage limits; clearing site data removes them. Party markers show shared positions without charting the ground around them.',
      }),
      this.waypointList,
    );
    this.d.wins.show('atlas', 'World atlas', root, {
      wide: true,
      onClose: () => {
        this.chart = null;
        this.directories = [];
        this.destinations = { quests: [], party: [] };
        this.save();
      },
    });
  }
  private refreshDestinations(): void {
    this.destinations.quests = questDestinations(
      this.d.store().seed,
      this.d.profile.quests,
      (id) => this.d.profile.count(id),
      this.state?.npcs ?? new Map(),
      (x, y) => this.seen(x, y),
    );
    this.destinations.party = partyDestinations(this.party(), this.d.identity?.() ?? '', this.d.myId());
    for (const directory of this.directories) {
      const routes = this.destinations[directory.key];
      // Position updates keep the same focused button; clicking resolves the latest coordinates.
      const signature = JSON.stringify(
        routes.map((p) => [p.id, p.title, p.detail, p.point ? planeOf(p.point.y) : null]),
      );
      if (signature === directory.signature) continue;
      directory.signature = signature;
      directory.summary.textContent = `${directory.key === 'quests' ? 'Quest' : 'Party'} destinations (${routes.length})`;
      directory.list.replaceChildren();
      if (!routes.length)
        directory.list.append(
          h('p', {
            class: 'atlas-note',
            text:
              directory.key === 'quests'
                ? 'No active quests. Visit the Journal for your quest history.'
                : 'No party companions. Invite a traveller through the party window.',
          }),
        );
      for (const route of routes) {
        const button = h('button', { type: 'button', text: route.title });
        button.disabled = !route.point;
        button.onclick = () => {
          const p = this.destinations[directory.key].find((p) => p.id === route.id)?.point;
          if (!p) return;
          this.centre = { ...p, name: route.title };
          this.plane = planeOf(p.y);
          const layer = document.querySelector<HTMLSelectElement>('[aria-label="Map layer"]');
          if (layer) layer.value = this.plane;
        };
        const detail = h('span', {
          class: 'atlas-note',
          text: `${route.detail}${route.point ? ` · ${planeOf(route.point.y)}` : ''}`,
        });
        directory.list.append(h('div', { class: 'atlas-destination' }, button, detail));
      }
    }
  }
  private place(x: number, y: number): void {
    if (!this.seen(x, y)) {
      this.d.toasts.add('Explore this ground before charting a waypoint.', 'info');
      return;
    }
    this.waypoints.push({
      x: Math.floor(x) + 0.5,
      y: Math.floor(y) + 0.5,
      name: this.nameInput?.value.trim().slice(0, 32) || `Waypoint ${this.waypoints.length + 1}`,
    });
    if (this.waypoints.length > 32) this.waypoints.shift();
    this.changed = true;
    this.save();
    this.renderWaypoints();
  }
  private renderWaypoints(): void {
    if (!this.waypointList) return;
    this.waypointList.replaceChildren();
    this.waypoints.forEach((p, i) => {
      const visit = h('button', {
        text: `${p.name} · ${planeOf(p.y)}`,
        on: {
          click: () => {
            this.plane = planeOf(p.y);
            this.centre = p;
            const select = document.querySelector<HTMLSelectElement>('[aria-label="Map layer"]');
            if (select) select.value = this.plane;
          },
        },
      });
      const remove = h('button', {
        text: `Remove ${p.name}`,
        on: {
          click: () => {
            this.waypoints.splice(i, 1);
            this.changed = true;
            this.save();
            this.renderWaypoints();
          },
        },
      });
      this.waypointList!.append(visit, remove);
    });
  }
  private page(key: string, c: ChartChunk): HTMLCanvasElement {
    const old = this.cache.get(key);
    if (old?.chunk === c && old.revision === c.revision) return old.canvas;
    const canvas = old?.canvas ?? document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const n = c.tiles[x + y * 32]!;
        if (n < 0) continue;
        const d = TILE_DEFS[n];
        ctx.fillStyle =
          d?.obj === 'tree'
            ? PALETTE[9]
            : d?.obj === 'torch'
              ? PALETTE[22]
              : d?.obj === 'rock'
                ? PALETTE[4]
                : d?.obj === 'flowers'
                  ? PALETTE[14]
                  : colors[d?.ground ?? G.GRASS]!;
        const px = 64 + (x - y) * 2,
          py = x + y;
        ctx.fillRect(px - 1, py, 2, 1);
        ctx.fillRect(px - 2, py + 1, 4, 1);
      }
    this.cache.delete(key);
    this.cache.set(key, { chunk: c, revision: c.revision, canvas });
    while (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value!);
    return canvas;
  }
  private draw(canvas: HTMLCanvasElement, centre: Point, zoom: number, plane: string): void {
    const w = canvas === this.small ? this.size : Math.max(1, Math.floor(canvas.clientWidth)),
      height = canvas === this.small ? this.size : Math.max(1, Math.floor(canvas.clientHeight));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10191d';
    ctx.fillRect(0, 0, w, height);
    const pos = (x: number, y: number) => ({
      x: w / 2 + (isoX(x - centre.x, y - centre.y) / 16) * zoom,
      y: height / 2 + (isoY(x - centre.x, y - centre.y) / 16) * zoom,
    });
    let archivedVisible = 0;
    if (this.archive) {
      const visibleKeys: { key: string; distance: number }[] = [];
      const extent = unproject((w * 8) / zoom, (height * 8) / zoom).x;
      // Query only viewport coordinates, not the whole discovery index on every frame.
      for (let cy = Math.floor((centre.y - extent) / 32) - 1; cy <= Math.floor((centre.y + extent) / 32); cy++) {
        if (planeOf(cy * 32) !== plane) continue;
        for (let cx = Math.floor((centre.x - extent) / 32) - 1; cx <= Math.floor((centre.x + extent) / 32); cx++) {
          const key = `${cx},${cy}`;
          if (!this.archive.discovery.has(key)) continue;
          const p = pos(cx * 32, cy * 32);
          if (p.x + 32 * zoom < 0 || p.x - 32 * zoom > w || p.y > height || p.y + 32 * zoom < 0) continue;
          visibleKeys.push({ key, distance: Math.hypot(p.x - w / 2, p.y - height / 2) });
        }
      }
      archivedVisible = visibleKeys.length;
      // At extreme zoom-out prefer the nearest pages; never churn an unbounded viewport through the cache.
      this.archive.load(
        visibleKeys
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 384)
          .map((p) => p.key),
      );
    }
    let visible = 0;
    for (const [key, c] of this.journal.chunks) {
      if (planeOf(c.cy * 32) !== plane) continue;
      const p = pos(c.cx * 32, c.cy * 32);
      if (p.x + 32 * zoom < 0 || p.x - 32 * zoom > w || p.y > height || p.y + 32 * zoom < 0) continue;
      visible++;
      ctx.drawImage(this.page(key, c), Math.round(p.x - 32 * zoom), Math.round(p.y), 64 * zoom, 32 * zoom);
    }
    if (!visible && canvas !== this.small) {
      ctx.font = '14px monospace';
      ctx.fillStyle = '#b3c1af';
      ctx.textAlign = 'center';
      ctx.fillText(
        archivedVisible
          ? this.archive?.status === 'unavailable'
            ? 'Chart unavailable'
            : 'Loading chart…'
          : 'Uncharted ground',
        w / 2,
        height / 2 - 18,
      );
      ctx.textAlign = 'left';
    }
    const mark = (p: Point, color: string, label = false, shape = 'square', seen = true) => {
      if (planeOf(p.y) !== plane || (seen && !this.seen(p.x, p.y))) return;
      const at = pos(p.x, p.y);
      if (at.x < 0 || at.x > w || at.y < 0 || at.y > height) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#10191d';
      ctx.lineWidth = 2;
      if (shape === 'ring') {
        ctx.beginPath();
        ctx.arc(at.x, at.y, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      } else if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(at.x, at.y - 5);
        ctx.lineTo(at.x + 5, at.y + 4);
        ctx.lineTo(at.x - 5, at.y + 4);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      } else {
        ctx.fillRect(Math.round(at.x) - 3, Math.round(at.y) - 3, 6, 6);
        ctx.strokeRect(Math.round(at.x) - 3, Math.round(at.y) - 3, 6, 6);
      }
      if (label && canvas !== this.small) {
        ctx.font = '11px monospace';
        ctx.lineWidth = 3;
        ctx.strokeText(p.name, at.x + 6, at.y - 5);
        ctx.fillText(p.name, at.x + 6, at.y - 5);
      }
    };
    if (this.filters.locations) {
      for (const t of townsFor(this.d.store().seed)) mark({ x: t.cx, y: t.cy, name: t.name }, '#eed093', true);
      for (const p of this.landmarks.values())
        if (!p.shrine || !this.solved.has(p.shrine)) mark(p, '#b7d6c6', true, 'ring');
    }
    for (const p of this.waypoints) mark(p, '#df84a5', true, 'square', false);
    for (const [group, on, color] of [
      ['players', this.filters.players, '#7fe3d3'],
      ['npcs', this.filters.npcs, '#eed093'],
      ['enemies', this.filters.enemies, '#ce7556'],
    ] as const)
      if (on)
        this.state?.[group]?.forEach((e: any) => {
          if (e.id === this.d.myId() || e.hp === 0) return;
          if (group === 'enemies' && ENEMY_BY_KIND[e.kind]?.passive) return;
          mark(
            {
              x: e.x,
              y: e.y,
              name:
                e.name ??
                (group === 'npcs' ? NPC_BY_ID[e.id]?.name : undefined) ??
                ENEMY_BY_KIND[e.kind]?.name ??
                'Traveller',
            },
            color,
            false,
            group === 'players' ? 'ring' : group === 'enemies' ? 'triangle' : 'square',
          );
        });
    if (canvas !== this.small) {
      if (this.filters.quests)
        for (const p of this.destinations.quests)
          if (p.point) mark({ ...p.point, name: p.title }, '#f6c568', false, 'triangle');
      if (this.filters.party)
        for (const p of this.destinations.party)
          if (p.point) mark({ ...p.point, name: p.title }, '#bba4ef', false, 'ring', false);
    }
    const route = this.navigation();
    if (route?.point && this.filters.quests)
      mark({ ...route.point, name: route.title }, '#f6c568', canvas !== this.small, 'triangle', false);
    const me = this.d.me();
    if (me && planeOf(me.y) === plane) {
      const p = pos(me.x, me.y),
        dx = isoX(me.fx, me.fy),
        dy = isoY(me.fx, me.fy),
        len = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = '#f5e5b9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (dx / len) * 10, p.y + (dy / len) * 10);
      ctx.stroke();
      mark({ ...me, name: 'You' }, '#f5e5b9', false, 'ring');
    }
    ctx.font = '11px monospace';
    ctx.fillStyle = '#f1e4c7';
    ctx.fillText('N', 8, 16);
    ctx.strokeStyle = '#f1e4c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 17);
    ctx.lineTo(30, 12);
    ctx.lineTo(24, 12);
    ctx.moveTo(30, 12);
    ctx.lineTo(29, 17);
    ctx.stroke();
  }
  debug(): Record<string, unknown> {
    return {
      trackedQuest: this.tracked,
      chartPages: this.journal.chunks.size,
      archivedPages: this.archive?.discovery.size ?? 0,
      chartStorage: this.archive?.status,
      chartWaypoints: this.waypoints.length,
      chartLandmarks: this.landmarks.size,
      chartPlane: this.plane,
      minimap: this.showMini,
    };
  }
}
