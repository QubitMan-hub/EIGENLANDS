import { KINGDOMS } from './kingdoms';
import { ITEMS } from './items';
import { REALM_IDS, type RealmId } from './realms';
import { REALM_BEAST, ENEMY_DEFS } from './combat';
import { realmDishes } from './realm-npcs';
import type { QuestDef } from './quests';

/**
 * Each kingdom's quest chain (world revision 5): an audience at court, a trade errand, a hunt for the realm's mythical
 * beast and a festival invitation. Standing is earned with the kingdom (`rewards.rep`); givers are the ruler, a
 * councillor and the capital's commander.
 */
export function realmQuests(): QuestDef[] {
  const out: QuestDef[] = [];
  for (const id of REALM_IDS) out.push(...chain(id));
  return out;
}

function chain(r: RealmId): QuestDef[] {
  const k = KINGDOMS[r];
  const ruler = `${r}_${k.ruler.id}`;
  const court = k.court.map((c) => `${r}_${c.id}`);
  const cap = `${r}_capital`;
  const beast = REALM_BEAST[r];
  const beastDef = ENEMY_DEFS[beast];
  const goods = k.economy.exports.filter((x) => ITEMS[x]).slice(0, 2);
  const [dish] = realmDishes(r);
  const e = (id: string) => (ITEMS[id] ? id : 'wood');
  return [
    {
      id: `${r}_audience`,
      giver: ruler,
      realm: r,
      title: `An Audience in ${k.capital}`,
      summary: `Present yourself to the people of ${k.capital}: the commander, an innkeeper and a scholar.`,
      where: `${k.ruler.name}, ${k.capital}`,
      objectives: [
        { type: 'talk', target: `${cap}_commander`, n: 1, label: 'Speak to the commander of the guard' },
        { type: 'talk', target: `${cap}_innkeeper`, n: 1, label: 'Speak to the innkeeper' },
        { type: 'talk', target: `${cap}_scholar`, n: 1, label: 'Speak to the scholar' },
      ],
      rewards: { coins: 80, friend: 20, xp: 40, rep: 40 },
      lines: {
        offer: `${k.ruler.trait} Walk my halls, listen to my people, then tell me what ${k.name} is.`,
        progress: 'The commander, the innkeeper and the scholar know more than the throne ever will.',
        done: `${k.motto} You listen well, traveller.`,
      },
    },
    {
      id: `${r}_trade`,
      giver: court[0]!,
      realm: r,
      title: `The Trade of ${k.name}`,
      summary: `${k.economy.trade} Bring goods the realm values.`,
      where: `${k.court[0]!.name}, ${k.capital}`,
      requires: [`${r}_audience`],
      objectives: goods.map((g) => ({
        type: 'deliver' as const,
        target: e(g),
        n: 6,
        label: `Deliver 6 ${ITEMS[g]!.name}`,
      })),
      rewards: { coins: 160, xp: 60, rep: 80, items: [{ id: 'healing_herb', n: 3 }] },
      lines: {
        offer: `${k.court[0]!.agenda} Prove the roads between us are worth keeping.`,
        progress: 'The ledgers are open and my patience is not endless.',
        done: 'Fair goods, fairly delivered. The treasury remembers.',
      },
    },
    {
      id: `${r}_hunt`,
      giver: `${cap}_commander`,
      realm: r,
      title: `Beasts of the ${k.name} Wilds`,
      summary: `The ${beastDef.name} troubles the roads beyond the walls. Bring it down.`,
      where: `Commander, ${k.capital}`,
      requires: [`${r}_trade`],
      objectives: [{ type: 'kill', target: beast, n: 2, label: `Defeat 2 ${beastDef.name}` }],
      rewards: { coins: 320, xp: 120, rep: 150, items: [{ id: 'qubit_crystal', n: 2 }] },
      lines: {
        offer: `Out in the wilds there is a ${beastDef.name}. Soldiers have bled for it. Perhaps you can do what they could not.`,
        progress: 'It prowls the open country. Keep to the high ground and watch your flanks.',
        done: 'The roads breathe easier. The realm is in your debt.',
      },
    },
    {
      id: `${r}_festival`,
      giver: ruler,
      realm: r,
      title: k.festivals[0]!.name,
      summary: `${k.festivals[0]!.desc} Learn the feast before the festival.`,
      where: `${k.ruler.name}, ${k.capital}`,
      requires: [`${r}_hunt`],
      objectives: [
        {
          type: 'deliver',
          target: e(k.festivals[0]!.feast),
          n: 1,
          label: `Bring 1 ${ITEMS[k.festivals[0]!.feast]?.name ?? 'feast dish'}`,
        },
      ],
      rewards: { coins: 240, xp: 100, rep: 120, friend: 40, ...(dish ? { recipe: dish } : {}) },
      lines: {
        offer: `The season turns and ${k.festivals[0]!.name} approaches. Bring me a dish worthy of the table.`,
        progress: `The feast is incomplete without a proper ${ITEMS[k.festivals[0]!.feast]?.name ?? 'dish'}.`,
        done: `${k.festivals[0]!.name} will be glorious, and you shall have a seat of honour.`,
      },
    },
  ];
}
