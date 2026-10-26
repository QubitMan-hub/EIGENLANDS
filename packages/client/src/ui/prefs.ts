/** Per-player UI preferences kept in the browser: favourite recipes and the recipes whose ingredients are tracked. */
const KEY = 'eigenlands.craft.v1';
interface Data {
  fav: string[];
  track: string[];
}
const empty = (): Data => ({ fav: [], track: [] });

function load(): Data {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Data> | null;
    return {
      fav: Array.isArray(raw?.fav) ? raw!.fav.filter((x): x is string => typeof x === 'string').slice(0, 500) : [],
      track: Array.isArray(raw?.track) ? raw!.track.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    };
  } catch {
    return empty();
  }
}
function save(d: Data): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // private windows and blocked storage: the choices simply do not persist
  }
}

export class Prefs {
  private d = load();
  isFav(id: string): boolean {
    return this.d.fav.includes(id);
  }
  toggleFav(id: string): void {
    this.d.fav = this.isFav(id) ? this.d.fav.filter((x) => x !== id) : [...this.d.fav, id];
    save(this.d);
  }
  tracked(): string[] {
    return [...this.d.track];
  }
  toggleTrack(id: string): void {
    this.d.track = this.d.track.includes(id) ? this.d.track.filter((x) => x !== id) : [...this.d.track.slice(-7), id];
    save(this.d);
  }
}
