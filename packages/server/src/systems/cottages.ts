/**
 * The families in the crown's new cottages (shared/src/growth.ts). Walk up to one in front of their door and talk:
 * they say who they are, what they do and how the kingdom is faring, and once a day they press a little of their work
 * on you (a loaf, some eggs, a skein of wool).
 */
import {
  ITEMS,
  cottageFamily,
  cottagePlot,
  cottageTalk,
  cottagerOf,
  isCivOwner,
  type DialogueMsg,
} from '@eigenlands/shared';
import { civOf } from '../features/civ/registry';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { giveStacks } from './helpers';

/** how close you must stand to the family by their door */
export const COTTAGE_TALK_RANGE = 8;

export function cottageDialogue(room: RoomApi, p: ServerPlayer, id: string): DialogueMsg | null {
  const plot = cottagePlot(room.seed, id);
  if (!plot || !isCivOwner(room.store.structureAt(plot.x, plot.y)?.owner)) return null;
  const at = cottagerOf(plot.x, plot.y);
  if (Math.hypot(at.x - p.sim.x, at.y - p.sim.y) > COTTAGE_TALK_RANGE) return null;
  const f = cottageFamily(plot.x, plot.y, plot.site.realm);
  const k = civOf(room.seed)?.kingdoms[plot.site.realm];
  const day = room.wclock.day();
  const visits = p.data.prog.cottages ?? [];
  const mine = visits.filter((v) => v.startsWith(`${id}:`));
  const pages = cottageTalk(f, day, {
    weather: room.wclock.weather(),
    prosperity: k?.prosperity ?? 55,
    atWar: (k?.wars.length ?? 0) > 0,
    first: !mine.length,
  });
  if (!mine.some((v) => v === `${id}:${day}`)) {
    const name = ITEMS[f.gift.id]?.name.toLowerCase() ?? f.gift.id;
    if (giveStacks(p, [f.gift])) {
      p.data.prog.cottages = [...visits.filter((v) => !v.startsWith(`${id}:`)), `${id}:${day}`].slice(-40);
      p.dirty('stats');
      pages.push(`${f.members[1]} presses something into your hands: ${f.gift.n} ${name}. "For the road. Come again!"`);
    } else pages.push(`"We'd give you some ${name}, but your pack is full! Come back when you have room."`);
  }
  return {
    npcId: id,
    name: `The ${f.surname} family`,
    title: f.trade[0]!.toUpperCase() + f.trade.slice(1),
    text: pages[0]!,
    pages: pages.slice(1),
    hearts: 0,
    pts: 0,
    doing: 'at home',
    canShop: false,
    canGift: false,
    canChat: false,
    teaches: [],
    mood: 'happy',
  };
}
