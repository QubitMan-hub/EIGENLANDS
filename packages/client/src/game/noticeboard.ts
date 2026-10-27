import {
  bountyOf,
  caravansNear,
  compassWord,
  festivalToday,
  nextFestivalOf,
  weatherForDay,
  type FestHost,
  type Town,
  type Weather,
} from '@eigenlands/shared';

/**
 * The notice board on a town square: what the town would pin up today. The bounty on a named beast and where it was
 * last seen, the next caravan, the festival calendar and tomorrow's weather. Everything here is a pure function of
 * the seed, the day and the world clock (the same shared functions the server and the rest of the client use), so
 * the board never disagrees with what actually happens.
 */
export interface Notice {
  /** a short heading, written as the town would write it */
  head: string;
  text: string;
  /** the wanted poster stands out */
  wanted?: boolean;
}

const FORECAST: Record<Weather, string> = {
  clear: 'Fair skies. A good day for the road.',
  cloudy: 'Grey skies, but dry.',
  rain: 'Rain expected. Bring in the washing.',
  storm: 'Storm warning. Stay off the high roads.',
  snow: 'Snow is coming. Mind the passes.',
  fog: 'Fog at dawn. Travellers, keep to the road.',
};

export function boardNotices(seed: number, town: Town, host: FestHost, day: number, nowMs: number): Notice[] {
  const out: Notice[] = [];
  const b = bountyOf(seed, town, day);
  out.push(
    b
      ? {
          head: `Wanted: ${b.name}`,
          text: `Last seen to the ${b.dir}. ${b.reward} coins to whoever brings it down, shared among all who stand against it.`,
          wanted: true,
        }
      : { head: 'Bounties', text: 'No beast has troubled the town today.' },
  );

  // the nearest caravan on the roads, and whether it is here
  const cars = caravansNear(seed, town.cx, town.cy, 160, nowMs).filter((c) => !c.route.peddler);
  cars.sort((p, q) => Math.hypot(p.x - town.cx, p.y - town.cy) - Math.hypot(q.x - town.cx, q.y - town.cy));
  const c = cars[0];
  if (c) {
    const d = Math.hypot(c.x - town.cx, c.y - town.cy);
    out.push({
      head: 'Caravans',
      text:
        d < Math.max(town.x1 - town.x0, town.y1 - town.y0) / 2 + 4
          ? `${c.route.master}'s caravan is in town. Trade at the wagon.`
          : `${c.route.master}'s caravan is on the road, about ${Math.round(d / 10) * 10} paces to the ${compassWord(c.x - town.cx, c.y - town.cy)}.`,
    });
  }

  const today = festivalToday(host, day);
  if (today) out.push({ head: `Today: ${today.name}`, text: today.desc });
  else {
    const next = nextFestivalOf(host, day);
    out.push({
      head: 'Festivals',
      text: `${next.festival.name} in ${next.in} day${next.in === 1 ? '' : 's'}. ${next.festival.desc}`,
    });
  }

  out.push({ head: 'Tomorrow', text: FORECAST[weatherForDay(seed, day + 1)] });
  return out;
}

/** The parchment card shown while you stand at the board. */
export class NoticeCard {
  private el: HTMLElement | null = null;
  private key = '';

  show(title: string, notices: Notice[]): void {
    if (!this.el) {
      this.el = document.createElement('section');
      this.el.id = 'noticeboard';
      this.el.className = 'notice-card';
      this.el.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.el);
    }
    const key = title + notices.map((n) => n.head + n.text).join('|');
    if (key !== this.key) {
      this.key = key;
      this.el.replaceChildren();
      const h = document.createElement('h2');
      h.textContent = `${title} notice board`;
      this.el.appendChild(h);
      for (const n of notices) {
        const p = document.createElement('article');
        if (n.wanted) p.className = 'wanted';
        const b = document.createElement('h3');
        b.textContent = n.head;
        const t = document.createElement('p');
        t.textContent = n.text;
        p.append(b, t);
        this.el.appendChild(p);
      }
    }
    this.el.hidden = false;
  }
  hide(): void {
    if (this.el) this.el.hidden = true;
  }
}
