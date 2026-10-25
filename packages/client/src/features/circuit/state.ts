import {
  CLASSES,
  TUTORIAL_DONE,
  allowedAbilities,
  emptyBoard,
  emptyGateCounts,
  qubitsForLevel,
  validBoard,
  validLocks,
  type AbilityId,
  type Board,
  type ClassId,
  type GateCounts,
  type Locks,
  type ProgressMsg,
  type TutorialProgress,
} from '@eigenlands/shared';

export type ProgressKey = keyof ProgressMsg;

/** A Wanderer's board before the server has said anything: one orb holding Glimmer Bolt. */
export function starterBoard(): Board {
  const b = emptyBoard();
  b.abilities[0] = 'glimmer';
  return b;
}

/** Client mirror of the private PROGRESS message (partial updates merge in; the first one is complete). */
export class Progress {
  cls: ClassId = 'wanderer';
  spec: string | null = null;
  second: ClassId | null = null;
  board: Board = starterBoard();
  locks: Locks = {};
  gates: GateCounts = emptyGateCounts();
  runes = 0;
  qubits = 1;
  codex: string[] = [];
  tutorial: TutorialProgress = { step: 0, count: 0, skipped: false };
  attuneReady = 0;
  cd: Partial<Record<AbilityId | 'ult', number>> = {};
  /** true once the server has sent the first (complete) PROGRESS */
  loaded = false;
  private listeners = new Set<(changed: Set<ProgressKey>, prev: Progress) => void>();

  onChange(fn: (changed: Set<ProgressKey>, prev: Progress) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): Progress {
    const p = new Progress();
    Object.assign(p, {
      ...this,
      listeners: new Set(),
      tutorial: { ...this.tutorial },
      cd: { ...this.cd },
      gates: { ...this.gates },
      codex: [...this.codex],
    });
    return p;
  }

  apply(m: ProgressMsg): Set<ProgressKey> {
    const prev = this.snapshot();
    const changed = new Set<ProgressKey>();
    if (m.cls && m.cls in CLASSES) {
      this.cls = m.cls;
      changed.add('cls');
    }
    if (m.spec !== undefined) {
      this.spec = m.spec;
      changed.add('spec');
    }
    if (m.second !== undefined) {
      this.second = m.second;
      changed.add('second');
    }
    if (m.board) {
      this.board = validBoard(m.board);
      changed.add('board');
    }
    if (m.locks) {
      this.locks = validLocks(m.locks);
      changed.add('locks');
    }
    if (m.gates) {
      this.gates = { ...emptyGateCounts(), ...m.gates };
      changed.add('gates');
    }
    if (m.runes !== undefined) {
      this.runes = m.runes;
      changed.add('runes');
    }
    if (m.qubits !== undefined) {
      this.qubits = Math.max(1, m.qubits);
      changed.add('qubits');
    }
    if (m.codex) {
      this.codex = [...m.codex];
      changed.add('codex');
    }
    if (m.tutorial) {
      this.tutorial = { ...m.tutorial };
      changed.add('tutorial');
    }
    if (m.attuneReady !== undefined) {
      this.attuneReady = m.attuneReady;
      changed.add('attuneReady');
    }
    if (m.cd) {
      this.cd = { ...this.cd, ...m.cd };
      changed.add('cd');
    }
    this.loaded = true;
    for (const l of this.listeners) l(changed, prev);
    return changed;
  }

  allowed(): AbilityId[] {
    return allowedAbilities(this.cls, this.second);
  }
  get tutorialActive(): boolean {
    return this.loaded && !this.tutorial.skipped && this.tutorial.step < TUTORIAL_DONE;
  }
  get tutorialDone(): boolean {
    return this.tutorial.step >= TUTORIAL_DONE;
  }
  /** Orbs shown as unlocked; before the server answers, what the level alone allows. */
  qubitsFor(level: number): number {
    return this.loaded ? this.qubits : qubitsForLevel(level);
  }
}
