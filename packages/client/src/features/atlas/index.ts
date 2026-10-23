import './atlas.css';
import { ENEMY_BY_KIND, NPC_BY_ID, G, PALETTE, TILE_DEFS, townsFor } from '@eigenlands/shared';
import { isoX, isoY, unproject } from '../../game/iso';
import { keyLabel } from '../../input/keymap';
import { h } from '../../ui/dom';
import { iconSvg } from '../../ui/icons';
import type { ClientModule, P34Deps } from '../types';
import { Exploration, chartY, planeOf, type ChartChunk } from './model';
interface Point {
  x: number;
  y: number;
  name: string;
}
interface Landmark extends Point {
  sub: string;
  shrine?: string;
}
const known = new Map<string, string>([['shrine_altar', 'Resonance shrine'], ['cave_mouth', 'Cave entrance'], ['cave_ladder', 'Surface ladder'], ['dive_gate', 'Diving buoy'], ['dive_exit', 'Sloop return'], ['stairs_up', 'Upper floor'], ['stairs_down', 'Downstairs'], ['board', 'Town board']]);
const colors = ['#224555', '#326779', '#cba67c', '#5b8056', '#af855e', '#62433f', '#443039', '#b48d60', '#6b7c7c', '#46565b', '#2b3941'];
const point = (v: unknown): v is Point => !!v && typeof v === 'object' && ['x', 'y'].every(k => Number.isFinite((v as Record<string, unknown>)[k]) && Math.abs(Number((v as Record<string, unknown>)[k])) < 1e6) && typeof (v as Point).name === 'string';
/** One local chart shared by the modal atlas and quiet live minimap. */
export class AtlasClient implements ClientModule {
  journal = new Exploration();
  private key = '';
  private last = -Infinity;
  private saved = -1;
  private savedAt = 0;
  private changed = false;
  private warned = false;
  private state: any;
  private solved = new Set<string>();
  private landmarks = new Map<string, Landmark>();
  private waypoints: Point[] = [];
  private cache = new Map<string, {
    chunk: ChartChunk;
    revision: number;
    canvas: HTMLCanvasElement;
  }>();
  private mini = h('button', { id: 'atlas-mini', type: 'button' });
  private small = h('canvas');
  private label = h('span');
  private binding = h('kbd');
  private button = h('button', { class: 'gatebtn', type: 'button', title: 'World atlas' });
  private showMini = true;
  private size = 144;
  private filters = { locations: true, players: true, npcs: true, enemies: false };
  private centres = new Map<string, Point>();
  private centre: Point = { x: 0, y: 0, name: '' };
  private plane = 'Overworld';
  private zoom = 8;
  private chart: HTMLCanvasElement | null = null;
  private readout: HTMLElement | null = null;
  private waypointList: HTMLElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  constructor(private d: P34Deps) {
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
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden)
      this.save(); });
  }
  onWelcome(): void {
    const key = `eigen.atlas:${this.d.identity?.() ?? 'local'}:${this.d.store().seed}`;
    if (key === this.key)
      return;
    this.save();
    this.key = key;
    this.journal = new Exploration();
    this.cache.clear();
    this.landmarks.clear();
    this.waypoints = [];
    this.centres.clear();
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (v?.v === 1) {
        if (typeof v.chart === 'string')
          this.journal.restore(v.chart);
        if (Array.isArray(v.waypoints))
          this.waypoints = v.waypoints.filter(point).slice(-32).map((p: Point) => ({ ...p, name: p.name.slice(0, 32) }));
        if (Array.isArray(v.landmarks))
          for (const p of v.landmarks.slice(-256))
            if (point(p) && 'sub' in p && typeof p.sub === 'string' && known.has(p.sub))
              this.landmarks.set(`${Math.floor(p.x)},${Math.floor(p.y)}`, { ...p, name: p.name.slice(0, 64), sub: p.sub, shrine: 'shrine' in p && typeof p.shrine === 'string' ? p.shrine : undefined });
        if (Array.isArray(v.centres))
          for (const p of v.centres.filter(point))
            this.centres.set(planeOf(p.y), p);
        for (const key of Object.keys(this.filters) as (keyof typeof this.filters)[])
          if (typeof v.filters?.[key] === 'boolean')
            this.filters[key] = v.filters[key];
        this.showMini = v.showMini !== false;
        if ([112, 144, 176].includes(v.size))
          this.size = v.size;
      }
    }
    catch { /* private/corrupt storage leaves a usable empty chart */ }
    this.saved = this.journal.revision;
    this.last = -Infinity;
  }
  forgetAll(): void { try {
    const prefix = `eigen.atlas:${this.d.identity?.() ?? 'local'}:`;
    for (const key of Object.keys(localStorage))
      if (key.startsWith(prefix))
        localStorage.removeItem(key);
  }
  catch { /* storage may be unavailable */ } this.key = ''; }
  setSolved(ids: string[]): void { this.solved = new Set(ids); }
  onState(s: any): void { this.state = s; }
  action(a: string): boolean { if (a !== 'map')
    return false; this.toggle(); return true; }
  private save(): void {
    if (!this.key || !this.changed && this.saved === this.journal.revision)
      return;
    try {
      localStorage.setItem(this.key, JSON.stringify({ v: 1, chart: this.journal.serialize(), waypoints: this.waypoints, landmarks: [...this.landmarks.values()], centres: [...this.centres.values()], showMini: this.showMini, size: this.size, filters: this.filters }));
      this.changed = false;
      this.saved = this.journal.revision;
    }
    catch {
      if (!this.warned) {
        this.warned = true;
        this.d.toasts.add('Chart storage is unavailable or full. Exploration still works for this visit.', 'info');
      }
    }
  }
  frame(now: number): void {
    if (now - this.last < 250 || !this.key)
      return;
    this.last = now;
    const me = this.d.me();
    if (!me)
      return;
    const plane = planeOf(me.y);
    this.journal.visit(this.d.store(), me.x, me.y);
    this.centres.set(plane, { x: me.x, y: me.y, name: plane });
    for (const o of this.d.store().objects.values())
      if (known.has(o.sub) && this.journal.tile(o.x, o.y) !== undefined) {
        const key = `${o.x},${o.y}`;
        if (!this.landmarks.has(key)) {
          this.landmarks.set(key, { x: o.x + .5, y: o.y + .5, name: known.get(o.sub)!, sub: o.sub, shrine: typeof o.data?.shrine === 'string' ? o.data.shrine : undefined });
          this.changed = true;
        }
      }
    while (this.landmarks.size > 256)
      this.landmarks.delete(this.landmarks.keys().next().value!);
    const mapKey = this.d.keys().map[0], text = mapKey ? keyLabel(mapKey) : 'Map';
    this.label.textContent = `Atlas · ${text}`;
    this.binding.textContent = mapKey ? text : '';
    this.button.title = `World atlas${mapKey ? ` (${text})` : ''}`;
    this.mini.hidden = !this.showMini;
    if (this.showMini)
      this.draw(this.small, { x: me.x, y: me.y, name: '' }, 3.5, plane);
    if (this.d.wins.name === 'atlas' && this.chart) {
      this.draw(this.chart, this.centre, this.zoom, this.plane);
      if (this.readout)
        this.readout.textContent = `${this.plane} · ${Math.floor(this.centre.x)}, ${Math.floor(chartY(this.centre.y))} · ${this.journal.chunks.size} chart pages`;
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
    if (!me)
      return;
    this.plane = planeOf(me.y);
    this.centre = { ...me, name: '' };
    const root = h('div', { class: 'atlas' }), tools = h('div', { class: 'atlas-tools' }), nav = h('div', { class: 'atlas-nav' });
    const layer = h('select');
    layer.setAttribute('aria-label', 'Map layer');
    for (const name of ['Overworld', 'Undercroft', 'Upper rooms', 'Submerged sanctuaries'])
      layer.append(h('option', { value: name, text: name }));
    layer.value = this.plane;
    layer.onchange = () => { this.plane = layer.value; this.centre = this.centres.get(this.plane) ?? { x: 0, y: 0, name: '' }; };
    const act = (text: string, fn: () => void) => h('button', { type: 'button', text, on: { click: fn } });
    tools.append(layer, act('− Zoom', () => this.zoom = Math.max(.5, this.zoom / 1.5)), act('+ Zoom', () => this.zoom = Math.min(16, this.zoom * 1.5)), act('Centre on me', () => { const p = this.d.me(); if (p) {
      this.plane = planeOf(p.y);
      layer.value = this.plane;
      this.centre = { ...p, name: '' };
    } }));
    const places = h('select');
    places.setAttribute('aria-label', 'Charted location');
    places.append(h('option', { value: '', text: 'Find a charted location' }));
    const locations: Point[] = [...townsFor(this.d.store().seed).map(t => ({ x: t.cx, y: t.cy, name: t.name })), ...[...this.landmarks.values()].filter(p => !p.shrine || !this.solved.has(p.shrine))].filter(p => this.journal.tile(p.x, p.y) !== undefined);
    locations.forEach((p, i) => places.append(h('option', { value: String(i), text: `${p.name} · ${planeOf(p.y)}` })));
    places.onchange = () => { const p = locations[Number(places.value)]; if (places.value && p) {
      this.centre = p;
      this.plane = planeOf(p.y);
      layer.value = this.plane;
    } };
    tools.append(places);
    const mini = act(this.showMini ? 'Hide minimap' : 'Show minimap', () => { this.showMini = !this.showMini; mini.textContent = this.showMini ? 'Hide minimap' : 'Show minimap'; this.changed = true; this.save(); });
    const size = h('select');
    size.setAttribute('aria-label', 'Minimap size');
    for (const n of [112, 144, 176])
      size.append(h('option', { value: String(n), text: `${n}px minimap` }));
    size.value = String(this.size);
    size.onchange = () => { this.size = Number(size.value); this.changed = true; this.save(); };
    tools.append(mini, size);
    const filters = h('div', { class: 'atlas-filters' });
    for (const [key, text] of Object.entries({ locations: 'Locations', players: 'Travellers', npcs: 'Villagers', enemies: 'Enemies' })) {
      const input = h('input', { type: 'checkbox' });
      input.checked = this.filters[key as keyof typeof this.filters];
      input.onchange = () => { this.filters[key as keyof typeof this.filters] = input.checked; this.changed = true; this.save(); };
      filters.append(h('label', {}, input, text));
    }
    this.chart = h('canvas', { class: 'atlas-canvas' });
    this.chart.tabIndex = 0;
    this.chart.setAttribute('aria-label', 'Exploration chart. Arrow keys pan; plus and minus zoom. Click explored ground to place a waypoint.');
    this.chart.setAttribute('role', 'img');
    let drag: {
      x: number;
      y: number;
      cx: number;
      cy: number;
      moved: boolean;
    } | null = null;
    this.chart.onpointerdown = e => { this.chart!.focus(); this.chart!.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, cx: this.centre.x, cy: this.centre.y, moved: false }; };
    this.chart.onpointermove = e => { if (!drag)
      return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved ||= Math.hypot(dx, dy) > 5; const p = unproject(dx / this.zoom * 16, dy / this.zoom * 16); this.centre = { x: drag.cx - p.x, y: drag.cy - p.y, name: '' }; };
    this.chart.onpointerup = e => { if (drag && !drag.moved) {
      const r = this.chart!.getBoundingClientRect(), p = unproject((e.clientX - r.left - r.width / 2) / this.zoom * 16, (e.clientY - r.top - r.height / 2) / this.zoom * 16);
      this.place(this.centre.x + p.x, this.centre.y + p.y);
    } drag = null; };
    this.chart.onpointercancel = () => { drag = null; };
    this.chart.onwheel = e => { e.preventDefault(); this.zoom = Math.max(.5, Math.min(16, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); };
    const pan = (x: number, y: number) => { const p = unproject(x * 16 / this.zoom, y * 16 / this.zoom); this.centre = { x: this.centre.x + p.x, y: this.centre.y + p.y, name: '' }; };
    this.chart.onkeydown = e => { const moves: Record<string, number[]> = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }; if (moves[e.key]) {
      e.preventDefault();
      pan(moves[e.key]![0]!, moves[e.key]![1]!);
    } if (['+', '=', '-'].includes(e.key)) {
      e.preventDefault();
      this.zoom = Math.max(.5, Math.min(16, this.zoom * (e.key === '-' ? 1 / 1.5 : 1.5)));
    } };
    nav.append(act('Pan left', () => pan(-60, 0)), act('Pan up', () => pan(0, -60)), act('Pan down', () => pan(0, 60)), act('Pan right', () => pan(60, 0)));
    this.nameInput = h('input', { type: 'text', placeholder: 'Waypoint name', maxLength: 32 });
    this.nameInput.setAttribute('aria-label', 'Waypoint name');
    nav.append(this.nameInput, act('Mark my position', () => { const p = this.d.me(); if (p)
      this.place(p.x, p.y); }));
    this.readout = h('div', { class: 'atlas-position small' });
    this.waypointList = h('div', { class: 'atlas-waypoints' });
    this.renderWaypoints();
    const legend = h('div', { class: 'atlas-legend' });
    for (const [name, color] of [['You', '#f5e5b9'], ['Traveller', '#7fe3d3'], ['Villager', '#eed093'], ['Enemy', '#ce7556'], ['Waypoint', '#df84a5'], ['Unexplored', '#10191d']])
      legend.append(h('span', {}, h('i', { class: 'atlas-key', style: `background:${color}` }), name));
    root.append(tools, filters, this.chart, this.readout, legend, nav, h('p', { class: 'atlas-note', text: 'Drag to pan. Click explored ground to mark it. Only nearby visited terrain is charted; oldest regions are replaced when local chart history is full. Waypoints remain saved on this browser.' }), this.waypointList);
    this.d.wins.show('atlas', 'World atlas', root, { wide: true, onClose: () => { this.chart = null; this.save(); } });
  }
  private place(x: number, y: number): void { if (this.journal.tile(x, y) === undefined) {
    this.d.toasts.add('Explore this ground before charting a waypoint.', 'info');
    return;
  } this.waypoints.push({ x: Math.floor(x) + .5, y: Math.floor(y) + .5, name: this.nameInput?.value.trim().slice(0, 32) || `Waypoint ${this.waypoints.length + 1}` }); if (this.waypoints.length > 32)
    this.waypoints.shift(); this.changed = true; this.save(); this.renderWaypoints(); }
  private renderWaypoints(): void { if (!this.waypointList)
    return; this.waypointList.replaceChildren(); this.waypoints.forEach((p, i) => { const visit = h('button', { text: `${p.name} · ${planeOf(p.y)}`, on: { click: () => { this.plane = planeOf(p.y); this.centre = p; const select = document.querySelector<HTMLSelectElement>('[aria-label="Map layer"]'); if (select)
        select.value = this.plane; } } }); const remove = h('button', { text: `Remove ${p.name}`, on: { click: () => { this.waypoints.splice(i, 1); this.changed = true; this.save(); this.renderWaypoints(); } } }); this.waypointList!.append(visit, remove); }); }
  private page(key: string, c: ChartChunk): HTMLCanvasElement {
    const old = this.cache.get(key);
    if (old?.chunk === c && old.revision === c.revision)
      return old.canvas;
    const canvas = old?.canvas ?? document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const n = c.tiles[x + y * 32]!;
        if (n < 0)
          continue;
        const d = TILE_DEFS[n];
        ctx.fillStyle = d?.obj === 'tree' ? PALETTE[9] : d?.obj === 'torch' ? PALETTE[22] : d?.obj === 'rock' ? PALETTE[4] : d?.obj === 'flowers' ? PALETTE[14] : colors[d?.ground ?? G.GRASS]!;
        const px = 64 + (x - y) * 2, py = x + y;
        ctx.fillRect(px - 1, py, 2, 1);
        ctx.fillRect(px - 2, py + 1, 4, 1);
      }
    this.cache.delete(key);
    this.cache.set(key, { chunk: c, revision: c.revision, canvas });
    while (this.cache.size > 512)
      this.cache.delete(this.cache.keys().next().value!);
    return canvas;
  }
  private draw(canvas: HTMLCanvasElement, centre: Point, zoom: number, plane: string): void {
    const w = canvas === this.small ? this.size : Math.max(1, Math.floor(canvas.clientWidth)), height = canvas === this.small ? this.size : Math.max(1, Math.floor(canvas.clientHeight));
    if (canvas.width !== w)
      canvas.width = w;
    if (canvas.height !== height)
      canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10191d';
    ctx.fillRect(0, 0, w, height);
    const pos = (x: number, y: number) => ({ x: w / 2 + isoX(x - centre.x, y - centre.y) / 16 * zoom, y: height / 2 + isoY(x - centre.x, y - centre.y) / 16 * zoom });
    let visible = 0;
    for (const [key, c] of this.journal.chunks) {
      if (planeOf(c.cy * 32) !== plane)
        continue;
      const p = pos(c.cx * 32, c.cy * 32);
      if (p.x + 32 * zoom < 0 || p.x - 32 * zoom > w || p.y > height || p.y + 32 * zoom < 0)
        continue;
      visible++;
      ctx.drawImage(this.page(key, c), Math.round(p.x - 32 * zoom), Math.round(p.y), 64 * zoom, 32 * zoom);
    }
    if (!visible && canvas !== this.small) {
      ctx.font = '14px monospace';
      ctx.fillStyle = '#b3c1af';
      ctx.textAlign = 'center';
      ctx.fillText('Uncharted ground — explore to record this region', w / 2, height / 2);
      ctx.textAlign = 'left';
    }
    const mark = (p: Point, color: string, label = false, shape = 'square', seen = true) => { if (planeOf(p.y) !== plane || seen && this.journal.tile(p.x, p.y) === undefined)
      return; const at = pos(p.x, p.y); if (at.x < 0 || at.x > w || at.y < 0 || at.y > height)
      return; ctx.fillStyle = color; ctx.strokeStyle = '#10191d'; ctx.lineWidth = 2; if (shape === 'ring') {
      ctx.beginPath();
      ctx.arc(at.x, at.y, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
    else if (shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(at.x, at.y - 5);
      ctx.lineTo(at.x + 5, at.y + 4);
      ctx.lineTo(at.x - 5, at.y + 4);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
    else {
      ctx.fillRect(Math.round(at.x) - 3, Math.round(at.y) - 3, 6, 6);
      ctx.strokeRect(Math.round(at.x) - 3, Math.round(at.y) - 3, 6, 6);
    } if (label && canvas !== this.small) {
      ctx.font = '11px monospace';
      ctx.lineWidth = 3;
      ctx.strokeText(p.name, at.x + 6, at.y - 5);
      ctx.fillText(p.name, at.x + 6, at.y - 5);
    } };
    if (this.filters.locations) {
      for (const t of townsFor(this.d.store().seed))
        mark({ x: t.cx, y: t.cy, name: t.name }, '#eed093', true);
      for (const p of this.landmarks.values())
        if (!p.shrine || !this.solved.has(p.shrine))
          mark(p, '#b7d6c6', true, 'ring');
    }
    for (const p of this.waypoints)
      mark(p, '#df84a5', true, 'square', false);
    for (const [group, on, color] of [['players', this.filters.players, '#7fe3d3'], ['npcs', this.filters.npcs, '#eed093'], ['enemies', this.filters.enemies, '#ce7556']] as const)
      if (on)
        this.state?.[group]?.forEach((e: any) => { if (e.id === this.d.myId() || e.hp === 0)
          return; if (group === 'enemies' && ENEMY_BY_KIND[e.kind]?.passive)
          return; mark({ x: e.x, y: e.y, name: e.name ?? (group === 'npcs' ? NPC_BY_ID[e.id]?.name : undefined) ?? ENEMY_BY_KIND[e.kind]?.name ?? 'Traveller' }, color, false, group === 'players' ? 'ring' : group === 'enemies' ? 'triangle' : 'square'); });
    const me = this.d.me();
    if (me && planeOf(me.y) === plane) {
      const p = pos(me.x, me.y), dx = isoX(me.fx, me.fy), dy = isoY(me.fx, me.fy), len = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = '#f5e5b9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + dx / len * 10, p.y + dy / len * 10);
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
  debug(): Record<string, unknown> { return { chartPages: this.journal.chunks.size, chartWaypoints: this.waypoints.length, chartLandmarks: this.landmarks.size, chartPlane: this.plane, minimap: this.showMini }; }
}
