/**
 * The Qubitpedia: short, friendly explainers of the real ideas behind the game, unlocked as players meet them.
 * Plain words first; each entry ends with one optional "for the curious" line that names the real physics.
 */

export interface CodexEntry {
  id: string;
  title: string;
  /** what you saw in the game */
  seen: string;
  /** the real idea, in plain words */
  idea: string;
  /** optional deeper line (Expert View players) */
  curious: string;
}

export const QUBITPEDIA: CodexEntry[] = [
  {
    id: 'qubit', title: 'Orbs are qubits',
    seen: 'Each orb on your Board powers one ability and settles on one of two forms when you cast.',
    idea: 'A qubit is the quantum version of a bit. A normal bit is 0 or 1. A qubit can be a blend of both until you look at it, and then it is just one.',
    curious: 'Your orbs start in the state |0⟩, the "first form". Real quantum computers are built from many qubits like these.',
  },
  {
    id: 'superposition', title: 'Superposition (Split)',
    seen: 'After a Split, the same cast sometimes comes out one way and sometimes the other.',
    idea: 'A split qubit is in superposition: it really is both possibilities at once, not secretly one of them. Only looking (casting) makes it pick.',
    curious: 'Split is the Hadamard gate H. It turns |0⟩ into (|0⟩ + |1⟩)/√2, an even blend.',
  },
  {
    id: 'measurement', title: 'Measurement (casting and Lock-in)',
    seen: 'The form is decided at the moment you cast. A Lock-in decides it once and keeps it.',
    idea: 'Measuring a qubit forces it to choose, and after that it stays chosen. The chance of each answer comes from how much of each possibility was in the blend.',
    curious: 'This is the Born rule: the chance of an outcome is the squared size of its amplitude. A Lock-in is a mid-circuit measurement.',
  },
  {
    id: 'xgate', title: 'Flip (the X gate)',
    seen: 'Flip turns the ability into its opposite form and element.',
    idea: 'Flip swaps the two possibilities, like turning a coin over. It is the quantum NOT.',
    curious: 'X maps |0⟩ ↔ |1⟩. It is a half turn of the Bloch sphere around its x axis.',
  },
  {
    id: 'phase', title: 'Phase (Tune)',
    seen: 'Tune changes a split orb\'s colour, but does nothing to an orb that is not split.',
    idea: 'Inside a blend, each possibility carries a hidden angle called its phase. You cannot see phase directly, but it changes how blends combine later. Here it shows up as colour.',
    curious: 'Tune ¼, Tune ½ and Tune are the T, S and Z gates: phase turns of 45°, 90° and 180°. A phase on a plain |0⟩ is invisible (a "global phase").',
  },
  {
    id: 'interference', title: 'Interference',
    seen: 'Split, Tune, Split made the orb always come out as the second form.',
    idea: 'Possibilities behave like waves. When they meet again they can add up or cancel out, so a second Split can make one outcome certain, or tilt the odds.',
    curious: 'H·Z·H = X: the two paths to |0⟩ cancel. With T instead of Z you get cos²(π/8) ≈ 85% for |0⟩.',
  },
  {
    id: 'entanglement', title: 'Entanglement (Link)',
    seen: 'Linked orbs fire together, and after a Split their forms always match (or always differ).',
    idea: 'Two qubits can share one state, so that looking at one tells you about the other, however far apart they are. Neither has its own answer until one is looked at.',
    curious: 'Link is the CNOT gate. H then CNOT makes a Bell state (|00⟩ + |11⟩)/√2. An entangled orb on its own has no colour: its phase lives in the pair.',
  },
  {
    id: 'decoherence', title: 'Noise and decoherence',
    seen: 'Big boards sometimes misfire: the other form comes out, in wild Flux colours.',
    idea: 'Qubits are fragile. Every operation has a small chance to go wrong, and errors pile up as circuits grow. This is the biggest challenge in real quantum computers.',
    curious: 'The game models a bit-flip channel: each gate adds a small chance that the qubit is flipped by the environment.',
  },
  {
    id: 'correction', title: 'Error Correction runes',
    seen: 'A rune makes an orb much steadier.',
    idea: 'You can protect information by copying it out several times and taking a vote. If only one copy slips, the vote still gets it right.',
    curious: 'A rune is a repetition code: 3 copies (or 5 with two runes) and majority vote. A slip chance p becomes 3p² − 2p³, much smaller when p is small. Real quantum codes are cleverer because qubits cannot simply be copied.',
  },
  {
    id: 'bloch', title: 'The colour wheel (Bloch sphere)',
    seen: 'Expert View shows each orb as a point with a direction and a colour.',
    idea: 'Any single qubit can be drawn as a point on a ball. Top and bottom are the two forms; the direction around the middle is the phase, which the game shows as colour.',
    curious: 'The colour you see is the azimuth of the Bloch vector, read from the qubit\'s reduced density matrix.',
  },
  {
    id: 'nocloning', title: 'No copying',
    seen: 'Rune-protected orbs vote between copies of their result, not copies of the orb itself.',
    idea: 'An unknown quantum state cannot be copied perfectly. This is why legendary items in Eigenlands are one of a kind.',
    curious: 'This is the no-cloning theorem. Quantum error correction gets around it by spreading information across entangled qubits instead of copying.',
  },
];

export const CODEX_BY_ID: Record<string, CodexEntry> = Object.fromEntries(QUBITPEDIA.map((e) => [e.id, e]));
export const isCodexId = (v: unknown): v is string => typeof v === 'string' && v in CODEX_BY_ID;
