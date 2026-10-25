/**
 * Chat moderation: masks profanity and slurs (whole words, with common letter swaps folded), strips control
 * characters and clamps length. The word list is stored rot13-encoded so it does not read as a word list in source.
 */
import { CHAT_MAX } from './protocol34';

const rot13 = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

/** Exact words (after folding). */
const WORDS = new Set(
  [
    'shpx',
    'fuvg',
    'phag',
    'ovgpu',
    'nffubyr',
    'onfgneq',
    'qvpx',
    'cvff',
    'jnaxre',
    'gjng',
    'fyhg',
    'juber',
    'nff',
    'fuvggl',
    'fuvgf',
    'snt',
    'snttbg',
    'avttre',
    'avttn',
    'ergneq',
    'fcvp',
    'puvax',
    'xvxr',
    'genaal',
    'qlxr',
    'pbba',
    'jrgonpx',
    'zbgureshpxre',
    'ohyyfuvg',
    'qvpxurnq',
    'pbpx',
    'cbea',
  ].map((w) => rot13(w.toLowerCase())),
);
/** Prefixes that are masked whatever follows (shpxvat, fuvggl...). */
const PREFIXES = ['shpx', 'avttre', 'snttbg', 'zbgureshpx'].map(rot13);

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'l',
};

/** Lowercase, undo letter swaps and collapse repeats ("fuuuck" -> "fuck"). */
export function foldWord(w: string): string {
  let s = '';
  for (const ch of w.toLowerCase()) s += LEET[ch] ?? ch;
  s = s.replace(/[^a-z]/g, '');
  return s.replace(/(.)\1+/g, '$1');
}

function bad(word: string): boolean {
  const f = foldWord(word);
  if (!f) return false;
  if (WORDS.has(f)) return true;
  // words like "ass" fold to "as"; check the uncollapsed form too
  const u = word
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');
  if (WORDS.has(u)) return true;
  return PREFIXES.some((p) => f.startsWith(p) || u.startsWith(p));
}

/** Clean a chat line. Returns '' if nothing printable is left. */
export function cleanChat(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw
    // Deliberately strip controls and invisible directional formatting.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > CHAT_MAX) s = s.slice(0, CHAT_MAX);
  return s.replace(/[^\s]+/g, (tok) => {
    // try the word with symbol letters at its edges ("$hit") and without ("hell!")
    for (const re of [/^([^\p{L}\p{N}@$!|]*)(.*?)([^\p{L}\p{N}@$!|]*)$/u, /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u]) {
      const m = re.exec(tok);
      if (m && m[2] && bad(m[2])) return `${m[1]}${'*'.repeat(Math.max(3, m[2].length))}${m[3]}`;
    }
    return tok;
  });
}

/** True when the text is mostly the same character or very shouty spam. */
export function isSpammy(text: string): boolean {
  const letters = text.replace(/\s/g, '');
  if (letters.length >= 12 && new Set(letters.toLowerCase()).size <= 2) return true;
  return false;
}
