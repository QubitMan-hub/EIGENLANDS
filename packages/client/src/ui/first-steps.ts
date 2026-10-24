import type { Acts } from './ui';
import { keyLabel, type Action, type KeyMap } from '../input/keymap';
import { h } from './dom';
export const binding = (keys: KeyMap, action: Action): string => keys[action].map(keyLabel).join(' / ') || 'unbound — use the on-screen control';
export const controlText = (text: string, keys: KeyMap): string => text.replace(/\{(\w+)\}/g, (all, action: Action) => action in keys ? binding(keys, action) : all);
export const FIRST_STEPS: { id: keyof Acts; text: string }[] = [
  {id:'moved',text:'Walk with {up}, {left}, {down}, {right}, the arrow keys, or the left stick.'},
  {id:'attacked',text:'Left-click or press {attack} to swing. Tap for a combo; hold and release for a heavy strike. You can practise on empty ground.'},
  {id:'dashed',text:'Press {dash} to dodge. In combat, dash through a red warning just before it fills.'},
  {id:'selected',text:'Choose a quick-bar slot with 1–0, the mouse wheel, or a tap. Your starting tools are already there. Select an axe or pickaxe, then left-click a tree or rock to approach and gather until it breaks; movement or Dodge cancels.'},
  {id:'openedPack',text:'Open your pack with {inventory}. Select an item to inspect, equip or use it.'},
  {id:'openedMap',text:'Open the atlas with {map}. Track Hadamere below: its pin guides you without revealing unexplored ground.'},
  {id:'arrived',text:'Follow the tracked direction to Hadamere. Its wards protect streets, shops and homes from monsters.'},
  {id:'talked',text:'Stand beside a villager and press {interact} or Use to talk. Mayor Orla welcomes newcomers in Hadamere.'},
  {id:'quest',text:'Accept a villager quest. In this Journal, press Track quest for a direction and map pin. Talk to the giver again when ready to hand it in.'},
  {id:'journal',text:'Open your Journal with {journal}. Quests keeps your progress; Controls lists every current binding, including social and sailing actions.'},
  {id:'skillShot',text:'Press {skill} for your basic ranged skill shot. Aim with the cursor or right stick.'},
  {id:'openedCircuit',text:'Open the Circuit Board with {board}. Guides previews gate patterns; Attune saves the draft to your orbs.'},
  {id:'orbCast',text:'Close the Board and cast an orb with {ability1}, {ability2}, {ability3} or {ability4}, or tap its button. If an aiming reticle appears, aim and left-click the world to release it; press the same key again to cancel. Only awakened orbs with an ability can cast.'},
];
export function buildFirstSteps(read: () => { done: Set<string>; keys: KeyMap }, track: () => void): { el: HTMLElement; refresh(): void } {
  const title=h('h3'), next=h('p'), summary=h('summary'), list=h('ol'), details=h('details',{},summary,list);
  const el=h('section',{class:'journal-guidance first-steps'},title,next,h('button',{text:'Track Hadamere',on:{click:track}}),details);
  let previous='';
  const refresh=()=>{
    const {done,keys}=read(), signature=JSON.stringify([ [...done],keys ]);if(signature===previous)return;previous=signature;
    const completed=FIRST_STEPS.filter(s=>done.has(s.id)).length;
    title.textContent=`First steps to Hadamere · ${completed}/${FIRST_STEPS.length}`;
    next.textContent=controlText(FIRST_STEPS.find(s=>!done.has(s.id))?.text??'You know the essentials. Explore at your own pace; Controls and How to… stay here whenever you need them.',keys);
    summary.textContent='Review every step';
    list.replaceChildren(...FIRST_STEPS.map(s=>h('li',{class:done.has(s.id)?'done':''},h('b',{text:done.has(s.id)?'Done · ':'To do · '}),controlText(s.text,keys))));
  };refresh();return {el,refresh};
}
