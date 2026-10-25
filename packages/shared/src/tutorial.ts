/**
 * "The Flickering Orb": the 5-minute story quest that teaches the Circuit Board without numbers or symbols.
 * Told by Lumen, a small light-sprite. Text placeholders in braces ({board}, {cast}) are replaced by the
 * client with the player's current key bindings.
 */
import type { GateId } from './circuit';

export type TutorialGoal =
  | { kind: 'open_board' }
  /** cast orb 1 `n` times while its line holds exactly these gates in order (and the board is attuned) */
  | { kind: 'casts'; pattern: GateId[]; n: number }
  /** defeat creatures with abilities */
  | { kind: 'kills'; n: number }
  | { kind: 'choose_class' }
  /** a single cast that fires two or more orbs */
  | { kind: 'link_cast' }
  /** attune a board that holds a Lock-in */
  | { kind: 'lock' };

export interface TutorialStep {
  id: string;
  title: string;
  /** Lumen's lines when the step begins */
  lines: string[];
  /** short reminder for the hint box */
  hint: string;
  goal: TutorialGoal;
  /** granted when the step begins */
  grant?: { gates?: GateId[]; qubitBonus?: number };
  /** Qubitpedia entries unlocked when the step is completed */
  codex?: string[];
  /** Lumen's line when the step is done */
  done: string;
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'wake',
    title: 'A Flicker',
    lines: [
      "Oh! You can see me? Wonderful. I'm Lumen.",
      'That flicker in your chest is an orb. Everyone here carries one, but yours has never been woken up.',
      'New to these lands? Your Journal ({journal}) has First steps to Hadamere: a practical quest covering the controls and a route to town.',
      'Move with WASD or the arrows, left-click to attack, and use {dash} to dodge. The atlas ({map}) shows your route. Village wards keep monsters out of the streets and homes.',
      'When you want to try your orb, open your Board with {board}.',
    ],
    hint: 'Open your Board ({board}).',
    goal: { kind: 'open_board' },
    done: 'There it is. One orb, one line of light. Each orb powers one ability.',
  },
  {
    id: 'split',
    title: 'Two Ways at Once',
    lines: [
      "Here, take this Split. Drag it onto your orb's line, then press Attune.",
      'Then throw your Glimmer Bolt with {cast} a few times. Watch the colour.',
    ],
    hint: 'Put Split on your orb, Attune, then cast {cast} three times.',
    goal: { kind: 'casts', pattern: ['h'], n: 3 },
    grant: { gates: ['h'] },
    codex: ['qubit', 'superposition'],
    done: 'See? Sometimes fire, sometimes frost. A split orb holds both, and only decides when you throw it.',
  },
  {
    id: 'flip',
    title: 'The Other Side',
    lines: [
      "Now try this one. It's called Flip. Take the Split off and put the Flip on instead, then Attune.",
      'Throw it once.',
    ],
    hint: 'Swap Split for Flip, Attune, cast {cast}.',
    goal: { kind: 'casts', pattern: ['x'], n: 1 },
    grant: { gates: ['x'] },
    codex: ['xgate'],
    done: 'Frost, every time. A flipped orb always shows its other side.',
  },
  {
    id: 'interfere',
    title: 'Colours That Cancel',
    lines: [
      'Here comes my favourite trick. Take another Split and a Tune.',
      'Line them up: Split, then Tune, then Split. Attune, and throw it twice.',
    ],
    hint: 'Split → Tune → Split on your orb, Attune, cast {cast} twice.',
    goal: { kind: 'casts', pattern: ['h', 'z', 'h'], n: 2 },
    grant: { gates: ['z', 'h'] },
    codex: ['phase', 'interference'],
    done: "Always frost! Two splits should make a mess, but the Tune turned one path's colour around, and the paths cancelled each other out. That's interference.",
  },
  {
    id: 'fight',
    title: 'Put It to Use',
    lines: [
      "You're ready. Set your orb up however you like and defeat three creatures with it.",
      'Slimes and hoppers wander out past the shrine.',
    ],
    hint: 'Defeat three creatures with your orb ({cast}).',
    goal: { kind: 'kills', n: 3 },
    codex: ['measurement'],
    done: 'Nicely done! Every throw, the orb settles on an answer at that very moment.',
  },
  {
    id: 'choose',
    title: 'Choose Your Path',
    lines: [
      'Your orb has woken up properly now, and a second one is stirring.',
      'Two paths suit you. A Superposer fights from two places at once. An Entangler ties friends and foes together with threads of light.',
      'Choose. You can explore the other path later in life.',
    ],
    hint: 'Choose your class on the Board.',
    goal: { kind: 'choose_class' },
    grant: { qubitBonus: 1 },
    done: 'A fine choice. Look: two orbs now, each with its own ability.',
  },
  {
    id: 'link',
    title: 'Threads Between Orbs',
    lines: [
      'Here is a Link. Put it on your first orb and stretch it to your second, then Attune.',
      'Now when you use your first orb, the second one answers too.',
    ],
    hint: 'Link orb 1 to orb 2, Attune, cast {cast}.',
    goal: { kind: 'link_cast' },
    grant: { gates: ['cx'] },
    codex: ['entanglement'],
    done: 'Both fired! Linked orbs share their fate. Split the first one before the Link and their forms will always match.',
  },
  {
    id: 'lock',
    title: 'Lock It In',
    lines: [
      'One last gift: a Lock-in. Put it on any orb and Attune.',
      'The orb decides once, right then, and keeps that answer. No more surprises, and more power.',
    ],
    hint: 'Place a Lock-in and Attune.',
    goal: { kind: 'lock' },
    grant: { gates: ['m'] },
    codex: ['decoherence', 'correction'],
    done: "You've got it. One warning: the more you pile onto an orb, the shakier it gets. Runes steady it. I've left a few gifts in your collection. The Qubitpedia on your Board explains everything we found today.",
  },
];

/** Granted when the tutorial is finished (or skipped, minus the story). */
export const TUTORIAL_REWARD = { gates: ['h', 't', 'x'] as GateId[], runes: 1, coins: 100 };
/** Gates a skipper receives so they hold everything the story would have given. */
export const TUTORIAL_SKIP_GATES: GateId[] = TUTORIAL.flatMap((s) => s.grant?.gates ?? []);
export const TUTORIAL_DONE = TUTORIAL.length;
